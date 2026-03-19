import { useState } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { TrendingUp, Download, RefreshCw, Printer } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { printReport, buildTable } from '../../utils/reportPrinter';
import { localToday, localMonthStart } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

interface ProfitLossSection {
  account_code: string;
  account_name: string;
  amount: number;
}

interface ProfitLossData {
  revenue: ProfitLossSection[];
  expenses: ProfitLossSection[];
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
}

const exportToCSV = (data: any[], filename: string, columns: { key: string; label: string }[]) => {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row =>
    columns.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const ProfitLoss = () => {
  const toast = useToast();
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState(localMonthStart);
  const [toDate, setToDate] = useState(localToday);

  const fetchProfitLoss = async () => {
    if (!fromDate || !toDate) {
      toast.error('Select date range');
      return;
    }
    if (fromDate > toDate) {
      toast.error('From date must be before to date');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/accounting/reports/profit-loss', {
        params: { from_date: fromDate, to_date: toDate }
      });
      setData(res.data);
      if (res.data.revenue.length === 0 && res.data.expenses.length === 0) {
        toast.info('No data found for selected period');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load profit & loss');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFromDate(localMonthStart());
    setToDate(localToday());
    setData(null);
  };

  const handleExport = () => {
    if (!data) return;

    const exportData = [
      { section: 'REVENUE', account: '', amount: '' },
      ...data.revenue.map(r => ({ section: '', account: `${r.account_code} - ${r.account_name}`, amount: r.amount })),
      { section: '', account: 'Total Revenue', amount: data.total_revenue },
      { section: '', account: '', amount: '' },
      { section: 'EXPENSES', account: '', amount: '' },
      ...data.expenses.map(e => ({ section: '', account: `${e.account_code} - ${e.account_name}`, amount: e.amount })),
      { section: '', account: 'Total Expenses', amount: data.total_expenses },
      { section: '', account: '', amount: '' },
      { section: '', account: 'NET PROFIT/LOSS', amount: data.net_profit },
    ];

    exportToCSV(exportData, `profit-loss-${fromDate}-to-${toDate}`, [
      { key: 'section', label: 'Section' },
      { key: 'account', label: 'Account' },
      { key: 'amount', label: 'Amount' },
    ]);
  };

  const handlePrint = () => {
    if (!data) return;
    let content = '';
    content += buildTable(['Account Code', 'Account Name', 'Amount'], data.revenue.map(r => [r.account_code, r.account_name, formatCurrency(r.amount)]), { alignRight: [2], summaryRow: ['', 'Total Revenue', formatCurrency(data.total_revenue)], caption: 'REVENUE' });
    content += buildTable(['Account Code', 'Account Name', 'Amount'], data.expenses.map(e => [e.account_code, e.account_name, formatCurrency(e.amount)]), { alignRight: [2], summaryRow: ['', 'Total Expenses', formatCurrency(data.total_expenses)], caption: 'EXPENSES' });
    content += `<div style="margin-top:20px;padding:12px;border-top:3px solid #000;font-size:16px;font-weight:bold;display:flex;justify-content:space-between"><span>{currency}{data.net_profit >= 0 ? 'NET PROFIT' : 'NET LOSS'}</span><span>{currency}{formatCurrency(Math.abs(data.net_profit))}</span></div>`;
    printReport({ title: 'Profit & Loss Statement', dateRange: `${fromDate} to ${toDate}`, content });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <TrendingUp className="text-emerald-600" size={20} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">Profit & Loss Statement</h1>
            <p className="text-gray-600 text-sm mt-1">Income statement for the period</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap items-center gap-4">
        <DateRangeFilter standalone={false} dateFrom={fromDate} dateTo={toDate} onFromChange={setFromDate} onToChange={setToDate} onApply={fetchProfitLoss} applyLabel={loading ? 'Loading...' : 'Generate'} />
        <button onClick={handleReset} className="flex items-center gap-2 px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
          <RefreshCw size={15} /> Reset
        </button>
        {data && (
          <>
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition ml-auto">
              <Printer size={15} /> Print
            </button>
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">
              <Download size={15} /> Export CSV
            </button>
          </>
        )}
      </div>

      {/* Report */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : !data ? (
          <div className="text-center py-12 text-gray-500">
            <TrendingUp size={48} className="mx-auto mb-4 opacity-30" />
            <p>No data to display</p>
            <p className="text-sm mt-2">Select a date range and click Generate to view profit & loss</p>
          </div>
        ) : (
          <div className="p-8">
            {/* Revenue Section */}
            <div className="mb-8">
              <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-emerald-200">
                REVENUE
              </h2>
              {data.revenue.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No revenue accounts</p>
              ) : (
                <div className="space-y-2">
                  {data.revenue.map((item) => (
                    <div key={item.account_code} className="flex justify-between items-center py-2 hover:bg-gray-50 px-4 rounded">
                      <div>
                        <span className="font-medium text-gray-900">{item.account_name}</span>
                        <span className="text-sm text-gray-500 ml-2">({item.account_code})</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center py-3 mt-4 border-t-2 border-emerald-100 bg-emerald-50 px-4 rounded">
                <span className="font-bold text-emerald-900">Total Revenue</span>
                <span className="font-bold text-emerald-900 text-lg">
                  {formatCurrency(data.total_revenue)}
                </span>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="mb-8">
              <h2 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b-2 border-emerald-200">
                EXPENSES
              </h2>
              {data.expenses.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No expense accounts</p>
              ) : (
                <div className="space-y-2">
                  {data.expenses.map((item) => (
                    <div key={item.account_code} className="flex justify-between items-center py-2 hover:bg-gray-50 px-4 rounded">
                      <div>
                        <span className="font-medium text-gray-900">{item.account_name}</span>
                        <span className="text-sm text-gray-500 ml-2">({item.account_code})</span>
                      </div>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center py-3 mt-4 border-t-2 border-emerald-100 bg-emerald-50 px-4 rounded">
                <span className="font-bold text-emerald-900">Total Expenses</span>
                <span className="font-bold text-emerald-900 text-lg">
                  {formatCurrency(data.total_expenses)}
                </span>
              </div>
            </div>

            {/* Net Profit/Loss */}
            <div className={`flex justify-between items-center py-4 mt-6 border-t-4 ${data.net_profit >= 0 ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'} px-4 rounded-lg`}>
              <span className={`font-bold text-xl ${data.net_profit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {data.net_profit >= 0 ? 'NET PROFIT' : 'NET LOSS'}
              </span>
              <span className={`font-bold text-2xl ${data.net_profit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                {formatCurrency(Math.abs(data.net_profit))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ProfitLossWithGate = () => <ReportPasswordGate><ProfitLoss /></ReportPasswordGate>;
export default ProfitLossWithGate;
