import mongoose from 'mongoose';

const purchaseOrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  partName: String,
  partCode: { type: String, trim: true, default: '' },
  brand: String,
  model: { type: String, default: 'COMMON' },
  qty: { type: Number, required: true, min: 1 },
  received: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['pending', 'received', 'partial'], default: 'pending' }
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, index: true },
  orderDate: { type: Date, default: Date.now },
  totalPrice: { type: Number, required: true, min: 0 },
  items: [purchaseOrderItemSchema],
  status: { type: String, enum: ['pending', 'partial', 'received'], default: 'pending' },
  notes: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
