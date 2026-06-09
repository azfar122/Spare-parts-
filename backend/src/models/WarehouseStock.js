import mongoose from 'mongoose';

const warehouseStockSchema = new mongoose.Schema({
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  quantity: { type: Number, default: 0, min: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

warehouseStockSchema.index({ warehouse: 1, product: 1 }, { unique: true });

export default mongoose.model('WarehouseStock', warehouseStockSchema);
