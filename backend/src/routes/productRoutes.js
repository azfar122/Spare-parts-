import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import WarehouseStock from '../models/WarehouseStock.js';
import Warehouse from '../models/Warehouse.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

function normalizeProductPayload(body) {
  const payload = {
    partName: String(body.partName || '').trim(),
    partCode: String(body.partCode || '').trim(),
    model: String(body.model || 'COMMON').trim() || 'COMMON',
    bookingPrice: Number(body.bookingPrice || 0),
    mrp: Number(body.mrp || 0),
    minOrderQty: Number(body.minOrderQty || 1),
    quantity: Number(body.quantity || 0),
    description: String(body.description || '').trim()
  };

  if (!payload.partName) throw new Error('Part name is required');
  if (!payload.model) throw new Error('Model is required');
  if (!payload.partCode) throw new Error('Part code is required');
  if (!Number.isFinite(payload.mrp) || payload.mrp < 0) throw new Error('MRP must be a valid amount');
  if (!Number.isInteger(payload.quantity) || payload.quantity < 0) throw new Error('Quantity must be a whole number');
  if (!Number.isFinite(payload.bookingPrice) || payload.bookingPrice < 0) throw new Error('Booking price must be a valid amount');
  if (!Number.isInteger(payload.minOrderQty) || payload.minOrderQty < 1) throw new Error('Minimum order quantity must be at least 1');

  return payload;
}

function productErrorResponse(err, res) {
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    const label = field === 'partCode' ? 'Part code' : field;
    return res.status(409).json({ message: `${label} already exists` });
  }

  if (err?.name === 'ValidationError') {
    const message = Object.values(err.errors || {})[0]?.message || err.message;
    return res.status(400).json({ message });
  }

  return res.status(400).json({ message: err.message || 'Product could not be saved' });
}

router.get('/', async (req, res) => {
  const { q = '', page = 1, limit = 25, lowStock, inStock, includeWarehouseStock } = req.query;
  const filter = { active: { $ne: false } };
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
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const [product] = await Product.create([normalizeProductPayload(req.body)], { session });
    const warehouses = await Warehouse.find({ active: { $ne: false } }).session(session);

    if (warehouses.length) {
      await WarehouseStock.bulkWrite(
        warehouses.map(warehouse => ({
          updateOne: {
            filter: { warehouse: warehouse._id, product: product._id },
            update: {
              $setOnInsert: {
                warehouse: warehouse._id,
                product: product._id,
                quantity: 0,
                updatedBy: req.user._id
              }
            },
            upsert: true
          }
        })),
        { session, ordered: false }
      );
    }

    await session.commitTransaction();
    req.app.get('io').emit('inventory:update', product);
    res.status(201).json(product);
  } catch (err) {
    await session.abortTransaction();
    productErrorResponse(err, res);
  } finally {
    session.endSession();
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, normalizeProductPayload(req.body), { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    req.app.get('io').emit('inventory:update', product);
    res.json(product);
  } catch (err) {
    productErrorResponse(err, res);
  }
});

export default router;
