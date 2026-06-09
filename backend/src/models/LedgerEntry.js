import mongoose from 'mongoose';

const ledgerEntrySchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  type: { type: String, enum: ['opening', 'sale', 'payment', 'adjustment', 'return'], required: true },
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
  description: { type: String, trim: true, default: '' },
  debit: { type: Number, default: 0 },
  credit: { type: Number, default: 0 },
  balanceAfter: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('LedgerEntry', ledgerEntrySchema);
