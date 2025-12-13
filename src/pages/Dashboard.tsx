
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
import { getAllLedgerRecords, getAssetRecords, getNetAmount, getClients, getClientBalance } from '../services/storageService';
import { TrendingUp, TrendingDown, DollarSign, Wallet } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    totalCompanyBalance: 0,
    totalAssetsIn: 0,
    totalAssetsOut: 0,
    clientDebt: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const clients = await getClients();
        const assets = getAssetRecords();

        let clientBalanceSum = 0;
        clients.forEach(c => {
            clientBalanceSum += getClientBalance(c.id);
        });

        const assetsIn = assets.filter(a => a.type === 'IN').reduce((acc, curr) => acc + curr.amount, 0);
        const assetsOut = assets.filter(a => a.type === 'OUT').reduce((acc, curr) => acc + curr.amount, 0);

        const liquidCash = assetsIn - assetsOut;
        const totalBalance = liquidCash + clientBalanceSum;

        setStats({
        totalCompanyBalance: totalBalance,
        totalAssetsIn: assetsIn,
        totalAssetsOut: assetsOut,
        clientDebt: clientBalanceSum
        });

        const ledgers = getAllLedgerRecords();
        const data = ledgers.slice(-10).map((l, i) => ({
        name: `T-${i}`,
        amount: getNetAmount(l),
        volume: l.amount 
        }));
        setChartData(data);
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
          subText="Total owed by all clients"
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
