import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import Return from '../models/Return.js';
import Customer from '../models/Customer.js';
import { addLedgerEntry } from './customerRoutes.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('admin'), async (req, res) => {
  const { startDate, endDate, productCode, productName, page = 1, limit = 50 } = req.query;
  const filter = {};
  
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (productCode || productName) {
    filter.$or = [];
    if (productCode) filter.$or.push({ 'items.partCode': new RegExp(productCode, 'i') });
    if (productName) filter.$or.push({ 'items.partName': new RegExp(productName, 'i') });
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [sales, total] = await Promise.all([
    Sale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('soldBy', 'name email').populate('customer', 'name phone currentBalance'),
    Sale.countDocuments(filter)
  ]);
  res.json({ items: sales, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

router.get('/by-receipt/:receiptNo', requireRole('sales', 'admin'), async (req, res) => {
  try {
    const receiptNo = String(req.params.receiptNo || '').trim();
    if (!receiptNo) return res.status(400).json({ message: 'Bill number is required' });

    const sale = await Sale.findOne({ receiptNo })
      .populate('customer', 'name phone currentBalance')
      .populate('soldBy', 'name email');
    if (!sale) return res.status(404).json({ message: 'Bill not found' });

    const returns = await Return.aggregate([
      { $match: { sale: sale._id } },
      { $group: { _id: '$product', returnedQty: { $sum: '$qty' }, refunded: { $sum: '$amountRefunded' } } }
    ]);
    const returnedByProduct = new Map(returns.map(item => [String(item._id), item]));
    const saleObject = sale.toObject();

    saleObject.items = saleObject.items.map(item => {
      const previousReturn = returnedByProduct.get(String(item.product));
      const returnedQty = previousReturn?.returnedQty || 0;
      return {
        ...item,
        returnedQty,
        refunded: previousReturn?.refunded || 0,
        returnableQty: Math.max(0, Number(item.qty || 0) - returnedQty)
      };
    });

    res.json(saleObject);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', requireRole('sales', 'admin'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, customerName, customerId, paymentStatus = 'paid' } = req.body;
    if (!items?.length) throw new Error('No items selected');
    if (!['paid', 'unpaid', 'partial'].includes(paymentStatus)) throw new Error('Invalid payment status');

    const saleItems = [];
    let subtotal = 0;
    let discountTotal = 0;
    let customer = null;

    if (customerId) {
      customer = await Customer.findById(customerId).session(session);
      if (!customer) throw new Error('Customer not found');
    }

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error('Product not found');
      const qty = Number(item.qty);
      const discount = Number(item.discount || 0);
      if (qty <= 0) throw new Error('Invalid quantity');
      if (product.quantity < qty) throw new Error(`Not enough stock for ${product.partCode}`);
      const price = Number(item.price ?? product.mrp);
      const gross = price * qty;
      const lineTotal = Math.max(0, gross - discount);
      subtotal += gross;
      discountTotal += discount;
      product.quantity -= qty;
      await product.save({ session });
      saleItems.push({ product: product._id, partName: product.partName, partCode: product.partCode, model: product.model, qty, price, discount, lineTotal });
    }

    const grandTotal = subtotal - discountTotal;
    const requestedPaidAmount = Number(req.body.paidAmount || 0);
    let paidAmount = paymentStatus === 'paid' ? grandTotal : 0;
    if (paymentStatus === 'partial') {
      if (requestedPaidAmount <= 0 || requestedPaidAmount >= grandTotal) throw new Error('Partial payment must be greater than zero and less than the total');
      paidAmount = requestedPaidAmount;
    }
    const dueAmount = Math.max(0, grandTotal - paidAmount);
    if (dueAmount > 0 && !customer) throw new Error('Select an existing customer before adding unpaid balance');

    const receiptNo = `R-${Date.now()}`;
    const [sale] = await Sale.create([{
      receiptNo,
      items: saleItems,
      subtotal,
      discountTotal,
      grandTotal,
      customer: customer?._id,
      customerName: customer?.name || customerName || 'Walk-in Customer',
      paymentStatus,
      paidAmount,
      dueAmount,
      soldBy: req.user._id
    }], { session });

    if (customer) {
      await addLedgerEntry({
        customer,
        type: 'sale',
        sale: sale._id,
        description: `Sale bill ${receiptNo}`,
        debit: grandTotal,
        credit: paidAmount,
        userId: req.user._id,
        session
      });
    }

    await session.commitTransaction();
    req.app.get('io').emit('inventory:bulk-update');
    res.status(201).json(sale);
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

export default router;
