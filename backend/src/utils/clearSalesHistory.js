export async function clearSalesHistory({ Sale, Return, LedgerEntry }, session) {
  const sales = await Sale.deleteMany({}, { session });
  const returns = await Return.deleteMany({}, { session });
  // Keep customer balances and ledger amounts while removing deleted receipt links.
  await LedgerEntry.updateMany(
    { $or: [{ sale: { $exists: true } }, { type: { $in: ['sale', 'return'] } }] },
    { $unset: { sale: '' }, $set: { description: 'Historical balance entry (receipt history cleared)' } },
    { session }
  );
  return { salesDeleted: sales.deletedCount, returnsDeleted: returns.deletedCount };
}
