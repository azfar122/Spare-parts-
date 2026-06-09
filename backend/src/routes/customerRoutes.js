import express from 'express';
import mongoose from 'mongoose';
import Customer from '../models/Customer.js';
import LedgerEntry from '../models/LedgerEntry.js';
import Sale from '../models/Sale.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

function parseAmount(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Amount must be zero or greater');
  return amount;
}

function normalizePhone(phone = '') {
  return String(phone || '').trim();
}

async function ensureUniquePhone(phone, currentCustomerId) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return normalizedPhone;

  const filter = { phone: normalizedPhone };
  if (currentCustomerId) filter._id = { $ne: currentCustomerId };
  const existing = await Customer.findOne(filter).select('_id name');
  if (existing) throw new Error(`Phone number already belongs to ${existing.name}`);
  return normalizedPhone;
}

async function addLedgerEntry({ customer, type, sale, description, debit = 0, credit = 0, userId, session }) {
  const nextBalance = Number(customer.currentBalance || 0) + Number(debit || 0) - Number(credit || 0);
  customer.currentBalance = nextBalance;
  await customer.save({ session });
  const [entry] = await LedgerEntry.create([{
    customer: customer._id,
    type,
    sale,
    description,
    debit,
    credit,
    balanceAfter: nextBalance,
    createdBy: userId
  }], { session });
  return entry;
}

router.get('/', requireRole('sales', 'admin'), async (req, res) => {
  const { q = '', page = 1, limit = 20 } = req.query;
  const filter = { active: { $ne: false } };
  if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }];
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip(skip).limit(Number(limit)),
    Customer.countDocuments(filter)
  ]);
  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

router.post('/', requireRole('admin'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, phone = '', address = '', notes = '', openingBalance = 0 } = req.body;
    if (!name?.trim()) throw new Error('Customer name is required');
    const parsedOpeningBalance = parseAmount(openingBalance);
    const normalizedPhone = await ensureUniquePhone(phone);
    const [customer] = await Customer.create([{
      name: name.trim(),
      phone: normalizedPhone,
      address,
      notes,
      openingBalance: parsedOpeningBalance,
      currentBalance: parsedOpeningBalance,
      createdBy: req.user._id
    }], { session });

    if (parsedOpeningBalance > 0) {
      await LedgerEntry.create([{
        customer: customer._id,
        type: 'opening',
        description: 'Opening balance',
        debit: parsedOpeningBalance,
        credit: 0,
        balanceAfter: parsedOpeningBalance,
        createdBy: req.user._id
      }], { session });
    }

    await session.commitTransaction();
    res.status(201).json(customer);
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

router.get('/:id', requireRole('sales', 'admin'), async (req, res) => {
  const customer = await Customer.findOne({ _id: req.params.id, active: { $ne: false } });
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const [ledger, sales] = await Promise.all([
    LedgerEntry.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(200).populate('sale', 'receiptNo grandTotal paidAmount dueAmount paymentStatus'),
    Sale.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(100)
  ]);
  res.json({ customer, ledger, sales });
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { name, phone = '', address = '', notes = '' } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'Customer name is required' });
  const normalizedPhone = await ensureUniquePhone(phone, req.params.id);
  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    { name: name.trim(), phone: normalizedPhone, address, notes },
    { new: true, runValidators: true }
  );
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  res.json(customer);
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const customer = await Customer.findByIdAndUpdate(
    req.params.id,
    { active: false },
    { new: true }
  );
  if (!customer) return res.status(404).json({ message: 'Customer not found' });
  res.json({ message: 'Customer deleted', customer });
});

router.post('/:id/payment', requireRole('admin'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const amount = parseAmount(req.body.amount);
    if (amount <= 0) throw new Error('Payment amount must be greater than zero');
    const customer = await Customer.findById(req.params.id).session(session);
    if (!customer) throw new Error('Customer not found');
    await addLedgerEntry({
      customer,
      type: 'payment',
      description: req.body.description || 'Payment received',
      credit: amount,
      userId: req.user._id,
      session
    });
    await session.commitTransaction();
    res.json(customer);
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

router.post('/:id/adjustment', requireRole('admin'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const amount = parseAmount(req.body.amount);
    if (amount <= 0) throw new Error('Adjustment amount must be greater than zero');
    const direction = req.body.direction === 'decrease' ? 'decrease' : 'increase';
    const customer = await Customer.findById(req.params.id).session(session);
    if (!customer) throw new Error('Customer not found');
    await addLedgerEntry({
      customer,
      type: 'adjustment',
      description: req.body.description || (direction === 'increase' ? 'Balance increased' : 'Balance decreased'),
      debit: direction === 'increase' ? amount : 0,
      credit: direction === 'decrease' ? amount : 0,
      userId: req.user._id,
      session
    });
    await session.commitTransaction();
    res.json(customer);
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

export { addLedgerEntry };
export default router;
