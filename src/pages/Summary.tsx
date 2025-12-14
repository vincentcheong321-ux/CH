
import React, { useEffect, useState } from 'react';
import { getClients, getClientBalance, getAllDrawRecords } from '../services/storageService';
import { Client } from '../types';
import { TrendingUp, TrendingDown, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { MONTH_NAMES } from '../utils/reportUtils';

const Summary: React.FC = () => {
  const [clientData, setClientData] = useState<{client: Client, total: number}[]>([]);
  const [weeklyData, setWeeklyData] = useState<{date: string, total: number, count: number}[]>([]);
  const [activeTab, setActiveTab] = useState<'weekly' | 'clients'>('weekly');

  useEffect(() => {
    const fetchData = async () => {
        // 1. Fetch Client Balances
        const clients = await getClients();
        const summary = clients.map(client => {
            const total = getClientBalance(client.id);
            return { client, total };
        });
        summary.sort((a, b) => b.total - a.total);
        setClientData(summary);

        // 2. Fetch Weekly Earnings (Draw Records)
        const draws = await getAllDrawRecords();
        const weeklyMap = new Map<string, number>();
        const weeklyCount = new Map<string, number>();

        draws.forEach(d => {
            const current = weeklyMap.get(d.date) || 0;
            const count = weeklyCount.get(d.date) || 0;
            weeklyMap.set(d.date, current + d.balance);
            weeklyCount.set(d.date, count + 1);
        });

        const weeklyList = Array.from(weeklyMap.entries()).map(([date, total]) => ({
            date,
            total,
            count: weeklyCount.get(date) || 0
        }));

        // Sort by date descending (newest first)
        weeklyList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setWeeklyData(weeklyList);
    }
    fetchData();
  }, []);

  const totalReceivables = clientData.reduce((acc, curr) => acc + curr.total, 0);
  const totalWeeklyEarnings = weeklyData.reduce((acc, curr) => acc + curr.total, 0);

  const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0,3)} ${d.getFullYear()}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Financial Summary</h1>
            <p className="text-gray-500">Company performance and client standings.</p>
        </div>
        
        {/* Toggle Tabs */}
        <div className="bg-gray-200 p-1 rounded-lg flex self-start md:self-auto">
            <button 
                onClick={() => setActiveTab('weekly')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'weekly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
                Weekly Earnings
            </button>
            <button 
                onClick={() => setActiveTab('clients')}
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'clients' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
                Client Net Balances
            </button>
        </div>
      </div>
      
      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
            <div className="relative z-10">
                <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wide">Total Weekly Net</h2>
                <div className="flex items-baseline mt-2">
                    <span className={`text-4xl font-bold ${totalWeeklyEarnings >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {totalWeeklyEarnings >= 0 ? '+' : ''}${totalWeeklyEarnings.toLocaleString()}
                    </span>
                </div>
                <p className="text-sm text-gray-400 mt-2">Aggregated earnings from all weekly reports</p>
            </div>
            <div className="absolute right-0 bottom-0 p-6 opacity-5">
                <TrendingUp size={100} />
            </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
            <div className="relative z-10">
                <h2 className="text-gray-500 text-xs font-bold uppercase tracking-wide">Current Client Receivables</h2>
                <div className="flex items-baseline mt-2">
                    <span className={`text-4xl font-bold ${totalReceivables >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        ${totalReceivables.toLocaleString()}
                    </span>
                </div>
                <p className="text-sm text-gray-400 mt-2">Net outstanding balance across all clients</p>
            </div>
            <div className="absolute right-0 bottom-0 p-6 opacity-5">
                <Calendar size={100} />
            </div>
        </div>
      </div>

      {activeTab === 'weekly' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Weekly Earnings Report</h3>
                <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">{weeklyData.length} Weeks Recorded</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                    <tr>
                    <th className="px-6 py-4">Week Ending / Draw Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Records</th>
                    <th className="px-6 py-4 text-right">Net Earnings</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {weeklyData.map((week, idx) => (
                    <tr key={week.date} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center">
                                <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mr-3">
                                    <Calendar size={18} />
                                </div>
                                <span className="font-medium text-gray-900">{formatDate(week.date)}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                week.total > 0 ? 'bg-green-100 text-green-800' : 
                                week.total < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                                {week.total > 0 ? <ArrowUpRight size={14} className="mr-1"/> : week.total < 0 ? <ArrowDownRight size={14} className="mr-1"/> : '-'}
                                {week.total > 0 ? 'Profit' : week.total < 0 ? 'Loss' : 'Neutral'}
                            </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-500 font-mono text-sm">
                            {week.count} Clients
                        </td>
                        <td className={`px-6 py-4 text-right font-bold text-lg font-mono ${week.total > 0 ? 'text-green-600' : week.total < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {week.total > 0 ? '+' : ''}{week.total.toLocaleString()}
                        </td>
                    </tr>
                    ))}
                    {weeklyData.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                                No weekly data found. Start by adding records in Draw Reports.
                            </td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>
          </div>
      )}

      {activeTab === 'clients' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">Client Net Balances</h3>
            </div>
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
                {clientData.map(({ client, total }) => (
                <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{client.name}</td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-sm">{client.code}</td>
                    <td className={`px-6 py-4 text-right font-bold text-lg font-mono ${total >= 0 ? 'text-blue-600' : 'text-green-600'}`}>
                    {total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        total > 0 ? 'bg-blue-100 text-blue-700' : 
                        total < 0 ? 'bg-green-100 text-green-700' : 
                        'bg-gray-100 text-gray-600'
                    }`}>
                        {total > 0 ? 'OWES CO' : total < 0 ? 'CO OWES' : 'SETTLED'}
                    </span>
                    </td>
                </tr>
                ))}
                {clientData.length === 0 && (
                    <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No clients found.</td>
                    </tr>
                )}
            </tbody>
            </table>
          </div>
      )}
    </div>
  );
};

export default Summary;
