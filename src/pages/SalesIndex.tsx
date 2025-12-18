
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Loader2, Calendar, Smartphone, FileText, DollarSign, RefreshCw, FileSpreadsheet, Zap, CheckCircle, TrendingUp } from 'lucide-react';
import { getClients, getSalesForDates, saveSaleRecord, getLedgerRecords, updateLedgerRecord, saveLedgerRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';
import { MONTH_NAMES, getWeeksForMonth } from '../utils/reportUtils';

// Specific Display Codes
const PAPER_Z_CODES = ['Z03', 'Z05', 'Z07', 'Z15', 'Z19', 'Z20'];
const PAPER_C_CODES = ['C03', 'C04', 'C06', 'C09', 'C13', 'C15', 'C17'];

// Mapping: Mobile Code -> Paper Code (Case Insensitive)
const MOBILE_TO_PAPER_MAP: Record<string, string> = {
    'sk3964': 'z07',  // SINGER -> 顺
    'sk3818': 'z19',  // MOOI -> 妹
    'sk3619': 'c13',  // ZHONG -> 中
    'sk8959': 'c17',  // YEE -> 仪
    'vc9486': '9486'  // vincent -> 张
};

// --- Helper: Composite Input for B/S or A/C ---
const CompositeInput = React.memo(({ 
    val1, 
    val2, 
    onChange, 
    colorClass
}: { 
    val1: number, 
    val2: number, 
    onChange: (v1: number, v2: number) => void,
    colorClass: string
}) => {
    const formatValue = (v1: number, v2: number) => {
        if (!v1 && !v2) return '';
        if (v2 === 0) return `${v1}`;
        return `${v1}/${v2}`;
    };

    const [localVal, setLocalVal] = useState(formatValue(val1, val2));

    useEffect(() => {
        setLocalVal(formatValue(val1, val2));
    }, [val1, val2]);

    const handleBlur = () => {
        let v1 = 0, v2 = 0;
        
        if (localVal.trim() === '') {
            if (val1 !== 0 || val2 !== 0) onChange(0, 0);
            return;
        }

        if (localVal.includes('/')) {
            const parts = localVal.split('/');
            v1 = parseFloat(parts[0]) || 0;
            v2 = parseFloat(parts[1]) || 0;
        } else {
            v1 = parseFloat(localVal) || 0;
            v2 = 0; 
        }

        if (v1 !== val1 || v2 !== val2) {
            onChange(v1, v2);
        }
        setLocalVal(formatValue(v1, v2));
    };

    return (
        <input 
            type="text"
            inputMode="decimal"
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                }
            }}
            onFocus={(e) => e.target.select()}
            className={`w-full h-full text-center bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono text-base ${colorClass} ${localVal ? 'font-bold' : 'opacity-50'}`}
            placeholder="-"
        />
    );
});

const DetailedMobileTableRow = React.memo(({ 
    client, 
    record
}: { 
    client: Client, 
    record?: SaleRecord
}) => {
    const raw = record?.mobileRawData || [];
    const getVal = (idx: number) => raw[idx] || '';
    const fmt = (val: string | number) => {
        if (!val || val === '-') return '-';
        return String(val);
    };
    const getColorClass = (val: string | number) => {
        const num = parseFloat(String(val).replace(/,/g,''));
        if (isNaN(num)) return 'text-gray-900';
        return num >= 0 ? 'text-green-700' : 'text-red-600';
    };

    return (
        <tr className="hover:bg-purple-50/50 transition-colors border-b border-gray-100 last:border-0 font-mono text-[10px] md:text-xs">
            <td className="px-2 py-3 text-left bg-white sticky left-0 z-10 border-r border-gray-200 shadow-sm">
                <div className="font-bold text-gray-900">{client.name}</div>
                <div className="text-[9px] text-gray-500">{client.code}</div>
            </td>
            <td className="px-2 py-3 text-right bg-gray-50/20 font-semibold border-r border-gray-100">{fmt(getVal(0))}</td>
            <td className="px-2 py-3 text-right">{fmt(getVal(1))}</td>
            <td className="px-2 py-3 text-right">{fmt(getVal(2))}</td>
            <td className="px-2 py-3 text-right">{fmt(getVal(3))}</td>
            <td className="px-2 py-3 text-right">{fmt(getVal(4))}</td>
            <td className={`px-2 py-3 text-right font-extrabold bg-blue-50/50 border-x border-blue-100 ${getColorClass(getVal(5))}`}>
                {fmt(getVal(5))}
            </td>
            <td className="px-2 py-3 text-right">{fmt(getVal(6))}</td>
            <td className="px-2 py-3 text-right">{fmt(getVal(7))}</td>
            <td className="px-2 py-3 text-right">{fmt(getVal(8))}</td>
            <td className="px-2 py-3 text-right text-orange-600 bg-orange-50/30">{fmt(getVal(9))}</td>
            <td className="px-2 py-3 text-right">{fmt(getVal(10))}</td>
            <td className={`px-2 py-3 text-right font-extrabold bg-indigo-50/50 border-x border-indigo-100 ${getColorClass(getVal(11))}`}>
                {fmt(getVal(11))}
            </td>
            <td className="px-2 py-3 text-right">{fmt(getVal(12))}</td>
            <td className="px-2 py-3 text-right">{fmt(getVal(13))}</td>
            <td className="px-2 py-3 text-right">{fmt(getVal(14))}</td>
            <td className="px-2 py-3 text-right">{fmt(getVal(15))}</td>
            <td className={`px-2 py-3 text-right font-extrabold bg-green-50/50 border-l border-green-100 ${getColorClass(getVal(16))}`}>
                {fmt(getVal(16))}
            </td>
        </tr>
    );
});

