
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
import { getAllLedgerRecords, getAssetRecords, getNetAmount, getClients, getClientBalance, getTotalDrawReceivables, getAllDrawRecords } from '../services/storageService';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';
import { getWeeksForMonth, MONTH_NAMES } from '../utils/reportUtils';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalCompanyBalance: 0,
    totalAssetsIn: 0,
    totalAssetsOut: 0,
    clientDebt: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [weeklyChartData, setWeeklyChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const clients = await getClients();
        const assets = getAssetRecords();
        const drawTotal = await getTotalDrawReceivables();
        const allDraws = await getAllDrawRecords();

        // Calculate Ledger Balance (Old method)
        let ledgerBalanceSum = 0;
        // clients.forEach(c => {
        //     ledgerBalanceSum += getClientBalance(c.id);
        // });

        // Combine Ledger Balances with Draw Report Balances
        const totalReceivables = ledgerBalanceSum + drawTotal;

        const assetsIn = assets.filter(a => a.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);
        const assetsOut = assets.filter(a => a.type === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);

        const liquidCash = assetsIn - assetsOut;
        const totalBalance = liquidCash + totalReceivables;

        setStats({
        totalCompanyBalance: totalBalance,
        totalAssetsIn: assetsIn,
        totalAssetsOut: assetsOut,
        clientDebt: totalReceivables
        });

        // --- Ledger Line Chart Data ---
        const ledgers = await getAllLedgerRecords(); // Now Async
        const data = ledgers.slice(-10).map((l, i) => ({
        name: `T-${i}`,
        amount: getNetAmount(l),
        volume: l.amount 
        }));
        setChartData(data);

        // --- Weekly Draw Chart Data ---
        const currentYear = new Date().getFullYear();
        const currentMonthIndex = new Date().getMonth();
        
        const weeks = getWeeksForMonth(currentYear, currentMonthIndex);
        
        const wData = Object.keys(weeks).sort((a,b)=>Number(a)-Number(b)).map((weekNum, index) => {
            const days = weeks[Number(weekNum)]; // This is now Date[]
            
            // Sum all draws that match the computed date strings for this week's days
            const weekTotal = allDraws.reduce((acc, r) => {
                const match = days.some(d => {
                    // Compare ISO date strings YYYY-MM-DD
                    const yearStr = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const dayStr = String(d.getDate()).padStart(2, '0');
                    const targetDateStr = `${yearStr}-${m}-${dayStr}`;
                    return r.date === targetDateStr;
                });

                if (match) {
                    return acc + r.balance;
                }
                return acc;
            }, 0);
            
            return {
                name: `Week ${index + 1}`,
                total: weekTotal,
                label: `Week ${index + 1}`
            };
        });
        setWeeklyChartData(wData);
    };

    fetchData();
  }, []);

  const Card = ({ title, value, icon: Icon, color, subText }: any) => (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wider">{title}</h3>
        <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
          <Icon className={color} size={24} />
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-gray-900">
          ${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
        <span className="text-xs text-gray-400 mt-1">{subText}</span>
      </div>
    </div>
  );

  const currentMonthName = MONTH_NAMES[new Date().getMonth()];
  const displayYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Company Overview</h1>
        <p className="text-gray-500">Financial status and recent activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          title="Total Company Value" 
          value={stats.totalCompanyBalance} 
          icon={Wallet} 
          color="text-blue-600"
          subText="Liquid Assets + Receivables"
        />
        <Card 
          title="Net Client Receivables" 
          value={stats.clientDebt} 
          icon={DollarSign} 
          color="text-emerald-600"
          subText="Ledger + Draw Reports"
        />
        <Card 
          title="Total Cash In" 
          value={stats.totalAssetsIn} 
          icon={TrendingUp} 
          color="text-indigo-600"
          subText="Recorded asset injections"
        />
        <Card 
          title="Total Cash Out" 
          value={stats.totalAssetsOut} 
          icon={TrendingDown} 
          color="text-red-600"
          subText="Recorded expenses/withdrawals"
        />
      </div>

      {/* New Row: Weekly Report Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Weekly Draw Reports</h3>
            <p className="text-sm text-gray-500 mb-6">Total balances per week for {currentMonthName} {displayYear}</p>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                        <Tooltip 
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total Balance']}
                            cursor={{fill: '#f3f4f6'}}
                        />
                        <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={60} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Recent Transactions Impact</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} hide />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#2563eb" 
                  strokeWidth={2} 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Recent Volume</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} hide />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                <Tooltip />
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
