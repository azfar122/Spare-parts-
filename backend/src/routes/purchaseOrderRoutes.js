import express from 'express';
import mongoose from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Product from '../models/Product.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('admin'));

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
      return res.status(400).json({ message: 'Order number, price, and items are required' });
    }
    
    const order = await PurchaseOrder.create({
      orderNumber: String(orderNumber).trim(),
      totalPrice: Number(totalPrice),
      items,
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
    const { itemIndex, receivedQty } = req.body;
    const order = await PurchaseOrder.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    
    const item = order.items[itemIndex];
    if (!item) return res.status(400).json({ message: 'Item not found' });
    
    item.received = Number(receivedQty);
    if (item.received >= item.qty) {
      item.status = 'received';
      // Update product inventory
      if (item.product) {
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.received } });
      } else if (item.partCode) {
        // Create new product if it doesn't exist
        const existingProduct = await Product.findOne({ partCode: item.partCode });
        if (!existingProduct) {
          const newProduct = await Product.create({
            partName: item.partName || `New Part - ${item.partCode}`,
            partCode: item.partCode,
            model: item.model || 'COMMON',
            quantity: item.received,
            mrp: item.price || 0,
            bookingPrice: item.price || 0
          });
          item.product = newProduct._id;
        } else {
          await Product.findByIdAndUpdate(existingProduct._id, { $inc: { quantity: item.received } });
          item.product = existingProduct._id;
        }
      }
    } else if (item.received > 0) {
      item.status = 'partial';
      // Partial update to inventory
      if (item.product) {
        await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.received } });
      }
    }
    
    // Update order status
    const allReceived = order.items.every(i => i.status === 'received');
    const anyReceived = order.items.some(i => i.status === 'received' || i.status === 'partial');
    order.status = allReceived ? 'received' : anyReceived ? 'partial' : 'pending';
    
    await order.save();
    await order.populate('items.product');
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
