
import React, { useState, useEffect } from 'react';
import { getClients, getDrawBalances, saveDrawBalance, INITIAL_CLIENTS_DATA } from '../services/storageService';
import { Client } from '../types';
import { Calendar, ChevronLeft, ChevronRight, Filter, Save } from 'lucide-react';

const YEAR = 2025;

const MONTH_NAMES = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
];

// Data Structure: [Month Index 0-11]: { type: [days] }
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

// Extracted Component to prevent re-mounting on every render
const ClientInputRow = React.memo(({ client, value, onChange, onBlur }: { 
    client: Client, 
    value: string, 
    onChange: (id: string, val: string) => void,
    onBlur: (id: string) => void
}) => {
    const numVal = parseFloat(value);
    const isPositive = !isNaN(numVal) && numVal > 0;
    const isNegative = !isNaN(numVal) && numVal < 0;

    return (
        <div className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
            <div className="flex-1">
                <div className="font-bold text-gray-800 text-sm">{client.name}</div>
                <div className="text-xs text-gray-500 font-mono">{client.code}</div>
            </div>
            <div className="w-40">
                    <input 
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={value}
                    onChange={(e) => onChange(client.id, e.target.value)}
                    onBlur={() => onBlur(client.id)}
                    onFocus={(e) => e.target.select()}
                    className={`
                        w-full px-2 py-1 text-right font-mono font-bold rounded border
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                        ${isPositive ? 'text-green-600 border-green-200 bg-green-50/50' : 
                        isNegative ? 'text-red-600 border-red-200 bg-red-50/50' : 
                        'text-gray-600 border-gray-200 bg-white'}
                    `}
                    />
            </div>
        </div>
    );
});

const DrawReport: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(0); 
  const [selectedDate, setSelectedDate] = useState<string>(''); 
  const [clients, setClients] = useState<Client[]>([]);
  // Use string for input values to allow empty/typing state, parse to number on save
  const [clientBalances, setClientBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClients();
    
    // Hardcode default selection for preview
    setSelectedDate(`${YEAR}-01-01`);
    setCurrentMonth(0); // Ensure Jan is shown
  }, []);

  const fetchClients = async () => {
    let list = await getClients();
    
    // Hardcode fallback if empty for preview purposes
    if (list.length === 0) {
        list = INITIAL_CLIENTS_DATA.map((c, i) => ({
            ...c,
            id: `demo_${i}`,
            createdAt: new Date().toISOString()
        }));
    }
    setClients(list);
  };

  useEffect(() => {
    if (selectedDate && clients.length > 0) {
        fetchDailyData();
    }
  }, [selectedDate, clients]);

  const fetchDailyData = async () => {
      setLoading(true);
      const data = await getDrawBalances(selectedDate);
      const mapped: Record<string, string> = {};
      
      clients.forEach(c => {
          // If data exists, use it. If not, default to empty string for input placeholder
          mapped[c.id] = data[c.id] !== undefined ? data[c.id].toString() : '';
      });
      
      setClientBalances(mapped);
      setLoading(false);
  };

  const handleDateClick = (day: number) => {
      const m = String(currentMonth + 1).padStart(2, '0');
      const d = String(day).padStart(2, '0');
      setSelectedDate(`${YEAR}-${m}-${d}`);
  };

  const handleInputChange = (clientId: string, val: string) => {
      setClientBalances(prev => ({
          ...prev,
          [clientId]: val
      }));
  };

  const handleInputBlur = async (clientId: string) => {
      const val = clientBalances[clientId];
      // Only save if it's a valid number
      if (val !== '' && !isNaN(Number(val))) {
          await saveDrawBalance(selectedDate, clientId, parseFloat(val));
      } else if (val === '') {
          // Optional: Handle clearing? For now, we leave empty implies 0 or no record
          await saveDrawBalance(selectedDate, clientId, 0);
      }
  };

  const calculateTotal = () => {
      return Object.values(clientBalances).reduce((acc, val) => {
          const num = parseFloat(val);
          return acc + (isNaN(num) ? 0 : num);
      }, 0);
  };

  const nextMonth = () => setCurrentMonth(prev => Math.min(11, prev + 1));
  const prevMonth = () => setCurrentMonth(prev => Math.max(0, prev - 1));

  const renderDateButtons = () => {
      const data = DRAW_DATES[currentMonth];
      if (!data) return null;

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

  const midPoint = Math.ceil(clients.length / 2);
  const leftClients = clients.slice(0, midPoint);
  const rightClients = clients.slice(midPoint);

  const total = calculateTotal();

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-screen pb-20">
       {/* Left Sidebar: Calendar Controls */}
       <div className="lg:w-80 flex-shrink-0 no-print">
            <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
                <Calendar className="mr-2" /> Draw Reports
            </h1>
            <p className="text-gray-500 mb-6 text-sm">Select a date to enter client balances.</p>
            {renderDateButtons()}
       </div>

       {/* Main Content: Report View */}
       <div className="flex-1 flex flex-col">
            {!selectedDate ? (
                <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-gray-300 p-12 text-gray-400">
                    <Filter size={48} className="mb-4 opacity-20" />
                    <p>Please select a draw date from the calendar to view or enter data.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 relative">
                    {/* Header */}
                    <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center sticky top-0 z-10">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Draw Date Report</h2>
                            <p className="text-blue-600 font-medium text-sm">
                                {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                        </div>
                        <div className="flex items-center text-xs text-gray-500 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
                             <Save size={14} className="mr-1" /> Auto-saves on exit
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading data...</div>
                    ) : (
                        <div className="flex-1 overflow-auto">
                            <div className="p-4 md:p-6 pb-24">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                                    {/* Column 1 */}
                                    <div className="flex flex-col">
                                        {leftClients.map(c => (
                                            <ClientInputRow 
                                                key={c.id} 
                                                client={c} 
                                                value={clientBalances[c.id] || ''} 
                                                onChange={handleInputChange}
                                                onBlur={handleInputBlur}
                                            />
                                        ))}
                                    </div>
                                    
                                    {/* Column 2 */}
                                    <div className="flex flex-col border-t md:border-t-0 border-gray-100 pt-4 md:pt-0">
                                        {rightClients.map(c => (
                                            <ClientInputRow 
                                                key={c.id} 
                                                client={c} 
                                                value={clientBalances[c.id] || ''} 
                                                onChange={handleInputChange}
                                                onBlur={handleInputBlur}
                                            />
                                        ))}
                                    </div>
                                </div>
                                {clients.length === 0 && <div className="text-center text-gray-400 py-8">No clients found.</div>}
                            </div>
                        </div>
                    )}
                    
                    {/* Sticky Footer Total */}
                    <div className="sticky bottom-0 bg-gray-900 text-white p-4 shadow-lg flex justify-between items-center z-20">
                         <div className="text-sm font-medium uppercase tracking-wider text-gray-400">Total Company Balance</div>
                         <div className={`text-2xl font-mono font-bold ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                             {total > 0 ? '+' : ''}{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                         </div>
                    </div>
                </div>
            )}
       </div>
    </div>
  );
};

export default DrawReport;
