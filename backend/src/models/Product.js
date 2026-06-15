import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  partName: { type: String, required: true, trim: true, index: true },
  partCode: { type: String, required: true, trim: true, unique: true, index: true },
  model: { type: String, default: 'COMMON', trim: true, index: true },
  brand: { type: String, default: '', trim: true, index: true },
  category: { type: String, default: '', trim: true, index: true },
  type: { type: String, default: '', trim: true, index: true },
  bookingPrice: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 },
  minOrderQty: { type: Number, default: 1 },
  minimumQuantity: { type: Number, default: 0, min: 0 },
  quantity: { type: Number, default: 0, min: 0 },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

productSchema.index({ partName: 'text', partCode: 'text', model: 'text' });

export default mongoose.model('Product', productSchema);
