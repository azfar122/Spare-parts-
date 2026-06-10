import express from 'express';
import mongoose from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { productStockSet, serializeProduct } from '../utils/productLegacy.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('admin'));

async function addProductStock(productId, received, options = {}) {
  let query = Product.findById(productId).lean();
  if (options.session) query = query.session(options.session);
  const product = await query;
  if (!product) throw new Error('Product not found');
  const current = Number(serializeProduct(product).quantity || 0);
  await Product.collection.updateOne(
    { _id: product._id },
    { $set: productStockSet(current + Number(received || 0)) },
    options.session ? { session: options.session } : undefined
  );
}

async function addWarehouseStock(productId, warehouseId, received, userId, options = {}) {
  const [product, warehouse] = await Promise.all([
    Product.findById(productId).session(options.session || null),
    Warehouse.findById(warehouseId).session(options.session || null)
  ]);
  if (!product) throw new Error('Product not found');
  if (!warehouse || warehouse.active === false) throw new Error('Warehouse not found');

  const stock = await WarehouseStock.findOne({ product: product._id, warehouse: warehouse._id }).session(options.session || null);
  if (stock) {
    stock.quantity = Number(stock.quantity || 0) + Number(received || 0);
    stock.updatedBy = userId;
    await stock.save(options.session ? { session: options.session } : undefined);
  } else {
    await WarehouseStock.create([{
      product: product._id,
      warehouse: warehouse._id,
      quantity: Number(received || 0),
      updatedBy: userId
    }], options.session ? { session: options.session } : undefined);
  }
}

function temporaryPartCode(order, itemIndex) {
  const orderToken = String(order.orderNumber || order._id || Date.now()).replace(/[^a-z0-9-]/gi, '').toUpperCase();
  return `PO-${orderToken}-${Number(itemIndex) + 1}`;
}

async function findOrCreateProductForItem(item, initialMainStock = 0, fallbackPartCode = '') {
  if (item.product) return item.product;

  const partCode = String(item.partCode || fallbackPartCode || '').trim();
  if (!partCode) throw new Error('Part code is required before receiving this item into inventory');

  const existingProduct = await Product.findOne({
    $or: [{ partCode }, { PartNo: partCode }, { 'Part No': partCode }]
  });
  if (existingProduct) {
    item.product = existingProduct._id;
    return existingProduct._id;
  }

  const newProduct = await Product.create({
    partName: item.partName || `New Part - ${partCode}`,
    partCode,
    model: item.model || 'COMMON',
    brand: item.brand || '',
    type: item.model || 'COMMON',
    quantity: initialMainStock,
    mrp: 0,
    bookingPrice: 0
  });
  await Product.collection.updateOne(
    { _id: newProduct._id },
    { $set: {
      'Product Name': item.partName || `New Part - ${partCode}`,
      PartNo: partCode,
      'Part No': partCode,
      Brand: item.brand || '',
      Type: item.model || 'COMMON',
      'Stock Qty': initialMainStock,
      CCP: 0,
      CP: 0,
      RP: 0
    } }
  );
  item.partCode = partCode;
  item.product = newProduct._id;
  return newProduct._id;
}

router.get('/', async (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  
  const skip = (Number(page) - 1) * Number(limit);
  const [orders, total] = await Promise.all([
    PurchaseOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('createdBy', 'name'),
    PurchaseOrder.countDocuments(filter)
  ]);
  res.json({ items: orders, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

router.get('/:id', async (req, res) => {
  const order = await PurchaseOrder.findById(req.params.id).populate('items.product').populate('createdBy', 'name');
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json(order);
});

router.post('/', async (req, res) => {
  try {
    const { orderNumber, totalPrice, items, notes } = req.body;
    if (!orderNumber || !totalPrice || !items?.length) {
      return res.status(400).json({ message: 'Order number, total price, and items are required' });
    }
    const normalizedItems = items.map(item => ({
      product: item.product || undefined,
      partCode: String(item.partCode || '').trim(),
      partName: String(item.partName || '').trim(),
      brand: String(item.brand || '').trim(),
      model: String(item.model || 'COMMON').trim() || 'COMMON',
      qty: Number(item.qty || 0)
    }));
    const invalidItem = normalizedItems.find(item => !item.product && !item.partName);
    if (invalidItem) return res.status(400).json({ message: 'Each item needs a product name or selected inventory product' });
    
    const order = await PurchaseOrder.create({
      orderNumber: String(orderNumber).trim(),
      totalPrice: Number(totalPrice),
      items: normalizedItems,
      notes,
      createdBy: req.user._id
    });
    
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id/receive', async (req, res) => {
  try {
    const { itemIndex, receivedQty, stockDestination = 'shop', warehouseId } = req.body;
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    const item = order.items[itemIndex];
    if (!item) return res.status(400).json({ message: 'Item not found' });
    if (!['shop', 'warehouse'].includes(stockDestination)) return res.status(400).json({ message: 'Choose shop or warehouse stock destination' });
    if (stockDestination === 'warehouse' && !warehouseId) return res.status(400).json({ message: 'Select a warehouse to receive this stock' });
    
    const nextReceived = Number(receivedQty);
    const previousReceived = Number(item.received || 0);
    if (!Number.isFinite(nextReceived) || nextReceived < 0) return res.status(400).json({ message: 'Received quantity must be zero or greater' });
    if (nextReceived > Number(item.qty || 0)) return res.status(400).json({ message: 'Received quantity cannot exceed ordered quantity' });
    if (nextReceived < previousReceived) return res.status(400).json({ message: 'Received quantity cannot be reduced after stock has been added' });

    const receivedDelta = nextReceived - previousReceived;
    if (receivedDelta > 0) {
      const productId = await findOrCreateProductForItem(item, 0, temporaryPartCode(order, itemIndex));
      if (stockDestination === 'warehouse') {
        await addWarehouseStock(productId, warehouseId, receivedDelta, req.user._id);
      } else {
        await addProductStock(productId, receivedDelta);
      }
    }

    item.received = nextReceived;
    item.status = item.received >= item.qty ? 'received' : item.received > 0 ? 'partial' : 'pending';
    
    // Update order status
    const allReceived = order.items.every(i => i.status === 'received');
    const anyReceived = order.items.some(i => i.status === 'received' || i.status === 'partial');
    order.status = allReceived ? 'received' : anyReceived ? 'partial' : 'pending';
    
    await order.save();
    await order.populate('items.product');
    req.app.get('io').emit('inventory:bulk-update');
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { orderNumber, totalPrice, items, notes } = req.body;
    const order = await PurchaseOrder.findByIdAndUpdate(
      req.params.id,
      { orderNumber, totalPrice, items, notes },
      { new: true, runValidators: true }
    );
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const order = await PurchaseOrder.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
