
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Loader2, Smartphone, FileText, RefreshCw, FileSpreadsheet, Zap, DollarSign, Briefcase, TrendingUp, LayoutTemplate, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { getClients, getSalesForDates, saveSaleRecord, getLedgerRecords, updateLedgerRecord, saveLedgerRecord, deleteLedgerRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';
import { MONTH_NAMES, getWeeksForMonth } from '../utils/reportUtils';
import { useGlobalState } from '../context/GlobalStateContext';

// Mapping: Mobile ID -> Paper Client Code
const MOBILE_TO_PAPER_MAP: Record<string, string> = {
    'sk3619': 'c13', 'sk3818': 'z19', 'sk3964': 'z07', 'sk8959': 'c17', 'vc9486': '9486',
    'g8sv8239': 'z03', 'mrcc04': 'c04', 'pt217': 'pt217', 'sk0922': 'z05', 'sk2839': '2839',
    'sk3715': '伍', 'sk5611': 'c09', 'sk8264': 'c19', 'skc009': 'c08', 'skc15': 'c15'
};

const Z_CLIENT_CODES = ['Z03', 'Z05', 'Z07', 'Z15', 'Z19', 'Z20'];
const C_CLIENT_CODES = ['C03', 'C04', 'C06', 'C07', 'C09', 'C13', 'C15', 'C17'];

const SpreadsheetInput = React.memo(({ 
    value, 
    onChange, 
    onBlur, 
    colorClass 
}: { 
    value: number, 
    onChange: (val: number) => Promise<void>, 
    onBlur: () => void,
    colorClass: string 
}) => {
    const [local, setLocal] = useState(value === 0 ? '' : value.toString());
    const [isSaving, setIsSaving] = useState(false);
    const lastValue = useRef(value);

    useEffect(() => {
        setLocal(value === 0 ? '' : value.toString());
        setIsSaving(false);
        lastValue.current = value;
    }, [value]);

    const handleConfirm = async () => {
        const num = parseFloat(local) || 0;
        if (num !== lastValue.current) {
            setIsSaving(true);
            await onChange(num);
            lastValue.current = num;
        }
        onBlur();
    };

    return (
        <div className="w-full h-full relative">
            <input 
                type="text"
                inputMode="decimal"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                onBlur={handleConfirm}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                }}
                disabled={isSaving}
                className={`w-full h-full text-center bg-transparent outline-none focus:bg-blue-50 font-mono text-lg font-black transition-all ${colorClass} ${isSaving ? 'opacity-30' : ''}`}
                placeholder=""
            />
            {isSaving && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-white/10">
                    <Loader2 size={12} className="animate-spin text-gray-400" />
                </div>
            )}
        </div>
    );
});

