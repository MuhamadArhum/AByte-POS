import { useState, useEffect } from 'react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import { FiDownload } from 'react-icons/fi';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Reports() {
  const [tab, setTab] = useState('daily');
  const [dailyData, setDailyData] = useState(null);
  const [dateRange, setDateRange] = useState({ start_date: '', end_date: '' });
  const [rangeData, setRangeData] = useState(null);
  const [productData, setProductData] = useState([]);
  const [inventoryData, setInventoryData] = useState(null);

  useEffect(() => {
    if (tab === 'daily') loadDaily();
    if (tab === 'inventory') loadInventory();
  }, [tab]);

  const loadDaily = async () => {
    try {
      const res = await api.get('/reports/daily');
      setDailyData(res.data);
    } catch (err) {
      toast.error('Failed to load report');
    }
  };

  const loadDateRange = async () => {
    if (!dateRange.start_date || !dateRange.end_date) {
      toast.warning('Select both dates');
      return;
    }
    try {
      const res = await api.get('/reports/date-range', { params: dateRange });
      setRangeData(res.data);
    } catch (err) {
      toast.error('Failed to load report');
    }
  };

  const loadProductReport = async () => {
    try {
      const params = dateRange.start_date && dateRange.end_date ? dateRange : {};
      const res = await api.get('/reports/product', { params });
      setProductData(res.data);
    } catch (err) {
      toast.error('Failed to load report');
    }
  };

  const loadInventory = async () => {
    try {
      const res = await api.get('/reports/inventory');
      setInventoryData(res.data);
    } catch (err) {
      toast.error('Failed to load report');
    }
  };

  const exportCSV = (data, headers, filename) => {
    const csv = [headers.join(','), ...data.map((row) => headers.map((h) => row[h] ?? '').join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = (title, columns, rows) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
    autoTable(doc, { startY: 28, head: [columns], body: rows, theme: 'grid', styles: { fontSize: 9 } });
    doc.save(`${title.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reports</h1>
      </div>

      <div className="tab-nav">
        {['daily', 'date-range', 'product', 'inventory'].map((t) => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'date-range' ? 'Date Range' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="report-content">
        {/* Daily Report */}
        {tab === 'daily' && dailyData && (
          <div>
            <h2>Today's Sales Summary</h2>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-info"><h3>Transactions</h3><p className="stat-value">{dailyData.total_transactions}</p></div></div>
              <div className="stat-card"><div className="stat-info"><h3>Total Sales</h3><p className="stat-value">Rs. {Number(dailyData.total_sales).toLocaleString()}</p></div></div>
              <div className="stat-card"><div className="stat-info"><h3>Discounts Given</h3><p className="stat-value">Rs. {Number(dailyData.total_discount).toLocaleString()}</p></div></div>
              <div className="stat-card"><div className="stat-info"><h3>Net Revenue</h3><p className="stat-value">Rs. {Number(dailyData.total_revenue).toLocaleString()}</p></div></div>
            </div>
          </div>
        )}

        {/* Date Range Report */}
        {tab === 'date-range' && (
          <div>
            <div className="filters">
              <input type="date" value={dateRange.start_date} onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })} />
              <input type="date" value={dateRange.end_date} onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })} />
              <button className="btn btn-primary" onClick={loadDateRange}>Generate</button>
            </div>
            {rangeData && (
              <>
                <div className="stats-grid" style={{ marginTop: '1rem' }}>
                  <div className="stat-card"><div className="stat-info"><h3>Transactions</h3><p className="stat-value">{rangeData.summary.total_transactions}</p></div></div>
                  <div className="stat-card"><div className="stat-info"><h3>Revenue</h3><p className="stat-value">Rs. {Number(rangeData.summary.total_revenue).toLocaleString()}</p></div></div>
                  <div className="stat-card"><div className="stat-info"><h3>Avg Transaction</h3><p className="stat-value">Rs. {Number(rangeData.summary.avg_transaction).toLocaleString()}</p></div></div>
                </div>
                <h3 style={{ marginTop: '1rem' }}>Daily Breakdown</h3>
                <div className="table-container">
                  <table>
                    <thead><tr><th>Date</th><th>Transactions</th><th>Revenue</th></tr></thead>
                    <tbody>
                      {rangeData.daily.map((d, i) => (
                        <tr key={i}>
                          <td>{new Date(d.date).toLocaleDateString()}</td>
                          <td>{d.transactions}</td>
                          <td>Rs. {Number(d.revenue).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="export-buttons">
                  <button className="btn btn-secondary" onClick={() => exportCSV(rangeData.daily, ['date', 'transactions', 'revenue'], 'sales-report')}>
                    <FiDownload /> CSV
                  </button>
                  <button className="btn btn-secondary" onClick={() => exportPDF('Sales Report', ['Date', 'Transactions', 'Revenue'], rangeData.daily.map(d => [new Date(d.date).toLocaleDateString(), d.transactions, `Rs. ${Number(d.revenue).toLocaleString()}`]))}>
                    <FiDownload /> PDF
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Product Report */}
        {tab === 'product' && (
          <div>
            <div className="filters">
              <input type="date" value={dateRange.start_date} onChange={(e) => setDateRange({ ...dateRange, start_date: e.target.value })} />
              <input type="date" value={dateRange.end_date} onChange={(e) => setDateRange({ ...dateRange, end_date: e.target.value })} />
              <button className="btn btn-primary" onClick={loadProductReport}>Generate</button>
            </div>
            {productData.length > 0 && (
              <>
                <div className="table-container" style={{ marginTop: '1rem' }}>
                  <table>
                    <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>% of Total</th></tr></thead>
                    <tbody>
                      {productData.map((p, i) => (
                        <tr key={i}>
                          <td>{p.product_name}</td>
                          <td>{p.total_quantity}</td>
                          <td>Rs. {Number(p.total_revenue).toLocaleString()}</td>
                          <td>{p.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="export-buttons">
                  <button className="btn btn-secondary" onClick={() => exportCSV(productData, ['product_name', 'total_quantity', 'total_revenue', 'percentage'], 'product-report')}>
                    <FiDownload /> CSV
                  </button>
                  <button className="btn btn-secondary" onClick={() => exportPDF('Product Sales Report', ['Product', 'Qty Sold', 'Revenue', '% Total'], productData.map(p => [p.product_name, p.total_quantity, `Rs. ${Number(p.total_revenue).toLocaleString()}`, `${p.percentage}%`]))}>
                    <FiDownload /> PDF
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Inventory Report */}
        {tab === 'inventory' && inventoryData && (
          <div>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-info"><h3>Total Products</h3><p className="stat-value">{inventoryData.total_products}</p></div></div>
              <div className="stat-card"><div className="stat-info"><h3>Low Stock</h3><p className="stat-value">{inventoryData.low_stock.length}</p></div></div>
              <div className="stat-card"><div className="stat-info"><h3>Out of Stock</h3><p className="stat-value">{inventoryData.out_of_stock.length}</p></div></div>
              <div className="stat-card"><div className="stat-info"><h3>Total Value</h3><p className="stat-value">Rs. {Number(inventoryData.total_inventory_value).toLocaleString()}</p></div></div>
            </div>

            {inventoryData.low_stock.length > 0 && (
              <>
                <h3 style={{ marginTop: '1rem', color: '#e67e22' }}>Low Stock Alerts</h3>
                <div className="table-container">
                  <table>
                    <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Value</th></tr></thead>
                    <tbody>
                      {inventoryData.low_stock.map((p, i) => (
                        <tr key={i}>
                          <td>{p.product_name}</td>
                          <td>{p.category_name || '-'}</td>
                          <td><span className="stock-badge low">{p.available_stock}</span></td>
                          <td>Rs. {Number(p.stock_value).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <h3 style={{ marginTop: '1rem' }}>Full Inventory</h3>
            <div className="table-container">
              <table>
                <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Value</th></tr></thead>
                <tbody>
                  {inventoryData.products.map((p, i) => (
                    <tr key={i}>
                      <td>{p.product_name}</td>
                      <td>{p.category_name || '-'}</td>
                      <td>Rs. {Number(p.price).toLocaleString()}</td>
                      <td>{p.available_stock}</td>
                      <td>Rs. {Number(p.stock_value).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="export-buttons">
              <button className="btn btn-secondary" onClick={() => exportCSV(inventoryData.products, ['product_name', 'category_name', 'price', 'available_stock', 'stock_value'], 'inventory-report')}>
                <FiDownload /> CSV
              </button>
              <button className="btn btn-secondary" onClick={() => exportPDF('Inventory Report', ['Product', 'Category', 'Price', 'Stock', 'Value'], inventoryData.products.map(p => [p.product_name, p.category_name || '-', `Rs. ${Number(p.price).toLocaleString()}`, p.available_stock, `Rs. ${Number(p.stock_value).toLocaleString()}`]))}>
                <FiDownload /> PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
