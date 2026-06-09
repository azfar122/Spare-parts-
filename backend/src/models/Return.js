import mongoose from 'mongoose';

const returnSchema = new mongoose.Schema({
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', index: true },
  receiptNo: { type: String, trim: true, index: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, default: 'Walk-in Customer' },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  partName: String,
  partCode: String,
  originalQty: { type: Number, default: 0 },
  originalPrice: { type: Number, default: 0 },
  originalLineTotal: { type: Number, default: 0 },
  qty: { type: Number, required: true, min: 1 },
  reason: { type: String, default: '' },
  amountRefunded: { type: Number, default: 0 },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Return', returnSchema);
