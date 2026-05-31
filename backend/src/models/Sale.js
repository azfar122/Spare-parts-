import mongoose from 'mongoose';

const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  partName: String,
  partCode: String,
  model: String,
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  lineTotal: { type: Number, required: true }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  receiptNo: { type: String, required: true, unique: true },
  items: [saleItemSchema],
  subtotal: Number,
  discountTotal: Number,
  grandTotal: Number,
  customerName: { type: String, default: 'Walk-in Customer' },
  soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Sale', saleSchema);
