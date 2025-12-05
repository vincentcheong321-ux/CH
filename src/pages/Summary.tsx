
import React, { useEffect, useState } from 'react';
import { getClients, getClientBalance } from '../services/storageService';
import { Client } from '../types';

const Summary: React.FC = () => {
  const [data, setData] = useState<{client: Client, total: number}[]>([]);

  useEffect(() => {
    const clients = getClients();
    
    const summary = clients.map(client => {
      const total = getClientBalance(client.id);
      return { client, total };
    });

    // Sort by Total Descending
    summary.sort((a, b) => b.total - a.total);
    setData(summary);
  }, []);

  const totalReceivables = data.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Client Balance Summary</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="text-gray-500 text-sm font-bold uppercase tracking-wide">Total Net Receivables</h2>
        <p className={`text-4xl font-bold mt-2 ${totalReceivables >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
          ${totalReceivables.toLocaleString()}
        </p>
        <p className="text-sm text-gray-400 mt-2">Sum of all client ledger balances</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Client Name</th>
              <th className="px-6 py-4">Code</th>
              <th className="px-6 py-4 text-right">Total Balance</th>
              <th className="px-6 py-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map(({ client, total }) => (
              <tr key={client.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{client.name}</td>
                <td className="px-6 py-4 text-gray-500 font-mono text-sm">{client.code}</td>
                <td className={`px-6 py-4 text-right font-bold text-lg ${total >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {total.toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    total > 0 ? 'bg-blue-100 text-blue-700' : 
                    total < 0 ? 'bg-green-100 text-green-700' : 
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {total > 0 ? 'OWES COMPANY' : total < 0 ? 'COMPANY OWES' : 'SETTLED'}
                  </span>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
                <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No clients found.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Summary;