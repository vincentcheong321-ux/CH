
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getClients, getCashAdvances, saveCashAdvance, getLedgerRecords, getNetAmount } from '../services/storageService';
import { Client, LedgerRecord } from '../types';
import { Calendar, ChevronLeft, ChevronRight, Filter, Save, Banknote } from 'lucide-react';
import { MONTH_NAMES, getWeeksForMonth, getWeekRangeString } from '../utils/reportUtils';
import { Link } from 'react-router-dom';

// Preview Component
const LedgerPreviewOverlay = ({ clientId, selectedDate }: { clientId: string, selectedDate: string }) => {
    const [balance, setBalance] = useState<number | null>(null);
    const [dailyRecords, setDailyRecords] = useState<LedgerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [clientName, setClientName] = useState('');
    const [weekRange, setWeekRange] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const records = await getLedgerRecords(clientId);
            const clients = await getClients();
            const c = clients.find(cl => cl.id === clientId);
            if (c) setClientName(c.name);

            // Determine Week Range (Mon - Sun)
            const startObj = new Date(selectedDate);
            const endObj = new Date(startObj);
            endObj.setDate(endObj.getDate() + 6);
            
            const startStr = startObj.toISOString().split('T')[0];
            const endStr = endObj.toISOString().split('T')[0];
            
            setWeekRange(`${startStr} to ${endStr}`);

            // 1. Show Records for the Whole Week belonging to MAIN LEDGER
            const weekRecords = records.filter(r => 
                r.date >= startStr && 
                r.date <= endStr && 
                (r.column === 'main' || !r.column)
            );
            
            weekRecords.sort((a, b) => a.date.localeCompare(b.date));

            // 2. Calculate Balance strictly based on this week's visible records
            const visibleWeekRecords = weekRecords.filter(r => r.isVisible);
            const bal = visibleWeekRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
            
            setBalance(bal);
            setDailyRecords(weekRecords);
            
            setLoading(false);
        };
        load();
    }, [clientId, selectedDate]);

    if (loading) return null;

    return (
        <div className="fixed bottom-2 left-2 right-2 md:left-auto md:right-8 md:bottom-8 bg-white border border-gray-200 shadow-2xl rounded-xl z-50 md:w-[450px] overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300 flex flex-col max-h-[40vh] md:max-h-[600px]">
            <div className="bg-gray-900 text-white p-2 md:p-4 flex justify-between items-center flex-shrink-0 shadow-md z-10">
                <div className="flex flex-col overflow-hidden mr-2">
                    <span className="font-bold truncate text-sm md:text-lg">{clientName}</span>
                    <span className="text-[10px] md:text-xs text-gray-400">Balance as of Week End</span>
                </div>
                <span className={`font-mono font-bold text-lg md:text-2xl whitespace-nowrap ${balance! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${Math.abs(balance!).toLocaleString()}
                </span>
            </div>
            <div className="flex-1 bg-gray-50 overflow-y-auto p-0">
                <div className="sticky top-0 bg-gray-100 px-3 py-1.5 md:px-4 md:py-2 border-b border-gray-200 text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider z-0">
                    Week: {weekRange}
                </div>
                <div className="divide-y divide-gray-200">
                    {dailyRecords.map(r => (
                        <div key={r.id} className="flex justify-between items-center px-3 py-1.5 md:px-4 md:py-3 text-[11px] md:text-sm bg-white hover:bg-gray-50">
                            <div className="flex flex-col min-w-0 mr-2">
                                <div className="text-gray-700 truncate font-medium">
                                    <span className="inline-block w-12 text-gray-400 text-xs font-mono">{r.date.slice(5)}</span>
                                    {r.typeLabel} {r.description ? <span className="text-gray-500 font-normal">- {r.description}</span> : ''}
                                </div>
                            </div>
                            <span className={`font-mono font-bold text-xs md:text-base flex-shrink-0 ${r.operation === 'add' ? 'text-green-600' : r.operation === 'subtract' ? 'text-red-600' : 'text-gray-400'}`}>
                                {r.operation === 'add' ? '+' : r.operation === 'subtract' ? '-' : ''}{r.amount.toLocaleString()}
                            </span>
                        </div>
                    ))}
                    {dailyRecords.length === 0 && <p className="p-4 text-center text-[10px] md:text-xs text-gray-400 italic">No main ledger activity for this week.</p>}
                </div>
            </div>
        </div>
    );
};

// Component for Individual Client Input
const CashAdvanceInputRow = React.memo(({ client, value, onChange, onBlur, onFocus, navState }: { 
    client: Client, 
    value: string, 
    onChange: (id: string, val: string) => void,
    onBlur: (id: string) => void,
    onFocus: (id: string) => void,
    navState: any
}) => {
    const numVal = parseFloat(value);
    const hasValue = !isNaN(numVal) && numVal !== 0;

    return (
        <div className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
            <div className="flex-1">
                <Link to={`/clients/${client.id}`} state={navState} className="font-bold text-gray-800 text-lg hover:text-blue-600 transition-colors">{client.name}</Link>
                <div className="text-xs text-gray-500 font-mono">{client.code}</div>
            </div>
            <div className="w-40 relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold text-xs">$</span>
                    <input 
                    type="text" 
                    inputMode="decimal"
                    placeholder="0.00"
                    value={value}
                    onChange={(e) => onChange(client.id, e.target.value)}
                    onBlur={() => onBlur(client.id)}
                    onFocus={() => onFocus(client.id)}
                    className={`
                        w-full pl-6 pr-2 py-1 text-right font-mono font-bold rounded border
                        focus:outline-none focus:ring-2 focus:ring-blue-500
                        ${hasValue ? 'text-blue-700 border-blue-200 bg-blue-50/50' : 'text-gray-600 border-gray-200 bg-white'}
                    `}
                    />
            </div>
        </div>
    );
});

const CashAdvanceReport: React.FC = () => {
  const [currentYear, setCurrentYear] = useState(2025);
  const [currentMonth, setCurrentMonth] = useState(0); 
  const [selectedDate, setSelectedDate] = useState<string>(''); 
  const [clients, setClients] = useState<Client[]>([]);
  const [cashAdvances, setCashAdvances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    
    const todayStr = `${y}-${String(m+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
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
      const data = await getCashAdvances(selectedDate);
      const mapped: Record<string, string> = {};
      
      clients.forEach(c => {
          mapped[c.id] = data[c.id] !== undefined ? data[c.id].toFixed(2) : '';
      });
      
      setCashAdvances(mapped);
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
        setCashAdvances((prev: Record<string, string>) => ({
            ...prev,
            [clientId]: val
        }));
      }
  }, []);

  const handleInputBlur = useCallback(async (clientId: string) => {
      setCashAdvances((prev: Record<string, string>) => {
          const val = prev[clientId];
          const newMap = { ...prev };
          if (val !== '' && !isNaN(Number(val))) {
              const numVal = parseFloat(val);
              saveCashAdvance(selectedDate, clientId, numVal);
              newMap[clientId] = numVal.toFixed(2);
          } else if (val === '') {
              saveCashAdvance(selectedDate, clientId, 0);
          }
          return newMap;
      });
      
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = setTimeout(() => {
          setPreviewClientId(null);
          blurTimeoutRef.current = null;
      }, 200);
  }, [selectedDate]);

  const handleInputFocus = useCallback((clientId: string) => {
      if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current);
          blurTimeoutRef.current = null;
      }
      setPreviewClientId(clientId);
  }, []);

  const calculateTotal = (): number => {
    const values = Object.values(cashAdvances) as string[];
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

  const activeWeekIndex = activeWeekNum ? Object.keys(currentMonthWeeks).map(Number).sort((a: number,b: number) => a-b).indexOf(Number(activeWeekNum)) : 0;
  const sortedWeekNums = Object.keys(currentMonthWeeks).map(Number).sort((a: number,b: number) => a-b);

  const activeDays = activeWeekNum ? currentMonthWeeks[parseInt(activeWeekNum)] : [];
  const rangeTitle = activeDays.length > 0 
    ? getWeekRangeString(null, null, activeDays) 
    : `Week ${activeWeekIndex + 1}`;

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

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-screen pb-20 relative">
       {/* Preview Overlay */}
       {previewClientId && <LedgerPreviewOverlay clientId={previewClientId} selectedDate={selectedDate} />}

       {/* Left Sidebar */}
       <div className="lg:w-80 flex-shrink-0 no-print hidden lg:block">
            <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
                <Banknote className="mr-2" /> Cash Advance
            </h1>
            <p className="text-gray-500 mb-6 text-sm">Record advances for paper clients.</p>
            {renderDateButtons()}
       </div>

       {/* Main Content */}
       <div className="flex-1 flex flex-col">
            {!selectedDate ? (
                <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-gray-300 p-12 text-gray-400">
                    <Filter size={48} className="mb-4 opacity-20" />
                    <p>Please select a week from the sidebar.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col flex-1 relative">
                    {/* Header */}
                    <div className="bg-gray-50 p-4 border-b border-gray-200 sticky top-0 z-10">
                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-4 gap-2">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 flex items-center">
                                        <Banknote size={20} className="mr-2 text-blue-600" />
                                        <span className="lg:hidden">Cash Advance</span>
                                        <span className="hidden lg:inline">{rangeTitle}</span>
                                    </h2>
                                    <p className="text-gray-500 font-medium text-sm mt-1 hidden lg:block">
                                        {MONTH_NAMES[currentMonth]} {currentYear} • Week {activeWeekIndex + 1}
                                    </p>
                                </div>
                                 {/* Mobile Month Nav */}
                                 <div className="flex lg:hidden items-center bg-white rounded-lg border border-gray-200 shadow-sm p-0.5">
                                     <button onClick={prevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-1.5 hover:bg-gray-50 rounded-md disabled:opacity-30"><ChevronLeft size={16}/></button>
                                     <span className="text-xs font-bold px-2 w-20 text-center">{MONTH_NAMES[currentMonth].slice(0,3)} {currentYear}</span>
                                     <button onClick={nextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-1.5 hover:bg-gray-50 rounded-md disabled:opacity-30"><ChevronRight size={16}/></button>
                                </div>
                            </div>
                            <div className="flex items-center text-xs text-gray-500 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-200 w-fit">
                                <Save size={14} className="mr-1" /> Auto-saves on exit
                            </div>
                        </div>

                         {/* Mobile Pills with Sunday Date */}
                         <div className="flex lg:hidden space-x-2 bg-gray-200 p-1 rounded-lg w-full overflow-x-auto mb-2 no-scrollbar">
                            {sortedWeekNums.map((weekNum, idx) => {
                                const days = currentMonthWeeks[weekNum];
                                const isActive = weekNum.toString() === activeWeekNum;
                                const sunday = days[6];
                                const sunLabel = sunday ? `${sunday.getDate().toString().padStart(2,'0')}/${(sunday.getMonth()+1).toString().padStart(2,'0')}` : `W${idx+1}`;
                                
                                return (
                                    <button
                                        key={weekNum}
                                        onClick={() => handleDateClick(days[0])}
                                        className={`
                                            px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap flex-shrink-0
                                            ${isActive 
                                                ? 'bg-white text-blue-600 shadow-sm' 
                                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}
                                        `}
                                    >
                                        Sun {sunLabel}
                                    </button>
                                );
                            })}
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
                                            <CashAdvanceInputRow 
                                                key={c.id} 
                                                client={c} 
                                                value={cashAdvances[c.id] || ''} 
                                                onChange={handleInputChange}
                                                onBlur={handleInputBlur}
                                                onFocus={handleInputFocus}
                                                navState={navState}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex flex-col border-t md:border-t-0 border-gray-100 pt-4 md:pt-0">
                                        {rightClients.map(c => (
                                            <CashAdvanceInputRow 
                                                key={c.id} 
                                                client={c} 
                                                value={cashAdvances[c.id] || ''} 
                                                onChange={handleInputChange}
                                                onBlur={handleInputBlur}
                                                onFocus={handleInputFocus}
                                                navState={navState}
                                            />
                                        ))}
                                    </div>
                                </div>
                                {clients.length === 0 && <div className="text-center text-gray-400 py-8">No paper clients found.</div>}
                            </div>
                        </div>
                    )}
                    
                    {/* Sticky Footer Total */}
                    <div className="sticky bottom-0 bg-gray-900 text-white p-4 shadow-lg flex justify-between items-center z-20">
                         <div className="text-sm font-medium uppercase tracking-wider text-gray-400">Total Cash Advance</div>
                         <div className="text-2xl font-mono font-bold text-blue-400">
                             ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </div>
                    </div>
                </div>
            )}
       </div>
    </div>
  );
};

export default CashAdvanceReport;
