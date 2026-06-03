import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { q = '', page = 1, limit = 25, lowStock, inStock, includeWarehouseStock } = req.query;
  const filter = { active: true };
  if (q) filter.$or = [
    { partName: new RegExp(q, 'i') },
    { partCode: new RegExp(q, 'i') },
    { model: new RegExp(q, 'i') }
  ];
  if (lowStock === 'true') filter.quantity = { $lte: 5 };
  if (inStock === 'true') filter.quantity = { $gt: 0 };
  const skip = (Number(page) - 1) * Number(limit);
  let [items, total] = await Promise.all([
    Product.find(filter).sort({ partName: 1 }).skip(skip).limit(Number(limit)),
    Product.countDocuments(filter)
  ]);

  if (includeWarehouseStock === 'true') {
    const warehouseTotals = await WarehouseStock.aggregate([
      { $match: { product: { $in: items.map(product => product._id) } } },
      { $group: { _id: '$product', warehouseQuantity: { $sum: '$quantity' } } }
    ]);
    const warehouseQtyByProduct = new Map(warehouseTotals.map(item => [String(item._id), item.warehouseQuantity]));
    items = items.map(product => ({
      ...product.toObject(),
      warehouseQuantity: warehouseQtyByProduct.get(String(product._id)) || 0
    }));
  }

  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const product = await Product.create(req.body);
  req.app.get('io').emit('inventory:update', product);
  res.status(201).json(product);
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ message: 'Product not found' });
  req.app.get('io').emit('inventory:update', product);
  res.json(product);
});

export default router;
