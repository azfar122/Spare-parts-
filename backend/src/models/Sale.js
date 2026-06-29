import mongoose from 'mongoose';

const warehouseAllocationSchema = new mongoose.Schema({
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  warehouseName: { type: String, default: '' },
  qty: { type: Number, required: true, min: 1 }
}, { _id: false });

const saleItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  partName: String,
  partCode: String,
  model: String,
  qty: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  inventoryQtyUsed: { type: Number, default: 0 },
  warehouseQtyUsed: { type: Number, default: 0 },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
  warehouseName: { type: String, default: '' },
  warehouseAllocations: [warehouseAllocationSchema],
  lineTotal: { type: Number, required: true }
}, { _id: false });

const saleSchema = new mongoose.Schema({
  receiptNo: { type: String, required: true, unique: true },
  items: [saleItemSchema],
  subtotal: Number,
  discountTotal: Number,
  grandTotal: Number,
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, default: 'Walk-in Customer' },
  paymentStatus: { type: String, enum: ['paid', 'unpaid', 'partial'], default: 'paid' },
  paidAmount: { type: Number, default: 0 },
  dueAmount: { type: Number, default: 0 },
  soldBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Sale', saleSchema);
