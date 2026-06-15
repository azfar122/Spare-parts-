import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import WarehouseStock from '../models/WarehouseStock.js';
import Warehouse from '../models/Warehouse.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { productSearchConditions, serializeProduct } from '../utils/productLegacy.js';

const router = express.Router();
router.use(requireAuth);

function normalizeProductPayload(body) {
  const mrp = Number(body.mrp || body.RP || 0);
  const bookingPrice = Number(body.bookingPrice ?? body.CCP ?? body.CP ?? body['Booking Price'] ?? mrp);
  const payload = {
    partName: String(body.partName || body.productName || body['Product name'] || body['Product Name'] || '').trim(),
    partCode: String(body.partCode || body.partNo || body.PartNo || body['Part No'] || body['Part No.'] || '').trim(),
    model: String(body.model || 'COMMON').trim() || 'COMMON',
    brand: String(body.brand || '').trim(),
    category: String(body.category || '').trim(),
    type: String(body.type || body.model || '').trim(),
    bookingPrice,
    mrp,
    minOrderQty: Number(body.minOrderQty || 1),
    quantity: Number(body.quantity || 0),
    description: String(body.description || '').trim()
  };

  if (!payload.partName) throw new Error('Part name is required');
  if (!payload.model) throw new Error('Model is required');
  if (!payload.partCode) throw new Error('Part code is required');
  if (!Number.isFinite(payload.mrp) || payload.mrp < 0) throw new Error('MRP must be a valid amount');
  if (!Number.isFinite(payload.bookingPrice) || payload.bookingPrice < 0) throw new Error('Booking price must be a valid amount');
  if (!Number.isInteger(payload.quantity) || payload.quantity < 0) throw new Error('Quantity must be a whole number');
  if (!Number.isInteger(payload.minOrderQty) || payload.minOrderQty < 1) throw new Error('Minimum order quantity must be at least 1');

  return payload;
}

function normalizeProductUpdate(body, existing = {}) {
  const partName = String(body.partName || body.productName || body['Product Name'] || existing.partName || existing['Product Name'] || '').trim();
  const partCode = String(body.partCode || body.partNo || body.PartNo || body['Part No'] || existing.partCode || existing.partNo || existing.PartNo || existing['Part No'] || '').trim();
  const brand = String(body.brand || body.Brand || existing.brand || existing.Brand || '').trim();
  const category = String(body.category || body.Category || existing.category || existing.Category || '').trim();
  const type = String(body.type || body.Type || body.model || existing.type || existing.Type || existing.model || '').trim();
  const mrp = Number(body.mrp ?? body.RP ?? existing.mrp ?? existing.RP ?? 0);
  const bookingPrice = Number(body.bookingPrice ?? body.CCP ?? body.CP ?? body['Booking Price'] ?? existing.bookingPrice ?? existing.CCP ?? existing.CP ?? mrp);
  const quantity = Number(body.quantity ?? body['Stock Qty'] ?? existing.quantity ?? existing['Stock Qty'] ?? 0);
  const minOrderQty = Number(body.minOrderQty || existing.minOrderQty || 1);

  if (!partName) throw new Error('Product name is required');
  if (!Number.isFinite(mrp) || mrp < 0) throw new Error('Retail price must be a valid amount');
  if (!Number.isFinite(bookingPrice) || bookingPrice < 0) throw new Error('Booking price must be a valid amount');
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('Quantity must be a whole number');
  if (!Number.isInteger(minOrderQty) || minOrderQty < 1) throw new Error('Minimum order quantity must be at least 1');

  const update = {
    partName,
    model: type || existing.model || 'COMMON',
    brand,
    category,
    type,
    bookingPrice,
    mrp,
    minOrderQty,
    quantity,
    description: String(body.description ?? existing.description ?? '').trim(),
    'Product Name': partName,
    Brand: brand,
    Category: category,
    Type: type,
    CCP: bookingPrice,
    CP: bookingPrice,
    RP: mrp,
    'Stock Qty': quantity
  };

  if (partCode) {
    update.partCode = partCode;
    update.PartNo = partCode;
    update['Part No'] = partCode;
  }

  return update;
}