const ClientWeeklyCard = React.memo(({ 
    client, 
    dateStrings, 
    salesData, 
    onUpdate,
    weekState 
}: { 
    client: Client, 
    dateStrings: string[], 
    salesData: SaleRecord[], 
    onUpdate: (clientId: string, dateStr: string, field1: 'b'|'a', val1: number, field2: 's'|'c', val2: number) => void,
    weekState: { year: number, month: number, week: number }
}) => {
    const clientRecords = salesData.filter(r => r.clientId === client.id);
    const rawTotal = clientRecords.reduce((acc, r) => acc + (r.b||0) + (r.s||0) + (r.a||0) + (r.c||0), 0);
    const totalWeek = rawTotal * 0.86;

    const formatMonth = (mIndex: number) => {
        const name = MONTH_NAMES[mIndex] || "";
        return name.charAt(0) + name.slice(1, 3).toLowerCase();
    };

    const paperDisplayDates = dateStrings.filter(dStr => {
        const [y, m, d] = dStr.split('-').map(Number);
        const dateObj = new Date(y, m-1, d);
        const day = dateObj.getDay();
        return [0, 2, 3, 6].includes(day);
    });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <Link 
                    to={`/clients/${client.id}`} 
                    state={weekState}
                    className="flex items-center space-x-2 hover:text-blue-600 transition-colors group"
                >
                    <div>
                        <div className="font-bold text-gray-800 group-hover:text-blue-600 leading-tight">{client.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{client.code}</div>
                    </div>
                </Link>
                <div className="text-right">
                    <div className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Week Total (-14%)</div>
                    <span className={`font-mono font-bold text-sm ${totalWeek > 0 ? 'text-blue-600' : 'text-gray-900'}`}>
                        {totalWeek !== 0 ? totalWeek.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto">
                <table className="w-full text-center border-collapse">
                    <thead className="bg-gray-50/50 text-xs text-gray-500 font-semibold uppercase tracking-wider">
                        <tr>
                            <th className="py-2 pl-4 text-left font-medium w-24">Date</th>
                            <th className="py-2 text-blue-700 font-bold border-l border-gray-100 text-sm">万 <span className="opacity-40 text-[9px] font-normal">B/S</span></th>
                            <th className="py-2 text-red-700 font-bold border-l border-gray-100 text-sm">千 <span className="opacity-40 text-[9px] font-normal">A/C</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {paperDisplayDates.map(dateStr => {
                            const [y, m, d] = dateStr.split('-').map(Number);
                            const displayDate = `${d} ${formatMonth(m-1)}`;
                            const record = salesData.find(r => r.clientId === client.id && r.date === dateStr);
                            
                            return (
                                <tr key={dateStr} className="hover:bg-gray-50/80 transition-colors">
                                    <td className="py-2 pl-4 text-left font-bold text-gray-700 whitespace-nowrap bg-gray-50/20">
                                        {displayDate}
                                    </td>
                                    <td className="p-0 h-10 border-l border-gray-100 relative">
                                        <CompositeInput 
                                            val1={record?.b || 0}
                                            val2={record?.s || 0}
                                            onChange={(b, s) => onUpdate(client.id, dateStr, 'b', b, 's', s)}
                                            colorClass="text-blue-700"
                                        />
                                    </td>
                                    <td className="p-0 h-10 border-l border-gray-100 relative">
                                        <CompositeInput 
                                            val1={record?.a || 0}
                                            val2={record?.c || 0}
                                            onChange={(a, c) => onUpdate(client.id, dateStr, 'a', a, 'c', c)}
                                            colorClass="text-red-700"
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
});


const SalesIndex: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(2025);
  const [currentMonth, setCurrentMonth] = useState(0);
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);
  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'paper' | 'mobile'>('paper');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenMessage, setRegenMessage] = useState<string | null>(null);

  useEffect(() => {
      const now = new Date();
      let y = now.getFullYear();
      let m = now.getMonth();
      if (y < 2025) y = 2025;
      if (y > 2026) y = 2026;
      setCurrentYear(y);
      setCurrentMonth(m);
      const weeks = getWeeksForMonth(y, m);
      const todayStr = `${y}-${String(m+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const foundWeek = Object.keys(weeks).find(wKey => weeks[parseInt(wKey)].some(dObj => {
          const dStr = `${dObj.getFullYear()}-${String(dObj.getMonth()+1).padStart(2,'0')}-${String(dObj.getDate()).padStart(2,'0')}`;
          return dStr === todayStr;
      }));
      setSelectedWeekNum(foundWeek ? parseInt(foundWeek) : parseInt(Object.keys(weeks)[0] || '1'));
  }, []);

  const weeksData = useMemo<Record<number, Date[]>>(() => getWeeksForMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  const activeDays = weeksData[selectedWeekNum] || [];
  const activeDateStrings = useMemo(() => activeDays.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`), [activeDays]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
        const loadedClients = await getClients();
        setClients(loadedClients);
        if (activeDateStrings.length > 0) {
            const records = await getSalesForDates(activeDateStrings);
            setSalesData(records);
        } else {
            setSalesData([]);
        }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [activeDateStrings]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUpdate = useCallback(async (clientId: string, dateStr: string, f1: 'b'|'a', v1: number, f2: 's'|'c', v2: number) => {
      setSalesData(prev => {
          const idx = prev.findIndex(r => r.clientId === clientId && r.date === dateStr);
          if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], [f1]: v1, [f2]: v2 };
              return updated;
          } else {
              return [...prev, { id: 'temp', clientId, date: dateStr, b: f1 === 'b' ? v1 : 0, s: f2 === 's' ? v2 : 0, a: f1 === 'a' ? v1 : 0, c: f2 === 'c' ? v2 : 0 }];
          }
      });
      const existing = salesData.find(r => r.clientId === clientId && r.date === dateStr);
      const payload = existing ? { ...existing, [f1]: v1, [f2]: v2 } : { clientId, date: dateStr, b:0, s:0, a:0, c:0, [f1]: v1, [f2]: v2 };
      const { id, ...savePayload } = payload; 
      await saveSaleRecord(savePayload);
  }, [salesData]);

  const handleRegenerateDianFromList = async () => {
      if (salesData.length === 0) return;
      setIsRegenerating(true); setRegenMessage(null);
      let updateCount = 0;
      try {
          for (const record of salesData) {
              const mobileClient = clients.find(c => c.id === record.clientId);
              if (!mobileClient || !mobileClient.code) continue;
              const mappedPaperCode = MOBILE_TO_PAPER_MAP[mobileClient.code.toLowerCase()];
              if (mappedPaperCode) {
                  const paperClient = clients.find(c => c.code.toLowerCase() === mappedPaperCode.toLowerCase());
                  if (paperClient) {
                      const rawData = record.mobileRawData;
                      if (!rawData || rawData.length < 6) continue;
                      const companyAmount = parseFloat(String(rawData[5]).replace(/,/g, ''));
                      if (!isNaN(companyAmount) && companyAmount !== 0) {
                          const records = await getLedgerRecords(paperClient.id);
                          const existingDian = records.find(r => r.date === record.date && r.typeLabel === '电' && r.column === 'main');
                          const operation = companyAmount >= 0 ? 'subtract' : 'add';
                          const amount = Math.abs(companyAmount);
                          if (existingDian) { await updateLedgerRecord(existingDian.id, { amount, operation }); } 
                          else { await saveLedgerRecord({ clientId: paperClient.id, date: record.date, description: '', typeLabel: '电', amount, operation, column: 'main', isVisible: true }); }
                          updateCount++;
                      }
                  }
              }
          }
          setRegenMessage(`Successfully updated ${updateCount} '电' records.`);
          setTimeout(() => setRegenMessage(null), 3000);
      } catch (error) { console.error(error); setRegenMessage("Failed to regenerate records."); } 
      finally { setIsRegenerating(false); }
  };

  const handlePrevMonth = () => {
      if (currentMonth === 0) { if (currentYear > 2025) { setCurrentYear(y => y - 1); setCurrentMonth(11); } } 
      else { setCurrentMonth(m => m - 1); }
  };
  const handleNextMonth = () => {
      if (currentMonth === 11) { if (currentYear < 2026) { setCurrentYear(y => y + 1); setCurrentMonth(0); } } 
      else { setCurrentMonth(m => m + 1); }
  };

  const paperClients = useMemo(() => clients.filter(c => (c.category || 'paper') === 'paper'), [clients]);
  const mobileClients = useMemo(() => clients.filter(c => c.category === 'mobile'), [clients]);

  const { zClients, cClients } = useMemo(() => {
      const term = searchTerm.toLowerCase();
      const filtered = paperClients.filter(c => c.name.toLowerCase().includes(term) || c.code.toLowerCase().includes(term));
      const zList = filtered.filter(c => PAPER_Z_CODES.includes(c.code.toUpperCase()));
      const cList = filtered.filter(c => PAPER_C_CODES.includes(c.code.toUpperCase()));
      zList.sort((a,b) => PAPER_Z_CODES.indexOf(a.code.toUpperCase()) - PAPER_Z_CODES.indexOf(b.code.toUpperCase()));
      cList.sort((a,b) => PAPER_C_CODES.indexOf(a.code.toUpperCase()) - PAPER_C_CODES.indexOf(b.code.toUpperCase()));
      return { zClients: zList, cClients: cList };
  }, [paperClients, searchTerm]);

  const filteredMobileClients = mobileClients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.toLowerCase().includes(searchTerm.toLowerCase()));

  const mobileColumnTotals = useMemo(() => {
      const totals = new Array(17).fill(0);
      filteredMobileClients.forEach(client => {
          const clientRecords = salesData.filter(r => r.clientId === client.id);
          const record = clientRecords[clientRecords.length - 1]; 
          if (record?.mobileRawData) {
              record.mobileRawData.forEach((val, idx) => {
                  if (idx < 17) totals[idx] += parseFloat(String(val).replace(/,/g, '')) || 0;
              });
          }
      });
      return totals;
  }, [filteredMobileClients, salesData]);

  const totalPaperRaw = [...zClients, ...cClients].reduce((acc, client) => {
      const clientRecs = salesData.filter(r => r.clientId === client.id);
      return acc + clientRecs.reduce((sum, r) => sum + (r.b||0) + (r.s||0) + (r.a||0) + (r.c||0), 0);
  }, 0);

  const totalPaperCompany = totalPaperRaw * 0.83; 
  const totalPaperClient = totalPaperRaw * 0.86; 
  const totalPaperEarnings = totalPaperCompany - totalPaperClient;

  // Mobile Totals (Absolute and Aligned)
  const totalMobileAgent = Math.abs(mobileColumnTotals[16] || 0);
  const totalMobileCompany = Math.abs(mobileColumnTotals[5] || 0);
  const totalMobileShareholder = Math.abs(mobileColumnTotals[11] || 0);

  // Weekly Total Earning Calculation (Paper Earnings + Mobile Earnings)
  const totalWeeklyProfit = Math.abs(totalPaperEarnings) + totalMobileShareholder;

  const sortedWeekKeys = Object.keys(weeksData).map(Number).sort((a,b) => a-b);
  useEffect(() => { if (sortedWeekKeys.length > 0 && !sortedWeekKeys.includes(selectedWeekNum)) setSelectedWeekNum(sortedWeekKeys[0]); }, [sortedWeekKeys, selectedWeekNum]);

  const getWeekRangeLabel = (weekNum: number) => {
      const days = weeksData[weekNum];
      if (!days || days.length === 0) return '';
      const formatDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()].slice(0,3)}`;
      return `${formatDate(days[0])} - ${formatDate(days[days.length - 1])}`;
  };

  const formatTotal = (val: number) => val.toLocaleString(undefined, {minimumFractionDigits: 2});
  const getTotalColor = (val: number) => val >= 0 ? 'text-green-800' : 'text-red-700';

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Top Header - Tabs and Navigation */}
      <div className="bg-white border-b border-gray-200 z-20 shadow-sm flex-shrink-0">
          <div className="px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-3">
             <div className="flex items-center w-full sm:w-auto">
                 <div className="flex bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
                    <button onClick={() => setActiveTab('paper')} className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'paper' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}><FileText size={16} className="mr-2" />Paper</button>
                    <button onClick={() => setActiveTab('mobile')} className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'mobile' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}><Smartphone size={16} className="mr-2" />Mobile</button>
                 </div>
             </div>

             <div className="flex items-center space-x-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder={`Search ${activeTab}...`} className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                {activeTab === 'mobile' && (
                    <div className="flex space-x-2">
                        <button onClick={handleRegenerateDianFromList} disabled={isRegenerating || filteredMobileClients.length === 0} className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 shadow-sm" title="Regenerate 电"><Zap size={18} className={isRegenerating ? 'animate-pulse' : ''} /></button>
                        <button onClick={() => navigate('/sales/mobile-report')} className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm" title="Import Mobile Report"><FileSpreadsheet size={18} /></button>
                    </div>
                )}
            </div>
          </div>

          {/* Sub Header - Month and Week Selector */}
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar bg-gray-50/50">
                <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 flex-shrink-0 shadow-sm">
                    <button onClick={handlePrevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronLeft size={18}/></button>
                    <span className="w-24 md:w-28 text-center font-bold text-gray-800 text-[11px] md:text-sm">{MONTH_NAMES[currentMonth].slice(0,3)} {currentYear}</span>
                    <button onClick={handleNextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronRight size={18}/></button>
                </div>
                <div className="flex space-x-1.5 md:space-x-2">
                    {sortedWeekKeys.map(wk => (
                        <button key={wk} onClick={() => setSelectedWeekNum(wk)} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex flex-col items-center justify-center min-w-[90px] md:min-w-[110px] border ${selectedWeekNum === wk ? 'bg-blue-600 text-white shadow border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}><span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider opacity-80">Week {Object.keys(weeksData).indexOf(String(wk)) + 1}</span><span className={`text-[10px] md:text-[11px] font-mono mt-0.5 ${selectedWeekNum === wk ? 'text-blue-100' : 'text-gray-400'}`}>{getWeekRangeLabel(wk)}</span></button>
                    ))}
                </div>
                <button onClick={loadData} className="ml-auto p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
          </div>

          {/* New Totals Bar - Better View and Mobile Responsive */}
          <div className="bg-white border-t border-gray-100 px-4 py-2.5 overflow-x-auto no-scrollbar">
                <div className="flex items-center min-w-max space-x-6 md:space-x-8">
                    {activeTab === 'paper' ? (
                        <>
                            <div className="flex flex-col"><span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Raw Total</span><span className="font-mono font-bold text-gray-800 text-sm md:text-base">${totalPaperRaw.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            <div className="flex flex-col"><span className="text-[9px] text-blue-500 font-bold uppercase tracking-widest">Company (17%)</span><span className="font-mono font-bold text-blue-600 text-sm md:text-base">${Math.abs(totalPaperCompany).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            <div className="flex flex-col"><span className="text-[9px] text-red-500 font-bold uppercase tracking-widest">Client (14%)</span><span className="font-mono font-bold text-red-600 text-sm md:text-base">${Math.abs(totalPaperClient).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            <div className="flex flex-col"><span className="text-[9px] text-orange-500 font-bold uppercase tracking-widest">Earnings</span><span className="font-mono font-bold text-orange-600 text-sm md:text-base">${Math.abs(totalPaperEarnings).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                        </>
                    ) : (
                        <>
                            <div className="flex flex-col"><span className="text-[9px] text-purple-400 font-bold uppercase tracking-widest">公司总额</span><span className="font-mono font-bold text-purple-600 text-sm md:text-base">${totalMobileAgent.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            <div className="flex flex-col"><span className="text-[9px] text-blue-500 font-bold uppercase tracking-widest">会员总数</span><span className="font-mono font-bold text-blue-600 text-sm md:text-base">${totalMobileCompany.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                            <div className="flex flex-col"><span className="text-[9px] text-orange-500 font-bold uppercase tracking-widest">Earnings</span><span className="font-mono font-bold text-orange-600 text-sm md:text-base">${Math.abs(totalMobileShareholder).toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                        </>
                    )}
                    
                    {/* Weekly Total Earning relocated to a prominent end-cap */}
                    <div className="flex-1"></div>
                    <div className="bg-emerald-50 px-4 py-1.5 rounded-xl border border-emerald-100 flex items-center shadow-sm">
                        <TrendingUp size={16} className="text-emerald-500 mr-3" />
                        <div className="flex flex-col">
                            <span className="text-[9px] text-emerald-600 font-black uppercase tracking-widest leading-none mb-1">Weekly Total Earning</span>
                            <span className="font-mono font-black text-emerald-700 text-base md:text-xl leading-none">${totalWeeklyProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </div>
          </div>
      </div>

      {regenMessage && (
        <div className="bg-green-50 border-b border-green-200 px-4 py-2 text-green-800 text-sm font-bold flex items-center justify-center animate-in fade-in slide-in-from-top-2"><CheckCircle size={16} className="mr-2" />{regenMessage}</div>
      )}

      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {loading ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
            <div className="max-w-[1600px] mx-auto pb-20">
                {activeTab === 'paper' ? (
                    <div className="flex flex-col lg:flex-row gap-6">
                        <div className="flex-1 bg-white/50 p-4 rounded-xl border border-dashed border-gray-300">
                            <h2 className="text-lg font-bold text-gray-700 mb-4 px-2 border-b border-gray-200 pb-2">Z Series</h2>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {zClients.map(client => (<ClientWeeklyCard key={client.id} client={client} dateStrings={activeDateStrings} salesData={salesData} onUpdate={handleUpdate} weekState={{ year: currentYear, month: currentMonth, week: selectedWeekNum }} />))}
                                {zClients.length === 0 && <p className="text-gray-400 text-sm col-span-full text-center py-4">No Z-series clients found.</p>}
                            </div>
                        </div>
                        <div className="flex-1 bg-white/50 p-4 rounded-xl border border-dashed border-gray-300">
                            <h2 className="text-lg font-bold text-gray-700 mb-4 px-2 border-b border-gray-200 pb-2">C Series</h2>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {cClients.map(client => (<ClientWeeklyCard key={client.id} client={client} dateStrings={activeDateStrings} salesData={salesData} onUpdate={handleUpdate} weekState={{ year: currentYear, month: currentMonth, week: selectedWeekNum }} />))}
                                {cClients.length === 0 && <p className="text-gray-400 text-sm col-span-full text-center py-4">No C-series clients found.</p>}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                                <thead className="bg-gray-100 font-bold text-gray-700">
                                    <tr className="bg-gray-200 text-gray-800 text-[10px] uppercase tracking-wider border-b border-gray-300">
                                        <th className="px-2 py-1 sticky left-0 bg-gray-200 z-10 border-r border-gray-300"></th>
                                        <th className="px-2 py-1 text-center border-r border-gray-300 bg-gray-200/50">Member / 会员</th>
                                        <th colSpan={5} className="px-2 py-1 text-center border-r border-gray-300 bg-blue-50 text-blue-800">Company / 公司</th>
                                        <th colSpan={6} className="px-2 py-1 text-center border-r border-gray-300 bg-indigo-50 text-indigo-800">Shareholder / 股东</th>
                                        <th colSpan={5} className="px-2 py-1 text-center bg-green-50 text-green-800">Agent / 总代理</th>
                                    </tr>
                                    <tr className="bg-gray-100 border-b border-gray-200">
                                        <th className="px-2 py-3 sticky left-0 bg-gray-100 z-10 border-r border-gray-200 shadow-sm text-left">登陆帐号 / 名字</th>
                                        <th className="px-2 py-3 text-right text-gray-500 border-r border-gray-200">总投注</th>
                                        <th className="px-2 py-3 text-right text-gray-600">营业额</th>
                                        <th className="px-2 py-3 text-right text-gray-600">佣金</th>
                                        <th className="px-2 py-3 text-right text-gray-600">赔出</th>
                                        <th className="px-2 py-3 text-right text-gray-600">补费用</th>
                                        <th className="px-2 py-3 text-right font-extrabold bg-blue-50 text-blue-800 border-x border-blue-100">总额</th>
                                        <th className="px-2 py-3 text-right text-gray-600">营业额</th>
                                        <th className="px-2 py-3 text-right text-gray-600">佣金</th>
                                        <th className="px-2 py-3 text-right text-gray-600">赔出</th>
                                        <th className="px-2 py-3 text-right text-orange-600 bg-orange-50/20">赢彩</th>
                                        <th className="px-2 py-3 text-right text-gray-600">补费用</th>
                                        <th className="px-2 py-3 text-right font-extrabold bg-indigo-50 text-indigo-800 border-x border-indigo-100">总额</th>
                                        <th className="px-2 py-3 text-right text-gray-600">营业额</th>
                                        <th className="px-2 py-3 text-right text-gray-600">佣金</th>
                                        <th className="px-2 py-3 text-right text-gray-600">赔出</th>
                                        <th className="px-2 py-3 text-right text-gray-600">抽费用</th>
                                        <th className="px-2 py-3 text-right font-extrabold bg-green-100 text-green-900 border-l border-green-100">总额</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredMobileClients.map(client => {
                                        const clientRecords = salesData.filter(r => r.clientId === client.id);
                                        const record = clientRecords[clientRecords.length - 1]; 
                                        return (<DetailedMobileTableRow key={client.id} client={client} record={record} />);
                                    })}
                                    {filteredMobileClients.length === 0 && (<tr><td colSpan={22} className="text-center py-8 text-gray-400">No mobile clients found.</td></tr>)}
                                </tbody>
                                <tfoot className="bg-gray-100 border-t-2 border-gray-300 font-mono font-bold text-[10px] md:text-xs">
                                    <tr>
                                        <td className="px-2 py-3 sticky left-0 bg-gray-100 z-10 border-r border-gray-300 text-left">总额</td>
                                        <td className="px-2 py-3 text-right border-r border-gray-300 text-gray-700">{formatTotal(mobileColumnTotals[0])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[1])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[2])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[3])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[4])}</td>
                                        <td className={`px-2 py-3 text-right bg-blue-100 border-x border-blue-200 ${getTotalColor(mobileColumnTotals[5])}`}>{formatTotal(mobileColumnTotals[5])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[6])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[7])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[8])}</td>
                                        <td className="px-2 py-3 text-right text-orange-700">{formatTotal(mobileColumnTotals[9])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[10])}</td>
                                        <td className={`px-2 py-3 text-right bg-indigo-100 border-x border-indigo-200 ${getTotalColor(mobileColumnTotals[11])}`}>{formatTotal(mobileColumnTotals[11])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[12])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[13])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[14])}</td>
                                        <td className="px-2 py-3 text-right">{formatTotal(mobileColumnTotals[15])}</td>
                                        <td className={`px-2 py-3 text-right bg-green-200 border-l border-green-300 ${getTotalColor(mobileColumnTotals[16])}`}>{formatTotal(mobileColumnTotals[16])}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

      {activeTab === 'mobile' && (
        <div className="bg-purple-900 text-white p-4 sticky bottom-0 z-30 shadow-lg flex justify-between items-center lg:hidden">
            <div>
                <p className="text-xs text-purple-300 font-bold uppercase tracking-wider">Mobile Week Total</p>
                <p className="text-xs text-purple-400 opacity-75">{MONTH_NAMES[currentMonth]} W{Object.keys(weeksData).indexOf(String(selectedWeekNum)) + 1}</p>
            </div>
            <p className="font-mono font-bold text-2xl">${Math.abs(totalMobileShareholder).toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
      )}
    </div>
  );
};

export default SalesIndex;
