import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Sale from '../models/Sale.js';
import Return from '../models/Return.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { clearSalesHistory } from '../utils/clearSalesHistory.js';

const router = express.Router();
router.use(requireAuth, requireRole('admin'));
router.delete('/sales-history', async (req, res) => {
  if (req.body?.confirmation !== 'DELETE ALL SALES') return res.status(400).json({ message: 'Type DELETE ALL SALES to confirm.' });
  if (typeof req.body.password !== 'string' || !req.body.password) return res.status(400).json({ message: 'Enter your admin password.' });
  const admin = await User.findById(req.user._id);
  if (!admin || !await bcrypt.compare(req.body.password, admin.passwordHash)) return res.status(403).json({ message: 'Incorrect admin password.' });
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await clearSalesHistory({ Sale, Return, LedgerEntry }, session);
    });
    res.json({ message: 'Sales and receipt history permanently cleared.', ...result });
  } catch {
    res.status(500).json({ message: 'Could not clear sales history. No changes were saved. Please try again.' });
  } finally { await session.endSession(); }
});
export default router;
