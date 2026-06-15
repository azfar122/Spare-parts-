import { useEffect, useRef } from 'react';
import { Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';

export default function ProductTable({ products, onDetail, onEdit, onDelete, salesMode, onAddSale, selectedIndex = -1, selectedActionIndex = 0, onSelectIndex, onMoveSelection, onMoveAction, onActivateAction, startIndex = 0, warehouseColumns = [], showBookingPrice = false, onToggleBookingPrice }) {
  const rowRefs = useRef([]);
  const productName = product => product.productName || product.partName || '-';
  const partNo = product => product.partNo || product.partCode || '-';
  const minimumQty = product => Number(product.minimumQuantity || 0);
  const totalQty = product => Number(product.quantity || 0) + Number(product.warehouseQuantity || 0);
  const isLowStock = product => minimumQty(product) > 0 && totalQty(product) <= minimumQty(product);
  const warehouseQty = (product, warehouseId) => {
    const stock = product.warehouseStocks?.find(item => String(item.warehouseId) === String(warehouseId));
    return Number(stock?.quantity || 0);
  };

  useEffect(() => {
    if (selectedIndex >= 0) rowRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  function actionButtonClass(rowIndex, actionIndex, baseClass) {
    return `${baseClass} ${selectedIndex === rowIndex && selectedActionIndex === actionIndex ? 'ring-2 ring-brand-red ring-offset-2' : ''}`;
  }

  function handleRowKeyDown(e, product, index) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMoveSelection?.(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMoveSelection?.(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onSelectIndex?.(selectedIndex >= 0 ? selectedIndex : index);
      onMoveAction?.(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onSelectIndex?.(selectedIndex >= 0 ? selectedIndex : index);
      onMoveAction?.(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onActivateAction?.(products[selectedIndex] || product);
      onSelectIndex?.(selectedIndex >= 0 ? selectedIndex : index);
    }
  }

  if (!salesMode) {
    return <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-soft">
      {onToggleBookingPrice && <div className="flex justify-end border-b bg-white px-4 py-3">
        <button
          type="button"
          onClick={onToggleBookingPrice}
          className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          title={showBookingPrice ? 'Hide booking price' : 'Show booking price'}
        >
          {showBookingPrice ? <EyeOff size={16} /> : <Eye size={16} />}
          Booking Price
        </button>
      </div>}
      <div>
        <table className="w-full table-fixed text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="w-[4%] p-3 text-left">Sr No.</th>
              <th className="w-[17%] p-3 text-left">Product Name</th>
              <th className="w-[10%] p-3 text-left">Part No</th>
              <th className="w-[9%] p-3 text-left">Brand</th>
              <th className="w-[9%] p-3 text-left">Category</th>
              <th className="w-[8%] p-3 text-left">Type</th>
              {showBookingPrice && <th className="w-[8%] p-3 text-right">Booking Price</th>}
              <th className="w-[8%] p-3 text-right">Retail Price(RP)</th>
              <th className="w-[6%] p-3 text-right">Stock Qty</th>
              <th className="w-[6%] p-3 text-right">Total Qty</th>
              <th className="w-[6%] p-3 text-right">Minimum Qty</th>
              <th className="w-[9%] p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, index) => (
              <tr
                key={p._id}
                ref={node => { rowRefs.current[index] = node; }}
                tabIndex={0}
                aria-selected={selectedIndex === index}
                onClick={() => onSelectIndex?.(index)}
                onKeyDown={e => handleRowKeyDown(e, p, index)}
                className={`border-t outline-none hover:bg-slate-50/70 ${selectedIndex === index ? 'bg-red-50 ring-2 ring-inset ring-brand-red/40' : ''}`}
              >
                <td className="p-3 font-semibold text-slate-500">{startIndex + index + 1}</td>
                <td className="break-words p-3 font-semibold">{productName(p)}</td>
                <td className="break-words p-3 text-slate-600">{partNo(p)}</td>
                <td className="break-words p-3 text-slate-600">{p.brand || '-'}</td>
                <td className="break-words p-3 text-slate-600">{p.category || '-'}</td>
                <td className="break-words p-3 text-slate-600">{p.type || p.model || '-'}</td>
                {showBookingPrice && <td className="p-3 text-right">Rs {Number(p.bookingPrice || 0).toLocaleString()}</td>}
                <td className="p-3 text-right">Rs {Number(p.mrp || 0).toLocaleString()}</td>
                <td className="p-3 text-right font-semibold">{Number(p.quantity || 0).toLocaleString()}</td>
                <td className={`p-3 text-right font-semibold ${isLowStock(p) ? 'text-red-600' : ''}`}>{totalQty(p).toLocaleString()}</td>
                <td className="p-3 text-right">{minimumQty(p).toLocaleString()}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <button title="View details" className={actionButtonClass(index, 0, 'rounded-lg border p-2 hover:bg-slate-100')} onClick={() => onDetail(p)}><Eye size={15}/></button>
                    {onEdit && <button title="Edit product" className={actionButtonClass(index, 1, 'rounded-lg border p-2 hover:bg-slate-100')} onClick={() => onEdit(p)}><Pencil size={15}/></button>}
                    {onDelete && <button title="Delete product" className={actionButtonClass(index, onEdit ? 2 : 1, 'rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50')} onClick={() => onDelete(p)}><Trash2 size={15}/></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>;
  }

  return <div className="overflow-hidden rounded-3xl bg-white shadow-soft border border-slate-100">
    {onToggleBookingPrice && <div className="flex justify-end border-b bg-white px-3 py-2">
      <button
        type="button"
        onClick={onToggleBookingPrice}
        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        title={showBookingPrice ? 'Hide booking price' : 'Show booking price'}
      >
        {showBookingPrice ? <EyeOff size={15} /> : <Eye size={15} />}
        Booking Price
      </button>
    </div>}
    <div>
      <table className="w-full table-fixed text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="w-[4%] p-3 text-left">Sr No.</th>
            <th className="w-[21%] p-3 text-left">Product Name</th>
            <th className="w-[10%] p-3 text-left">Part No</th>
            <th className="w-[7%] p-3 text-left">Brand</th>
            <th className="w-[7%] p-3 text-left">Category</th>
            <th className="w-[6%] p-3 text-left">Type</th>
            {showBookingPrice && <th className="w-[8%] p-3 text-right">Booking Price</th>}
            <th className="w-[9%] p-3 text-right">Retail Price(RP)</th>
            <th className="w-[6%] p-3 text-right">Stock Qty</th>
            <th className="w-[6%] p-3 text-right">Total Qty</th>
            <th className="w-[6%] p-3 text-right">Min Qty</th>
            {warehouseColumns.map(warehouse => (
              <th key={warehouse._id} className="w-[7%] p-3 text-right">{warehouse.name}</th>
            ))}
            <th className="w-[6%] p-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, index) => {
            const availableQty = totalQty(p);
            return <tr
              key={p._id}
              ref={node => { rowRefs.current[index] = node; }}
              tabIndex={0}
              aria-selected={selectedIndex === index}
              onClick={() => onSelectIndex?.(index)}
              onKeyDown={e => handleRowKeyDown(e, p, index)}
              className={`border-t outline-none hover:bg-slate-50/70 ${selectedIndex === index ? 'bg-red-50 ring-2 ring-inset ring-brand-red/40' : ''}`}
            >
              <td className="p-3 font-semibold text-slate-500">{startIndex + index + 1}</td>
              <td className="p-3 font-semibold break-words">{productName(p)}</td>
              <td className="p-3 text-slate-600 break-words">{partNo(p)}</td>
              <td className="p-3 text-slate-600 break-words">{p.brand || '-'}</td>
              <td className="p-3 text-slate-600 break-words">{p.category || '-'}</td>
              <td className="p-3 text-slate-600 break-words">{p.type || p.model || '-'}</td>
              {showBookingPrice && <td className="p-3 text-right">Rs {Number(p.bookingPrice || 0).toLocaleString()}</td>}
              <td className="p-3 text-right">Rs {Number(p.mrp || 0).toLocaleString()}</td>
              <td className="p-3 text-right font-semibold">{Number(p.quantity || 0).toLocaleString()}</td>
              <td className={`p-3 text-right font-semibold ${isLowStock(p) ? 'text-red-600' : ''}`}>{availableQty.toLocaleString()}</td>
              <td className="p-3 text-right">{minimumQty(p).toLocaleString()}</td>
              {warehouseColumns.map(warehouse => (
                <td key={warehouse._id} className="p-3 text-right text-slate-600">{warehouseQty(p, warehouse._id).toLocaleString()}</td>
              ))}
              <td className="p-3"><div className="flex justify-end gap-2">
                {!salesMode && <button title="View details" className="rounded-xl border px-3 py-2 hover:bg-slate-100" onClick={() => onDetail(p)}><Eye size={16}/></button>}
                {onEdit && <button className="rounded-xl border px-3 py-2 hover:bg-slate-100" onClick={() => onEdit(p)}><Pencil size={16}/></button>}
                {salesMode && <button disabled={availableQty <= 0} className={actionButtonClass(index, 0, 'rounded-xl bg-brand-red px-3 py-2 text-white disabled:opacity-40')} onClick={() => onAddSale(p)}>Sell</button>}
              </div></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  </div>;
}
