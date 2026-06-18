import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import Return from '../models/Return.js';
import WarehouseStock from '../models/WarehouseStock.js';
import Customer from '../models/Customer.js';
import { addLedgerEntry } from './customerRoutes.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { productLabel, productPrice, productStock, productStockSet, serializeProduct } from '../utils/productLegacy.js';

const router = express.Router();
router.use(requireAuth);

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function parseDateFilter(value, endOfDay = false) {
  const dateValue = String(value || '').trim();
  if (!dateValue) return null;

  if (dateOnlyPattern.test(dateValue)) {
    const [year, month, day] = dateValue.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0));
  }

  const parsed = new Date(dateValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function attachReturnSummaries(sales) {
  const saleObjects = sales.map(sale => typeof sale.toObject === 'function' ? sale.toObject() : sale);
  const saleIds = saleObjects.map(sale => sale._id);
  if (!saleIds.length) return saleObjects;

  const returnRows = await Return.aggregate([
    { $match: { sale: { $in: saleIds } } },
    {
      $group: {
        _id: { sale: '$sale', product: '$product' },
        returnedQty: { $sum: '$qty' },
        refunded: { $sum: '$amountRefunded' }
      }
    }
  ]);

  const returnsBySaleProduct = new Map();
  for (const row of returnRows) {
    returnsBySaleProduct.set(`${row._id.sale}:${row._id.product}`, row);
  }

  return saleObjects.map(sale => {
    let returnedQty = 0;
    let returnedAmount = 0;
    const items = (sale.items || []).map(item => {
      const previousReturn = returnsBySaleProduct.get(`${sale._id}:${item.product}`);
      const itemReturnedQty = previousReturn?.returnedQty || 0;
      const itemRefunded = previousReturn?.refunded || 0;
      const lineTotal = Number(item.lineTotal ?? (Number(item.price || 0) * Number(item.qty || 0) - Number(item.discount || 0)));
      returnedQty += itemReturnedQty;
      returnedAmount += itemRefunded;
      return {
        ...item,
        returnedQty: itemReturnedQty,
        refunded: itemRefunded,
        returnableQty: Math.max(0, Number(item.qty || 0) - itemReturnedQty),
        netQty: Math.max(0, Number(item.qty || 0) - itemReturnedQty),
        netLineTotal: Math.max(0, lineTotal - itemRefunded)
      };
    });
    const soldQty = items.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const netTotal = Math.max(0, Number(sale.grandTotal || 0) - returnedAmount);
    const returnStatus = returnedQty <= 0 ? 'none' : returnedQty >= soldQty ? 'returned' : 'partial';

    return {
      ...sale,
      items,
      returnedQty,
      returnedAmount,
      netTotal,
      returnStatus
    };
  });
}

router.get('/', requireRole('sales', 'admin'), async (req, res) => {
  const {
    startDate,
    endDate,
    productCode: rawProductCode,
    productName: rawProductName,
    customerName: rawCustomerName,
    receiptNo: rawReceiptNo,
    page = 1,
    limit = 50
  } = req.query;
  const productCode = String(rawProductCode || '').trim();
  const productName = String(rawProductName || '').trim();
  const customerName = String(rawCustomerName || '').trim();
  const receiptNo = String(rawReceiptNo || '').trim();
  const filter = {};
  const conditions = [];
  const productSearchActive = Boolean(productCode || productName);

  const escapeRegex = value => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  if (startDate || endDate) {
    filter.createdAt = {};
    const start = parseDateFilter(startDate);
    const end = parseDateFilter(endDate || startDate, true);
    if (start) filter.createdAt.$gte = start;
    if (end) filter.createdAt.$lte = end;
    if (!Object.keys(filter.createdAt).length) delete filter.createdAt;
  }

  if (productCode || productName) {
    const productItemFilter = {};
    if (productCode) productItemFilter.partCode = new RegExp(escapeRegex(productCode), 'i');
    if (productName) productItemFilter.partName = new RegExp(escapeRegex(productName), 'i');
    conditions.push({ items: { $elemMatch: productItemFilter } });
  }

  if (customerName) {
    const customerPattern = new RegExp(escapeRegex(customerName), 'i');
    const matchingCustomers = await Customer.find({ name: customerPattern }).select('_id').lean();
    conditions.push({
      $or: [
        { customerName: customerPattern },
        { customer: { $in: matchingCustomers.map(customer => customer._id) } }
      ]
    });
  }
  if (receiptNo) conditions.push({ receiptNo: new RegExp(escapeRegex(receiptNo), 'i') });
  if (conditions.length) filter.$and = conditions;
  if (req.user.role === 'sales') filter.soldBy = req.user._id;

  const skip = (Number(page) - 1) * Number(limit);
  const [sales, total] = await Promise.all([
    Sale.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).populate('soldBy', 'name username email').populate('customer', 'name phone currentBalance'),
    Sale.countDocuments(filter)
  ]);

  const salesWithReturns = await attachReturnSummaries(sales);
  const codePattern = productCode ? new RegExp(escapeRegex(productCode), 'i') : null;
  const namePattern = productName ? new RegExp(escapeRegex(productName), 'i') : null;
  const summarizeMatchedItems = saleItems => {
    const matchedItems = saleItems.filter(item => {
      const codeMatches = !codePattern || codePattern.test(item.partCode || '');
      const nameMatches = !namePattern || namePattern.test(item.partName || '');
      return codeMatches && nameMatches;
    });

    return {
      matchedItems,
      matchedQty: matchedItems.reduce((sum, item) => sum + Number(item.netQty ?? item.qty ?? 0), 0),
      matchedAmount: matchedItems.reduce((sum, item) => sum + Number(item.netLineTotal ?? item.lineTotal ?? (Number(item.price || 0) * Number(item.qty || 0) - Number(item.discount || 0))), 0)
    };
  };

  const items = productSearchActive
    ? salesWithReturns.map(saleObject => {
      const matched = summarizeMatchedItems(saleObject.items);
      return {
        ...saleObject,
        ...matched
      };
    })
    : salesWithReturns;

  let matchedSummary = null;
  if (productSearchActive) {
    const allMatchingSales = await Sale.find(filter).select('items').lean();
    const allMatchingSalesWithReturns = await attachReturnSummaries(allMatchingSales);
    const allMatchedItems = allMatchingSalesWithReturns.flatMap(sale => summarizeMatchedItems(sale.items || []).matchedItems);
    const productNames = [...new Set(allMatchedItems.map(item => item.partName).filter(Boolean))];
    matchedSummary = {
      productNames,
      qty: allMatchedItems.reduce((sum, item) => sum + Number(item.netQty ?? item.qty ?? 0), 0),
      amount: allMatchedItems.reduce((sum, item) => sum + Number(item.netLineTotal ?? item.lineTotal ?? (Number(item.price || 0) * Number(item.qty || 0) - Number(item.discount || 0))), 0),
      bills: allMatchingSales.length
    };
  }

  res.json({ items, total, page: Number(page), pages: Math.ceil(total / Number(limit)), matchedSummary });
});