function exactText(value) {
  return { $regex: `^${String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' };
}

function duplicateProductQuery(payload, excludeId) {
  const query = {
    active: { $ne: false },
    partName: exactText(payload.partName),
    partCode: exactText(payload.partCode),
    brand: exactText(payload.brand),
    category: exactText(payload.category),
    type: exactText(payload.type),
    mrp: payload.mrp
  };

  if (excludeId) query._id = { $ne: excludeId };

  return query;
}

function duplicateProductMessage(product) {
  const stock = Number(product?.quantity || 0).toLocaleString();
  return `This product already exists with stock ${stock}. Please increase the stock on the existing product instead of creating a new one.`;
}

function productErrorResponse(err, res) {
  if (err?.code === 11000) {
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
    const label = field === 'partCode' ? 'Part code' : field;
    return res.status(409).json({ message: `${label} already exists. Please increase the stock on the existing product instead of creating a new one.` });
  }

  if (err?.name === 'ValidationError') {
    const message = Object.values(err.errors || {})[0]?.message || err.message;
    return res.status(400).json({ message });
  }

  return res.status(err.statusCode || 400).json({ message: err.message || 'Product could not be saved' });
}

router.get('/', async (req, res) => {
  const { q = '', page = 1, limit = 25, lowStock, inStock, includeWarehouseStock } = req.query;
  const filter = { active: { $ne: false } };
  const conditions = [];
  if (q) conditions.push({ $or: productSearchConditions(q) });
  if (lowStock === 'true') conditions.push({ $or: [{ quantity: { $lte: 5 } }, { 'Stock Qty': { $lte: 5 } }] });
  if (inStock === 'true') {
    const warehouseProductIds = includeWarehouseStock === 'true'
      ? await WarehouseStock.distinct('product', { quantity: { $gt: 0 } })
      : [];
    conditions.push({
      $or: [
        { quantity: { $gt: 0 } },
        { 'Stock Qty': { $gt: 0 } },
        ...(warehouseProductIds.length ? [{ _id: { $in: warehouseProductIds } }] : [])
      ]
    });
  }
  if (conditions.length) filter.$and = conditions;
  const skip = (Number(page) - 1) * Number(limit);
  let [items, total] = await Promise.all([
    Product.find(filter).sort({ Sr: 1, partName: 1, 'Product Name': 1 }).skip(skip).limit(Number(limit)).lean(),
    Product.countDocuments(filter)
  ]);

  if (includeWarehouseStock === 'true') {
    const [warehouseTotals, warehouseRows] = await Promise.all([
      WarehouseStock.aggregate([
        { $match: { product: { $in: items.map(product => product._id) } } },
        { $group: { _id: '$product', warehouseQuantity: { $sum: '$quantity' } } }
      ]),
      WarehouseStock.find({ product: { $in: items.map(product => product._id) } })
        .populate('warehouse', 'name location active')
        .lean()
    ]);
    const warehouseQtyByProduct = new Map(warehouseTotals.map(item => [String(item._id), item.warehouseQuantity]));
    const warehouseStocksByProduct = new Map();
    for (const row of warehouseRows) {
      if (row.warehouse?.active === false) continue;
      const productId = String(row.product);
      if (!warehouseStocksByProduct.has(productId)) warehouseStocksByProduct.set(productId, []);
      warehouseStocksByProduct.get(productId).push({
        warehouseId: String(row.warehouse?._id || row.warehouse),
        warehouseName: row.warehouse?.name || '',
        quantity: Number(row.quantity || 0)
      });
    }
    items = items.map(product => ({
      ...serializeProduct(product),
      warehouseQuantity: warehouseQtyByProduct.get(String(product._id)) || 0,
      warehouseStocks: warehouseStocksByProduct.get(String(product._id)) || []
    }));
  } else {
    items = items.map(serializeProduct);
  }

  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

router.get('/:id', async (req, res) => {
  const product = await Product.findById(req.params.id).lean();
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(serializeProduct(product));
});

router.post('/', requireRole('admin'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const payload = normalizeProductPayload(req.body);
    const duplicateProduct = await Product.findOne(duplicateProductQuery(payload)).session(session).lean();
    if (duplicateProduct) {
      const err = new Error(duplicateProductMessage(duplicateProduct));
      err.statusCode = 409;
      throw err;
    }

    const [product] = await Product.create([payload], { session });
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
    res.status(201).json(serializeProduct(product));
  } catch (err) {
    await session.abortTransaction();
    productErrorResponse(err, res);
  } finally {
    session.endSession();
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const existing = await Product.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ message: 'Product not found' });
    const update = normalizeProductUpdate(req.body, existing);
    const duplicateProduct = await Product.findOne(duplicateProductQuery(update, existing._id)).lean();
    if (duplicateProduct) {
      const err = new Error(duplicateProductMessage(duplicateProduct));
      err.statusCode = 409;
      throw err;
    }

    await Product.collection.updateOne(
      { _id: existing._id },
      { $set: update }
    );
    const product = await Product.findById(req.params.id).lean();
    req.app.get('io').emit('inventory:update', serializeProduct(product));
    res.json(serializeProduct(product));
  } catch (err) {
    productErrorResponse(err, res);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    ).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    req.app.get('io').emit('inventory:bulk-update');
    res.json({ message: 'Product deleted', product: serializeProduct(product) });
  } catch (err) {
    productErrorResponse(err, res);
  }
});

export default router;
