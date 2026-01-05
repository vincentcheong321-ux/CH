
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
import { getAllLedgerRecords, getAssetRecords, getNetAmount, getClients, fetchClientTotalBalance, getSalesForDates } from '../services/storageService';
import { TrendingUp, TrendingDown, DollarSign, Wallet, BarChart3, Briefcase } from 'lucide-react';
import { getWeeksForMonth, MONTH_NAMES } from '../utils/reportUtils';
import { supabase } from '../supabaseClient';

const PAPER_Z_CODES = ['Z03', 'Z05', 'Z07', 'Z15', 'Z19', 'Z20'];
const PAPER_C_CODES = ['C03', 'C04', 'C06', 'C09', 'C13', 'C15', 'C17'];

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalCompanyValue: 0,
    totalEarnings: 0,
    weeklyEarning: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [weeklyChartData, setWeeklyChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        const clients = await getClients();
        const assets = getAssetRecords();
        
        // 1. Calculate Liquid Cash (Assets In - Assets Out)
        const assetsIn = assets.filter(a => a.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);
        const assetsOut = assets.filter(a => a.type === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);
        const liquidCash = assetsIn - assetsOut;

        // 2. Calculate Total Client Receivables (Real-time sum of all client balances)
        const clientBalances = await Promise.all(clients.map(c => fetchClientTotalBalance(c.id)));
        const totalReceivables = clientBalances.reduce((acc, curr) => acc + curr, 0);

        // TOTAL COMPANY VALUE = Liquid Cash + Receivables
        const totalCompanyValue = liquidCash + totalReceivables;

        // 3. Calculate Total Earnings (All-time sales profit) - Kept existing logic
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

        // 4. Calculate Weekly Earning (Current Week Profit)
        const now = new Date();
        const weeks = getWeeksForMonth(now.getFullYear(), now.getMonth());
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        
        // Find current week days
        const currentWeekDays = Object.values(weeks).find(days => 
            days.some(d => {
                const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                return dStr === todayStr;
            })
        ) || Object.values(weeks)[Object.values(weeks).length - 1]; // Fallback to last week if undefined

        let weeklyEarning = 0;
        if (currentWeekDays) {
            const activeDateStrings = currentWeekDays.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
            const currentWeekSales = await getSalesForDates(activeDateStrings);
            
            currentWeekSales.forEach(r => {
                const client = clients.find(c => c.id === r.clientId);
                if (!client) return;

                const isMobileProfile = client.category === 'mobile';
                const codeUpper = (client.code || '').toUpperCase();
                const isValidPaper = PAPER_Z_CODES.includes(codeUpper) || PAPER_C_CODES.includes(codeUpper);

                if (isMobileProfile) {
                    const shareholderTotalStr = r.mobileRawData?.[11] || '0';
                    weeklyEarning += Math.abs(parseFloat(String(shareholderTotalStr).replace(/,/g, '')) || 0);
                } else if (isValidPaper) {
                    const rawTotal = (r.b||0) + (r.s||0) + (r.a||0) + (r.c||0);
                    // Paper Earning Logic: abs(Client14% - Company17%)
                    weeklyEarning += Math.abs((rawTotal * 0.86) - (rawTotal * 0.83));
                }
            });
        }

        setStats({
            totalCompanyValue,
            totalEarnings,
            weeklyEarning
        });

        // --- Ledger Line Chart Data ---
        const ledgers = await getAllLedgerRecords(); 
        const data = ledgers.slice(-10).map((l, i) => ({
            name: `T-${i}`,
            amount: getNetAmount(l),
            volume: l.amount 
        }));
        setChartData(data);

        setLoading(false);
    };

    fetchData();
  }, []);

  const Card = ({ title, value, icon: Icon, color, subText, bgClass }: any) => (
    <div className={`rounded-2xl shadow-sm p-6 border border-gray-100 transition-all hover:shadow-md ${bgClass || 'bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-xs font-black uppercase tracking-widest ${bgClass ? 'text-blue-100' : 'text-gray-400'}`}>{title}</h3>
        <div className={`p-2 rounded-xl ${bgClass ? 'bg-white/10' : color + ' bg-opacity-10'}`}>
          <Icon className={bgClass ? 'text-white' : color} size={20} />
        </div>
      </div>
      <div className="flex flex-col">
        <span className={`text-2xl font-black font-mono ${bgClass ? 'text-white' : 'text-gray-900'}`}>
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
        <span className={`text-[10px] font-bold uppercase mt-1 tracking-tighter ${bgClass ? 'text-blue-200' : 'text-gray-400'}`}>{subText}</span>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card 
          title="Total Company Balance" 
          value={stats.totalCompanyValue} 
          icon={Wallet} 
          color="text-white"
          bgClass="bg-blue-600"
          subText="Assets + Receivables"
        />
        <Card 
          title="Total Lifetime Earnings" 
          value={stats.totalEarnings} 
          icon={TrendingUp} 
          color="text-emerald-600"
          subText="All-time Sales Profits"
        />
        <Card 
          title="Weekly Earning" 
          value={stats.weeklyEarning} 
          icon={Briefcase} 
          color="text-indigo-600"
          subText="Current Week Profit"
        />
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
