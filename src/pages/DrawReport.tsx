import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getClients, getDrawBalances, saveDrawBalance, getClientBalancesPriorToDate, generateSpecialCarryForward, getLedgerRecords, getNetAmount } from '../services/storageService';
import { Client, LedgerRecord } from '../types';
import { Calendar, ChevronLeft, ChevronRight, Filter, Save, Layers, RefreshCw, Loader2, AlertCircle, Check } from 'lucide-react';
import { MONTH_NAMES, getWeeksForMonth, getWeekRangeString } from '../utils/reportUtils';
import { Link } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalStateContext';

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
        <div className="fixed bottom-2 left-2 right-2 md:right-auto md:left-8 md:bottom-8 bg-white border border-gray-200 shadow-2xl rounded-xl z-50 md:w-[450px] overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300 flex flex-col max-h-[40vh] md:max-h-[600px]">
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

// Extracted Component to prevent re-mounting on every render
const ClientInputRow = React.memo(({ client, value, onChange, onBlur, onFocus, navState }: { 
    client: Client, 
    value: string, 
    onChange: (id: string, val: string) => void, 
    onBlur: (id: string) => void,
    onFocus: (id: string) => void,
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
                    onFocus={(e) => { e.target.select(); onFocus(client.id); }}
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
  const { currentDate, setCurrentDate } = useGlobalState();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientBalances, setClientBalances] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorLog, setErrorLog] = useState<string[]>([]);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);
  
  // Timeout reference to manage blur/focus race conditions
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived Date State
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // Format selectedDate string 'YYYY-MM-DD' from currentDate
  const selectedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    fetchClients();
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
          mapped[c.id] = data[c.id] !== undefined ? data[c.id].toFixed(2) : '';
      });
      
      setClientBalances(mapped);
      setLoading(false);
  };

  const handleDateClick = (dateObj: Date) => {
      setCurrentDate(dateObj);
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
      setClientBalances((prev: Record<string, string>) => {
          const val = prev[clientId];
          const newMap = { ...prev };
          if (val !== '' && !isNaN(Number(val))) {
              const numVal = parseFloat(val);
              saveDrawBalance(selectedDate, clientId, numVal);
              newMap[clientId] = numVal.toFixed(2);
          } else if (val === '') {
              saveDrawBalance(selectedDate, clientId, 0);
          }
          return newMap;
      });
      
      // Cancel previous timeout if it exists
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      
      // Set new timeout to hide preview
      blurTimeoutRef.current = setTimeout(() => {
          setPreviewClientId(null);
          blurTimeoutRef.current = null;
      }, 200);
  }, [selectedDate]);

  const handleInputFocus = useCallback((clientId: string) => {
      // Cancel pending hide since we are focusing a new input
      if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current);
          blurTimeoutRef.current = null;
      }
      setPreviewClientId(clientId);
  }, []);

  const handleGenerateBalance = async () => {
      if (!selectedDate) return;
      if (!window.confirm("This will fetch the total net balance of all clients from previous weeks and overwrite the current week's draw report. Continue?")) return;

      setGenerating(true);
      setProgress(0);
      setErrorLog([]);
      setGenerationComplete(false);
      
      const errors: string[] = [];

      try {
          // getClientBalancesPriorToDate is now updated to strictly return Main Ledger totals.
          const prevBalances = await getClientBalancesPriorToDate(selectedDate, clients);
          
          const newBalances: Record<string, string> = {};
          let processed = 0;
          const totalCount = clients.length;
          
          for (const client of clients) {
              try {
                  const codeUpper = client.code?.toUpperCase();
                  const clientData = prevBalances[client.id] || { amount: 0, isPanel1: false };
                  
                  // Special Logic for Z21 and C19 (Row Copying)
                  if (codeUpper === 'Z21' || codeUpper === 'C19') {
                      await generateSpecialCarryForward(client.id, codeUpper, selectedDate);
                  } 
                  
                  // REVISED: Always set the Main Ledger Opening Balance (Draw Balance) 
                  // to the final Main Ledger amount from previous periods.
                  const bal = clientData.amount;
                  newBalances[client.id] = bal.toFixed(2);
                  await saveDrawBalance(selectedDate, client.id, bal);
                  
              } catch (err: any) {
                  const msg = `${client.name}: ${err.message || 'Error processing'}`;
                  console.error(msg);
                  errors.push(msg);
                  setErrorLog(prev => [...prev, msg]);
              }
              processed++;
              setProgress(Math.round((processed / totalCount) * 100));
          }
          
          setClientBalances(newBalances);
          
      } catch (e: any) {
          console.error("Failed to generate balances", e);
          const msg = `Critical System Error: ${e.message}`;
          errors.push(msg);
          setErrorLog(prev => [...prev, msg]);
      } finally {
          setGenerationComplete(true);
          if (errors.length === 0) {
              setTimeout(() => {
                  setGenerating(false);
                  setGenerationComplete(false);
              }, 800);
          }
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
      const newDate = new Date(currentDate);
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() + 1);
      if (newDate.getFullYear() > 2026) return;
      setCurrentDate(newDate);
  };

  const prevMonth = () => {
      const newDate = new Date(currentDate);
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() - 1);
      if (newDate.getFullYear() < 2025) return;
      setCurrentDate(newDate);
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
  const sortedWeekNums = Object.keys(currentMonthWeeks).map(Number).sort((a, b) => a - b);

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
    <div className="flex flex-col lg:flex-row gap-6 min-h-screen pb-20 relative">
       {/* Preview Overlay */}
       {previewClientId && <LedgerPreviewOverlay clientId={previewClientId} selectedDate={selectedDate} />}

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
                        <div className="flex flex-col w-full">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center">
                                    <h2 className="text-xl font-bold text-gray-900 flex items-center mr-3">
                                        <Layers size={20} className="mr-2 text-blue-600" />
                                        <span className="hidden lg:inline">{activeWeekDateRange}</span>
                                        <span className="lg:hidden">Draw Reports</span>
                                    </h2>
                                    <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded hidden lg:inline">
                                        {MONTH_NAMES[currentMonth]} {currentYear}
                                    </span>
                                </div>

                                 {/* Mobile Month Nav */}
                                 <div className="flex lg:hidden items-center bg-white rounded-lg border border-gray-200 shadow-sm p-0.5">
                                     <button onClick={prevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-1.5 hover:bg-gray-50 rounded-md disabled:opacity-30"><ChevronLeft size={16}/></button>
                                     <span className="text-xs font-bold px-2 w-20 text-center">{MONTH_NAMES[currentMonth].slice(0,3)} {currentYear}</span>
                                     <button onClick={nextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-1.5 hover:bg-gray-50 rounded-md disabled:opacity-30"><ChevronRight size={16}/></button>
                                </div>
                            </div>
                            
                            {/* Mobile Week Buttons with Sunday Date */}
                            <div className="flex lg:hidden space-x-2 bg-gray-200 p-1 rounded-lg w-full overflow-x-auto mt-3">
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
                                                px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap flex-shrink-0
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

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={handleGenerateBalance}
                                disabled={generating}
                                className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm text-sm font-bold disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                                <RefreshCw size={16} className={`mr-2 ${generating && !generationComplete ? 'animate-spin' : ''}`} />
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
                                                onFocus={handleInputFocus}
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
                    
                    <div className="sticky bottom-0 bg-gray-900 text-white p-4 shadow-lg flex justify-between items-center z-20">
                         <div className="text-sm font-medium uppercase tracking-wider text-gray-400">Total Company Balance</div>
                         <div className={`text-2xl font-mono font-bold ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                             {total > 0 ? '+' : ''}{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                         </div>
                    </div>
                </div>
            )}
       </div>

       {generating && (
           <div className="fixed inset-0 bg-black/60 z-[9999] flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4">
                   <div className="relative mb-6">
                        {generationComplete ? (
                            errorLog.length > 0 ? (
                                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 animate-in zoom-in">
                                    <AlertCircle size={32} />
                                </div>
                            ) : (
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 animate-in zoom-in">
                                    <Check size={32} />
                                </div>
                            )
                        ) : (
                            <>
                                <Loader2 className="animate-spin text-indigo-600 w-16 h-16" strokeWidth={1.5} />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-bold text-indigo-800">{progress}%</span>
                                </div>
                            </>
                        )}
                   </div>
                   
                   <h3 className="text-xl font-bold text-gray-900 mb-2">
                       {generationComplete 
                            ? (errorLog.length > 0 ? 'Completed with Errors' : 'Complete!') 
                            : 'Generating Balances'}
                   </h3>
                   
                   {!generationComplete && (
                       <>
                           <p className="text-gray-500 text-center text-sm mb-6">
                               Retrieving and processing last week's final amounts...
                           </p>
                           <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                               <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                           </div>
                       </>
                   )}

                   {errorLog.length > 0 && (
                       <div className="mt-4 w-full bg-red-50 p-3 rounded-lg border border-red-100 max-h-40 overflow-y-auto">
                           <p className="text-red-800 font-bold text-xs mb-1 uppercase tracking-wider">Failed Records:</p>
                           {errorLog.map((err, idx) => (
                               <div key={idx} className="flex items-start text-red-600 text-xs mb-1 last:mb-0">
                                   <span className="mr-1">•</span>
                                   <span>{err}</span>
                               </div>
                           ))}
                       </div>
                   )}

                   {generationComplete && errorLog.length > 0 && (
                       <button 
                           onClick={() => setGenerating(false)}
                           className="mt-6 px-6 py-2 bg-gray-800 text-white rounded-lg font-bold shadow-md hover:bg-gray-900 transition-colors w-full"
                       >
                           Close
                       </button>
                   )}
               </div>
           </div>
       )}
    </div>
  );
};

export default DrawReport;
