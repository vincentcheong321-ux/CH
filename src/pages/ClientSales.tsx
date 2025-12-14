
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2, ChevronDown } from 'lucide-react';
import { getClients, getSaleRecords, saveSaleRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';
import { MONTH_NAMES } from '../utils/reportUtils';

// --- Types & Helpers ---

interface DayRowData {
  dateStr: string; // YYYY-MM-DD
  dayNum: number;
  monthIndex: number; 
  displayDate: string; // e.g. "01-Feb"
  record?: SaleRecord;
}

interface MonthGroup {
  monthIndex: number;
  monthName: string;
  days: DayRowData[];
}

// --- Sub-Component: Sales Row (Optimized) ---
const SalesRow = React.memo(({ 
    clientId, 
    dateStr, 
    displayDate,
    initialRecord, 
    onUpdate 
}: { 
    clientId: string;
    dateStr: string;
    displayDate: string;
    initialRecord?: SaleRecord;
    onUpdate: () => void;
}) => {
    // Local state for inputs (allows strings to support empty state)
    const [b, setB] = useState(initialRecord?.b?.toString() || '');
    const [s, setS] = useState(initialRecord?.s?.toString() || '');
    const [a, setA] = useState(initialRecord?.a?.toString() || '');
    const [c, setC] = useState(initialRecord?.c?.toString() || '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setB(initialRecord?.b?.toString() || '');
        setS(initialRecord?.s?.toString() || '');
        setA(initialRecord?.a?.toString() || '');
        setC(initialRecord?.c?.toString() || '');
    }, [initialRecord]);

    const handleSave = async () => {
        const valB = parseFloat(b) || 0;
        const valS = parseFloat(s) || 0;
        const valA = parseFloat(a) || 0;
        const valC = parseFloat(c) || 0;

        const prevB = initialRecord?.b || 0;
        const prevS = initialRecord?.s || 0;
        const prevA = initialRecord?.a || 0;
        const prevC = initialRecord?.c || 0;

        if (valB === prevB && valS === prevS && valA === prevA && valC === prevC) {
            return;
        }

        setIsSaving(true);
        await saveSaleRecord({
            clientId,
            date: dateStr,
            b: valB,
            s: valS,
            a: valA,
            c: valC
        });
        setIsSaving(false);
        onUpdate(); 
    };

    return (
        <tr className="hover:bg-blue-50/30 transition-colors group h-10">
            <td className="border border-black p-1 text-center font-mono text-gray-700 bg-gray-50/50 relative">
                {displayDate}
                {isSaving && <div className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />}
            </td>
            
            {/* Wan Group (B | S) */}
            <td className="border border-black p-0 relative">
                <input 
                    type="number" step="0.01" placeholder="" 
                    value={b} onChange={e => setB(e.target.value)} onBlur={handleSave}
                    className="w-full h-full p-1 text-center outline-none focus:bg-blue-50 font-mono text-blue-900 bg-transparent"
                />
            </td>
            <td className="border-r border-t border-b border-black p-0 relative border-r-2 md:border-r-black">
                <input 
                    type="number" step="0.01" placeholder="" 
                    value={s} onChange={e => setS(e.target.value)} onBlur={handleSave}
                    className="w-full h-full p-1 text-center outline-none focus:bg-blue-50 font-mono text-blue-900 bg-transparent"
                />
            </td>

            {/* Qian Group (A | C) */}
            <td className="border border-black p-0 relative">
                <input 
                    type="number" step="0.01" placeholder="" 
                    value={a} onChange={e => setA(e.target.value)} onBlur={handleSave}
                    className="w-full h-full p-1 text-center outline-none focus:bg-red-50 font-mono text-red-900 bg-transparent"
                />
            </td>
            <td className="border border-black p-0 relative">
                <input 
                    type="number" step="0.01" placeholder="" 
                    value={c} onChange={e => setC(e.target.value)} onBlur={handleSave}
                    className="w-full h-full p-1 text-center outline-none focus:bg-red-50 font-mono text-red-900 bg-transparent"
                />
            </td>
        </tr>
    );
});

// --- Main Page Component ---

