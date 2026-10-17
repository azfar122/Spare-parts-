import { captureDailyOpening } from '../utils/dailyStock.js';
import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import StockBatch from '../models/StockBatch.js';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { productStock, productStockSet } from '../utils/productLegacy.js';
import { reconcileBatches } from '../utils/stockCost.js';

const router = express.Router();
router.use(requireAuth, requireRole('admin', 'sales'));
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const filter = { source: 'purchase' };
  const [items, total] = await Promise.all([
    StockBatch.find(filter).sort({ createdAt: -1 }).skip((page - 1) * 50).limit(50)
      .populate('product', 'partName partCode').populate('warehouse', 'name').populate('createdBy', 'name username'),
    StockBatch.countDocuments(filter)
  ]);
  res.json({ items, total, page });
});
router.post('/', async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let purchase;
    await session.withTransaction(async () => {
      const qty = Number(req.body.qty);
      const unitCost = Number(req.body.unitCost);
      if (!Number.isInteger(qty) || qty <= 0) throw new Error('Quantity must be a positive whole number');
      if (req.body.unitCost === '' || req.body.unitCost == null || !Number.isFinite(unitCost) || unitCost < 0) throw new Error('Enter a valid purchase price');
      if (!['shop', 'warehouse'].includes(req.body.destination)) throw new Error('Select a stock destination');
      let warehouse = null;
      if (req.body.destination === 'warehouse') {
        warehouse = await Warehouse.findOne({ _id: req.body.warehouseId, active: true }).session(session);
        if (!warehouse) throw new Error('Select an active warehouse');
      }
      let product;
      let isNew = false;
      if (req.body.productId) {
        product = await Product.findOne({ _id: req.body.productId, active: { $ne: false } }).session(session).lean();
        if (!product) throw new Error('Product not found');
      } else {
        const input = req.body.newProduct || {};
        const partName = String(input.partName || '').trim();
        const partCode = String(input.partCode || '').trim();
        const mrp = Number(input.mrp);
        const wholesalePrice = Number(input.wholesalePrice ?? 0);
        if (!partName || !partCode) throw new Error('Product name and part number are required');
        if (input.mrp === '' || input.mrp == null || !Number.isFinite(mrp) || mrp < 0 || !Number.isFinite(wholesalePrice) || wholesalePrice < 0) throw new Error('Enter valid retail and wholesale prices');
        if (await Product.findOne({ $or: [{ partCode }, { PartNo: partCode }, { 'Part No': partCode }] }).session(session)) throw new Error('Part number already exists. Select the existing product.');
        const [created] = await Product.create([{ partName, partCode, brand: String(input.brand || ''), bookingPrice: unitCost, mrp, wholesalePrice, quantity: 0 }], { session });
        product = created.toObject();
        isNew = true;
      }
      await captureDailyOpening(product, session, isNew);
      const stock = warehouse ? await WarehouseStock.findOne({ product: product._id, warehouse: warehouse._id }).session(session) : null;
      const current = warehouse ? Number(stock?.quantity || 0) : productStock(product);
      await reconcileBatches(product, warehouse?._id, current, session);
      // Lock the product for purchases and sales, including warehouse-only operations.
      await Product.collection.updateOne({ _id: product._id }, { $inc: { stockRevision: 1 }, ...(warehouse ? {} : { $set: productStockSet(current + qty) }) }, { session });
      if (warehouse) await WarehouseStock.findOneAndUpdate({ product: product._id, warehouse: warehouse._id }, { $inc: { quantity: qty }, $set: { updatedBy: req.user._id } }, { upsert: true, session });
      [purchase] = await StockBatch.create([{ product: product._id, warehouse: warehouse?._id || null, quantity: qty, remaining: qty, unitCost, source: 'purchase', createdBy: req.user._id }], { session });
    });
    req.app.get('io').emit('inventory:bulk-update');
    res.status(201).json(purchase);
  } catch (error) {
    res.status(400).json({ message: error.code === 11000 ? 'This part number already exists. Select the existing product.' : error.message });
  } finally { await session.endSession(); }
});
export default router;
