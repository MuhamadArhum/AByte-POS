import { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import api from '../utils/api';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    try {
      const res = await api.get('/expenses', { params: { limit: 50 } });
      setExpenses(res.data.data);
    } catch (error) {
      console.error('Failed to fetch expenses', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Expenses</h1>
          <p className="text-gray-600 mt-1">Track and manage business expenses</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Description</th>
              <th className="text-left p-4">Category</th>
              <th className="text-right p-4">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense: any) => (
              <tr key={expense.expense_id} className="border-b hover:bg-gray-50">
                <td className="p-4">{new Date(expense.expense_date).toLocaleDateString()}</td>
                <td className="p-4">{expense.description}</td>
                <td className="p-4">{expense.category_name}</td>
                <td className="p-4 text-right font-semibold">Rs. {expense.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Expenses;
