
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Loader2, Calendar } from 'lucide-react';
import { getClients, getSalesForDates, saveSaleRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';
import { MONTH_NAMES, YEAR, getWeeksForMonth } from '../utils/reportUtils';

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
        // Parse "10/5" or "10"
        // Allow "." for decimal values
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
            v2 = 0; // Default to first value only if no separator
        }

        if (v1 !== val1 || v2 !== val2) {
            onChange(v1, v2);
        }
        // Re-format on blur to clean up input
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

// --- Client Card Component ---
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
        // Convert "JANUARY" -> "Jan"
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

            {/* Matrix Table: Transposed (Date x Type) */}
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
                            // m is 1-based from string split
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
                        {dateStrings.length === 0 && (
                            <tr><td colSpan={3} className="py-6 text-center text-gray-400 italic text-xs">No dates in this week</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
});


const SalesIndex: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(0);
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);
  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
      const now = new Date();
      setCurrentMonth(now.getMonth());
  }, []);

  const weeksData = useMemo(() => getWeeksForMonth(currentMonth), [currentMonth]);
  const activeDays = weeksData[selectedWeekNum] || [];
  
  // Convert day numbers (potentially > days in month) to valid YYYY-MM-DD strings
  const activeDateStrings = useMemo(() => 
      activeDays.map(d => {
        const dateObj = new Date(YEAR, currentMonth, d);
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }),
  [activeDays, currentMonth]);

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

  const handleUpdate = useCallback(async (
      clientId: string, 
      dateStr: string, 
      f1: 'b'|'a', v1: number, 
      f2: 's'|'c', v2: number
    ) => {
      
      // Optimistic Update
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

      // DB Save
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

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedWeekKeys = Object.keys(weeksData).map(Number).sort((a,b) => a-b);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex flex-col md:flex-row justify-between items-center gap-3 flex-shrink-0 z-20 shadow-sm">
        <div className="flex items-center space-x-4 overflow-x-auto w-full md:w-auto">
            <div className="flex items-center bg-gray-100 rounded-lg p-1 flex-shrink-0">
                <button onClick={() => setCurrentMonth(m => Math.max(0, m-1))} disabled={currentMonth===0} className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30"><ChevronLeft size={18}/></button>
                <span className="w-28 text-center font-bold text-gray-800 text-sm">{MONTH_NAMES[currentMonth]} {YEAR}</span>
                <button onClick={() => setCurrentMonth(m => Math.min(11, m+1))} disabled={currentMonth===11} className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30"><ChevronRight size={18}/></button>
            </div>

            <div className="flex space-x-1">
                {sortedWeekKeys.map(wk => (
                    <button
                        key={wk}
                        onClick={() => setSelectedWeekNum(wk)}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap
                            ${selectedWeekNum === wk ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}
                        `}
                    >
                        Week {Object.keys(weeksData).indexOf(String(wk)) + 1}
                    </button>
                ))}
            </div>
        </div>

        <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search clients..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {loading ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
            <div className="max-w-7xl mx-auto pb-20">
                {/* Grid Layout for Side-by-Side Viewing */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredClients.map(client => (
                        <ClientWeeklyCard 
                            key={client.id}
                            client={client}
                            dateStrings={activeDateStrings}
                            salesData={salesData}
                            onUpdate={handleUpdate}
                        />
                    ))}
                </div>
                
                {filteredClients.length === 0 && (
                    <div className="text-center text-gray-400 py-12">
                        <Calendar size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No clients match your search.</p>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
};

export default SalesIndex;
