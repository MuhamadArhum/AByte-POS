import { useState, useEffect } from 'react';
import React from 'react';
import { DollarSign, Plus, CreditCard, Ban, Eye, Filter } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import IssueLoanModal from '../../components/IssueLoanModal';
import LoanRepaymentModal from '../../components/LoanRepaymentModal';

const LoanManagement = () => {
  const toast = useToast();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [statusFilter, setStatusFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('');
  const [staffList, setStaffList] = useState<any[]>([]);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<any>(null);
  const [expandedLoan, setExpandedLoan] = useState<number | null>(null);
  const [repayments, setRepayments] = useState<Record<number, any[]>>({});

  useEffect(() => {
    api.get('/staff', { params: { limit: 200 } }).then(r => setStaffList(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { fetchLoans(); }, [pagination.page, statusFilter, staffFilter]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (staffFilter) params.staff_id = staffFilter;
      const res = await api.get('/staff/loans', { params });
      setLoans(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch (err) {
      toast.error('Failed to load loans');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (loan: any) => {
    if (!window.confirm(`Cancel loan of $${Number(loan.loan_amount).toLocaleString()} for ${loan.full_name}?`)) return;
    try {
      await api.put(`/staff/loans/${loan.loan_id}/cancel`);
      toast.success('Loan cancelled');
      fetchLoans();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const toggleRepayments = async (loanId: number) => {
    if (expandedLoan === loanId) { setExpandedLoan(null); return; }
    if (!repayments[loanId]) {
      try {
        const res = await api.get(`/staff/loans/${loanId}/repayments`);
        setRepayments(prev => ({ ...prev, [loanId]: res.data.data || [] }));
      } catch (err) { console.error(err); }
    }
    setExpandedLoan(loanId);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      completed: 'bg-blue-100 text-blue-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${map[status] || 'bg-gray-100 text-gray-700'}`}>{status}</span>;
  };

  const activeTotals = loans.filter(l => l.status === 'active').reduce((acc, l) => ({
    total: acc.total + Number(l.loan_amount),
    remaining: acc.remaining + Number(l.remaining_balance),
    repaid: acc.repaid + Number(l.total_repaid || 0)
  }), { total: 0, remaining: 0, repaid: 0 });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <CreditCard className="text-cyan-600" size={32} />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Loan Management</h1>
            <p className="text-gray-600 text-sm mt-1">Manage employee loans and repayments</p>
          </div>
        </div>
        <button onClick={() => setShowIssueModal(true)} className="flex items-center gap-2 bg-cyan-600 text-white px-6 py-3 rounded-xl hover:bg-cyan-700 transition shadow-lg">
          <Plus size={20} /> Issue Loan
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Loans</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{pagination.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Active Total</p>
          <p className="text-3xl font-bold text-cyan-600 mt-2">${activeTotals.total.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Repaid</p>
          <p className="text-3xl font-bold text-green-600 mt-2">${activeTotals.repaid.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Outstanding</p>
          <p className="text-3xl font-bold text-red-600 mt-2">${activeTotals.remaining.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <Filter size={20} className="text-gray-600" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={staffFilter} onChange={(e) => { setStaffFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 min-w-[200px]">
            <option value="">All Staff</option>
            {staffList.map(s => <option key={s.staff_id} value={s.staff_id}>{s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="border-b">
              <th className="text-left p-4 font-semibold text-gray-700">Staff</th>
              <th className="text-right p-4 font-semibold text-gray-700">Loan Amount</th>
              <th className="text-right p-4 font-semibold text-gray-700">Repaid</th>
              <th className="text-right p-4 font-semibold text-gray-700">Remaining</th>
              <th className="text-right p-4 font-semibold text-gray-700">Monthly Ded.</th>
              <th className="text-center p-4 font-semibold text-gray-700">Date</th>
              <th className="text-center p-4 font-semibold text-gray-700">Status</th>
              <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : loans.length > 0 ? (
              loans.map((loan: any) => (
                <React.Fragment key={loan.loan_id}>
                  <tr className="border-b hover:bg-gray-50 transition">
                    <td className="p-4">
                      <div className="font-semibold text-gray-800">{loan.full_name}</div>
                      <div className="text-xs text-gray-500">{loan.employee_id || ''} {loan.department ? `- ${loan.department}` : ''}</div>
                    </td>
                    <td className="p-4 text-right font-medium">${Number(loan.loan_amount).toLocaleString()}</td>
                    <td className="p-4 text-right font-medium text-green-600">${Number(loan.total_repaid || 0).toLocaleString()}</td>
                    <td className="p-4 text-right font-bold text-red-600">${Number(loan.remaining_balance).toLocaleString()}</td>
                    <td className="p-4 text-right text-gray-600">{Number(loan.monthly_deduction) > 0 ? `$${Number(loan.monthly_deduction).toLocaleString()}` : '-'}</td>
                    <td className="p-4 text-center text-gray-600">{new Date(loan.loan_date).toLocaleDateString()}</td>
                    <td className="p-4 text-center">{statusBadge(loan.status)}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => toggleRepayments(loan.loan_id)} className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition" title="View Repayments">
                          <Eye size={16} />
                        </button>
                        {loan.status === 'active' && (
                          <>
                            <button onClick={() => { setSelectedLoan(loan); setShowRepayModal(true); }} className="text-green-600 hover:bg-green-50 p-2 rounded-lg transition" title="Record Repayment">
                              <DollarSign size={16} />
                            </button>
                            <button onClick={() => handleCancel(loan)} className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition" title="Cancel Loan">
                              <Ban size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedLoan === loan.loan_id && (
                    <tr key={`rep-${loan.loan_id}`}>
                      <td colSpan={8} className="p-0">
                        <div className="bg-gray-50 p-4 border-b-2 border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Repayment History {loan.reason && <span className="font-normal text-gray-500 ml-2">Reason: {loan.reason}</span>}</h4>
                          {repayments[loan.loan_id]?.length > 0 ? (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left py-2 px-3">Date</th>
                                  <th className="text-right py-2 px-3">Amount</th>
                                  <th className="text-left py-2 px-3">Method</th>
                                  <th className="text-left py-2 px-3">Notes</th>
                                </tr>
                              </thead>
                              <tbody>
                                {repayments[loan.loan_id].map((r: any) => (
                                  <tr key={r.repayment_id} className="border-t border-gray-200">
                                    <td className="py-2 px-3">{new Date(r.repayment_date).toLocaleDateString()}</td>
                                    <td className="py-2 px-3 text-right font-medium text-green-600">${Number(r.amount).toLocaleString()}</td>
                                    <td className="py-2 px-3 capitalize">{r.payment_method?.replace('_', ' ')}</td>
                                    <td className="py-2 px-3 text-gray-500">{r.notes || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-sm text-gray-500">No repayments yet</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr><td colSpan={8} className="p-8 text-center text-gray-500">No loans found</td></tr>
            )}
          </tbody>
        </table>

        {pagination.totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">Page {pagination.page} of {pagination.totalPages}</div>
            <div className="flex gap-2">
              <button onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))} disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition">Previous</button>
              <button onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))} disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition">Next</button>
            </div>
          </div>
        )}
      </div>

      <IssueLoanModal isOpen={showIssueModal} onClose={() => setShowIssueModal(false)} onSuccess={fetchLoans} />
      {selectedLoan && <LoanRepaymentModal isOpen={showRepayModal} onClose={() => { setShowRepayModal(false); setSelectedLoan(null); }} onSuccess={() => { fetchLoans(); if (expandedLoan) { api.get(`/staff/loans/${expandedLoan}/repayments`).then(r => setRepayments(prev => ({ ...prev, [expandedLoan]: r.data.data || [] }))); } }} loan={selectedLoan} />}
    </div>
  );
};

export default LoanManagement;
