import mongoose from 'mongoose';

const returnSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  partName: String,
  partCode: String,
  qty: { type: Number, required: true, min: 1 },
  reason: { type: String, default: '' },
  amountRefunded: { type: Number, default: 0 },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Return', returnSchema);
