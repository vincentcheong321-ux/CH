
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Loader2, Calendar, Smartphone, FileText, DollarSign, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { getClients, getSalesForDates, saveSaleRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';
import { MONTH_NAMES, getWeeksForMonth } from '../utils/reportUtils';

// Specific Display Codes
const PAPER_Z_CODES = ['Z03', 'Z05', 'Z07', 'Z15', 'Z19', 'Z20'];
const PAPER_C_CODES = ['C03', 'C04', 'C06', 'C09', 'C13', 'C15', 'C17'];

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
    // Format: "10" or "10/5"
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

// --- Mobile Table Row Component ---
const MobileTableRow = React.memo(({ 
    client, 
    record,
    total 
}: { 
    client: Client, 
    record?: SaleRecord,
    total: number 
}) => {
    // Determine detailed values (Use Raw if available, otherwise 0/empty)
    const memBet = record?.mobileRaw?.memberBet || '-';
    const compTotal = record?.mobileRaw?.companyTotal || '-';
    const shareTotal = record?.mobileRaw?.shareholderTotal || '-';
    // Use the calculated 'total' for the Net column which maps to Agent Total usually
    const agentTotal = total !== 0 ? total.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-';

    return (
        <tr className="hover:bg-purple-50/50 transition-colors border-b border-gray-100 last:border-0">
            <td className="px-4 py-3">
                <div className="font-bold text-gray-900">{client.name}</div>
                <div className="text-xs text-gray-500 font-mono">{client.code}</div>
            </td>
            <td className="px-2 py-3 text-right text-gray-600 font-mono text-xs">{memBet}</td>
            <td className="px-2 py-3 text-right text-blue-600 font-mono text-xs font-bold">{compTotal}</td>
            <td className="px-2 py-3 text-right text-blue-600 font-mono text-xs font-bold">{shareTotal}</td>
            <td className={`px-4 py-3 text-right font-mono font-bold ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {agentTotal}
            </td>
        </tr>
    );
});

// --- Client Card Component (Paper View) ---
const ClientWeeklyCard = React.memo(({ 
    client, 
    dateStrings, 
    salesData, 
    onUpdate 
}: { 
    client: Client, 
    dateStrings: string[], 
    salesData: SaleRecord[], 
    onUpdate: (clientId: string, dateStr: string, field1: 'b'|'a', val1: number, field2: 's'|'c', val2: number) => void 
}) => {
    
    // Calculate Client Totals for the Week
    const clientRecords = salesData.filter(r => r.clientId === client.id);
    const totalWeek = clientRecords.reduce((acc, r) => acc + (r.b||0) + (r.s||0) + (r.a||0) + (r.c||0), 0);

    const formatMonth = (mIndex: number) => {
        const name = MONTH_NAMES[mIndex] || "";
        return name.charAt(0) + name.slice(1, 3).toLowerCase();
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
            {/* Card Header */}
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <Link to={`/clients/${client.id}/sales`} className="flex items-center space-x-2 hover:text-blue-600 transition-colors group">
                    <div>
                        <div className="font-bold text-gray-800 group-hover:text-blue-600 leading-tight">{client.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{client.code}</div>
                    </div>
                </Link>
                <div className="text-right">
                    <div className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Week Total</div>
                    <span className={`font-mono font-bold text-sm ${totalWeek > 0 ? 'text-blue-600' : 'text-gray-900'}`}>
                        {totalWeek > 0 ? totalWeek.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
                    </span>
                </div>
            </div>

            {/* Matrix Table */}
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
                        {dateStrings.map(dateStr => {
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
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'paper' | 'mobile'>('paper');

  // Initial Load: Set to "Today"
  useEffect(() => {
      const now = new Date();
      let y = now.getFullYear();
      let m = now.getMonth();
      const d = now.getDate();

      if (y < 2025) y = 2025;
      if (y > 2026) y = 2026;

      setCurrentYear(y);
      setCurrentMonth(m);

      const weeks = getWeeksForMonth(y, m);
      const foundWeek = Object.keys(weeks).find(wKey => {
          const days = weeks[parseInt(wKey)];
          return days.includes(d);
      });

      if (foundWeek) {
          setSelectedWeekNum(parseInt(foundWeek));
      } else {
          setSelectedWeekNum(parseInt(Object.keys(weeks)[0] || '1'));
      }
  }, []);

  const weeksData = useMemo(() => getWeeksForMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  const activeDays = weeksData[selectedWeekNum] || [];
  
  // Strict Filtering for 4 days: Tue(2), Wed(3), Sat(6), Sun(0)
  const activeDateStrings = useMemo(() => 
      activeDays
        .filter(d => {
            const dateObj = new Date(currentYear, currentMonth, d);
            const day = dateObj.getDay();
            // FILTER: Only Tuesday, Wednesday, Saturday, Sunday
            return [0, 2, 3, 6].includes(day);
        })
        .map(d => {
            const dateObj = new Date(currentYear, currentMonth, d);
            const y = dateObj.getFullYear();
            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }),
  [activeDays, currentYear, currentMonth]);

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
    } catch (e) {
        console.error("Failed to load data", e);
    } finally {
        setLoading(false);
    }
  }, [activeDateStrings]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle updates for Paper Clients (Detailed B/S/A/C)
  const handleUpdate = useCallback(async (
      clientId: string, 
      dateStr: string, 
      f1: 'b'|'a', v1: number, 
      f2: 's'|'c', v2: number
    ) => {
      
      setSalesData(prev => {
          const idx = prev.findIndex(r => r.clientId === clientId && r.date === dateStr);
          if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], [f1]: v1, [f2]: v2 };
              return updated;
          } else {
              return [...prev, { 
                  id: 'temp', clientId, date: dateStr, 
                  b: f1 === 'b' ? v1 : 0, 
                  s: f2 === 's' ? v2 : 0, 
                  a: f1 === 'a' ? v1 : 0, 
                  c: f2 === 'c' ? v2 : 0 
              }];
          }
      });

      const existing = salesData.find(r => r.clientId === clientId && r.date === dateStr);
      const payload = existing 
        ? { ...existing, [f1]: v1, [f2]: v2 } 
        : { 
            clientId, date: dateStr, 
            b:0, s:0, a:0, c:0, 
            [f1]: v1, [f2]: v2 
        };
      
      const { id, ...savePayload } = payload; 
      await saveSaleRecord(savePayload);

  }, [salesData]);

  const handlePrevMonth = () => {
      if (currentMonth === 0) {
          if (currentYear > 2025) {
              setCurrentYear(y => y - 1);
              setCurrentMonth(11);
          }
      } else {
          setCurrentMonth(m => m - 1);
      }
  };

  const handleNextMonth = () => {
      if (currentMonth === 11) {
          if (currentYear < 2026) {
              setCurrentYear(y => y + 1);
              setCurrentMonth(0);
          }
      } else {
          setCurrentMonth(m => m + 1);
      }
  };

  // Base Data Grouping
  const paperClients = useMemo(() => clients.filter(c => (c.category || 'paper') === 'paper'), [clients]);
  const mobileClients = useMemo(() => clients.filter(c => c.category === 'mobile'), [clients]);

  // Split Logic for Side-by-Side View
  const { zClients, cClients } = useMemo(() => {
      const zList = paperClients.filter(c => PAPER_Z_CODES.includes(c.code.toUpperCase()));
      const cList = paperClients.filter(c => PAPER_C_CODES.includes(c.code.toUpperCase()));
      
      zList.sort((a,b) => PAPER_Z_CODES.indexOf(a.code.toUpperCase()) - PAPER_Z_CODES.indexOf(b.code.toUpperCase()));
      cList.sort((a,b) => PAPER_C_CODES.indexOf(a.code.toUpperCase()) - PAPER_C_CODES.indexOf(b.code.toUpperCase()));

      return { zClients: zList, cClients: cList };
  }, [paperClients]);

  // Mobile Filtered list
  const filteredMobileClients = mobileClients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPaper = [...zClients, ...cClients].reduce((acc, client) => {
      const clientRecs = salesData.filter(r => r.clientId === client.id);
      return acc + clientRecs.reduce((sum, r) => sum + (r.b||0) + (r.s||0) + (r.a||0) + (r.c||0), 0);
  }, 0);

  const totalMobile = mobileClients.reduce((acc, client) => {
      const clientRecs = salesData.filter(r => r.clientId === client.id);
      return acc + clientRecs.reduce((sum, r) => sum + (r.b||0) + (r.s||0) + (r.a||0) + (r.c||0), 0);
  }, 0);

  const sortedWeekKeys = Object.keys(weeksData).map(Number).sort((a,b) => a-b);
  
  useEffect(() => {
     if (sortedWeekKeys.length > 0 && !sortedWeekKeys.includes(selectedWeekNum)) {
         setSelectedWeekNum(sortedWeekKeys[0]);
     }
  }, [sortedWeekKeys, selectedWeekNum]);

  // Helper to get formatted week date range
  const getWeekRangeLabel = (weekNum: number) => {
      const days = weeksData[weekNum];
      if (!days || days.length === 0) return '';
      
      const firstDay = new Date(currentYear, currentMonth, days[0]);
      const lastDay = new Date(currentYear, currentMonth, days[days.length - 1]);
      
      const formatDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()].slice(0,3)}`;
      return `${formatDate(firstDay)} - ${formatDate(lastDay)}`;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Top Bar with Navigation and Tabs */}
      <div className="bg-white border-b border-gray-200 z-20 shadow-sm flex-shrink-0">
          
          {/* Row 1: Search and Tab Switcher */}
          <div className="px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-3">
             <div className="flex items-center space-x-4">
                 <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('paper')}
                        className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'paper' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        <FileText size={16} className="mr-2" />
                        Paper List
                    </button>
                    <button 
                        onClick={() => setActiveTab('mobile')}
                        className={`flex items-center px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'mobile' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        <Smartphone size={16} className="mr-2" />
                        Mobile List
                    </button>
                 </div>
                 
                 {/* Distinct Total Displays based on Tab */}
                 <div className="hidden lg:flex items-center space-x-6 ml-6 pl-6 border-l border-gray-200">
                    <div className={`transition-opacity duration-300 ${activeTab === 'paper' ? 'opacity-100' : 'opacity-40'}`}>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Paper Week Total</p>
                        <p className="font-mono font-bold text-gray-800 text-lg">${totalPaper.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    </div>
                    <div className={`transition-opacity duration-300 ${activeTab === 'mobile' ? 'opacity-100' : 'opacity-40'}`}>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Mobile Week Total</p>
                        <p className="font-mono font-bold text-purple-600 text-lg">${totalMobile.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    </div>
                 </div>
             </div>

             <div className="flex items-center space-x-4">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                    type="text" 
                    placeholder={`Search ${activeTab} clients...`}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {activeTab === 'mobile' && (
                    <button
                        onClick={() => navigate('/sales/mobile-report')}
                        className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm text-sm font-bold whitespace-nowrap"
                        title="Import/View External Report"
                    >
                        <FileSpreadsheet size={16} className="mr-2" />
                        Report
                    </button>
                )}
            </div>
          </div>

          {/* Row 2: Date Navigation */}
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 overflow-x-auto">
                <div className="flex items-center bg-gray-100 rounded-lg p-1 flex-shrink-0">
                    <button onClick={handlePrevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30"><ChevronLeft size={18}/></button>
                    <span className="w-28 text-center font-bold text-gray-800 text-xs md:text-sm">{MONTH_NAMES[currentMonth]} {currentYear}</span>
                    <button onClick={handleNextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30"><ChevronRight size={18}/></button>
                </div>

                <div className="flex space-x-2">
                    {sortedWeekKeys.map(wk => (
                        <button
                            key={wk}
                            onClick={() => setSelectedWeekNum(wk)}
                            className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap flex flex-col items-center justify-center min-w-[100px] border
                                ${selectedWeekNum === wk 
                                    ? 'bg-blue-600 text-white shadow border-blue-600' 
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}
                            `}
                        >
                            <span className="text-xs font-bold uppercase tracking-wider">Week {Object.keys(weeksData).indexOf(String(wk)) + 1}</span>
                            <span className={`text-[10px] mt-0.5 ${selectedWeekNum === wk ? 'text-blue-100' : 'text-gray-400'}`}>
                                {getWeekRangeLabel(wk)}
                            </span>
                        </button>
                    ))}
                </div>
                
                {/* Refresh Button */}
                <button onClick={loadData} className="ml-auto p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-full" title="Refresh Data">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {loading ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
            <div className="max-w-[1600px] mx-auto pb-20">
                
                {activeTab === 'paper' ? (
                    // Paper View: Split Layout
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Z Series Column */}
                        <div className="flex-1 bg-white/50 p-4 rounded-xl border border-dashed border-gray-300">
                            <h2 className="text-lg font-bold text-gray-700 mb-4 px-2 border-b border-gray-200 pb-2">Z Series</h2>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {zClients.map(client => (
                                    <ClientWeeklyCard 
                                        key={client.id}
                                        client={client}
                                        dateStrings={activeDateStrings}
                                        salesData={salesData}
                                        onUpdate={handleUpdate}
                                    />
                                ))}
                                {zClients.length === 0 && <p className="text-gray-400 text-sm col-span-full text-center py-4">No Z-series clients found.</p>}
                            </div>
                        </div>

                        {/* C Series Column */}
                        <div className="flex-1 bg-white/50 p-4 rounded-xl border border-dashed border-gray-300">
                            <h2 className="text-lg font-bold text-gray-700 mb-4 px-2 border-b border-gray-200 pb-2">C Series</h2>
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {cClients.map(client => (
                                    <ClientWeeklyCard 
                                        key={client.id}
                                        client={client}
                                        dateStrings={activeDateStrings}
                                        salesData={salesData}
                                        onUpdate={handleUpdate}
                                    />
                                ))}
                                {cClients.length === 0 && <p className="text-gray-400 text-sm col-span-full text-center py-4">No C-series clients found.</p>}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Mobile View: Detailed Table
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                                    <tr>
                                        <th className="px-4 py-3">Client</th>
                                        <th className="px-2 py-3 text-right">Member Bet</th>
                                        <th className="px-2 py-3 text-right">Company Total</th>
                                        <th className="px-2 py-3 text-right">Shareholder Total</th>
                                        <th className="px-4 py-3 text-right">Agent (Net) Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {filteredMobileClients.map(client => {
                                        const clientRecords = salesData.filter(r => r.clientId === client.id);
                                        // Usually only one record per week for mobile, but if multiple, we take the latest or sum if logic dictates. 
                                        // Assuming one main record per week for mobile report import.
                                        // If there are multiple, 'total' sums them, but detailed columns need a single source of truth or careful summing.
                                        // For now, let's take the LAST record of the week which likely holds the report data.
                                        const record = clientRecords[clientRecords.length - 1]; 
                                        
                                        const total = clientRecords.reduce((acc, r) => acc + (r.b||0) + (r.s||0) + (r.a||0) + (r.c||0), 0);
                                        
                                        return (
                                            <MobileTableRow
                                                key={client.id}
                                                client={client}
                                                record={record}
                                                total={total}
                                            />
                                        );
                                    })}
                                    {filteredMobileClients.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="text-center py-8 text-gray-400">No mobile clients found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Sticky Mobile Footer Total (Visible only on Mobile Tab) */}
      {activeTab === 'mobile' && (
        <div className="bg-purple-900 text-white p-4 sticky bottom-0 z-30 shadow-lg flex justify-between items-center lg:hidden">
            <div>
                <p className="text-xs text-purple-300 font-bold uppercase tracking-wider">Mobile Week Total</p>
                <p className="text-xs text-purple-400 opacity-75">{MONTH_NAMES[currentMonth]} W{Object.keys(weeksData).indexOf(String(selectedWeekNum)) + 1}</p>
            </div>
            <p className="font-mono font-bold text-2xl">${totalMobile.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
        </div>
      )}
    </div>
  );
};

export default SalesIndex;
