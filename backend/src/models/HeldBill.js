import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

export default mongoose.model('HeldBill', schema);