const ClientSales: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2025);

  const fetchAllData = useCallback(async () => {
    if (!id) return;
    const [allClients, allRecords] = await Promise.all([
        getClients(),
        getSaleRecords(id)
    ]);
    const found = allClients.find(c => c.id === id);
    setClient(found || null);
    setRecords(allRecords);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handlePrint = () => window.print();

  // --- Data Preparation ---
  const yearData = useMemo(() => {
    const groups: MonthGroup[] = [];
    
    // Iterate through all months of the selected year
    for (let m = 0; m < 12; m++) {
        // Calculate days in month
        const daysInMonth = new Date(year, m + 1, 0).getDate();
        const days: number[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            days.push(d);
        }

        const rowData: DayRowData[] = days.map(day => {
            const dObj = new Date(year, m, day);
            const y = dObj.getFullYear();
            const mo = String(dObj.getMonth() + 1).padStart(2, '0');
            const da = String(dObj.getDate()).padStart(2, '0');
            const dateStr = `${y}-${mo}-${da}`;

            // Determine display date (e.g. "01-Feb")
            const displayDate = `${da}-${MONTH_NAMES[dObj.getMonth()].slice(0, 3)}`;

            const record = records.find(r => r.date === dateStr);
            return {
                dateStr,
                dayNum: day,
                monthIndex: m,
                displayDate,
                record
            };
        });

        groups.push({
            monthIndex: m,
            monthName: MONTH_NAMES[m],
            days: rowData
        });
    }
    return groups;
  }, [records, year]);

  // --- Totals (Filtered by selected year via yearData) ---
  // We should only sum records that are VISIBLE in the current year view
  const visibleRecords = useMemo(() => {
      const visibleDates = new Set(yearData.flatMap(m => m.days.map(d => d.dateStr)));
      return records.filter(r => visibleDates.has(r.date));
  }, [records, yearData]);

  const totalB = visibleRecords.reduce((acc, r) => acc + (r.b || 0), 0);
  const totalS = visibleRecords.reduce((acc, r) => acc + (r.s || 0), 0);
  const totalA = visibleRecords.reduce((acc, r) => acc + (r.a || 0), 0);
  const totalC = visibleRecords.reduce((acc, r) => acc + (r.c || 0), 0);
  
  const totalBS = totalB + totalS;
  const totalAC = totalA + totalC;
  const netTotal = totalBS - totalAC;

  if (loading || !client) {
      return (
          <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                  <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-500">Loading...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="bg-gray-100 min-h-screen font-sans">
        <style>{`
          input[type=number]::-webkit-inner-spin-button, 
          input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type=number] { -moz-appearance: textfield; }
          
          @media print {
              body { background-color: white; }
              .no-print { display: none !important; }
              #printable-area { width: 100%; max-width: none; }
              .page-break { page-break-after: always; }
          }
        `}</style>

        {/* Toolbar */}
        <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-gray-200 no-print">
            <div className="flex items-center justify-between p-4 max-w-5xl mx-auto">
                <div className="flex items-center space-x-3">
                    <Link to="/sales" className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 leading-tight">Sales Opening</h1>
                        <p className="text-xs text-gray-500 font-mono">{client.name} - {client.code}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <select 
                            value={year} 
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="appearance-none bg-gray-100 border border-gray-200 text-gray-700 py-2 pl-4 pr-8 rounded-lg font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value={2025}>2025</option>
                            <option value={2026}>2026</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none"/>
                    </div>
                    <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 shadow-sm flex items-center">
                        <Printer size={18} className="mr-2" /> Print
                    </button>
                </div>
            </div>
        </div>

        {/* Paper View */}
        <div className="max-w-3xl mx-auto p-4 md:p-8">
            <div id="printable-area" className="bg-white shadow-sm border border-gray-200 print:shadow-none print:border-none p-8 min-h-[1000px]">
                
                {/* Specific Layout matching the attached image */}
                <table className="w-full border-collapse border-2 border-black text-center text-lg">
                    <thead>
                        {/* Header Row 1: Client Info | Wan | Qian */}
                        <tr className="bg-gray-100 print:bg-transparent h-12">
                            <th className="border border-black w-1/5 text-left pl-4 relative">
                                <span className="text-xl font-bold block">{client.name}</span>
                                <span className="text-sm font-mono absolute top-1 right-2 text-gray-500 print:text-black">{client.code}</span>
                            </th>
                            <th colSpan={2} className="border border-black w-2/5 text-xl font-serif italic relative">
                                <span className="relative z-10">万</span>
                                {/* Decorative underline style from image */}
                                <div className="absolute bottom-2 left-1/4 right-1/4 h-px bg-black transform -rotate-1"></div>
                            </th>
                            <th colSpan={2} className="border border-black w-2/5 text-xl font-serif italic relative">
                                <span className="relative z-10">千</span>
                            </th>
                        </tr>
                        {/* Header Row 2: Date | B | S | A | C */}
                        <tr className="bg-gray-50 print:bg-transparent h-10 font-serif">
                            <th className="border border-black font-normal tracking-widest text-gray-600 print:text-black">DATE</th>
                            <th className="border border-black font-normal">B</th>
                            <th className="border-r-2 border-t border-b border-black font-normal border-r-black">S</th>
                            <th className="border border-black font-normal">A</th>
                            <th className="border border-black font-normal">C</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Flatten all months into one continuous list for the "opening" view */}
                        {yearData.flatMap(m => m.days).map((day) => (
                             <SalesRow
                                key={day.dateStr}
                                clientId={id!}
                                dateStr={day.dateStr}
                                displayDate={day.displayDate}
                                initialRecord={day.record}
                                onUpdate={fetchAllData}
                            />
                        ))}
                    </tbody>
                    <tfoot>
                        {/* Spacer Row */}
                        <tr className="h-4 border-t-2 border-black">
                            <td colSpan={5}></td>
                        </tr>
                        {/* Subtotals */}
                        <tr className="text-xl font-mono">
                            <td className="border-none text-right pr-4 font-bold text-gray-400 text-sm">TOTAL</td>
                            <td className="border-none">{totalB > 0 ? totalB : ''}</td>
                            <td className="border-none">{totalS > 0 ? totalS : ''}</td>
                            <td className="border-none">{totalA > 0 ? totalA : ''}</td>
                            <td className="border-none">{totalC > 0 ? totalC : ''}</td>
                        </tr>
                        {/* Net Totals */}
                        <tr className="text-2xl font-mono h-16">
                            <td className="border-none"></td>
                            <td colSpan={2} className="border-none">
                                {totalBS > 0 ? totalBS.toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}
                            </td>
                            <td colSpan={2} className="border-none">
                                {totalAC > 0 ? totalAC.toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}
                            </td>
                        </tr>
                         {/* Grand Net */}
                         <tr className="text-2xl font-mono h-16 border-t border-black">
                            <td colSpan={3} className="border-none text-right pr-8 text-sm font-sans font-bold pt-4 align-top uppercase text-gray-500">
                                Net Result ({year})
                            </td>
                            <td colSpan={2} className="border-none pt-2 align-top text-center font-bold">
                                {netTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </td>
                        </tr>
                    </tfoot>
                </table>

                <div className="mt-8 text-center text-gray-400 text-xs font-mono">
                    {netTotal.toFixed(2)}
                </div>
            </div>
        </div>
    </div>
  );
};

export default ClientSales;
