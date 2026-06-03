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
    const returnQty = Number(qty || 0);
    if (!receiptNo?.trim()) throw new Error('Bill number is required');
    if (!productId) throw new Error('Returned item is required');
    if (!Number.isFinite(returnQty) || returnQty <= 0) throw new Error('Return quantity must be greater than zero');

    const sale = await Sale.findOne({ receiptNo: String(receiptNo).trim() }).session(session);
    if (!sale) throw new Error('Bill not found');

    const saleItem = sale.items.find(item => String(item.product) === String(productId));
    if (!saleItem) throw new Error('Selected item was not found in this bill');

    const previousReturns = await Return.aggregate([
      { $match: { sale: sale._id, product: new mongoose.Types.ObjectId(productId) } },
      { $group: { _id: null, returnedQty: { $sum: '$qty' } } }
    ]).session(session);
    const alreadyReturnedQty = previousReturns[0]?.returnedQty || 0;
    const returnableQty = Number(saleItem.qty || 0) - alreadyReturnedQty;
    if (returnQty > returnableQty) throw new Error(`Only ${returnableQty} item(s) can be returned from this bill`);

    const product = await Product.findById(productId).session(session);
    if (!product) throw new Error('Product not found');

    const calculatedRefund = (Number(saleItem.lineTotal || 0) / Number(saleItem.qty || 1)) * returnQty;
    const refundAmount = amountRefunded === undefined || amountRefunded === ''
      ? calculatedRefund
      : Number(amountRefunded || 0);
    if (!Number.isFinite(refundAmount) || refundAmount < 0) throw new Error('Refund amount must be zero or greater');

    const previousSaleReturns = await Return.aggregate([
      { $match: { sale: sale._id } },
      { $group: { _id: null, refunded: { $sum: '$amountRefunded' } } }
    ]).session(session);
    const previousRefundedForSale = previousSaleReturns[0]?.refunded || 0;
    const remainingBillDue = Math.max(0, Number(sale.dueAmount || 0) - previousRefundedForSale);
    const ledgerCreditAmount = Math.min(refundAmount, remainingBillDue);

    product.quantity += returnQty;
    await product.save({ session });

    let customer = null;
    if (sale.customer) {
      customer = await Customer.findById(sale.customer).session(session);
    }

    const [ret] = await Return.create([{
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
      qty: returnQty,
      reason,
      amountRefunded: refundAmount,
      processedBy: req.user._id
    }], { session });

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
    req.app.get('io').emit('inventory:update', product);
    res.status(201).json(ret);
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
});

export default router;