router.get('/by-receipt/:receiptNo', requireRole('sales', 'admin'), async (req, res) => {
  try {
    const receiptNo = String(req.params.receiptNo || '').trim();
    if (!receiptNo) return res.status(400).json({ message: 'Bill number is required' });

    const sale = await Sale.findOne({ receiptNo })
      .populate('customer', 'name phone currentBalance')
      .populate('soldBy', 'name username email');
    if (!sale) return res.status(404).json({ message: 'Bill not found' });

    const [saleObject] = await attachReturnSummaries([sale]);

    res.json(saleObject);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', requireRole('sales', 'admin'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { items, customerName, customerId, paymentStatus = 'paid' } = req.body;
    if (!items?.length) throw new Error('No items selected');
    if (!['paid', 'unpaid', 'partial'].includes(paymentStatus)) throw new Error('Invalid payment status');

    const saleItems = [];
    let subtotal = 0;
    let discountTotal = 0;
    let customer = null;

    if (customerId) {
      customer = await Customer.findById(customerId).session(session);
      if (!customer) throw new Error('Customer not found');
    }

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session).lean();
      if (!product) throw new Error('Product not found');
      const productData = serializeProduct(product);
      const qty = Number(item.qty);
      const discount = Number(item.discount || 0);
      if (qty <= 0) throw new Error('Invalid quantity');

      const currentStock = productStock(product);
      const inventoryQtyUsed = Math.min(currentStock, qty);
      const warehouseQtyNeeded = qty - inventoryQtyUsed;
      let warehouseStock = null;
      let warehouseQtyUsed = 0;
      let warehouseName = '';

      if (warehouseQtyNeeded > 0) {
        if (!item.warehouseId) throw new Error(`Select a warehouse for ${productLabel(product)}. Main inventory is short by ${warehouseQtyNeeded}`);
        warehouseStock = await WarehouseStock.findOne({ warehouse: item.warehouseId, product: product._id })
          .populate('warehouse', 'name')
          .session(session);
        if (!warehouseStock || Number(warehouseStock.quantity || 0) < warehouseQtyNeeded) {
          throw new Error(`Selected warehouse does not have enough stock for ${productLabel(product)}`);
        }
        warehouseQtyUsed = warehouseQtyNeeded;
        warehouseName = warehouseStock.warehouse?.name || '';
      }

      const price = Number(item.price ?? productPrice(product));
      const gross = price * qty;
      const lineTotal = Math.max(0, gross - discount);
      subtotal += gross;
      discountTotal += discount;
      if (inventoryQtyUsed > 0) {
        await Product.collection.updateOne(
          { _id: product._id },
          { $set: productStockSet(currentStock - inventoryQtyUsed) },
          { session }
        );
      }

      if (warehouseStock && warehouseQtyUsed > 0) {
        warehouseStock.quantity -= warehouseQtyUsed;
        await warehouseStock.save({ session });
      }

      saleItems.push({
        product: product._id,
        partName: productData.partName,
        partCode: productData.partCode,
        model: productData.type || productData.model,
        qty,
        price,
        discount,
        inventoryQtyUsed,
        warehouseQtyUsed,
        warehouse: warehouseStock?.warehouse?._id,
        warehouseName,
        lineTotal
      });
    }

    const grandTotal = subtotal - discountTotal;
    const requestedPaidAmount = Number(req.body.paidAmount || 0);
    let paidAmount = paymentStatus === 'paid' ? grandTotal : 0;
    if (paymentStatus === 'partial') {
      if (requestedPaidAmount <= 0 || requestedPaidAmount >= grandTotal) throw new Error('Partial payment must be greater than zero and less than the total');
      paidAmount = requestedPaidAmount;
    }
    const dueAmount = Math.max(0, grandTotal - paidAmount);
    if (dueAmount > 0 && !customer) throw new Error('Select an existing customer before adding unpaid balance');

    const receiptNo = `R-${Date.now()}`;
    const [sale] = await Sale.create([{
      receiptNo,
      items: saleItems,
      subtotal,
      discountTotal,
      grandTotal,
      customer: customer?._id,
      customerName: customer?.name || customerName || 'Walk-in Customer',
      paymentStatus,
      paidAmount,
      dueAmount,
      soldBy: req.user._id
    }], { session });

    if (customer) {
      await addLedgerEntry({
        customer,
        type: 'sale',
        sale: sale._id,
        description: `Sale bill ${receiptNo}`,
        debit: grandTotal,
        credit: paidAmount,
        userId: req.user._id,
        session
      });
    }

    await session.commitTransaction();
    req.app.get('io').emit('inventory:bulk-update');
    res.status(201).json({
      ...sale.toObject(),
      soldBy: {
        _id: req.user._id,
        name: req.user.name,
        username: req.user.username
      }
    });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

export default router;
