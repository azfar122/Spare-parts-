import express from 'express';
import Product from '../models/Product.js';
import Return from '../models/Return.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const returns = await Return.find()
      .populate('product', 'partName partCode')
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(returns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', requireRole('sales', 'admin'), async (req, res) => {
  try {
    const { partCode, partName, qty, reason, amountRefunded = 0 } = req.body;
    if (!qty) return res.status(400).json({ message: 'Quantity required' });
    
    let product;
    if (partCode) {
      product = await Product.findOne({ partCode });
    } else if (partName) {
      product = await Product.findOne({ partName: new RegExp(partName, 'i') });
    }
    
    if (!product) return res.status(404).json({ message: 'Product not found' });
    
    product.quantity += Number(qty);
    await product.save();
    
    const ret = await Return.create({ 
      product: product._id, 
      partName: product.partName, 
      partCode: product.partCode, 
      qty: Number(qty), 
      reason, 
      amountRefunded: Number(amountRefunded), 
      processedBy: req.user._id 
    });
    
    req.app.get('io').emit('inventory:update', product);
    res.status(201).json(ret);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
