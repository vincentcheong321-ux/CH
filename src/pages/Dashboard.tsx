
import React, { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { getAllLedgerRecords, getAssetRecords, getNetAmount, getClients, getAllDrawRecords } from '../services/storageService';
import { TrendingUp, TrendingDown, DollarSign, Wallet, BarChart3 } from 'lucide-react';
import { getWeeksForMonth, MONTH_NAMES } from '../utils/reportUtils';
import { supabase } from '../supabaseClient';

const PAPER_Z_CODES = ['Z03', 'Z05', 'Z07', 'Z15', 'Z19', 'Z20'];
const PAPER_C_CODES = ['C03', 'C04', 'C06', 'C09', 'C13', 'C15', 'C17'];

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalCompanyValue: 0,
    totalEarnings: 0,
    totalAssetsIn: 0,
    totalAssetsOut: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [weeklyChartData, setWeeklyChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        const clients = await getClients();
        const assets = getAssetRecords();
        const allDraws = await getAllDrawRecords();

        // 1. Calculate Total Company Value (Total of LATEST draw report week)
        // Find the most recent date in draw records
        let latestDrawValue = 0;
        if (allDraws.length > 0) {
            const sortedDrawDates = [...new Set(allDraws.map(d => d.date))].sort((a, b) => b.localeCompare(a));
            const latestDate = sortedDrawDates[0];
            latestDrawValue = allDraws.filter(d => d.date === latestDate).reduce((acc, curr) => acc + curr.balance, 0);
        }

        // 2. Calculate Total Earnings (All-time sales profit)
        let totalEarnings = 0;
        if (supabase) {
            const { data: sales } = await supabase.from('financial_journal').select('*').eq('entry_type', 'SALE');
            if (sales) {
                sales.forEach(row => {
                    const client = clients.find(c => c.id === row.client_id);
                    if (!client) return;
                    
                    const isMobileProfile = client.category === 'mobile';
                    const codeUpper = (client.code || '').toUpperCase();
                    const isValidPaper = PAPER_Z_CODES.includes(codeUpper) || PAPER_C_CODES.includes(codeUpper);

                    if (isMobileProfile) {
                        const shareholderTotalStr = row.data?.mobileRawData?.[11] || '0';
                        totalEarnings += Math.abs(parseFloat(String(shareholderTotalStr).replace(/,/g, '')) || 0);
                    } else if (isValidPaper) {
                        const b = row.data?.b || 0;
                        const s = row.data?.s || 0;
                        const a = row.data?.a || 0;
                        const c = row.data?.c || 0;
                        const rawTotal = b + s + a + c;
                        totalEarnings += Math.abs((rawTotal * 0.83) - (rawTotal * 0.86));
                    }
                });
            }
        }

        const assetsIn = assets.filter(a => a.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);
        const assetsOut = assets.filter(a => a.type === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);

        setStats({
            totalCompanyValue: latestDrawValue,
            totalEarnings: totalEarnings,
            totalAssetsIn: assetsIn,
            totalAssetsOut: assetsOut
        });

        // --- Ledger Line Chart Data ---
        const ledgers = await getAllLedgerRecords(); 
        const data = ledgers.slice(-10).map((l, i) => ({
            name: `T-${i}`,
            amount: getNetAmount(l),
            volume: l.amount 
        }));
        setChartData(data);

        // --- Weekly Draw Chart Data (Current Month) ---
        const currentYear = new Date().getFullYear();
        const currentMonthIndex = new Date().getMonth();
        const weeks = getWeeksForMonth(currentYear, currentMonthIndex);
        
        const wData = Object.keys(weeks).sort((a,b)=>Number(a)-Number(b)).map((weekNum, index) => {
            const days = weeks[Number(weekNum)];
            const weekTotal = allDraws.reduce((acc, r) => {
                const match = days.some(d => {
                    const yearStr = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(d.getDate()).padStart(2, '0');
                    return r.date === `${yearStr}-${m}-${dayStr}`;
                });
                return match ? acc + r.balance : acc;
            }, 0);
            
            return {
                name: `Week ${index + 1}`,
                total: weekTotal
            };
        });
        setWeeklyChartData(wData);
        setLoading(false);
    };

    fetchData();
  }, []);

  const Card = ({ title, value, icon: Icon, color, subText }: any) => (
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-400 text-xs font-black uppercase tracking-widest">{title}</h3>
        <div className={`p-2 rounded-xl ${color} bg-opacity-10`}>
          <Icon className={color} size={20} />
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-black text-gray-900 font-mono">
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
        <span className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-tighter">{subText}</span>
      </div>
    </div>
  );

  const currentMonthName = MONTH_NAMES[new Date().getMonth()];
  const displayYear = new Date().getFullYear();

  if (loading) {
      return (
          <div className="flex items-center justify-center h-full">
              <TrendingUp className="animate-pulse text-blue-600" size={48} />
          </div>
      );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Company Overview</h1>
        <p className="text-gray-500">Financial summary and cutoff data monitoring.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          title="Total Company Value" 
          value={stats.totalCompanyValue} 
          icon={Wallet} 
          color="text-blue-600"
          subText="Latest Draw Report Total"
        />
        <Card 
          title="Total Earnings" 
          value={stats.totalEarnings} 
          icon={TrendingUp} 
          color="text-emerald-600"
          subText="All-time Sales Profits"
        />
        <Card 
          title="Total Cash In" 
          value={stats.totalAssetsIn} 
          icon={DollarSign} 
          color="text-indigo-600"
          subText="Recorded asset injections"
        />
        <Card 
          title="Total Cash Out" 
          value={stats.totalAssetsOut} 
          icon={TrendingDown} 
          color="text-rose-600"
          subText="Recorded expenses"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Weekly Draw Reports</h3>
                    <p className="text-sm text-gray-400 font-medium">Monitoring cutoff balances for {currentMonthName} {displayYear}</p>
                </div>
                <BarChart3 className="text-gray-200" size={32} />
            </div>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#9ca3af', fontSize: 10, fontWeight: 'bold'}}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#9ca3af', fontSize: 10}} 
                        />
                        <Tooltip 
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
                            cursor={{fill: '#f9fafb'}}
                        />
                        <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={50} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">Recent Ledger Impact</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} hide />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} />
                <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-widest mb-6">Transaction Magnitude</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} hide />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 10}} />
                <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="volume" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
