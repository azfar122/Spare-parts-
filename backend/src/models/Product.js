import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  partName: { type: String, required: true, trim: true, index: true },
  partCode: { type: String, required: true, trim: true, unique: true, index: true },
  brand: { type: String, default: '', trim: true, index: true },
  bookingPrice: { type: Number, default: 0 },
  wholesalePrice: { type: Number, default: 0, min: 0 },
  sellingPrice: { type: Number, min: 0 },
  mrp: { type: Number, default: 0 },
  minOrderQty: { type: Number, default: 1 },
  minimumQuantity: { type: Number, default: 0, min: 0 },
  quantity: { type: Number, default: 0, min: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true });


export default mongoose.model('Product', productSchema);
