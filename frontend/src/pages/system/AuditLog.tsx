import { useState, useEffect } from 'react';
import { Search, Filter, ScrollText, Clock, User } from 'lucide-react';
import api from '../utils/api';
import Pagination from '../components/Pagination';

interface AuditEntry {
  log_id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  user_id: number;
  user_name: string;
  details: string;
  ip_address: string;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN: 'bg-blue-100 text-blue-700',
  SALE_CREATED: 'bg-emerald-100 text-emerald-700',
  SALE_COMPLETED: 'bg-emerald-100 text-emerald-700',
  SALE_DELETED: 'bg-red-100 text-red-700',
  SALE_REFUNDED: 'bg-orange-100 text-orange-700',
  PRODUCT_CREATED: 'bg-purple-100 text-purple-700',
  PRODUCT_UPDATED: 'bg-purple-100 text-purple-700',
  PRODUCT_DELETED: 'bg-red-100 text-red-700',
  STOCK_UPDATED: 'bg-yellow-100 text-yellow-700',
  USER_CREATED: 'bg-blue-100 text-blue-700',
  USER_UPDATED: 'bg-blue-100 text-blue-700',
  USER_DELETED: 'bg-red-100 text-red-700',
  SETTINGS_UPDATED: 'bg-gray-100 text-gray-700',
  REGISTER_OPENED: 'bg-teal-100 text-teal-700',
  REGISTER_CLOSED: 'bg-teal-100 text-teal-700',
  CASH_MOVEMENT: 'bg-yellow-100 text-yellow-700',
  RETURN_CREATED: 'bg-orange-100 text-orange-700',
  BACKUP_CREATED: 'bg-indigo-100 text-indigo-700',
  BACKUP_RESTORED: 'bg-indigo-100 text-indigo-700',
  BACKUP_DELETED: 'bg-red-100 text-red-700',
  BARCODE_GENERATED: 'bg-purple-100 text-purple-700',
};

const AuditLog = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage] = useState(30);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  useEffect(() => {
    fetchActions();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, selectedAction, dateStart, dateEnd]);

  const fetchActions = async () => {
    try {
      const res = await api.get('/audit/actions');
      setActions(res.data);
    } catch (error) {
      console.error('Failed to fetch actions', error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(itemsPerPage) });
      if (selectedAction) params.append('action', selectedAction);
      if (dateStart) params.append('date_start', dateStart);
      if (dateEnd) params.append('date_end', dateEnd);

      const res = await api.get(`/audit?${params.toString()}`);
      setLogs(res.data.logs);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    } catch (error) {
      console.error('Failed to fetch logs', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDetails = (details: string) => {
    try {
      const parsed = JSON.parse(details);
      return Object.entries(parsed)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    } catch {
      return details;
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <ScrollText className="text-emerald-600" size={32} />
            Audit Log
          </h1>
          <p className="text-gray-500 mt-1">{total} total entries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action Type</label>
            <select
              value={selectedAction}
              onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">All Actions</option>
              {actions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From Date</label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => { setDateStart(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To Date</label>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => { setDateEnd(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
          <button
            onClick={() => { setSelectedAction(''); setDateStart(''); setDateEnd(''); setPage(1); }}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="p-4">Time</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr
                    key={log.log_id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedLog(expandedLog === log.log_id ? null : log.log_id)}
                  >
                    <td className="p-4 whitespace-nowrap text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} />
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-gray-400" />
                        <span className="font-medium text-gray-700">{log.user_name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                        {log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">
                      {log.entity_type}
                      {log.entity_id ? ` #${log.entity_id}` : ''}
                    </td>
                    <td className="p-4 text-gray-500 max-w-xs truncate">
                      {log.details ? formatDetails(log.details) : '-'}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-gray-400">
                      No audit logs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination */}
            <Pagination 
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={total}
              itemsPerPage={itemsPerPage}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
