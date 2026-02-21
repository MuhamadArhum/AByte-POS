import { useState } from 'react';
import { Scale, Calendar, Download, RefreshCw, Printer } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { printReport, buildTable } from '../../utils/reportPrinter';

interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type: string;
  debit: number;
  credit: number;
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

const TrialBalance = () => {
  const toast = useToast();
  const [data, setData] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchTrialBalance = async () => {
    if (!asOfDate) {
      toast.error('Select an as-of date');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/accounting/reports/trial-balance', {
        params: { as_of_date: asOfDate }
      });
      setData(res.data.data || []);
      if ((res.data.data || []).length === 0) {
        toast.info('No data found for selected date');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load trial balance');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAsOfDate(new Date().toISOString().split('T')[0]);
    setData([]);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const totals = data.reduce(
    (acc, row) => ({
      debit: acc.debit + Number(row.debit),
      credit: acc.credit + Number(row.credit),
    }),
    { debit: 0, credit: 0 }
  );

  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

  const handlePrint = () => {
    if (data.length === 0) return;
    const rows = data.map(r => [r.account_code, r.account_name, r.debit > 0 ? formatCurrency(r.debit) : '-', r.credit > 0 ? formatCurrency(r.credit) : '-']);
    const content = buildTable(['Code', 'Account Name', 'Debit', 'Credit'], rows, {
      alignRight: [2, 3],
      summaryRow: ['', 'TOTAL', formatCurrency(totals.debit), formatCurrency(totals.credit)],
    });
    printReport({ title: 'Trial Balance', subtitle: isBalanced ? 'Balanced' : 'OUT OF BALANCE', dateRange: `As of ${asOfDate}`, content });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Scale className="text-emerald-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Trial Balance</h1>
            <p className="text-gray-600 text-sm mt-1">Verify debits and credits balance</p>
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
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <button
            onClick={fetchTrialBalance}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
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

          {data.length > 0 && (
            <>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition ml-auto"
            >
              <Printer size={16} />
              Print
            </button>
            <button
              onClick={() => exportToCSV(data, `trial-balance-${asOfDate}`, [
                { key: 'account_code', label: 'Code' },
                { key: 'account_name', label: 'Account Name' },
                { key: 'debit', label: 'Debit' },
                { key: 'credit', label: 'Credit' },
              ])}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition ml-auto"
            >
              <Download size={16} />
              Export CSV
            </button>
            </>
          )}
        </div>
      </div>

      {/* Balance Status */}
      {data.length > 0 && (
        <div className={`mb-6 p-4 rounded-xl border-2 ${isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3">
            <Scale className={isBalanced ? 'text-emerald-600' : 'text-red-600'} size={24} />
            <div>
              <p className={`font-semibold ${isBalanced ? 'text-emerald-900' : 'text-red-900'}`}>
                {isBalanced ? 'Trial Balance is Balanced' : 'Trial Balance is Out of Balance'}
              </p>
              {!isBalanced && (
                <p className="text-sm text-red-700 mt-1">
                  Difference: {formatCurrency(Math.abs(totals.debit - totals.credit))}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Scale size={48} className="mx-auto mb-4 opacity-30" />
            <p>No data to display</p>
            <p className="text-sm mt-2">Select a date and click Generate to view trial balance</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-emerald-50 border-b border-emerald-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-emerald-700 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-emerald-700 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-emerald-700 uppercase tracking-wider">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((row) => (
                  <tr key={row.account_code} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.account_code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {row.account_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {row.debit > 0 ? formatCurrency(row.debit) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {row.credit > 0 ? formatCurrency(row.credit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-emerald-100 border-t-2 border-emerald-200">
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-sm font-bold text-emerald-900">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-emerald-900">
                    {formatCurrency(totals.debit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-emerald-900">
                    {formatCurrency(totals.credit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrialBalance;
