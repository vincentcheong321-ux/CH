
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Loader2, Smartphone, FileText, RefreshCw, FileSpreadsheet, Zap, DollarSign, Briefcase, TrendingUp, LayoutTemplate } from 'lucide-react';
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

    useEffect(() => {
        setLocal(value === 0 ? '' : value.toString());
        setIsSaving(false);
    }, [value]);

    const handleConfirm = async () => {
        const num = parseFloat(local) || 0;
        if (num !== value) {
            setIsSaving(true);
            await onChange(num);
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

// Mini Opening Table Component for the Registry
const MonthlyOpeningTable: React.FC<{ 
    client: Client, 
    year: number, 
    month: number,
    sales: SaleRecord[],
    onUpdate: (clientId: string, date: string, b: number, a: number) => Promise<void>
}> = ({ client, year, month, sales, onUpdate }) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const drawDays = useMemo(() => {
        const days = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            if ([0, 2, 3, 6].includes(date.getDay())) {
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const display = `${String(d).padStart(2,'0')}-${MONTH_NAMES[month].slice(0,3)}`;
                const record = sales.find(s => s.clientId === client.id && s.date === dateStr);
                days.push({ dateStr, display, record });
            }
        }
        return days;
    }, [year, month, sales, client.id, daysInMonth]);

    const totals = useMemo(() => {
        let b = 0, s = 0, a = 0, c = 0;
        drawDays.forEach(d => {
            b += d.record?.b || 0;
            s += d.record?.s || 0;
            a += d.record?.a || 0;
            c += d.record?.c || 0;
        });
        return { b, s, a, c, bs: b + s, ac: a + c, grand: b + s + a + c };
    }, [drawDays]);

    if (drawDays.length === 0) return null;

    return (
        <div className="bg-white border-2 border-black mb-12 shadow-md w-full max-w-2xl overflow-x-auto no-scrollbar">
            <table className="w-full border-collapse text-sm min-w-[500px]">
                <thead>
                    <tr className="bg-gray-100 h-10">
                        <th className="border border-black w-24 text-left pl-3 relative">
                            <Link to={`/clients/${client.id}/sales`} className="text-blue-600 hover:underline font-black text-xs uppercase">{client.name}</Link>
                            <span className="absolute top-1 right-1 text-[8px] font-mono text-gray-400">{client.code}</span>
                        </th>
                        <th colSpan={2} className="border border-black font-serif italic text-lg relative">万</th>
                        <th colSpan={2} className="border border-black font-serif italic text-lg">千</th>
                    </tr>
                    <tr className="bg-gray-50 h-8 text-[10px] font-bold text-gray-500">
                        <th className="border border-black uppercase tracking-widest">Date</th>
                        <th className="border border-black">B</th>
                        <th className="border-r-2 border-t border-b border-black border-r-black">S</th>
                        <th className="border border-black">A</th>
                        <th className="border border-black">C</th>
                    </tr>
                </thead>
                <tbody>
                    {drawDays.map(day => (
                        <tr key={day.dateStr} className="h-10 hover:bg-gray-50">
                            <td className="border border-black text-center font-mono text-[11px] text-gray-400">{day.display}</td>
                            <td className="border border-black p-0">
                                <SpreadsheetInput 
                                    value={day.record?.b || 0} 
                                    onChange={(v) => onUpdate(client.id, day.dateStr, v, day.record?.a || 0)} 
                                    onBlur={() => {}} 
                                    colorClass="text-blue-700" 
                                />
                            </td>
                            <td className="border-r-2 border-t border-b border-black border-r-black p-0">
                                <div className="w-full h-full flex items-center justify-center font-mono font-black text-gray-300 text-lg">0</div>
                            </td>
                            <td className="border border-black p-0">
                                <SpreadsheetInput 
                                    value={day.record?.a || 0} 
                                    onChange={(v) => onUpdate(client.id, day.dateStr, day.record?.b || 0, v)} 
                                    onBlur={() => {}} 
                                    colorClass="text-red-600" 
                                />
                            </td>
                            <td className="border border-black p-0">
                                <div className="w-full h-full flex items-center justify-center font-mono font-black text-gray-300 text-lg">0</div>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-gray-50 font-mono font-black">
                    <tr className="h-10">
                        <td className="border-none text-right pr-2 text-[10px] text-gray-400">TOTAL</td>
                        <td className="text-center">{totals.b || ''}</td>
                        <td className="text-center border-r-2 border-black border-r-black">{totals.s || ''}</td>
                        <td className="text-center">{totals.a || ''}</td>
                        <td className="text-center">{totals.c || ''}</td>
                    </tr>
                    <tr className="h-12 text-xl">
                        <td className="border-none"></td>
                        <td colSpan={2} className="text-center border-r-2 border-black border-r-black text-blue-700">{totals.bs || ''}</td>
                        <td colSpan={2} className="text-center text-red-600">{totals.ac || ''}</td>
                    </tr>
                    <tr className="h-16 border-t-2 border-black bg-white">
                        <td colSpan={5} className="text-center text-3xl text-gray-900">{totals.grand.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

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
            <div className="flex flex-col lg:flex-row">
                {/* Z GROUP */}
                <div className="flex-1 lg:border-r-2 lg:border-black">
                    <div className="bg-blue-600 text-white p-3 text-center font-black text-xl uppercase tracking-widest border-b-2 border-black">
                        {displayDate} - Z GROUP
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full border-collapse min-w-[320px]">
                            <tbody>
                                {zData.map((row, idx) => (
                                    <tr key={idx} className="h-14 border-b border-gray-400 last:border-0 hover:bg-gray-50 transition-colors">
                                        <td className="w-32 md:w-40 px-3 font-black text-gray-800 border-r border-gray-400 bg-gray-50/50 uppercase text-xs">
                                            <div className="flex flex-col">
                                                <span className="text-blue-700 text-sm">{row.code}</span>
                                                {row.client ? (
                                                    <Link to={`/clients/${row.client.id}`} className="text-[10px] text-gray-500 hover:text-blue-700 underline truncate font-bold">
                                                        {row.client.name}
                                                    </Link>
                                                ) : <span className="text-[10px] text-gray-300 font-bold italic">N/A</span>}
                                            </div>
                                        </td>
                                        <td className="border-r border-gray-400 w-24 md:w-28 p-0 h-14">
                                            {row.client && (
                                                <SpreadsheetInput 
                                                    value={row.sale?.b || 0} 
                                                    onChange={(v) => onUpdate(row.client!.id, dateStr, v, row.sale?.a || 0)}
                                                    onBlur={() => {}}
                                                    colorClass="text-blue-700"
                                                />
                                            )}
                                        </td>
                                        <td className="w-24 md:w-28 p-0 h-14">
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
                                            <div className="flex border-2 border-black divide-x-2 divide-black w-full max-w-[240px] mb-2 bg-white">
                                                <div className="flex-1 p-1 text-center font-mono font-black text-lg text-blue-700">{zTotals.wan || ''}</div>
                                                <div className="flex-1 p-1 text-center font-mono font-black text-lg text-red-600">{zTotals.qian || ''}</div>
                                            </div>
                                            <div className="border-2 border-black w-full max-w-[240px] p-1 text-center font-mono font-black text-2xl bg-white">{zTotals.total.toLocaleString(undefined, {minimumFractionDigits: 2}) || ''}</div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* C GROUP */}
                <div className="flex-1">
                    <div className="bg-red-600 text-white p-3 text-center font-black text-xl uppercase tracking-widest border-b-2 border-black border-t-2 lg:border-t-0">
                        {displayDate} - C GROUP
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full border-collapse min-w-[320px]">
                            <tbody>
                                {cData.map((row, idx) => (
                                    <tr key={idx} className="h-14 border-b border-gray-400 last:border-0 hover:bg-gray-50 transition-colors">
                                        <td className="w-32 md:w-40 px-3 font-black text-gray-800 border-r border-gray-400 bg-gray-50/50 uppercase text-xs">
                                            <div className="flex flex-col">
                                                <span className="text-emerald-700 text-sm">{row.code}</span>
                                                {row.client ? (
                                                    <Link to={`/clients/${row.client.id}`} className="text-[10px] text-gray-500 hover:text-blue-700 underline truncate font-bold">
                                                        {row.client.name}
                                                    </Link>
                                                ) : <span className="text-[10px] text-gray-300 font-bold italic">N/A</span>}
                                            </div>
                                        </td>
                                        <td className="border-r border-gray-400 w-24 md:w-28 p-0 h-14">
                                            {row.client && (
                                                <SpreadsheetInput 
                                                    value={row.sale?.b || 0} 
                                                    onChange={(v) => onUpdate(row.client!.id, dateStr, v, row.sale?.a || 0)}
                                                    onBlur={() => {}}
                                                    colorClass="text-blue-700"
                                                />
                                            )}
                                        </td>
                                        <td className="w-24 md:w-28 p-0 h-14">
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
                                            <div className="flex border-2 border-black divide-x-2 divide-black w-full max-w-[240px] mb-2 bg-white">
                                                <div className="flex-1 p-1 text-center font-mono font-black text-lg text-blue-700">{cTotals.wan || ''}</div>
                                                <div className="flex-1 p-1 text-center font-mono font-black text-lg text-red-600">{cTotals.qian || ''}</div>
                                            </div>
                                            <div className="border-2 border-black w-full max-w-[240px] p-1 text-center font-mono font-black text-2xl bg-white">{cTotals.total.toLocaleString(undefined, {minimumFractionDigits: 2}) || ''}</div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
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
        // Load sales for the entire month to populate registry tables
        const startOfMonth = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-01`;
        const endOfMonth = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-31`;
        // Optimization: just load dates we need
        const records = await getSalesForDates([startOfMonth, endOfMonth, ...drawDates]);
        setSalesData(records);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [drawDates, currentYear, currentMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePaperUpdate = useCallback(async (clientId: string, date: string, b: number, a: number) => {
    await saveSaleRecord({ clientId, date, b, a, s: 0, c: 0 });
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
  const paperClients = useMemo(() => clients.filter(c => (c.category || 'paper') === 'paper' && (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.toLowerCase().includes(searchTerm.toLowerCase()))), [clients, searchTerm]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      <div className="bg-white border-b border-gray-200 z-20 shadow-sm flex-shrink-0">
          <div className="px-4 py-3 flex flex-col lg:flex-row justify-between items-center gap-4">
             <div className="flex items-center space-x-4 w-full lg:w-auto">
                 <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('paper')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'paper' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}><FileText size={16} className="mr-2 inline" />Paper</button>
                    <button onClick={() => setActiveTab('mobile')} className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'mobile' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}><Smartphone size={16} className="mr-2 inline" />Mobile</button>
                 </div>
                 
                 <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-shrink-0 w-full lg:w-auto pb-1 lg:pb-0">
                     <div className="flex items-center px-4 py-2 bg-blue-50 rounded-xl border border-blue-200 flex-shrink-0 min-w-[130px]">
                        <Briefcase size={14} className="mr-2 text-blue-600" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-blue-800 uppercase leading-none mb-1">Paper Prof</span>
                            <span className="text-sm font-mono font-black text-blue-600 leading-none">${earnings.paper.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                    <div className="flex items-center px-4 py-2 bg-purple-50 rounded-xl border border-purple-200 flex-shrink-0 min-w-[130px]">
                        <TrendingUp size={14} className="mr-2 text-purple-600" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-purple-800 uppercase leading-none mb-1">Mobile Prof</span>
                            <span className="text-sm font-mono font-black text-purple-600 leading-none">${earnings.mobile.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                    <div className="flex items-center px-4 py-2 bg-emerald-600 rounded-xl shadow-lg shadow-emerald-100 flex-shrink-0 min-w-[130px]">
                        <DollarSign size={14} className="mr-2 text-white" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-emerald-100 uppercase leading-none mb-1">Net Weekly</span>
                            <span className="text-sm font-mono font-black text-white leading-none">${earnings.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    </div>
                 </div>
             </div>
             <div className="flex items-center space-x-3 w-full lg:w-auto">
                <div className="relative flex-1 lg:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" placeholder="Search..." className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>
          </div>
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar bg-gray-50/50">
                <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 flex-shrink-0 shadow-sm">
                    <button onClick={handlePrevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronLeft size={18}/></button>
                    <span className="w-24 md:w-28 text-center font-bold text-gray-800 text-[11px] md:text-sm uppercase">{MONTH_NAMES[currentMonth].slice(0,3)} {currentYear}</span>
                    <button onClick={handleNextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronRight size={18}/></button>
                </div>
                <div className="flex space-x-1.5 md:space-x-2">
                    {sortedWeekKeys.map(wk => (
                        <button key={wk} onClick={() => handleWeekSelect(wk)} className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap flex flex-col items-center justify-center min-w-[90px] md:min-w-[110px] border ${selectedWeekNum === wk ? 'bg-blue-600 text-white shadow border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}><span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider opacity-80">Week {Object.keys(weeksData).indexOf(String(wk)) + 1}</span></button>
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
                <section>
                    <div className="mb-8 border-b border-gray-400 pb-2 flex justify-between items-end">
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
                </section>

                <section className="pb-20">
                    <div className="mb-6 border-b border-gray-400 pb-2">
                        <h2 className="text-lg font-black text-gray-400 uppercase tracking-widest flex items-center">
                            <LayoutTemplate size={20} className="mr-2" />
                            Paper Client Registry ({MONTH_NAMES[currentMonth]})
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {paperClients.map(client => (
                            <MonthlyOpeningTable 
                                key={client.id}
                                client={client}
                                year={currentYear}
                                month={currentMonth}
                                sales={salesData}
                                onUpdate={handlePaperUpdate}
                            />
                        ))}
                    </div>
                </section>
            </div>
        ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[1200px]">
                        <thead className="bg-gray-100 font-bold text-gray-700">
                            <tr className="bg-gray-200 border-b border-gray-300">
                                <th className="px-2 py-1 sticky left-0 bg-gray-200 z-10 border-r border-gray-300"></th>
                                <th className="px-2 py-1 text-center border-r border-gray-300">Member</th>
                                <th colSpan={5} className="px-2 py-1 text-center border-r border-gray-300 bg-blue-50 text-blue-800 uppercase">Company</th>
                                <th colSpan={6} className="px-2 py-1 text-center border-r border-gray-300 bg-indigo-50 text-indigo-800 uppercase">Shareholder</th>
                                <th colSpan={5} className="px-2 py-1 text-center bg-green-50 text-green-800 uppercase">Agent</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {clients.filter(c => c.category === 'mobile' && (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.code.toLowerCase().includes(searchTerm.toLowerCase()))).map(client => {
                                const clientRecords = salesData.filter(r => r.clientId === client.id);
                                const record = clientRecords[clientRecords.length - 1]; 
                                const raw = record?.mobileRawData || [];
                                return (
                                    <tr key={client.id} className="hover:bg-purple-50 transition-colors border-b border-gray-100 font-mono text-[11px]">
                                        <td className="px-2 py-3 text-left bg-white sticky left-0 z-10 border-r border-gray-200 shadow-sm font-bold">
                                            {client.name}
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
