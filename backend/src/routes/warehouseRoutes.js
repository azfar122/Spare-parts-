import express from 'express';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import Product from '../models/Product.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { productSearchConditions, serializeProduct } from '../utils/productLegacy.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('sales', 'admin'), async (req, res) => {
  const warehouses = await Warehouse.find({ active: true }).sort({ name: 1 });
  res.json(warehouses);
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { name, location = '', notes = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Warehouse name is required' });
    const warehouse = await Warehouse.create({ name: name.trim(), location, notes, createdBy: req.user._id });
    req.app.get('io').emit('inventory:bulk-update');
    res.status(201).json(warehouse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { name, location = '', notes = '' } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Warehouse name is required' });
    const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, { name: name.trim(), location, notes }, { new: true, runValidators: true });
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });
    req.app.get('io').emit('inventory:bulk-update');
    res.json(warehouse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/stock', requireRole('admin'), async (req, res) => {
  const { warehouseId, q = '', page = 1, limit = 50 } = req.query;
  const productFilter = { active: { $ne: false } };
  if (q) productFilter.$or = productSearchConditions(q);

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(productFilter).sort({ Sr: 1, partName: 1, 'Product Name': 1 }).skip(skip).limit(Number(limit)).lean(),
    Product.countDocuments(productFilter)
  ]);

  const stocks = warehouseId
    ? await WarehouseStock.find({ warehouse: warehouseId, product: { $in: products.map(p => p._id) } })
    : [];
  const stockByProduct = new Map(stocks.map(stock => [String(stock.product), stock]));
  res.json({
    items: products.map(product => ({
      product: serializeProduct(product),
      warehouseStock: stockByProduct.get(String(product._id))?.quantity || 0
    })),
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit))
  });
});

router.get('/product/:productId/stock', requireRole('sales', 'admin'), async (req, res) => {
  const stocks = await WarehouseStock.find({ product: req.params.productId, quantity: { $gt: 0 } })
    .populate('warehouse', 'name location')
    .sort({ quantity: -1 });
  res.json(stocks.filter(stock => stock.warehouse?.active !== false));
});

router.put('/:warehouseId/stock/:productId', requireRole('admin'), async (req, res) => {
  try {
    const quantity = Number(req.body.quantity || 0);
    if (!Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ message: 'Quantity must be zero or greater' });
    const [warehouse, product] = await Promise.all([
      Warehouse.findById(req.params.warehouseId),
      Product.findById(req.params.productId)
    ]);
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const stock = await WarehouseStock.findOneAndUpdate(
      { warehouse: warehouse._id, product: product._id },
      { quantity, updatedBy: req.user._id },
      { new: true, upsert: true, runValidators: true }
    ).populate('warehouse', 'name location').populate('product', 'partName partCode model brand category type bookingPrice mrp');

    req.app.get('io').emit('inventory:bulk-update');
    res.json(stock);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
