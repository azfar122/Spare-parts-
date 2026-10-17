import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  quantity: { type: Number, required: true, min: 0 },
  remaining: { type: Number, required: true, min: 0 },
  unitCost: { type: Number, required: true, min: 0 },
  source: { type: String, enum: ['purchase', 'opening', 'return'], required: true },
  estimated: { type: Boolean, default: false },
  purchasedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });
schema.index({ product: 1, warehouse: 1, purchasedAt: 1, _id: 1 });
export default mongoose.model('StockBatch', schema);
