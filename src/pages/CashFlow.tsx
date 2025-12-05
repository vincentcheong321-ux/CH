import React, { useState, useEffect } from 'react';
import { ArrowDownLeft, ArrowUpRight, Save } from 'lucide-react';
import { getAssetRecords, saveAssetRecord } from '../services/storageService';
import { AssetRecord } from '../types';

const CashFlow: React.FC = () => {
  const [records, setRecords] = useState<AssetRecord[]>([]);
  const [form, setForm] = useState({
    type: 'IN' as 'IN' | 'OUT',
    amount: '',
    description: '',
    category: 'General'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setRecords(getAssetRecords().reverse()); // Show newest first
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description) return;

    saveAssetRecord({
      date: new Date().toISOString(),
      type: form.type,
      amount: parseFloat(form.amount),
      description: form.description,
      category: form.category
    });

    setForm({ type: 'IN', amount: '', description: '', category: 'General' });
    loadData();
  };

  const totalIn = records.filter(r => r.type === 'IN').reduce((acc, c) => acc + c.amount, 0);
  const totalOut = records.filter(r => r.type === 'OUT').reduce((acc, c) => acc + c.amount, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Input Section */}
      <div className="lg:col-span-1 space-y-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Assets Manager</h1>
            <p className="text-gray-500">Record cash in/out events.</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4 flex items-center">
                <Save size={18} className="mr-2" />
                New Entry
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setForm({...form, type: 'IN'})}
                        className={`p-2 rounded-lg text-sm font-bold border ${form.type === 'IN' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-500'}`}
                    >
                        IN (Income)
                    </button>
                    <button
                        type="button"
                        onClick={() => setForm({...form, type: 'OUT'})}
                        className={`p-2 rounded-lg text-sm font-bold border ${form.type === 'OUT' ? 'bg-red-50 border-red-500 text-red-700' : 'border-gray-200 text-gray-500'}`}
                    >
                        OUT (Expense)
                    </button>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input 
                        type="number" step="0.01" required
                        value={form.amount}
                        onChange={e => setForm({...form, amount: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <input 
                        type="text" required
                        value={form.description}
                        onChange={e => setForm({...form, description: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Utility Bill"
                    />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select 
                        value={form.category}
                        onChange={e => setForm({...form, category: e.target.value})}
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option>General</option>
                        <option>Operational Cost</option>
                        <option>Investment</option>
                        <option>Loan</option>
                    </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium">
                    Record Asset
                </button>
            </form>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-600 text-sm uppercase mb-4">Summary</h3>
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-gray-500">Total In</span>
                    <span className="text-green-600 font-bold font-mono">+${totalIn.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-gray-500">Total Out</span>
                    <span className="text-red-600 font-bold font-mono">-${totalOut.toLocaleString()}</span>
                </div>
                <div className="pt-4 border-t flex justify-between items-center">
                    <span className="font-bold text-gray-800">Net Flow</span>
                    <span className={`font-bold font-mono text-xl ${totalIn - totalOut >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        ${(totalIn - totalOut).toLocaleString()}
                    </span>
                </div>
            </div>
        </div>
      </div>

      {/* List Section */}
      <div className="lg:col-span-2">
         <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
             <div className="p-6 border-b border-gray-100">
                 <h2 className="font-bold text-gray-800">Transaction History</h2>
             </div>
             <div className="overflow-x-auto">
                 <table className="w-full text-left">
                     <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                         <tr>
                             <th className="px-6 py-4">Type</th>
                             <th className="px-6 py-4">Description</th>
                             <th className="px-6 py-4">Date</th>
                             <th className="px-6 py-4 text-right">Amount</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-100">
                         {records.map(r => (
                             <tr key={r.id} className="hover:bg-gray-50">
                                 <td className="px-6 py-4">
                                     <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                         r.type === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                     }`}>
                                         {r.type === 'IN' ? <ArrowDownLeft size={14} className="mr-1"/> : <ArrowUpRight size={14} className="mr-1"/>}
                                         {r.type}
                                     </span>
                                 </td>
                                 <td className="px-6 py-4">
                                     <p className="text-sm font-medium text-gray-900">{r.description}</p>
                                     <p className="text-xs text-gray-500">{r.category}</p>
                                 </td>
                                 <td className="px-6 py-4 text-sm text-gray-500">
                                     {new Date(r.date).toLocaleDateString()}
                                 </td>
                                 <td className={`px-6 py-4 text-right font-bold font-mono ${r.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                                     {r.type === 'IN' ? '+' : '-'}{r.amount.toLocaleString()}
                                 </td>
                             </tr>
                         ))}
                         {records.length === 0 && (
                             <tr>
                                 <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No records found.</td>
                             </tr>
                         )}
                     </tbody>
                 </table>
             </div>
         </div>
      </div>
    </div>
  );
};

export default CashFlow;