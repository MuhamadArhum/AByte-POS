/**
 * InvoiceModal.jsx
 * =================
 * A receipt/invoice modal component for the AByte POS system.
 *
 * This component renders a modal overlay that displays the full details of a
 * completed sale, formatted as a receipt-style invoice. It includes:
 *   - Sale metadata (date, cashier, customer)
 *   - An itemised table of products sold (name, quantity, unit price, line total)
 *   - Financial summary (subtotal, optional discount, grand total)
 *
 * Two export actions are provided:
 *   1. **Print** -- Opens a new browser window containing a minimal, receipt-width
 *      HTML document styled with monospace type. The browser's native print dialog
 *      is triggered automatically and the window closes after printing.
 *   2. **PDF Export** -- Generates an 80 mm-wide PDF (thermal-receipt size) using
 *      the jsPDF library and the jspdf-autotable plugin for the line-items table.
 *      The PDF is saved/downloaded immediately with a filename based on the sale ID.
 *
 * Props:
 *   @param {Object}   invoice  - The sale/invoice data object. Expected shape:
 *                                  { sale_id, sale_date, cashier_name, customer_name,
 *                                    items: [{ product_name, quantity, unit_price, total_price }],
 *                                    total_amount, discount, net_amount }
 *   @param {Function} onClose  - Callback to close/dismiss the modal.
 */

// --- React and third-party imports -------------------------------------------
import { useRef } from 'react';

// Icon imports from react-icons (Feather icon set)
import { FiX, FiPrinter, FiDownload } from 'react-icons/fi';

// jsPDF core library -- used to create PDF documents in the browser
import jsPDF from 'jspdf';

// jspdf-autotable plugin -- adds the `autoTable` helper that renders HTML-style
// tables directly into a jsPDF document
import autoTable from 'jspdf-autotable';

/**
 * InvoiceModal component
 *
 * Renders a full-screen overlay containing the invoice card. Clicking outside
 * the card (on the overlay) will close the modal via `onClose`.
 */
