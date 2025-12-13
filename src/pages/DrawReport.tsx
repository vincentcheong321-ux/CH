
import React, { useState, useEffect } from 'react';
import { getClients, getClientDailyBalance } from '../services/storageService';
import { Client } from '../types';
import { Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';

const YEAR = 2025;

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

// Data Structure: [Month Index 0-11]: { type: [days] }
// Types: W (Wed), S1 (Sat), S2 (Sun), T (Special Tue)
const DRAW_DATES: Record<number, { w: number[], s1: number[], s2: number[], t: number[] }> = {
  0: { w: [1,8,15,22,29], s1: [4,11,18,25], s2: [5,12,19,26], t: [28] }, // JAN
  1: { w: [5,12,19,26], s1: [1,8,15,22], s2: [2,9,16,23], t: [4,11] }, // FEB
  2: { w: [5,12,19,26], s1: [1,8,15,22,29], s2: [2,9,16,23,30], t: [] }, // MAR
  3: { w: [2,9,16,23,30], s1: [5,12,19,26], s2: [6,13,20,27], t: [29] }, // APR
  4: { w: [7,14,21,28], s1: [3,10,17,24,31], s2: [4,11,18,25], t: [27] }, // MAY
  5: { w: [4,11,18,25], s1: [7,14,21,28], s2: [1,8,15,22,29], t: [] }, // JUN
  6: { w: [2,9,16,23,30], s1: [5,12,19,26], s2: [6,13,20,27], t: [29] }, // JUL
  7: { w: [6,13,20,27], s1: [2,9,16,23,30], s2: [3,10,17,24,31], t: [] }, // AUG
  8: { w: [3,10,17,24], s1: [6,13,20,27], s2: [7,14,21,28], t: [] }, // SEP
  9: { w: [1,8,15,22,29], s1: [4,11,18,25], s2: [5,12,19,26], t: [28] }, // OCT
  10: { w: [5,12,19,26], s1: [1,8,15,22,29], s2: [2,9,16,23,30], t: [] }, // NOV
  11: { w: [3,10,17,24,31], s1: [6,13,20,27], s2: [7,14,21,28], t: [30] }, // DEC
};

const DrawReport: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(0); // 0 = Jan
  const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
  const [clients, setClients] = useState<Client[]>([]);
  const [clientBalances, setClientBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClients();
    // Default to today if it's in 2025, else Jan 1 2025
    const today = new Date();
    if (today.getFullYear() === 2025) {
        setCurrentMonth(today.getMonth());
        // Don't auto select date unless requested, keeps view clean
    }
  }, []);

  const fetchClients = async () => {
    const list = await getClients();
    setClients(list);
  };

  useEffect(() => {
    if (selectedDate && clients.length > 0) {
        calculateDailyBalances();
    }
  }, [selectedDate, clients]);

  const calculateDailyBalances = () => {
      setLoading(true);
      const balances: Record<string, number> = {};
      clients.forEach(c => {
          balances[c.id] = getClientDailyBalance(c.id, selectedDate);
      });
      setClientBalances(balances);
      setLoading(false);
  };

  const handleDateClick = (day: number) => {
      const m = String(currentMonth + 1).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      setSelectedDate(`${YEAR}-${m}-${d}`);
  };

  const nextMonth = () => setCurrentMonth(prev => Math.min(11, prev + 1));
  const prevMonth = () => setCurrentMonth(prev => Math.max(0, prev - 1));

  const renderDateButtons = () => {
      const data = DRAW_DATES[currentMonth];
      if (!data) return null;

      // Merge all dates and sort them to display in order? 
      // Or display by category (Wed, Sat, Sun, Special)?
      // Prompt says "follow these date by date". 
      // Let's display grouped by type to match the prompt's layout structure, 
      // but clickable to set the filter.

      const ButtonGroup = ({ days, label, color }: { days: number[], label: string, color: string }) => (
          <div className="flex flex-col gap-2 mb-4">
              <span className={`text-xs font-bold uppercase ${color}`}>{label}</span>
              <div className="flex flex-wrap gap-2">
                  {days.map(d => {
                      const dateStr = `${YEAR}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                      const isSelected = selectedDate === dateStr;
                      return (
                        <button
                            key={d}
                            onClick={() => handleDateClick(d)}
                            className={`
                                w-10 h-10 rounded-lg font-bold shadow-sm transition-all
                                ${isSelected 
                                    ? 'bg-blue-600 text-white ring-2 ring-blue-300 transform scale-105' 
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}
                            `}
                        >
                            {d}
                        </button>
                      );
                  })}
              </div>
          </div>
      );

      return (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                  <button onClick={prevMonth} disabled={currentMonth === 0} className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"><ChevronLeft /></button>
                  <h2 className="text-lg font-bold text-gray-800">{MONTH_NAMES[currentMonth]} {YEAR}</h2>
                  <button onClick={nextMonth} disabled={currentMonth === 11} className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"><ChevronRight /></button>
              </div>
              
              <ButtonGroup days={data.w} label="Wednesday" color="text-purple-600" />
              <ButtonGroup days={data.s1} label="Saturday" color="text-indigo-600" />
              <ButtonGroup days={data.s2} label="Sunday" color="text-green-600" />
              {data.t.length > 0 && <ButtonGroup days={data.t} label="Special (Tue)" color="text-red-600" />}
          </div>
      );
  };

  // Split clients into two columns
  const midPoint = Math.ceil(clients.length / 2);
  const leftClients = clients.slice(0, midPoint);
  const rightClients = clients.slice(midPoint);

  const ClientRow = ({ client }: { client: Client }) => {
      const balance = clientBalances[client.id] || 0;
      // If balance is 0, visual style is lighter
      const isZero = balance === 0;

      return (
          <div className={`flex items-center justify-between p-3 border-b border-gray-100 last:border-0 ${isZero ? 'opacity-60' : ''}`}>
              <div>
                  <div className="font-bold text-gray-800">{client.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{client.code}</div>
              </div>
              <div className={`font-mono font-bold text-lg ${balance > 0 ? 'text-green-600' : balance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                   {balance > 0 ? '+' : ''}{balance.toLocaleString()}
              </div>
          </div>
      );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-screen">
       {/* Left Sidebar: Calendar Controls */}
       <div className="lg:w-80 flex-shrink-0 no-print">
            <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
                <Calendar className="mr-2" /> Draw Reports
            </h1>
            <p className="text-gray-500 mb-6 text-sm">Select a draw date to view daily balance.</p>
            {renderDateButtons()}
       </div>

       {/* Main Content: Report View */}
       <div className="flex-1">
            {!selectedDate ? (
                <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-gray-300 p-12 text-gray-400">
                    <Filter size={48} className="mb-4 opacity-20" />
                    <p>Please select a draw date from the calendar to view the report.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Draw Date Report</h2>
                            <p className="text-blue-600 font-medium">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                        <div className="text-right">
                             <div className="text-xs uppercase text-gray-500 font-bold">Total Net Flow</div>
                             <div className="text-xl font-bold text-gray-900">
                                 ${Object.values(clientBalances).reduce((a,b)=>a+b, 0).toLocaleString()}
                             </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Calculating...</div>
                    ) : (
                        <div className="p-4 md:p-6">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                                 {/* Column 1 */}
                                 <div className="flex flex-col">
                                     {leftClients.map(c => <ClientRow key={c.id} client={c} />)}
                                 </div>
                                 
                                 {/* Column 2 */}
                                 <div className="flex flex-col border-t md:border-t-0 border-gray-100 pt-4 md:pt-0">
                                     {rightClients.map(c => <ClientRow key={c.id} client={c} />)}
                                 </div>
                             </div>
                             
                             {clients.length === 0 && <div className="text-center text-gray-400 py-8">No clients found.</div>}
                        </div>
                    )}
                </div>
            )}
       </div>
    </div>
  );
};

export default DrawReport;
