
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, FileText, Loader2, Save } from 'lucide-react';
import { getClients, getSalesForDates, saveSaleRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';
import { MONTH_NAMES, YEAR, getWeeksForMonth } from '../utils/reportUtils';

// --- Sub-Component: Compact Cell Input ---
// Displays one of the 4 values (B/S/A/C)
const CompactInput = React.memo(({ 
    value, 
    onChange, 
    onBlur,
    colorClass
}: { 
    value: number | undefined, 
    onChange: (val: string) => void,
    onBlur: () => void,
    colorClass: string
}) => {
    const [localVal, setLocalVal] = useState(value !== undefined && value !== 0 ? value.toString() : '');

    useEffect(() => {
        setLocalVal(value !== undefined && value !== 0 ? value.toString() : '');
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalVal(e.target.value);
        onChange(e.target.value);
    };

    return (
        <input 
            type="text"
            inputMode="decimal"
            value={localVal}
            onChange={handleChange}
            onBlur={onBlur}
            onFocus={(e) => e.target.select()}
            className={`w-full h-full text-center bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 font-mono text-sm ${colorClass} ${localVal ? 'font-bold' : ''}`}
            placeholder="-"
        />
    );
});

const SalesIndex: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(0);
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1); // 1-based index from utils
  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Setup Initial State based on today
  useEffect(() => {
      const now = new Date();
      setCurrentMonth(now.getMonth());
      // Logic to find current week is complex, defaulting to first week or user selected
      // Simple default to week 1 for now or persisting could be an improvement
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
        const loadedClients = await getClients();
        setClients(loadedClients);
        
        // Get dates for current selection
        const weeks = getWeeksForMonth(currentMonth);
        const days = weeks[selectedWeekNum] || [];
        
        if (days.length > 0) {
            const dateStrings = days.map(d => `${YEAR}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
            const records = await getSalesForDates(dateStrings);
            setSalesData(records);
        } else {
            setSalesData([]);
        }
    } catch (e) {
        console.error("Failed to load data", e);
    } finally {
        setLoading(false);
    }
  }, [currentMonth, selectedWeekNum]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Date Helpers ---
  const weeksData = useMemo(() => getWeeksForMonth(currentMonth), [currentMonth]);
  const activeDays = weeksData[selectedWeekNum] || [];
  const activeDateStrings = useMemo(() => 
      activeDays.map(d => `${YEAR}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`),
  [activeDays, currentMonth]);

  // --- Handlers ---
  const handleUpdate = useCallback(async (clientId: string, dateStr: string, field: 'b'|'s'|'a'|'c', valueStr: string) => {
      const numVal = parseFloat(valueStr) || 0;
      
      // Optimistic update locally
      setSalesData(prev => {
          const idx = prev.findIndex(r => r.clientId === clientId && r.date === dateStr);
          if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], [field]: numVal };
              return updated;
          } else {
              // Create simplified temporary record for UI
              return [...prev, { id: 'temp', clientId, date: dateStr, b:0, s:0, a:0, c:0, [field]: numVal }];
          }
      });

      // Save to DB
      // We need to fetch the current state of the record to ensure we don't overwrite other fields with 0 if they exist but aren't in `salesData` array properly (though we load all for dates)
      // Actually, since we load all records for these dates, `salesData` should be authoritative.
      const existing = salesData.find(r => r.clientId === clientId && r.date === dateStr);
      const payload = existing 
        ? { ...existing, [field]: numVal } 
        : { clientId, date: dateStr, b:0, s:0, a:0, c:0, [field]: numVal };
      
      // Remove ID if it's temp
      const { id, ...savePayload } = payload; 
      await saveSaleRecord(savePayload);
      
      // Reload effectively syncs ID and proper state, but we can rely on optimistic for speed
  }, [salesData]);

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Render ---
  
  const sortedWeekKeys = Object.keys(weeksData).map(Number).sort((a,b) => a-b);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      
      {/* Top Bar: Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 flex-shrink-0 z-20 shadow-sm">
        <div className="flex items-center space-x-6">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button onClick={() => setCurrentMonth(m => Math.max(0, m-1))} disabled={currentMonth===0} className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30"><ChevronLeft size={20}/></button>
                <span className="w-32 text-center font-bold text-gray-800">{MONTH_NAMES[currentMonth]} {YEAR}</span>
                <button onClick={() => setCurrentMonth(m => Math.min(11, m+1))} disabled={currentMonth===11} className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30"><ChevronRight size={20}/></button>
            </div>

            <div className="flex space-x-2 overflow-x-auto max-w-[300px] md:max-w-none">
                {sortedWeekKeys.map(wk => (
                    <button
                        key={wk}
                        onClick={() => setSelectedWeekNum(wk)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap
                            ${selectedWeekNum === wk ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}
                        `}
                    >
                        Week {Object.keys(weeksData).indexOf(String(wk)) + 1}
                    </button>
                ))}
            </div>
        </div>

        <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Filter clients..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* Main Content: Matrix */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        {loading && clients.length === 0 ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : (
            <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden inline-block min-w-full">
                <table className="border-collapse w-full">
                    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                        {/* Header Row 1: Dates */}
                        <tr>
                            <th className="p-3 border-r border-b border-gray-300 min-w-[150px] sticky left-0 bg-gray-50 z-20 text-left font-bold text-gray-700">Client</th>
                            {activeDateStrings.map(dateStr => {
                                const dayNum = parseInt(dateStr.split('-')[2]);
                                return (
                                    <th key={dateStr} colSpan={4} className="border-r border-b border-gray-300 text-center py-2 bg-blue-50/30">
                                        <div className="flex flex-col">
                                            <span className="text-lg font-bold text-gray-800">{dayNum}</span>
                                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{MONTH_NAMES[currentMonth].slice(0,3)}</span>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                        {/* Header Row 2: B S A C */}
                        <tr>
                            <th className="border-r border-b border-gray-300 sticky left-0 bg-gray-50 z-20"></th>
                            {activeDateStrings.map(dateStr => (
                                <React.Fragment key={dateStr}>
                                    <th className="w-12 border-b border-gray-300 text-center text-xs font-medium text-blue-700 bg-gray-50/50 py-1" title="Wan B">B</th>
                                    <th className="w-12 border-r border-b border-gray-300 text-center text-xs font-medium text-blue-700 bg-gray-50/50 py-1" title="Wan S">S</th>
                                    <th className="w-12 border-b border-gray-300 text-center text-xs font-medium text-red-700 bg-gray-50/50 py-1" title="Qian A">A</th>
                                    <th className="w-12 border-r border-b border-gray-300 text-center text-xs font-medium text-red-700 bg-gray-50/50 py-1" title="Qian C">C</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredClients.map((client, idx) => (
                            <tr key={client.id} className="hover:bg-blue-50/20 transition-colors group">
                                {/* Sticky Client Name */}
                                <td className="p-2 border-r border-gray-200 bg-white group-hover:bg-blue-50/20 sticky left-0 z-10 border-b min-w-[150px]">
                                    <Link to={`/clients/${client.id}/sales`} className="block hover:text-blue-600">
                                        <div className="font-bold text-gray-900 leading-tight">{client.name}</div>
                                        <div className="text-xs text-gray-400 font-mono">{client.code}</div>
                                    </Link>
                                </td>

                                {/* Data Cells */}
                                {activeDateStrings.map(dateStr => {
                                    const record = salesData.find(r => r.clientId === client.id && r.date === dateStr);
                                    
                                    return (
                                        <React.Fragment key={dateStr}>
                                            {/* Wan */}
                                            <td className="border-r border-gray-100 border-b p-0 h-10 bg-white">
                                                <CompactInput 
                                                    value={record?.b} 
                                                    onChange={(val) => handleUpdate(client.id, dateStr, 'b', val)}
                                                    onBlur={() => {}}
                                                    colorClass="text-blue-600"
                                                />
                                            </td>
                                            <td className="border-r-2 border-gray-300 border-b p-0 h-10 bg-white">
                                                <CompactInput 
                                                    value={record?.s} 
                                                    onChange={(val) => handleUpdate(client.id, dateStr, 's', val)}
                                                    onBlur={() => {}}
                                                    colorClass="text-blue-600"
                                                />
                                            </td>
                                            {/* Qian */}
                                            <td className="border-r border-gray-100 border-b p-0 h-10 bg-white">
                                                <CompactInput 
                                                    value={record?.a} 
                                                    onChange={(val) => handleUpdate(client.id, dateStr, 'a', val)}
                                                    onBlur={() => {}}
                                                    colorClass="text-red-600"
                                                />
                                            </td>
                                            <td className="border-r-2 border-gray-400 border-b p-0 h-10 bg-white">
                                                <CompactInput 
                                                    value={record?.c} 
                                                    onChange={(val) => handleUpdate(client.id, dateStr, 'c', val)}
                                                    onBlur={() => {}}
                                                    colorClass="text-red-600"
                                                />
                                            </td>
                                        </React.Fragment>
                                    );
                                })}
                            </tr>
                        ))}
                        {filteredClients.length === 0 && (
                            <tr><td colSpan={1 + activeDateStrings.length * 4} className="p-8 text-center text-gray-400">No clients match your filter.</td></tr>
                        )}
                    </tbody>
                    
                    {/* Footer Totals */}
                    <tfoot className="bg-gray-50 font-mono text-sm border-t-2 border-gray-300">
                        <tr>
                            <td className="p-3 border-r border-gray-300 sticky left-0 bg-gray-100 z-10 font-bold text-gray-600 text-right">
                                TOTALS
                            </td>
                            {activeDateStrings.map(dateStr => {
                                // Calculate daily totals for visible records
                                // Note: This sums ALL loaded data for this date, not just filtered clients if searching. 
                                // Ideally should sum visible, but usually sums are expected to be global. 
                                // Let's sum global for accuracy.
                                const dayRecords = salesData.filter(r => r.date === dateStr);
                                const sumB = dayRecords.reduce((a,c) => a + (c.b||0), 0);
                                const sumS = dayRecords.reduce((a,c) => a + (c.s||0), 0);
                                const sumA = dayRecords.reduce((a,c) => a + (c.a||0), 0);
                                const sumC = dayRecords.reduce((a,c) => a + (c.c||0), 0);

                                return (
                                    <React.Fragment key={dateStr}>
                                        <td className="text-center py-2 text-blue-800 font-bold border-r border-gray-200">{sumB > 0 ? sumB : '-'}</td>
                                        <td className="text-center py-2 text-blue-800 font-bold border-r-2 border-gray-300">{sumS > 0 ? sumS : '-'}</td>
                                        <td className="text-center py-2 text-red-800 font-bold border-r border-gray-200">{sumA > 0 ? sumA : '-'}</td>
                                        <td className="text-center py-2 text-red-800 font-bold border-r-2 border-gray-400">{sumC > 0 ? sumC : '-'}</td>
                                    </React.Fragment>
                                );
                            })}
                        </tr>
                    </tfoot>
                </table>
            </div>
        )}
      </div>
    </div>
  );
};

export default SalesIndex;
