import { useRef } from 'react';
import { FiX, FiPrinter, FiDownload } from 'react-icons/fi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InvoiceModal({ invoice, onClose }) {
  const printRef = useRef();

  const handlePrint = () => {
    const content = printRef.current;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Invoice #${invoice.sale_id}</title>
      <style>
        body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
        h2, h3 { text-align: center; margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        td, th { padding: 4px; text-align: left; font-size: 12px; }
        th { border-bottom: 1px dashed #000; }
        .right { text-align: right; }
        .total-row { border-top: 1px dashed #000; font-weight: bold; }
        .center { text-align: center; }
        hr { border-style: dashed; }
      </style></head><body>
      ${content.innerHTML}
      <script>window.print(); window.close();</script>
      </body></html>
    `);
  };

  const handlePDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    doc.setFontSize(14);
    doc.text('AByte POS', 40, 10, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Invoice #${invoice.sale_id}`, 40, 16, { align: 'center' });
    doc.text(`Date: ${new Date(invoice.sale_date).toLocaleString()}`, 5, 22);
    doc.text(`Cashier: ${invoice.cashier_name}`, 5, 27);
    doc.text(`Customer: ${invoice.customer_name}`, 5, 32);

    autoTable(doc, {
      startY: 36,
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: invoice.items.map((item) => [
        item.product_name,
        item.quantity,
        Number(item.unit_price).toLocaleString(),
        Number(item.total_price).toLocaleString(),
      ]),
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1 },
      margin: { left: 3, right: 3 },
    });

    const finalY = doc.lastAutoTable.finalY + 5;
    doc.text(`Subtotal: Rs. ${Number(invoice.total_amount).toLocaleString()}`, 5, finalY);
    if (parseFloat(invoice.discount) > 0) {
      doc.text(`Discount: Rs. ${Number(invoice.discount).toLocaleString()}`, 5, finalY + 5);
    }
    doc.setFontSize(12);
    doc.text(`Total: Rs. ${Number(invoice.net_amount).toLocaleString()}`, 5, finalY + 12);

    doc.save(`invoice-${invoice.sale_id}.pdf`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal invoice-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Invoice</h2>
          <div className="invoice-actions">
            <button className="btn btn-sm btn-secondary" onClick={handlePrint}><FiPrinter /> Print</button>
            <button className="btn btn-sm btn-primary" onClick={handlePDF}><FiDownload /> PDF</button>
            <button className="btn-icon" onClick={onClose}><FiX /></button>
          </div>
        </div>

        <div className="invoice-content" ref={printRef}>
          <div className="center">
            <h2>AByte POS</h2>
            <p>Invoice #{invoice.sale_id}</p>
          </div>
          <hr />
          <p><strong>Date:</strong> {new Date(invoice.sale_date).toLocaleString()}</p>
          <p><strong>Cashier:</strong> {invoice.cashier_name}</p>
          <p><strong>Customer:</strong> {invoice.customer_name}</p>
          <hr />

          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="right">Qty</th>
                <th className="right">Price</th>
                <th className="right">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i}>
                  <td>{item.product_name}</td>
                  <td className="right">{item.quantity}</td>
                  <td className="right">Rs. {Number(item.unit_price).toLocaleString()}</td>
                  <td className="right">Rs. {Number(item.total_price).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <hr />
          <div className="invoice-totals">
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>Rs. {Number(invoice.total_amount).toLocaleString()}</span>
            </div>
            {parseFloat(invoice.discount) > 0 && (
              <div className="summary-row">
                <span>Discount:</span>
                <span>- Rs. {Number(invoice.discount).toLocaleString()}</span>
              </div>
            )}
            <div className="summary-row grand-total">
              <span>Grand Total:</span>
              <span>Rs. {Number(invoice.net_amount).toLocaleString()}</span>
            </div>
          </div>
          <hr />
          <p className="center">Thank you for your purchase!</p>
        </div>
      </div>
    </div>
  );
}
