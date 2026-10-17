import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  day: { type: String, required: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  opening: { type: Number, required: true },
  reliable: { type: Boolean, default: false }
}, { timestamps: true });
schema.index({ day: 1, product: 1 }, { unique: true });
export const StockTracking = mongoose.model('StockTracking', new mongoose.Schema({ _id: String, startedAt: Date }));
export default mongoose.model('DailyStock', schema);