const DailySpreadsheetTable: React.FC<{ 
    dateStr: string, 
    clients: Client[], 
    sales: SaleRecord[], 
    onUpdate: (clientId: string, date: string, b: number, a: number) => Promise<void> 
}> = ({ 
    dateStr, 
    clients, 
    sales, 
    onUpdate 
}) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const displayDate = `${d}-${MONTH_NAMES[m-1].slice(0,3)}`;

    const getRowData = (codes: string[]) => {
        return codes.map(code => {
            const client = clients.find(c => c.code.toUpperCase() === code.toUpperCase());
            const sale = client ? sales.find(s => s.clientId === client.id && s.date === dateStr) : undefined;
            return { client, code, sale };
        });
    };

    const zData = getRowData(Z_CLIENT_CODES);
    const cData = getRowData(C_CLIENT_CODES);

    const calcTotals = (data: any[]) => {
        let wan = 0, qian = 0;
        data.forEach(d => {
            wan += (d.sale?.b || 0);
            qian += (d.sale?.a || 0);
        });
        return { wan, qian, total: wan + qian };
    };

    const zTotals = calcTotals(zData);
    const cTotals = calcTotals(cData);

    return (
        <div className="bg-white border-2 border-black mb-16 shadow-md max-w-6xl mx-auto overflow-hidden">
            {/* Desktop View: Side by Side | Mobile View: Stacked */}
            <div className="flex flex-col lg:flex-row">
                
                {/* Z GROUP Column */}
                <div className="flex-1 lg:border-r-2 lg:border-black">
                    <div className="bg-blue-600 text-white p-2 text-center font-black text-xl uppercase tracking-widest border-b-2 border-black">
                        {displayDate} - Z GROUP
                    </div>
                    <table className="w-full border-collapse">
                        <tbody>
                            {zData.map((row, idx) => (
                                <tr key={idx} className="h-14 border-b border-gray-400 last:border-0 hover:bg-gray-50 transition-colors">
                                    <td className="w-40 px-3 font-black text-gray-800 border-r border-gray-400 bg-gray-50/50 uppercase text-xs">
                                        <div className="flex flex-col">
                                            <span className="text-blue-700 text-sm">{row.code}</span>
                                            {row.client ? (
                                                <Link to={`/clients/${row.client.id}`} className="text-[10px] text-gray-500 hover:text-blue-700 underline truncate font-bold decoration-dotted">
                                                    {row.client.name}
                                                </Link>
                                            ) : (
                                                <span className="text-[10px] text-gray-300 font-bold italic">N/A</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="border-r border-gray-400 w-28 p-0 h-14">
                                        {row.client && (
                                            <SpreadsheetInput 
                                                value={row.sale?.b || 0} 
                                                onChange={(v) => onUpdate(row.client!.id, dateStr, v, row.sale?.a || 0)}
                                                onBlur={() => {}}
                                                colorClass="text-blue-700"
                                            />
                                        )}
                                    </td>
                                    <td className="w-28 p-0 h-14">
                                        {row.client && (
                                            <SpreadsheetInput 
                                                value={row.sale?.a || 0} 
                                                onChange={(v) => onUpdate(row.client!.id, dateStr, row.sale?.b || 0, v)}
                                                onBlur={() => {}}
                                                colorClass="text-red-600"
                                            />
                                        )}
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 h-24">
                                <td colSpan={3} className="p-4 border-t-2 border-black">
                                    <div className="flex flex-col items-center">
                                        <div className="flex border-2 border-black divide-x-2 divide-black w-56 mb-2 bg-white">
                                            <div className="flex-1 p-1 text-center font-mono font-black text-lg text-blue-700">{zTotals.wan || ''}</div>
                                            <div className="flex-1 p-1 text-center font-mono font-black text-lg text-red-600">{zTotals.qian || ''}</div>
                                        </div>
                                        <div className="border-2 border-black w-56 p-1 text-center font-mono font-black text-2xl bg-white">{zTotals.total.toLocaleString(undefined, {minimumFractionDigits: 2}) || ''}</div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* C GROUP Column */}
                <div className="flex-1">
                    <div className="bg-red-600 text-white p-2 text-center font-black text-xl uppercase tracking-widest border-b-2 border-black border-t-2 lg:border-t-0">
                        {displayDate} - C GROUP
                    </div>
                    <table className="w-full border-collapse">
                        <tbody>
                            {cData.map((row, idx) => (
                                <tr key={idx} className="h-14 border-b border-gray-400 last:border-0 hover:bg-gray-50 transition-colors">
                                    <td className="w-40 px-3 font-black text-gray-800 border-r border-gray-400 bg-gray-50/50 uppercase text-xs">
                                        <div className="flex flex-col">
                                            <span className="text-emerald-700 text-sm">{row.code}</span>
                                            {row.client ? (
                                                <Link to={`/clients/${row.client.id}`} className="text-[10px] text-gray-500 hover:text-blue-700 underline truncate font-bold decoration-dotted">
                                                    {row.client.name}
                                                </Link>
                                            ) : (
                                                <span className="text-[10px] text-gray-300 font-bold italic">N/A</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="border-r border-gray-400 w-28 p-0 h-14">
                                        {row.client && (
                                            <SpreadsheetInput 
                                                value={row.sale?.b || 0} 
                                                onChange={(v) => onUpdate(row.client!.id, dateStr, v, row.sale?.a || 0)}
                                                onBlur={() => {}}
                                                colorClass="text-blue-700"
                                            />
                                        )}
                                    </td>
                                    <td className="w-28 p-0 h-14">
                                        {row.client && (
                                            <SpreadsheetInput 
                                                value={row.sale?.a || 0} 
                                                onChange={(v) => onUpdate(row.client!.id, dateStr, row.sale?.b || 0, v)}
                                                onBlur={() => {}}
                                                colorClass="text-red-600"
                                            />
                                        )}
                                    </td>
                                </tr>
                            ))}
                            <tr className="bg-gray-100 h-24">
                                <td colSpan={3} className="p-4 border-t-2 border-black">
                                    <div className="flex flex-col items-center">
                                        <div className="flex border-2 border-black divide-x-2 divide-black w-56 mb-2 bg-white">
                                            <div className="flex-1 p-1 text-center font-mono font-black text-lg text-blue-700">{cTotals.wan || ''}</div>
                                            <div className="flex-1 p-1 text-center font-mono font-black text-lg text-red-600">{cTotals.qian || ''}</div>
                                        </div>
                                        <div className="border-2 border-black w-56 p-1 text-center font-mono font-black text-2xl bg-white">{cTotals.total.toLocaleString(undefined, {minimumFractionDigits: 2}) || ''}</div>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const SalesIndex: React.FC = () => {
  const navigate = useNavigate();
  const { currentDate, setCurrentDate } = useGlobalState();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'paper' | 'mobile'>('paper');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenMessage, setRegenMessage] = useState<string | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const weeksData = useMemo(() => getWeeksForMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  
  const selectedWeekNum = useMemo(() => {
      const todayStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;
      const foundWeek = Object.keys(weeksData).find(w => weeksData[parseInt(w)].some(d => {
          const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
          return dStr === todayStr;
      }));
      return foundWeek ? parseInt(foundWeek) : 1;
  }, [weeksData, currentDate]);

  const activeDays = weeksData[selectedWeekNum] || [];
  const drawDates = useMemo(() => activeDays.filter(d => [0, 2, 3, 6].includes(d.getDay())).map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`), [activeDays]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
        const loadedClients = await getClients();
        setClients(loadedClients);
        const records = await getSalesForDates(drawDates.length > 0 ? drawDates : [selectedDate]);
        setSalesData(records);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [drawDates]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

  const handlePaperUpdate = useCallback(async (clientId: string, date: string, b: number, a: number) => {
    // 1. Pessimistic Update for Stability: Write to DB first
    await saveSaleRecord({ clientId, date, b, a, s: 0, c: 0 });
    
    // 2. Sync local state for UI consistency
    setSalesData(prev => {
        const idx = prev.findIndex(s => s.clientId === clientId && s.date === date);
        if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], b, a };
            return updated;
        }
        return [...prev, { id: `temp-${clientId}-${date}`, clientId, date, b, a, s: 0, c: 0 }];
    });
  }, []);

  const earnings = useMemo(() => {
      let paper = 0;
      let mobile = 0;
      salesData.forEach(r => {
          const c = clients.find(cl => cl.id === r.clientId);
          if (!c) return;
          if (c.category === 'paper') {
              const rawTotal = (r.b || 0) + (r.s || 0) + (r.a || 0) + (r.c || 0);
              paper += Math.abs(rawTotal * 0.86 - rawTotal * 0.83);
          } else if (c.category === 'mobile' && r.mobileRawData) {
              const shareholderTotal = parseFloat(String(r.mobileRawData[11]).replace(/,/g, '')) || 0;
              mobile += Math.abs(shareholderTotal);
          }
      });
      return { paper, mobile, total: paper + mobile };
  }, [salesData, clients]);

  const handleRegenerateDianFromList = async () => {
      if (salesData.length === 0) return;
      setIsRegenerating(true); setRegenMessage(null);
      let updateCount = 0;
      const processedClientIds = new Set<string>();

      try {
          for (const record of salesData) {
              const mobileClient = clients.find(c => c.id === record.clientId);
              if (!mobileClient || !mobileClient.code) continue;
              const mappedPaperCode = MOBILE_TO_PAPER_MAP[mobileClient.code.toLowerCase()];
              if (mappedPaperCode) {
                  const paperClient = clients.find(c => c.code.toLowerCase() === mappedPaperCode.toLowerCase());
                  if (paperClient && !processedClientIds.has(paperClient.id)) {
                      const rawData = record.mobileRawData;
                      if (!rawData || rawData.length < 6) continue;
                      const companyAmount = parseFloat(String(rawData[5]).replace(/,/g, ''));
                      if (!isNaN(companyAmount) && companyAmount !== 0) {
                          processedClientIds.add(paperClient.id);
                          const records = await getLedgerRecords(paperClient.id);
                          const existingDianRecords = records.filter(r => r.date === record.date && r.typeLabel === '电' && r.column === 'main');
                          const operation = companyAmount >= 0 ? 'subtract' : 'add';
                          const amount = Math.abs(companyAmount);
                          if (existingDianRecords.length > 0) {
                              await updateLedgerRecord(existingDianRecords[0].id, { amount, operation });
                          } else { 
                              await saveLedgerRecord({ clientId: paperClient.id, date: record.date, description: '', typeLabel: '电', amount, operation, column: 'main', isVisible: true }); 
                          }
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
      const newDate = new Date(currentDate);
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() - 1);
      if (newDate.getFullYear() < 2025) return;
      setCurrentDate(newDate);
  };
  const handleNextMonth = () => {
      const newDate = new Date(currentDate);
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() + 1);
      if (newDate.getFullYear() > 2026) return;
      setCurrentDate(newDate);
  };

  const handleWeekSelect = (weekNum: number) => {
      const days = weeksData[weekNum];
      if (days && days.length > 0) setCurrentDate(new Date(days[0]));
  };

  const sortedWeekKeys = Object.keys(weeksData).map(Number).sort((a,b) => a-b);
  const getWeekRangeLabel = (weekNum: number) => {
      const days = weeksData[weekNum];
      if (!days || days.length === 0) return '';
      const formatDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()].slice(0,3)}`;
      return `${formatDate(days[0])} - ${formatDate(days[days.length - 1])}`;
  };

  const paperClients = useMemo(() => clients.filter(c => (c.category || 'paper') === 'paper'), [clients]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      <div className="bg-white border-b border-gray-200 z-20 shadow-sm flex-shrink-0">
          <div className="px-4 py-3 flex flex-col lg:flex-row justify-between items-center gap-4">
             <div className="flex items-center space-x-4 w-full lg:w-auto">
                 <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('paper')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'paper' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}><FileText size={16} className="mr-2 inline" />Paper</button>
                    <button onClick={() => setActiveTab('mobile')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'mobile' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}><Smartphone size={16} className="mr-2 inline" />Mobile</button>
                 </div>
                 
                 {/* PROFIT SUMMARY BAR - ALWAYS VISIBLE (SCROLLABLE ON MOBILE) */}
                 <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-shrink-0 w-full lg:w-auto pb-1 lg:pb-0">
                     <div className="flex items-center px-4 py-2 bg-blue-50 rounded-xl border border-blue-200 flex-shrink-0 min-w-[130px] lg:min-w-[150px]">
                        <Briefcase size={14} className="mr-2 text-blue-600" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-blue-800 uppercase leading-none mb-1">Paper Prof</span>
                            <span className="text-sm font-mono font-black text-blue-600 leading-none">${earnings.paper.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                    <div className="flex items-center px-4 py-2 bg-purple-50 rounded-xl border border-purple-200 flex-shrink-0 min-w-[130px] lg:min-w-[150px]">
                        <TrendingUp size={14} className="mr-2 text-purple-600" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-purple-800 uppercase leading-none mb-1">Mobile Prof</span>
                            <span className="text-sm font-mono font-black text-purple-600 leading-none">${earnings.mobile.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                    <div className="flex items-center px-4 py-2 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-100 flex-shrink-0 min-w-[130px] lg:min-w-[150px]">
                        <DollarSign size={14} className="mr-2 text-white" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-emerald-100 uppercase leading-none mb-1">Net Weekly</span>
                            <span className="text-sm font-mono font-black text-white leading-none">${earnings.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                 </div>
             </div>
             <div className="flex items-center space-x-3 w-full lg:w-auto">
                {activeTab === 'mobile' && (
                    <>
                        <div className="relative flex-1 lg:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input type="text" placeholder="Search mobile..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <button onClick={handleRegenerateDianFromList} disabled={isRegenerating} className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 shadow-sm"><Zap size={18} className={isRegenerating ? 'animate-pulse' : ''} /></button>
                        <button onClick={() => navigate('/sales/mobile-report')} className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm"><FileSpreadsheet size={18} /></button>
                    </>
                )}
            </div>
          </div>
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar bg-gray-50/50">
                <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 flex-shrink-0 shadow-sm">
                    <button onClick={handlePrevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronLeft size={18}/></button>
                    <span className="w-24 md:w-28 text-center font-bold text-gray-800 text-[11px] md:text-sm">{MONTH_NAMES[currentMonth].slice(0,3)} {currentYear}</span>
                    <button onClick={handleNextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronRight size={18}/></button>
                </div>
                <div className="flex space-x-1.5 md:space-x-2">
                    {sortedWeekKeys.map(wk => (
                        <button key={wk} onClick={() => handleWeekSelect(wk)} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex flex-col items-center justify-center min-w-[90px] md:min-w-[110px] border ${selectedWeekNum === wk ? 'bg-blue-600 text-white shadow border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}><span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider opacity-80">Week {Object.keys(weeksData).indexOf(String(wk)) + 1}</span><span className={`text-[10px] md:text-[11px] font-mono mt-0.5 ${selectedWeekNum === wk ? 'text-blue-100' : 'text-gray-400'}`}>{getWeekRangeLabel(wk)}</span></button>
                    ))}
                </div>
                <button onClick={loadData} className="ml-auto p-2 text-gray-400 hover:text-blue-600 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
          </div>
      </div>

      <div className="flex-1 overflow-auto bg-gray-200 p-4 md:p-8">
        {loading ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : activeTab === 'paper' ? (
            <div className="max-w-7xl mx-auto space-y-16">
                {/* 1. New Spreadsheet Board Layout */}
                <section>
                    <div className="mb-8 border-b border-gray-400 pb-2">
                        <h2 className="text-2xl font-black text-gray-800 uppercase tracking-widest flex items-center">
                            <FileText size={24} className="mr-3 text-blue-600" />
                            Weekly Opening Board
                        </h2>
                    </div>
                    {drawDates.map(date => (
                        <DailySpreadsheetTable 
                            key={date} 
                            dateStr={date} 
                            clients={clients} 
                            sales={salesData} 
                            onUpdate={handlePaperUpdate} 
                        />
                    ))}
                    {drawDates.length === 0 && (
                        <div className="p-12 text-center text-gray-400 font-bold bg-white rounded-2xl border-2 border-dashed border-gray-300">
                            No draw dates found for this week.
                        </div>
                    )}
                </section>

                {/* 2. December Style Grid Layout */}
                <section className="pb-20">
                    <div className="mb-6 border-b border-gray-400 pb-2">
                        <h2 className="text-lg font-black text-gray-400 uppercase tracking-widest flex items-center">
                            <LayoutTemplate size={20} className="mr-2" />
                            Paper Client Registry
                        </h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {paperClients.map(client => (
                            <Link 
                                key={client.id}
                                to={`/clients/${client.id}/sales`}
                                className="bg-white border-2 border-black p-5 flex flex-col items-center justify-center text-center shadow-sm hover:bg-gray-50 transition-all group"
                            >
                                <div className="font-black text-gray-900 text-xl mb-1 uppercase">{client.name}</div>
                                <div className="px-3 py-1 bg-gray-200 text-[11px] font-black text-gray-600 uppercase tracking-widest border border-gray-400">
                                    {client.code}
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                        <thead className="bg-gray-100 font-bold text-gray-700">
                            <tr className="bg-gray-200 border-b border-gray-300">
                                <th className="px-2 py-1 sticky left-0 bg-gray-200 z-10 border-r border-gray-300"></th>
                                <th className="px-2 py-1 text-center border-r border-gray-300">Member</th>
                                <th colSpan={5} className="px-2 py-1 text-center border-r border-gray-300 bg-blue-50 text-blue-800">Company</th>
                                <th colSpan={6} className="px-2 py-1 text-center border-r border-gray-300 bg-indigo-50 text-indigo-800">Shareholder</th>
                                <th colSpan={5} className="px-2 py-1 text-center bg-green-50 text-green-800">Agent</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {clients.filter(c => c.category === 'mobile').filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.toLowerCase().includes(searchTerm.toLowerCase())).map(client => {
                                const clientRecords = salesData.filter(r => r.clientId === client.id);
                                const record = clientRecords[clientRecords.length - 1]; 
                                const raw = record?.mobileRawData || [];
                                return (
                                    <tr key={client.id} className="hover:bg-purple-50 transition-colors border-b border-gray-100 font-mono text-[11px]">
                                        <td className="px-2 py-3 text-left bg-white sticky left-0 z-10 border-r border-gray-200 shadow-sm">
                                            <div className="font-bold text-gray-900">{client.name}</div>
                                            <div className="text-[9px] text-gray-500">{client.code}</div>
                                        </td>
                                        {[...Array(17)].map((_, i) => (
                                            <td key={i} className={`px-2 py-3 text-right ${[5, 11, 16].includes(i) ? 'bg-gray-50 font-black border-x border-gray-200' : ''}`}>
                                                {raw[i] || '-'}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default SalesIndex;
