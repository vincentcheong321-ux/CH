
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getClients, getDrawBalances, saveDrawBalance, getClientBalancesPriorToDate, generateSpecialCarryForward } from '../services/storageService';
import { Client } from '../types';
import { Calendar, ChevronLeft, ChevronRight, Filter, Save, Layers, RefreshCw, Loader2 } from 'lucide-react';
import { MONTH_NAMES, getWeeksForMonth, getWeekRangeString } from '../utils/reportUtils';
import { Link } from 'react-router-dom';

// Extracted Component to prevent re-mounting on every render
const ClientInputRow = React.memo(({ client, value, onChange, onBlur, navState }: { 
    client: Client, 
    value: string, 
    onChange: (id: string, val: string) => void,
    onBlur: (id: string) => void,
    navState: any
}) => {
    const numVal = parseFloat(value);
    const isPositive = !isNaN(numVal) && numVal > 0;
    const isNegative = !isNaN(numVal) && numVal < 0;

    return (
        <div className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
            <div className="flex-1">
                <Link to={`/clients/${client.id}`} state={navState} className="font-bold text-gray-800 text-lg hover:text-blue-600 transition-colors">{client.name}</Link>
                <div className="text-xs text-gray-500 font-mono">{client.code}</div>
            </div>
            <div className="w-40">
                    <input 
                    type="text" 
                    inputMode="decimal"
                    placeholder="0.00"
                    value={value}
                    onChange={(e) => onChange(client.id, e.target.value)}
                    onBlur={() => onBlur(client.id)}
                    onFocus={(e) => e.target.select()}
                    className={`
                        w-full px-2 py-1 text-right font-mono font-bold rounded border
                        focus:outline-none focus:ring-2 focus:ring-blue-500
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
  const [currentYear, setCurrentYear] = useState(2025);
  const [currentMonth, setCurrentMonth] = useState(0); 
  const [selectedDate, setSelectedDate] = useState<string>(''); 
  const [clients, setClients] = useState<Client[]>([]);
  const [clientBalances, setClientBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchClients();
    
    // Auto-select nearest date to "Today"
    const now = new Date();
    let y = now.getFullYear();
    if(y < 2025) y = 2025;
    if(y > 2026) y = 2026;
    setCurrentYear(y);

    const m = now.getMonth();
    setCurrentMonth(m);

    const weeks = getWeeksForMonth(y, m);
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    
    const weekNum = Object.keys(weeks).find(w => {
        return weeks[parseInt(w)].some(d => {
            const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            return dStr === todayStr;
        });
    });
    
    if (weekNum) {
        const startDay = weeks[parseInt(weekNum)][0];
        handleDateClick(startDay);
    } else {
        const firstWeekNum = Object.keys(weeks)[0];
        if (firstWeekNum) {
            handleDateClick(weeks[parseInt(firstWeekNum)][0]);
        }
    }
  }, []);

  const fetchClients = async () => {
    const list = await getClients();
    const paperClients = list.filter(c => (c.category || 'paper') === 'paper');
    setClients(paperClients);
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
          mapped[c.id] = data[c.id] !== undefined ? data[c.id].toString() : '';
      });
      
      setClientBalances(mapped);
      setLoading(false);
  };

  const handleDateClick = (dateObj: Date) => {
      const yearStr = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      setSelectedDate(`${yearStr}-${m}-${d}`);
  };

  const handleInputChange = useCallback((clientId: string, val: string) => {
      if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
        setClientBalances((prev: Record<string, string>) => ({
            ...prev,
            [clientId]: val
        }));
      }
  }, []);

  const handleInputBlur = useCallback(async (clientId: string) => {
      setClientBalances((currentBalances: Record<string, string>) => {
          const val = currentBalances[clientId];
          if (val !== '' && !isNaN(Number(val))) {
              saveDrawBalance(selectedDate, clientId, parseFloat(val));
          } else if (val === '') {
              saveDrawBalance(selectedDate, clientId, 0);
          }
          return currentBalances;
      });
  }, [selectedDate]);

  const handleGenerateBalance = async () => {
      if (!selectedDate) return;
      if (!window.confirm("This will fetch the total net balance of all clients from previous weeks and overwrite the current week's draw report. Continue?")) return;

      setGenerating(true);
      try {
          const prevBalances = await getClientBalancesPriorToDate(selectedDate);
          
          const newBalances: Record<string, string> = {};
          
          for (const client of clients) {
              const codeUpper = client.code?.toUpperCase();
              
              // Special Logic for Z21 and C19
              if (codeUpper === 'Z21' || codeUpper === 'C19') {
                  // Special Case: Do NOT generate '上欠' in Main Ledger.
                  // Instead, clone Panel 1 records from previous week.
                  await generateSpecialCarryForward(client.id, codeUpper, selectedDate);
                  // Ensure input shows blank or existing value to avoid confusion, 
                  // as "Draw Balance" input typically maps to Main Ledger "上欠".
                  newBalances[client.id] = ''; 
              } else {
                  // Standard Case
                  const bal = prevBalances[client.id] || 0;
                  newBalances[client.id] = bal.toString();
                  await saveDrawBalance(selectedDate, client.id, bal);
              }
          }
          
          setClientBalances(newBalances);
          await new Promise(r => setTimeout(r, 800));
      } catch (e) {
          console.error("Failed to generate balances", e);
          alert("Error generating balances. Please try again.");
      } finally {
          setGenerating(false);
      }
  };

  const calculateTotal = (): number => {
    const values = Object.values(clientBalances) as string[];
    return values.reduce((acc: number, val: string) => {
        const num = parseFloat(val);
        return acc + (isNaN(num) ? 0 : num);
    }, 0);
  };

  const nextMonth = () => {
      if (currentMonth === 11) {
          if (currentYear < 2026) {
              setCurrentYear(y => y + 1);
              setCurrentMonth(0);
          }
      } else {
          setCurrentMonth(prev => prev + 1);
      }
  };

  const prevMonth = () => {
      if (currentMonth === 0) {
          if (currentYear > 2025) {
              setCurrentYear(y => y - 1);
              setCurrentMonth(11);
          }
      } else {
          setCurrentMonth(prev => prev - 1);
      }
  };

  const currentMonthWeeks = useMemo<Record<number, Date[]>>(() => {
      return getWeeksForMonth(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  let activeWeekNum: string | undefined;
  
  if (selectedDate) {
      for (const [wNum, days] of Object.entries(currentMonthWeeks)) {
          const match = (days as Date[]).some(d => {
              const yearStr = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const dayStr = String(d.getDate()).padStart(2, '0');
              return `${yearStr}-${m}-${dayStr}` === selectedDate;
          });
          if (match) {
              activeWeekNum = wNum;
              break;
          }
      }
  }

  const activeWeekIndex = activeWeekNum ? Object.keys(currentMonthWeeks).map(Number).sort((a: number, b: number) => a - b).indexOf(Number(activeWeekNum)) : 0;
  const sortedWeekNums = Object.keys(currentMonthWeeks).map(Number).sort((a: number, b: number) => a - b);

  const activeWeekDays = activeWeekNum ? currentMonthWeeks[parseInt(activeWeekNum)] : [];

  const navState = useMemo(() => ({
      year: currentYear,
      month: currentMonth,
      week: activeWeekNum ? parseInt(activeWeekNum) : 1
  }), [currentYear, currentMonth, activeWeekNum]);

  const renderDateButtons = () => {
      return (
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                  <button onClick={prevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"><ChevronLeft /></button>
                  <h2 className="text-lg font-bold text-gray-800">{MONTH_NAMES[currentMonth]} {currentYear}</h2>
                  <button onClick={nextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"><ChevronRight /></button>
              </div>
              
              <div className="space-y-2">
                  {sortedWeekNums.map((weekNum, idx) => {
                      const days = currentMonthWeeks[weekNum];
                      const isActiveWeek = weekNum.toString() === activeWeekNum;
                      const rangeStr = getWeekRangeString(null, null, days);

                      return (
                        <button
                            key={weekNum}
                            onClick={() => handleDateClick(days[0])}
                            className={`
                                w-full p-3 rounded-lg font-bold transition-all flex flex-col items-center justify-center text-center
                                ${isActiveWeek
                                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300' 
                                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}
                            `}
                        >
                            <span className={`text-xs uppercase tracking-wider opacity-70 ${isActiveWeek ? 'text-blue-100' : 'text-gray-400'}`}>
                                Week {idx + 1}
                            </span>
                            <span className="text-sm font-mono mt-1 whitespace-nowrap">{rangeStr}</span>
                        </button>
                      );
                  })}
              </div>
          </div>
      );
  };

  const midPoint = Math.ceil(clients.length / 2);
  const leftClients = clients.slice(0, midPoint);
  const rightClients = clients.slice(midPoint);

  const total = calculateTotal();

  const activeWeekDateRange = activeWeekDays.length > 0 
    ? getWeekRangeString(null, null, activeWeekDays)
    : `Week ${activeWeekIndex + 1}`;

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-screen pb-20">
       {/* Left Sidebar: Calendar Controls */}
       <div className="lg:w-80 flex-shrink-0 no-print hidden lg:block">
            <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
                <Calendar className="mr-2" /> Draw Reports
            </h1>
            <p className="text-gray-500 mb-6 text-sm">Select a week to enter balances.</p>
            {renderDateButtons()}
       </div>

       {/* Main Content: Report View */}
       <div className="flex-1 flex flex-col">
            {!selectedDate ? (
                <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-gray-300 p-12 text-gray-400">
                    <Filter size={48} className="mb-4 opacity-20" />
                    <p>Please select a draw week from the sidebar.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 relative">
                    {/* Header */}
                    <div className="bg-gray-50 p-4 border-b border-gray-200 sticky top-0 z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-col">
                            <div className="flex items-center">
                                <h2 className="text-xl font-bold text-gray-900 flex items-center mr-3">
                                    <Layers size={20} className="mr-2 text-blue-600" />
                                    {activeWeekDateRange}
                                </h2>
                                <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                                    {MONTH_NAMES[currentMonth]} {currentYear}
                                </span>
                            </div>
                            
                            {/* Mobile Week Buttons */}
                            <div className="flex lg:hidden space-x-2 bg-gray-200 p-1 rounded-lg w-fit overflow-x-auto max-w-full mt-3">
                                {sortedWeekNums.map((weekNum, idx) => {
                                    const days = currentMonthWeeks[weekNum];
                                    const isActive = weekNum.toString() === activeWeekNum;
                                    return (
                                        <button
                                            key={weekNum}
                                            onClick={() => handleDateClick(days[0])}
                                            className={`
                                                px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap
                                                ${isActive 
                                                    ? 'bg-white text-blue-600 shadow-sm' 
                                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}
                                            `}
                                        >
                                            Week {idx + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handleGenerateBalance}
                                disabled={generating}
                                className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm text-sm font-bold disabled:opacity-50 transition-colors"
                            >
                                <RefreshCw size={16} className={`mr-2 ${generating ? 'animate-spin' : ''}`} />
                                Generate Last Week Balance
                            </button>
                            <div className="hidden md:flex items-center text-xs text-gray-500 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200">
                                <Save size={14} className="mr-1" /> Auto-saves
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading data...</div>
                    ) : (
                        <div className="flex-1 overflow-auto">
                            <div className="p-4 md:p-6 pb-24">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                                    <div className="flex flex-col">
                                        {leftClients.map(c => (
                                            <ClientInputRow 
                                                key={c.id} 
                                                client={c} 
                                                value={clientBalances[c.id] || ''} 
                                                onChange={handleInputChange}
                                                onBlur={handleInputBlur}
                                                navState={navState}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex flex-col border-t md:border-t-0 border-gray-100 pt-4 md:pt-0">
                                        {rightClients.map(c => (
                                            <ClientInputRow 
                                                key={c.id} 
                                                client={c} 
                                                value={clientBalances[c.id] || ''} 
                                                onChange={handleInputChange}
                                                onBlur={handleInputBlur}
                                                navState={navState}
                                            />
                                        ))}
                                    </div>
                                </div>
                                {clients.length === 0 && <div className="text-center text-gray-400 py-8">No paper clients found.</div>}
                            </div>
                        </div>
                    )}
                    
                    <div className="sticky bottom-0 bg-gray-900 text-white p-4 shadow-lg flex justify-between items-center z-20">
                         <div className="text-sm font-medium uppercase tracking-wider text-gray-400">Total Company Balance</div>
                         <div className={`text-2xl font-mono font-bold ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                             {total > 0 ? '+' : ''}{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                         </div>
                    </div>
                </div>
            )}
       </div>

       {generating && (
           <div className="fixed inset-0 bg-black/60 z-[9999] flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
                   <div className="relative mb-6">
                        <Loader2 className="animate-spin text-indigo-600 w-16 h-16" strokeWidth={1.5} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 bg-indigo-50 rounded-full animate-pulse"></div>
                        </div>
                   </div>
                   <h3 className="text-xl font-bold text-gray-900 mb-2">Generating Balances</h3>
                   <p className="text-gray-500 text-center text-sm mb-6">
                       Retrieving last week's final amounts for all clients...
                   </p>
                   <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                       <div className="bg-indigo-600 h-1.5 rounded-full w-full animate-progress-indeterminate"></div>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default DrawReport;