export default function InvoiceModal({ invoice, onClose }) {
  // ---- Refs -----------------------------------------------------------------
  /**
   * printRef
   * Attached to the `.invoice-content` div so we can grab its rendered HTML
   * (via `printRef.current.innerHTML`) when the user clicks Print.
   */
  const printRef = useRef();

  // ---- Event handlers -------------------------------------------------------

  /**
   * handlePrint
   * -----------
   * Opens a new blank browser window, writes a self-contained HTML document
   * into it (including inline CSS for receipt-style formatting), then triggers
   * `window.print()` on that window.  After printing the window auto-closes.
   *
   * The CSS is designed to mimic a narrow thermal receipt:
   *   - max-width 300 px, monospace font
   *   - dashed borders for table headers and totals
   */
  const handlePrint = () => {
    // Grab the DOM node that contains the printable invoice content
    const content = printRef.current;

    // Open a new blank tab/window for printing
    const win = window.open('', '_blank');

    // Write a complete HTML document into the new window. The inline <style>
    // block ensures the receipt looks correct even without external stylesheets.
    // At the end, a <script> tag triggers the browser print dialog and then
    // closes the window once printing is done (or cancelled).
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

  /**
   * handlePDF
   * ---------
   * Generates a downloadable PDF receipt using jsPDF and jspdf-autotable.
   *
   * The document is sized at 80 mm wide (standard thermal receipt width) and
   * 200 mm tall. Content is laid out top-to-bottom:
   *   1. Store name ("AByte POS") -- centred, 14 pt
   *   2. Invoice number -- centred, 10 pt
   *   3. Date, cashier, and customer lines
   *   4. Auto-generated items table via jspdf-autotable
   *   5. Subtotal, optional discount, and bold grand total
   *
   * The file is saved as "invoice-{sale_id}.pdf".
   */
  const handlePDF = () => {
    // Create a new PDF document with millimetre units and a custom receipt-size
    // page format (80 mm x 200 mm).
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });

    // --- Header section: store name and invoice number ---
    doc.setFontSize(14);
    doc.text('AByte POS', 40, 10, { align: 'center' }); // centred at x=40 (half of 80 mm)

    doc.setFontSize(10);
    doc.text(`Invoice #${invoice.sale_id}`, 40, 16, { align: 'center' });

    // --- Sale metadata (date, cashier, customer) ---
    doc.text(`Date: ${new Date(invoice.sale_date).toLocaleString()}`, 5, 22);
    doc.text(`Cashier: ${invoice.cashier_name}`, 5, 27);
    doc.text(`Customer: ${invoice.customer_name}`, 5, 32);

    // --- Items table ---
    // Uses the autoTable plugin to render a table with columns:
    //   Item | Qty | Price | Total
    // Each row maps to one sale line-item. The 'plain' theme removes coloured
    // backgrounds so it prints well on receipt paper.
    autoTable(doc, {
      startY: 36, // start the table 36 mm from the top of the page
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: invoice.items.map((item) => [
        item.product_name,
        item.quantity,
        Number(item.unit_price).toLocaleString(),
        Number(item.total_price).toLocaleString(),
      ]),
      theme: 'plain',                       // no coloured fills -- clean receipt look
      styles: { fontSize: 8, cellPadding: 1 }, // compact text for narrow receipt
      margin: { left: 3, right: 3 },        // small side margins
    });

    // --- Totals section ---
    // `doc.lastAutoTable.finalY` gives the Y-coordinate where the table ended,
    // so we can position the totals just below it.
    const finalY = doc.lastAutoTable.finalY + 5;

    // Subtotal line
    doc.text(`Subtotal: Rs. ${Number(invoice.total_amount).toLocaleString()}`, 5, finalY);

    // Discount line -- only rendered when a discount was applied (> 0)
    if (parseFloat(invoice.discount) > 0) {
      doc.text(`Discount: Rs. ${Number(invoice.discount).toLocaleString()}`, 5, finalY + 5);
    }

    // Grand total line -- slightly larger font to stand out
    doc.setFontSize(12);
    doc.text(`Total: Rs. ${Number(invoice.net_amount).toLocaleString()}`, 5, finalY + 12);

    // Trigger the browser download with a descriptive filename
    doc.save(`invoice-${invoice.sale_id}.pdf`);
  };

  // ---- Render ---------------------------------------------------------------
  return (
    /**
     * Modal overlay
     * Covers the full viewport with a semi-transparent backdrop.
     * Clicking anywhere on the overlay (but NOT on the modal card itself)
     * fires `onClose` to dismiss the modal.
     */
    <div className="modal-overlay" onClick={onClose}>
      {/**
       * Modal card
       * `e.stopPropagation()` prevents clicks inside the card from bubbling
       * up to the overlay and inadvertently closing the modal.
       */}
      <div className="modal invoice-modal" onClick={(e) => e.stopPropagation()}>

        {/* ---- Modal header: title + action buttons ---- */}
        <div className="modal-header">
          <h2>Invoice</h2>
          <div className="invoice-actions">
            {/* Print button -- triggers handlePrint to open a print-friendly window */}
            <button className="btn btn-sm btn-secondary" onClick={handlePrint}><FiPrinter /> Print</button>
            {/* PDF button -- triggers handlePDF to generate and download a PDF receipt */}
            <button className="btn btn-sm btn-primary" onClick={handlePDF}><FiDownload /> PDF</button>
            {/* Close button -- dismisses the modal */}
            <button className="btn-icon" onClick={onClose}><FiX /></button>
          </div>
        </div>

        {/* ================================================================
         *  Printable invoice content
         *  -------------------------
         *  This div is referenced by `printRef` so its innerHTML can be
         *  extracted by `handlePrint`. Everything inside here is what
         *  appears on the printed receipt.
         * ================================================================ */}
        <div className="invoice-content" ref={printRef}>

          {/* ---- Store branding and invoice ID ---- */}
          <div className="center">
            <h2>AByte POS</h2>
            <p>Invoice #{invoice.sale_id}</p>
          </div>
          <hr />

          {/* ---- Sale metadata ---- */}
          <p><strong>Date:</strong> {new Date(invoice.sale_date).toLocaleString()}</p>
          <p><strong>Cashier:</strong> {invoice.cashier_name}</p>
          <p><strong>Customer:</strong> {invoice.customer_name}</p>
          <hr />

          {/* ---- Line-items table ----
           *  Columns: Item name | Quantity | Unit price | Line total
           *  Each row corresponds to one product in the sale.
           *  Monetary values are formatted with `toLocaleString()` for
           *  thousand-separator display (e.g., "1,500").
           */}
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

          {/* ---- Financial summary section ----
           *  Shows subtotal, optional discount, and the grand total.
           */}
          <div className="invoice-totals">
            {/* Subtotal -- the sum of all line items before any discount */}
            <div className="summary-row">
              <span>Subtotal:</span>
              <span>Rs. {Number(invoice.total_amount).toLocaleString()}</span>
            </div>

            {/* Discount row -- only displayed when the discount value is > 0 */}
            {parseFloat(invoice.discount) > 0 && (
              <div className="summary-row">
                <span>Discount:</span>
                <span>- Rs. {Number(invoice.discount).toLocaleString()}</span>
              </div>
            )}

            {/* Grand total -- the final amount after discount, displayed prominently */}
            <div className="summary-row grand-total">
              <span>Grand Total:</span>
              <span>Rs. {Number(invoice.net_amount).toLocaleString()}</span>
            </div>
          </div>

          <hr />

          {/* ---- Footer message ---- */}
          <p className="center">Thank you for your purchase!</p>
        </div>
      </div>
    </div>
  );
}
