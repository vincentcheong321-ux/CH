
import React, { useEffect, useState } from 'react';
import { getClients, fetchClientTotalBalance, getSalesForDates, getAssetRecords } from '../services/storageService';
import { Client } from '../types';
import { TrendingUp, Calendar, Loader2, DollarSign, Wallet, BarChart3 } from 'lucide-react';
import { MONTH_NAMES, getWeeksForMonth } from '../utils/reportUtils';
import { supabase } from '../supabaseClient';

// Constants to match SalesIndex logic exactly for tallying
const PAPER_Z_CODES = ['Z03', 'Z05', 'Z07', 'Z15', 'Z19', 'Z20'];
const PAPER_C_CODES = ['C03', 'C04', 'C06', 'C09', 'C13', 'C15', 'C17'];

const Summary: React.FC = () => {
  const [clientData, setClientData] = useState<{client: Client, total: number, paperWeekly: number, mobileWeekly: number}[]>([]);
  const [weeklyData, setWeeklyData] = useState<{date: string, total: number}[]>([]);
  const [activeTab, setActiveTab] = useState<'weekly' | 'clients'>('weekly');
  const [loading, setLoading] = useState(true);
  const [cashBalance, setCashBalance] = useState(0);

  // Helper to get YYYY-MM-DD from a local Date object without timezone shift
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        // 1. Fetch Clients & Assets
        const clients = await getClients();
        const assets = getAssetRecords();
        const assetsIn = assets.filter(a => a.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);
        const assetsOut = assets.filter(a => a.type === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);
        setCashBalance(assetsIn - assetsOut);

        // 2. Fetch current week's sales for detailed client breakdown
        const now = new Date();
        const weeks = getWeeksForMonth(now.getFullYear(), now.getMonth());
        const todayStr = formatLocalDate(now);
        const currentWeekDays = Object.values(weeks).find(days => 
            days.some(d => formatLocalDate(d) === todayStr)
        ) || Object.values(weeks)[0];

        const activeDateStrings = currentWeekDays.map(d => formatLocalDate(d));
        const currentWeekSales = await getSalesForDates(activeDateStrings);

        // 3. Process each client with their net balance and weekly earnings
        const summary = await Promise.all(clients.map(async (client) => {
            const total = await fetchClientTotalBalance(client.id);
            
            // Calculate Paper Weekly for this client
            const clientRecs = currentWeekSales.filter(r => r.clientId === client.id);
            const rawTotal = clientRecs.reduce((sum, r) => sum + (r.b||0) + (r.s||0) + (r.a||0) + (r.c||0), 0);
            const paperWeekly = (client.category || 'paper') === 'paper' 
                ? Math.abs((rawTotal * 0.83) - (rawTotal * 0.86)) 
                : 0;

            // Calculate Mobile Weekly for this client
            const mobileWeekly = client.category === 'mobile' && clientRecs.length > 0
                ? Math.abs(parseFloat(String(clientRecs[clientRecs.length - 1].mobileRawData?.[11] || '0').replace(/,/g, '')) || 0)
                : 0;

            return { client, total, paperWeekly, mobileWeekly };
        }));

        summary.sort((a, b) => b.total - a.total);
        setClientData(summary);

        // 4. Weekly earnings logic for history tab
        if (supabase) {
            const { data: sales } = await supabase.from('financial_journal').select('*').eq('entry_type', 'SALE');
            
            if (sales) {
                const weeklyEarningsMap = new Map<string, number>();

                const allWeeks: { start: string, end: string, label: string }[] = [];
                for (let y = 2025; y <= 2026; y++) {
                    for (let m = 0; m < 12; m++) {
                        const weeks = getWeeksForMonth(y, m);
                        Object.values(weeks).forEach(days => {
                            const startStr = formatLocalDate(days[0]);
                            const endStr = formatLocalDate(days[6]); // SUNDAY
                            allWeeks.push({ start: startStr, end: endStr, label: endStr });
                        });
                    }
                }

                sales.forEach(row => {
                    const client = clients.find(c => c.id === row.client_id);
                    if (!client) return;

                    const isPaperProfile = (client.category || 'paper') === 'paper';
                    const codeUpper = (client.code || '').toUpperCase();
                    const isValidPaper = PAPER_Z_CODES.includes(codeUpper) || PAPER_C_CODES.includes(codeUpper);
                    const isMobileProfile = client.category === 'mobile';

                    if (!isValidPaper && !isMobileProfile) return;

                    const date = row.entry_date;
                    const week = allWeeks.find(w => date >= w.start && date <= w.end);
                    if (!week) return;

                    let earnings = 0;
                    if (isMobileProfile) {
                        const shareholderTotalStr = row.data?.mobileRawData?.[11] || '0';
                        earnings = Math.abs(parseFloat(String(shareholderTotalStr).replace(/,/g, '')) || 0);
                    } else if (isValidPaper) {
                        const b = row.data?.b || 0;
                        const s = row.data?.s || 0;
                        const a = row.data?.a || 0;
                        const c = row.data?.c || 0;
                        const rawTotal = b + s + a + c;
                        const comp = rawTotal * 0.83;
                        const clie = rawTotal * 0.86;
                        earnings = Math.abs(comp - clie);
                    }

                    const existing = weeklyEarningsMap.get(week.label) || 0;
                    weeklyEarningsMap.set(week.label, existing + earnings);
                });

                const weeklyList = Array.from(weeklyEarningsMap.entries()).map(([date, total]) => ({
                    date,
                    total
                }));

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
  const totalCompanyWorth = cashBalance + totalReceivables;

  const formatDate = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return `${d} ${MONTH_NAMES[m - 1].slice(0, 3)} ${y}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Financial Summary</h1>
            <p className="text-gray-500 mt-1">Cross-check profit net and company liquidity.</p>
        </div>
        
        <div className="bg-gray-200 p-1 rounded-2xl flex self-start md:self-auto shadow-inner">
            <button 
                onClick={() => setActiveTab('weekly')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'weekly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
                Earnings History
            </button>
            <button 
                onClick={() => setActiveTab('clients')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'clients' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
                Balance Ledger
            </button>
        </div>
      </div>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* New Total Worth Card */}
        <div className="bg-gradient-to-br from-indigo-700 to-blue-800 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
            <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                    <h2 className="text-indigo-100 text-xs font-black uppercase tracking-widest mb-2">Total Balance of Company</h2>
                    <div className="text-4xl font-black font-mono">
                        ${totalCompanyWorth.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="mt-8 flex items-center bg-white/10 w-fit px-4 py-1.5 rounded-full border border-white/20">
                    <BarChart3 size={16} className="mr-2" />
                    <span className="text-sm font-bold">Liquid + Receivables</span>
                </div>
            </div>
            <BarChart3 size={180} className="absolute -right-12 -bottom-12 opacity-10 rotate-12" />
        </div>

        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm shadow-gray-200/50 relative overflow-hidden">
            <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                    <h2 className="text-gray-400 text-xs font-black uppercase tracking-widest mb-2">Total Sales Earnings</h2>
                    <div className="text-4xl font-black font-mono text-emerald-600">
                        +${totalWeeklyEarnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="mt-8 flex items-center text-gray-500 text-sm font-bold">
                    <TrendingUp size={16} className="mr-2 text-emerald-500" />
                    Sum of system profit net
                </div>
            </div>
            <TrendingUp size={180} className="absolute -right-12 -bottom-12 opacity-5 text-emerald-500 rotate-12" />
        </div>

        <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm shadow-gray-200/50 relative overflow-hidden">
            <div className="relative z-10 flex flex-col justify-between h-full">
                <div>
                    <h2 className="text-gray-400 text-xs font-black uppercase tracking-widest mb-2">Net Active Receivables</h2>
                    <div className={`text-4xl font-black font-mono ${totalReceivables >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                        ${Math.abs(totalReceivables).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>
                <div className="mt-8 flex items-center text-gray-500 text-sm font-bold">
                    <Wallet size={16} className="mr-2 text-blue-500" />
                    Outstanding client debt
                </div>
            </div>
            <DollarSign size={180} className="absolute -right-12 -bottom-12 opacity-5 text-blue-500 rotate-[-15deg]" />
        </div>
      </div>

      {loading ? (
          <div className="flex justify-center items-center py-24"><Loader2 className="animate-spin text-blue-600" size={48} strokeWidth={3} /></div>
      ) : activeTab === 'weekly' ? (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                <h3 className="font-black text-gray-800 uppercase tracking-tight text-lg">Weekly Earning Breakdown</h3>
                <div className="flex items-center space-x-2 text-gray-400 font-bold text-xs">
                    <Calendar size={14} />
                    <span>{weeklyData.length} WEEKS ANALYZED</span>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                    <tr>
                    <th className="pl-8 pr-6 py-4">Week Ending (Sun)</th>
                    <th className="pr-8 pl-6 py-4 text-right">Weekly Profit</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-mono">
                    {weeklyData.map((week) => (
                    <tr key={week.date} className="hover:bg-gray-50 transition-colors group">
                        <td className="pl-8 pr-6 py-5">
                            <div className="flex items-center">
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mr-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Calendar size={18} />
                                </div>
                                <span className="font-black text-gray-900 text-lg">{formatDate(week.date)}</span>
                            </div>
                        </td>
                        <td className="pr-8 pl-6 py-5 text-right">
                            <span className="font-black text-2xl text-emerald-600">
                                +${Math.abs(week.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </td>
                    </tr>
                    ))}
                    {weeklyData.length === 0 && (
                        <tr>
                            <td colSpan={2} className="px-6 py-24 text-center">
                                <div className="max-w-xs mx-auto">
                                    <TrendingUp size={48} className="mx-auto text-gray-200 mb-4" />
                                    <p className="text-gray-400 font-bold">No sales profit data found for the current period.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
                </table>
            </div>
          </div>
      ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/30">
                <h3 className="font-black text-gray-800 uppercase tracking-tight text-lg">Detailed Ledger Balances</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                <thead className="bg-gray-50/50 text-gray-400 text-[10px] uppercase font-black tracking-widest">
                    <tr>
                    <th className="pl-8 pr-6 py-4">Client Name</th>
                    <th className="px-6 py-4 text-right">Paper Weekly Total</th>
                    <th className="px-6 py-4 text-right">Mobile Weekly Total</th>
                    <th className="pr-8 pl-6 py-4 text-right">Net Balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-mono">
                    {clientData.map(({ client, total, paperWeekly, mobileWeekly }) => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                        <td className="pl-8 pr-6 py-5">
                            <div className="flex flex-col">
                                <span className="font-black text-gray-900 text-lg uppercase tracking-tight">{client.name}</span>
                                <span className="text-gray-400 text-[10px] font-bold">{client.code || '-'}</span>
                            </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                             <span className={`font-bold ${paperWeekly > 0 ? 'text-blue-600' : 'text-gray-300'}`}>
                                {paperWeekly > 0 ? `$${paperWeekly.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                             </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                             <span className={`font-bold ${mobileWeekly > 0 ? 'text-orange-600' : 'text-gray-300'}`}>
                                {mobileWeekly > 0 ? `$${mobileWeekly.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                             </span>
                        </td>
                        <td className={`pr-8 pl-6 py-5 text-right font-black text-xl ${total >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                            ${Math.abs(total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                    </tr>
                    ))}
                    {clientData.length === 0 && (
                        <tr><td colSpan={4} className="px-6 py-24 text-center text-gray-300 font-bold">No registered clients found in system.</td></tr>
                    )}
                </tbody>
                </table>
            </div>
          </div>
      )}
    </div>
  );
};

export default Summary;
