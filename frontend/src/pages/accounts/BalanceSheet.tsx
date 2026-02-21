import { useState } from 'react';
import { FileBarChart, Calendar, Download, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../components/Toast';

interface BalanceSheetSection {
  account_code: string;
  account_name: string;
  amount: number;
}

interface BalanceSheetData {
  assets: BalanceSheetSection[];
  liabilities: BalanceSheetSection[];
  equity: BalanceSheetSection[];
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  total_liabilities_equity: number;
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

const BalanceSheet = () => {
  const toast = useToast();
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchBalanceSheet = async () => {
    if (!asOfDate) {
      toast.error('Select an as-of date');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/accounting/reports/balance-sheet', {
        params: { as_of_date: asOfDate }
      });
      setData(res.data);
      if (res.data.assets.length === 0 && res.data.liabilities.length === 0 && res.data.equity.length === 0) {
        toast.info('No data found for selected date');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load balance sheet');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAsOfDate(new Date().toISOString().split('T')[0]);
    setData(null);
  };

  const handleExport = () => {
    if (!data) return;

    const exportData = [
      { section: 'ASSETS', account: '', amount: '' },
      ...data.assets.map(a => ({ section: '', account: `${a.account_code} - ${a.account_name}`, amount: a.amount })),
      { section: '', account: 'Total Assets', amount: data.total_assets },
      { section: '', account: '', amount: '' },
      { section: 'LIABILITIES', account: '', amount: '' },
      ...data.liabilities.map(l => ({ section: '', account: `${l.account_code} - ${l.account_name}`, amount: l.amount })),
      { section: '', account: 'Total Liabilities', amount: data.total_liabilities },
      { section: '', account: '', amount: '' },
      { section: 'EQUITY', account: '', amount: '' },
      ...data.equity.map(e => ({ section: '', account: `${e.account_code} - ${e.account_name}`, amount: e.amount })),
      { section: '', account: 'Total Equity', amount: data.total_equity },
      { section: '', account: '', amount: '' },
      { section: '', account: 'Total Liabilities + Equity', amount: data.total_liabilities_equity },
    ];

    exportToCSV(exportData, `balance-sheet-${asOfDate}`, [
      { key: 'section', label: 'Section' },
      { key: 'account', label: 'Account' },
      { key: 'amount', label: 'Amount' },
    ]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const isBalanced = data ? Math.abs(data.total_assets - data.total_liabilities_equity) < 0.01 : true;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <FileBarChart className="text-purple-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Balance Sheet</h1>
            <p className="text-gray-600 text-sm mt-1">Financial position as of date</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">As of Date</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={fetchBalanceSheet}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
          >
            <Calendar size={18} />
            {loading ? 'Loading...' : 'Generate'}
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            <RefreshCw size={16} />
            Reset
          </button>

          {data && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition ml-auto"
            >
              <Download size={16} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Balance Status */}
      {data && (
        <div className={`mb-6 p-4 rounded-xl border-2 ${isBalanced ? 'bg-purple-50 border-purple-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3">
            <FileBarChart className={isBalanced ? 'text-purple-600' : 'text-red-600'} size={24} />
            <div>
              <p className={`font-semibold ${isBalanced ? 'text-purple-900' : 'text-red-900'}`}>
                {isBalanced ? 'Balance Sheet is Balanced' : 'Balance Sheet is Out of Balance'}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                Assets: {formatCurrency(data.total_assets)} | Liabilities + Equity: {formatCurrency(data.total_liabilities_equity)}
              </p>
              {!isBalanced && (
                <p className="text-sm text-red-700 mt-1">
                  Difference: {formatCurrency(Math.abs(data.total_assets - data.total_liabilities_equity))}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : !data ? (
          <div className="text-center py-12 text-gray-500">
            <FileBarChart size={48} className="mx-auto mb-4 opacity-30" />
            <p>No data to display</p>
            <p className="text-sm mt-2">Select a date and click Generate to view balance sheet</p>
          </div>
        ) : (
          <div className="p-8">
            {/* Assets Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-purple-200">
                ASSETS
              </h2>
              {data.assets.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No asset accounts</p>
              ) : (
                <div className="space-y-2">
                  {data.assets.map((item) => (
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
              <div className="flex justify-between items-center py-3 mt-4 border-t-2 border-purple-100 bg-purple-50 px-4 rounded">
                <span className="font-bold text-purple-900">Total Assets</span>
                <span className="font-bold text-purple-900 text-lg">
                  {formatCurrency(data.total_assets)}
                </span>
              </div>
            </div>

            {/* Liabilities Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-purple-200">
                LIABILITIES
              </h2>
              {data.liabilities.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No liability accounts</p>
              ) : (
                <div className="space-y-2">
                  {data.liabilities.map((item) => (
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
              <div className="flex justify-between items-center py-3 mt-4 border-t-2 border-purple-100 bg-purple-50 px-4 rounded">
                <span className="font-bold text-purple-900">Total Liabilities</span>
                <span className="font-bold text-purple-900 text-lg">
                  {formatCurrency(data.total_liabilities)}
                </span>
              </div>
            </div>

            {/* Equity Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b-2 border-purple-200">
                EQUITY
              </h2>
              {data.equity.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No equity accounts</p>
              ) : (
                <div className="space-y-2">
                  {data.equity.map((item) => (
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
              <div className="flex justify-between items-center py-3 mt-4 border-t-2 border-purple-100 bg-purple-50 px-4 rounded">
                <span className="font-bold text-purple-900">Total Equity</span>
                <span className="font-bold text-purple-900 text-lg">
                  {formatCurrency(data.total_equity)}
                </span>
              </div>
            </div>

            {/* Total Liabilities + Equity */}
            <div className="flex justify-between items-center py-4 mt-6 border-t-4 border-purple-300 bg-purple-100 px-4 rounded-lg">
              <span className="font-bold text-xl text-purple-900">
                Total Liabilities + Equity
              </span>
              <span className="font-bold text-2xl text-purple-900">
                {formatCurrency(data.total_liabilities_equity)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BalanceSheet;
