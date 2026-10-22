import express from 'express';
import mongoose from 'mongoose';
import HeldBill from '../models/HeldBill.js';
import Sale from '../models/Sale.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { heldBillId, heldSaleId, normalizeHeldBill, serializeHeldBill } from '../utils/heldBills.js';

const router = express.Router();
router.use(requireAuth, requireRole('sales', 'admin'));

router.get('/', async (req, res) => {
  const bills = await HeldBill.find({ owner: req.user._id }).sort({ updatedAt: -1 }).lean();
  res.json({ items: bills.map(serializeHeldBill) });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid held bill' });
  const bill = await HeldBill.findOne({ _id: req.params.id, owner: req.user._id }).lean();
  if (!bill) return res.status(404).json({ message: 'Held bill is no longer available. Refresh Held Bills.' });
  res.json(serializeHeldBill(bill));
});

async function save(req, res, create) {
  let session;
  try {
    const clientId = req.body.id;
    if (create && (typeof clientId !== 'string' || !/^[a-zA-Z0-9-]{8,100}$/.test(clientId))) throw new Error('Invalid held bill identifier');
    if (!create && !mongoose.isValidObjectId(req.params.id)) throw new Error('Invalid held bill');
    const id = create ? heldBillId(req.user._id, clientId) : req.params.id;
    const snapshot = normalizeHeldBill(req.body);
    session = await mongoose.startSession();
    const result = await session.withTransaction(async () => {
      const completed = await Sale.exists({ _id: heldSaleId(req.user._id, id), soldBy: req.user._id }).session(session);
      if (completed) return { completed: true, id };
      const filter = { _id: id, owner: req.user._id };
      // Imports are idempotent: another browser must not overwrite an existing hold.
      const update = create && req.body.importLegacy === true
        ? { $setOnInsert: { owner: req.user._id, snapshot } }
        : { $set: { snapshot }, ...(create ? { $setOnInsert: { owner: req.user._id } } : {}) };
      let bill;
      try {
        bill = await HeldBill.findOneAndUpdate(filter, update, { upsert: create, returnDocument: 'after', session });
      } catch (err) {
        if (err.code === 11000) err.addErrorLabel?.('TransientTransactionError');
        throw err;
      }
      if (!bill) { const err = new Error('Held bill is no longer available. Refresh Held Bills.'); err.status = 404; throw err; }
      return { completed: false, bill: serializeHeldBill(bill) };
    }, { timeoutMS: 15000, writeConcern: { w: 'majority' } });
    res.json(result);
  } catch (err) {
    res.status(err.status || 400).json({ message: err.message || 'Held bill could not be saved' });
  } finally {
    await session?.endSession();
  }
}

router.post('/', (req, res) => save(req, res, true));
router.put('/:id', (req, res) => save(req, res, false));
router.delete('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid held bill' });
  await HeldBill.deleteOne({ _id: req.params.id, owner: req.user._id });
  res.json({ message: 'Held bill removed' });
});

export default router;
