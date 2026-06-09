const shopInfo = {
  name: 'ASIF AUTO COMPANY',
  address: '59 MUSLIM MARKET MCLEOD ROAD, LAHORE - PAKISTAN',
  phones: ['04236308567', '03008080904', '03048922228']
};

const money = value => Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const dateOnly = value => new Date(value).toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

const timeOnly = value => new Date(value).toLocaleTimeString('en-GB', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true
});

function paymentLabel(status) {
  if (status === 'unpaid') return 'CREDIT';
  if (status === 'partial') return 'PARTIAL';
  return 'CASH';
}

export default function ShopReceipt({ receipt }) {
  if (!receipt) return null;

  return <div id="receipt-print" className="shop-receipt">
    <div className="receipt-topline">
      <span>Print:</span>
      <span>{dateOnly(receipt.createdAt)}</span>
      <span>{timeOnly(receipt.createdAt)}</span>
      <span className="receipt-page">Page 1 of 1</span>
    </div>

    <header className="receipt-header">
      <h2>{shopInfo.name}</h2>
      <p>{shopInfo.address}</p>
      <div className="receipt-phones">
        {shopInfo.phones.map(phone => <span key={phone}>{phone}</span>)}
      </div>
    </header>

    <div className="receipt-title">SALE BILL</div>

    <div className="receipt-meta">
      <span>Bill # {receipt.receiptNo}</span>
      <b>{paymentLabel(receipt.paymentStatus)}</b>
      <span>Date&nbsp;&nbsp;{dateOnly(receipt.createdAt)}</span>
    </div>

    <div className="receipt-account">
      <span>Ac #</span>
      <div>
        <b>{receipt.customerName || 'Walk-in Customer'}</b>
        <p>LAHORE</p>
      </div>
    </div>

    <table className="receipt-items">
      <thead>
        <tr>
          <th>Sr</th>
          <th>Description</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Disc</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {receipt.items.map((item, index) => (
          <tr key={`${item.partCode}-${index}`}>
            <td>{index + 1}</td>
            <td>
              <b>{item.partName}</b>
              <span>{[item.model, item.partCode].filter(Boolean).join(' ')}</span>
            </td>
            <td>{money(item.qty)}</td>
            <td>{money(item.price)}</td>
            <td>{money(item.discount)}</td>
            <td>{money(item.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <div className="receipt-totals">
      <div><span>Subtotal</span><b>{money(receipt.subtotal)}</b></div>
      <div><span>Discount</span><b>{money(receipt.discountTotal)}</b></div>
      <div><span>Paid</span><b>{money(receipt.paidAmount)}</b></div>
      <div><span>Balance</span><b>{money(receipt.dueAmount)}</b></div>
      <div className="receipt-grand"><span>Total</span><b>{money(receipt.grandTotal)}</b></div>
    </div>
  </div>;
}
