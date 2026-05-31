import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
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
    Sale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('soldBy', 'name email'),
    Sale.countDocuments(filter)
  ]);
  res.json({ items: sales, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

router.post('/', requireRole('sales', 'admin'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, customerName } = req.body;
    if (!items?.length) return res.status(400).json({ message: 'No items selected' });

    const saleItems = [];
    let subtotal = 0;
    let discountTotal = 0;

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

    const receiptNo = `R-${Date.now()}`;
    const [sale] = await Sale.create([{ receiptNo, items: saleItems, subtotal, discountTotal, grandTotal: subtotal - discountTotal, customerName, soldBy: req.user._id }], { session });
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
