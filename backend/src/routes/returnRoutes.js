import express from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Return from '../models/Return.js';
import Sale from '../models/Sale.js';
import Customer from '../models/Customer.js';
import { addLedgerEntry } from './customerRoutes.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const returns = await Return.find()
      .populate('product', 'partName partCode')
      .populate('sale', 'receiptNo')
      .populate('customer', 'name phone currentBalance')
      .populate('processedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json(returns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', requireRole('sales', 'admin'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { receiptNo, productId, qty, reason, amountRefunded } = req.body;
    const returnItems = Array.isArray(req.body.items) && req.body.items.length
      ? req.body.items
      : [{ productId, qty, amountRefunded }];
    if (!receiptNo?.trim()) throw new Error('Bill number is required');

    const sale = await Sale.findOne({ receiptNo: String(receiptNo).trim() }).session(session);
    if (!sale) throw new Error('Bill not found');

    const normalizedItems = returnItems.map(item => ({
      productId: item.productId,
      qty: Number(item.qty || 0),
      amountRefunded: item.amountRefunded
    }));
    if (!normalizedItems.length) throw new Error('Select at least one item to return');

    const duplicateProductId = normalizedItems.find((item, index) =>
      normalizedItems.findIndex(other => String(other.productId) === String(item.productId)) !== index
    )?.productId;
    if (duplicateProductId) throw new Error('Each returned item can only be selected once');

    for (const item of normalizedItems) {
      if (!item.productId) throw new Error('Returned item is required');
      if (!Number.isFinite(item.qty) || item.qty <= 0) throw new Error('Return quantity must be greater than zero');
    }

    const previousReturns = await Return.aggregate([
      { $match: { sale: sale._id } },
      { $group: { _id: '$product', returnedQty: { $sum: '$qty' }, refunded: { $sum: '$amountRefunded' } } }
    ]).session(session);
    const previousReturnsByProduct = new Map(previousReturns.map(item => [String(item._id), item]));
    const previousRefundedForSale = previousReturns.reduce((sum, item) => sum + Number(item.refunded || 0), 0);
    const remainingBillDue = Math.max(0, Number(sale.dueAmount || 0) - previousRefundedForSale);

    let customer = null;
    if (sale.customer) {
      customer = await Customer.findById(sale.customer).session(session);
    }

    let totalRefundAmount = 0;
    const productsToEmit = [];
    const returnDocs = [];

    for (const item of normalizedItems) {
      const saleItem = sale.items.find(saleLine => String(saleLine.product) === String(item.productId));
      if (!saleItem) throw new Error('Selected item was not found in this bill');

      const alreadyReturnedQty = previousReturnsByProduct.get(String(item.productId))?.returnedQty || 0;
      const returnableQty = Number(saleItem.qty || 0) - alreadyReturnedQty;
      if (item.qty > returnableQty) throw new Error(`Only ${returnableQty} item(s) can be returned for ${saleItem.partName}`);

      const product = await Product.findById(item.productId).session(session);
      if (!product) throw new Error('Product not found');

      const calculatedRefund = (Number(saleItem.lineTotal || 0) / Number(saleItem.qty || 1)) * item.qty;
      const refundAmount = item.amountRefunded === undefined || item.amountRefunded === ''
        ? calculatedRefund
        : Number(item.amountRefunded || 0);
      if (!Number.isFinite(refundAmount) || refundAmount < 0) throw new Error('Refund amount must be zero or greater');

      product.quantity += item.qty;
      await product.save({ session });
      productsToEmit.push(product);
      totalRefundAmount += refundAmount;

      returnDocs.push({
        sale: sale._id,
        receiptNo: sale.receiptNo,
        customer: customer?._id,
        customerName: customer?.name || sale.customerName || 'Walk-in Customer',
        product: product._id,
        partName: saleItem.partName || product.partName,
        partCode: saleItem.partCode || product.partCode,
        originalQty: saleItem.qty,
        originalPrice: saleItem.price,
        originalLineTotal: saleItem.lineTotal,
        qty: item.qty,
        reason,
        amountRefunded: refundAmount,
        processedBy: req.user._id
      });
    }

    const createdReturns = await Return.create(returnDocs, { session, ordered: true });
    const ledgerCreditAmount = Math.min(totalRefundAmount, remainingBillDue);

    if (customer && ledgerCreditAmount > 0) {
      await addLedgerEntry({
        customer,
        type: 'return',
        sale: sale._id,
        description: `Return against bill ${sale.receiptNo}`,
        credit: ledgerCreditAmount,
        userId: req.user._id,
        session
      });
    }
    
    await session.commitTransaction();
    for (const product of productsToEmit) req.app.get('io').emit('inventory:update', product);
    res.status(201).json(createdReturns.length === 1 ? createdReturns[0] : createdReturns);
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

export default router;
