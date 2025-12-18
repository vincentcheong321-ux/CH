
import React, { useEffect, useState } from 'react';
import { getClients, fetchClientTotalBalance, getAllLedgerRecords } from '../services/storageService';
import { Client, LedgerRecord } from '../types';
import { TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import { MONTH_NAMES, getWeeksForMonth } from '../utils/reportUtils';
import { supabase } from '../supabaseClient';

// Constants to match SalesIndex for exact tallying
const PAPER_Z_CODES = ['Z03', 'Z05', 'Z07', 'Z15', 'Z19', 'Z20'];
const PAPER_C_CODES = ['C03', 'C04', 'C06', 'C09', 'C13', 'C15', 'C17'];

const Summary: React.FC = () => {
  const [clientData, setClientData] = useState<{client: Client, total: number}[]>([]);
  const [weeklyData, setWeeklyData] = useState<{date: string, total: number, count: number}[]>([]);
  const [activeTab, setActiveTab] = useState<'weekly' | 'clients'>('weekly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        // 1. Fetch Client Balances
        const clients = await getClients();
        const summary = await Promise.all(clients.map(async (client) => {
            const total = await fetchClientTotalBalance(client.id);
            return { client, total };
        }));
        summary.sort((a, b) => b.total - a.total);
        setClientData(summary);

        // 2. REDEFINED: Fetch Weekly Earnings from Sales Opening (Paper & Mobile Earnings)
        // Grouping by SUNDAY cutoff.
        if (supabase) {
            const { data: sales } = await supabase.from('financial_journal').select('*').eq('entry_type', 'SALE');
            
            if (sales) {
                // Map of Sunday-Date -> total earnings
                const weeklyEarningsMap = new Map<string, { total: number, count: number }>();

                // Define all valid weeks in our system across 2025-2026
                const allWeeks: { start: string, end: string, label: string }[] = [];
                for (let y = 2025; y <= 2026; y++) {
                    for (let m = 0; m < 12; m++) {
                        const weeks = getWeeksForMonth(y, m);
                        Object.values(weeks).forEach(days => {
                            const startStr = days[0].toISOString().split('T')[0];
                            const endStr = days[6].toISOString().split('T')[0]; // SUNDAY
                            allWeeks.push({ start: startStr, end: endStr, label: endStr });
                        });
                    }
                }

                sales.forEach(row => {
                    const client = clients.find(c => c.id === row.client_id);
                    if (!client) return;

                    // FILTER Logic: Only sum clients that are displayed in SalesIndex to ensure tally
                    const isPaperProfile = (client.category || 'paper') === 'paper';
                    const codeUpper = (client.code || '').toUpperCase();
                    const isValidPaper = PAPER_Z_CODES.includes(codeUpper) || PAPER_C_CODES.includes(codeUpper);
                    const isMobileProfile = client.category === 'mobile';

                    if (!isValidPaper && !isMobileProfile) return;

                    const date = row.entry_date;
                    // Find which Mon-Sun week this date belongs to
                    const week = allWeeks.find(w => date >= w.start && date <= w.end);
                    if (!week) return;

                    let earnings = 0;
                    if (isMobileProfile) {
                        // Mobile Earnings = abs(idx 11: Shareholder Total)
                        const shareholderTotalStr = row.data?.mobileRawData?.[11] || '0';
                        earnings = Math.abs(parseFloat(String(shareholderTotalStr).replace(/,/g, '')) || 0);
                    } else if (isValidPaper) {
                        // Paper Earnings = abs((Raw * 0.83) - (Raw * 0.86))
                        const b = row.data?.b || 0;
                        const s = row.data?.s || 0;
                        const a = row.data?.a || 0;
                        const c = row.data?.c || 0;
                        const rawTotal = b + s + a + c;
                        const comp = rawTotal * 0.83;
                        const clie = rawTotal * 0.86;
                        earnings = Math.abs(comp - clie);
                    }

                    const existing = weeklyEarningsMap.get(week.label) || { total: 0, count: 0 };
                    weeklyEarningsMap.set(week.label, {
                        total: existing.total + earnings,
                        count: existing.count + 1
                    });
                });

                const weeklyList = Array.from(weeklyEarningsMap.entries()).map(([date, data]) => ({
                    date,
                    total: data.total,
                    count: data.count
                }));

                // Sort newest week (Sunday) first
                weeklyList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setWeeklyData(weeklyList);
            }
        }
        setLoading(false);
    }
    fetchData();
  }, []);

  const totalReceivables = clientData.reduce((acc, curr) => acc + curr.total, 0);
  const totalWeeklyEarnings = weeklyData.reduce((acc, curr) => acc + curr.total, 0);

  const formatDate = (dateStr: string) => {
      // Safe parsing to avoid timezone offset shifts that move Sunday to Saturday
      const [y, m, d] = dateStr.split('-').map(Number);
      return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Financial Summary</h1>
            <p className="text-gray-500">Calculated from Sales Opening earnings.</p>
        </div>
        
        <div className="bg-gray-200 p-1 rounded-xl flex self-start md:self-auto shadow-inner">
            <button 
                onClick={() => setActiveTab('weekly')}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'weekly' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-600 hover:text-gray-900'}`}
            >
                Weekly Earnings
            </button>
            <button 
                onClick={() => setActiveTab('clients')}
                className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'clients' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-600 hover:text-gray-900'}`}
            >
                Client Net Balances
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
            <div className="relative z-10">
                <h2 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Company Profit Net</h2>
                <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-emerald-600">
                        +${totalWeeklyEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                <p className="text-sm text-gray-400 mt-2">Sum of Paper + Mobile Earnings</p>
            </div>
            <div className="absolute right-0 bottom-0 p-6 opacity-5">
                <TrendingUp size={100} className="text-emerald-600" />
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
            <div className="relative z-10">
                <h2 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">Active Receivables</h2>
                <div className="flex items-baseline">
                    <span className={`text-4xl font-bold ${totalReceivables >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                        ${Math.abs(totalReceivables).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="ml-2 text-xs font-bold text-gray-400">{totalReceivables >= 0 ? 'OWED TO CO' : 'CREDIT'}</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">Total outstanding debt across all client ledgers</p>
            </div>
            <div className="absolute right-0 bottom-0 p-6 opacity-5 text-blue-600">
                <Calendar size={100} />
            </div>
        </div>
      </div>

      {loading ? (
          <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
      ) : activeTab === 'weekly' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h3 className="font-bold text-gray-800">Weekly Earnings (Opening Profit)</h3>
                <span className="text-xs font-bold bg-white border px-3 py-1 rounded-full text-gray-500">{weeklyData.length} Weeks Recorded</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-widest">
                    <tr>
                    <th className="px-6 py-4">Week Ending (Sun)</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Net Profit</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                    {weeklyData.map((week) => (
                    <tr key={week.date} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                            <div className="flex items-center">
                                <Calendar size={16} className="text-blue-500 mr-3" />
                                <span className="font-bold text-gray-900">{formatDate(week.date)}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">Sales Profit</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <span className="font-bold text-lg text-emerald-600">
                                +${Math.abs(week.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </td>
                    </tr>
                    ))}
                    {weeklyData.length === 0 && (
                        <tr>
                            <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                                No sales profit data found for the selected years.
                            </td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>
          </div>
      ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <h3 className="font-bold text-gray-800">Client Net Balances (Overall)</h3>
            </div>
            <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-widest">
                <tr>
                <th className="px-6 py-4">Client Name</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4 text-right">Ledger Total</th>
                <th className="px-6 py-4 text-right">Status</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
                {clientData.map(({ client, total }) => (
                <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                        <span className="font-bold text-gray-900">{client.name}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">{client.code}</td>
                    <td className={`px-6 py-4 text-right font-bold text-lg ${total >= 0 ? 'text-blue-600' : 'text-green-600'}`}>
                        ${Math.abs(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
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
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No clients found.</td></tr>
                )}
            </tbody>
            </table>
          </div>
      )}
    </div>
  );
};

export default Summary;
