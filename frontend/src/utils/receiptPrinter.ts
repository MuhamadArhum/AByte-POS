interface ReceiptSale {
  sale_id: number;
  total_amount: number | string;
  discount: number | string;
  tax_percent: number | string;
  tax_amount: number | string;
  additional_charges_percent: number | string;
  additional_charges_amount: number | string;
  payment_method: string;
  amount_paid: number | string;
  sale_date?: string;
  note?: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number | string;
  }>;
}

interface ReceiptSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  receipt_footer?: string;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

export function generateReceiptHTML(
  sale: ReceiptSale,
  settings: ReceiptSettings | null,
  cashierName: string,
  customerName?: string
): string {
  const storeName = escapeHtml(settings?.store_name || 'AByte POS');
  const storeAddress = escapeHtml(settings?.address || '');
  const storePhone = escapeHtml(settings?.phone || '');
  const footer = escapeHtml(settings?.receipt_footer || 'Thank you for shopping!');
  const cashier = escapeHtml(cashierName || 'Staff');
  const customer = customerName ? escapeHtml(customerName) : '';

  const totalAmount = parseFloat(String(sale.total_amount));
  const discount = parseFloat(String(sale.discount)) || 0;
  const taxAmount = parseFloat(String(sale.tax_amount)) || 0;
  const taxPercent = parseFloat(String(sale.tax_percent)) || 0;
  const chargesAmount = parseFloat(String(sale.additional_charges_amount)) || 0;
  const chargesPercent = parseFloat(String(sale.additional_charges_percent)) || 0;
  const amountPaid = parseFloat(String(sale.amount_paid));
  const changeDue = Math.max(0, amountPaid - totalAmount);
  const subtotal = totalAmount - taxAmount - chargesAmount + discount;

  const saleDate = sale.sale_date ? new Date(sale.sale_date) : new Date();
  const dateStr = saleDate.toLocaleDateString();
  const timeStr = saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const itemRows = (sale.items || []).map(item => {
    const qty = item.quantity;
    const price = parseFloat(String(item.unit_price));
    const lineTotal = (qty * price).toFixed(2);
    return `<tr>
      <td class="col-item">${escapeHtml(item.product_name)}</td>
      <td class="col-qty">${qty}</td>
      <td class="col-price">${lineTotal}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Receipt #${sale.sale_id}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', 'Consolas', monospace;
      width: 80mm; margin: 0 auto; padding: 4mm;
      background: white; color: #000;
      font-size: 12px; line-height: 1.3;
    }
    .center { text-align: center; }
    .store-name { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
    .info { font-size: 11px; color: #333; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .divider-bold { border-top: 2px solid #000; margin: 6px 0; }
    .meta { font-size: 11px; margin: 4px 0; }
    .meta-row { display: flex; justify-content: space-between; margin: 1px 0; }
    .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 11px; }
    .items-table th { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; font-size: 10px; }
    .items-table td { padding: 3px 0; vertical-align: top; }
    .col-qty { width: 12%; text-align: center; }
    .col-item { width: 60%; }
    .col-price { width: 28%; text-align: right; }
    .totals { margin-top: 4px; }
    .total-row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 11px; }
    .grand-total { font-weight: bold; font-size: 14px; margin-top: 4px; padding-top: 4px; border-top: 2px solid #000; }
    .footer { text-align: center; margin-top: 8px; font-size: 10px; color: #555; padding-top: 6px; border-top: 1px dashed #000; }
    @media print {
      body { width: 100%; padding: 2mm; }
      @page { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="store-name">${storeName}</div>
    ${storeAddress ? `<div class="info">${storeAddress}</div>` : ''}
    ${storePhone ? `<div class="info">Tel: ${storePhone}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="meta">
    <div class="meta-row"><span>Receipt #${sale.sale_id}</span><span>${dateStr} ${timeStr}</span></div>
    <div class="meta-row"><span>Cashier:</span><span>${cashier}</span></div>
    ${customer ? `<div class="meta-row"><span>Customer:</span><span>${customer}</span></div>` : ''}
  </div>

  <div class="divider"></div>

  <table class="items-table">
    <thead>
      <tr>
        <th class="col-item">Item</th>
        <th class="col-qty">Qty</th>
        <th class="col-price">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="divider"></div>

  <div class="totals">
    <div class="total-row"><span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>
    ${taxAmount > 0 ? `<div class="total-row"><span>Tax (${taxPercent}%):</span><span>$${taxAmount.toFixed(2)}</span></div>` : ''}
    ${chargesAmount > 0 ? `<div class="total-row"><span>Charges (${chargesPercent}%):</span><span>$${chargesAmount.toFixed(2)}</span></div>` : ''}
    ${discount > 0 ? `<div class="total-row"><span>Discount:</span><span>-$${discount.toFixed(2)}</span></div>` : ''}
    <div class="total-row grand-total"><span>TOTAL:</span><span>$${totalAmount.toFixed(2)}</span></div>
    <div class="total-row" style="margin-top:6px"><span>Paid (${(sale.payment_method || 'cash').toUpperCase()}):</span><span>$${amountPaid.toFixed(2)}</span></div>
    ${changeDue > 0 ? `<div class="total-row"><span>Change:</span><span>$${changeDue.toFixed(2)}</span></div>` : ''}
  </div>

  ${sale.note ? `<div class="divider"></div><div class="meta" style="font-size:10px">Note: ${escapeHtml(sale.note)}</div>` : ''}

  <div class="footer">
    <div>${footer}</div>
    <div style="margin-top:4px">Software by AByte</div>
  </div>
</body>
</html>`;
}

export function printReceipt(
  sale: ReceiptSale,
  settings: ReceiptSettings | null,
  cashierName: string,
  customerName?: string
): void {
  const html = generateReceiptHTML(sale, settings, cashierName, customerName);
  const printWindow = window.open('', '', 'width=350,height=600');
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 400);
}
