
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Calendar, Save, Loader2, AlertCircle } from 'lucide-react';
import { getClients, getSaleRecords, saveSaleRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';
import { MONTH_NAMES, YEAR, DRAW_DATES } from '../utils/reportUtils';

// --- Types & Helpers ---

interface DayRowData {
  dateStr: string; // YYYY-MM-DD
  dayNum: number;
  record?: SaleRecord;
}

interface MonthGroup {
  monthIndex: number;
  monthName: string;
  days: DayRowData[];
}

// --- Sub-Component: Sales Row (Optimized for performance) ---
// Handles its own local state to prevent re-rendering the entire list on every keystroke
const SalesRow = React.memo(({ 
    clientId, 
    dateStr, 
    dayNum, 
    initialRecord, 
    onUpdate 
}: { 
    clientId: string;
    dateStr: string;
    dayNum: number;
    initialRecord?: SaleRecord;
    onUpdate: () => void;
}) => {
    // Local state for inputs (allows strings to support empty state and decimals)
    const [b, setB] = useState(initialRecord?.b?.toString() || '');
    const [s, setS] = useState(initialRecord?.s?.toString() || '');
    const [a, setA] = useState(initialRecord?.a?.toString() || '');
    const [c, setC] = useState(initialRecord?.c?.toString() || '');
    const [isSaving, setIsSaving] = useState(false);

    // Update local state if external data changes (e.g. initial load)
    useEffect(() => {
        setB(initialRecord?.b?.toString() || '');
        setS(initialRecord?.s?.toString() || '');
        setA(initialRecord?.a?.toString() || '');
        setC(initialRecord?.c?.toString() || '');
    }, [initialRecord]);

    const handleSave = async () => {
        // Only save if values differ from initial, or if it's a new entry with data
        const valB = parseFloat(b) || 0;
        const valS = parseFloat(s) || 0;
        const valA = parseFloat(a) || 0;
        const valC = parseFloat(c) || 0;

        const prevB = initialRecord?.b || 0;
        const prevS = initialRecord?.s || 0;
        const prevA = initialRecord?.a || 0;
        const prevC = initialRecord?.c || 0;

        // Check if anything actually changed to reduce DB writes
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
        onUpdate(); // Trigger parent refresh for totals
    };

    const net = (parseFloat(b) || 0) + (parseFloat(s) || 0) - ((parseFloat(a) || 0) + (parseFloat(c) || 0));

    return (
        <tr className="hover:bg-blue-50/30 transition-colors group">
            <td className="border border-gray-300 p-2 text-center font-bold text-gray-700 w-16 bg-gray-50 group-hover:bg-blue-50/50">
                {String(dayNum).padStart(2, '0')}
                {isSaving && <Loader2 size={12} className="animate-spin text-blue-500 absolute ml-1 inline" />}
            </td>
            
            {/* B & S Group */}
            <td className="border border-gray-300 p-0 w-24 relative">
                <input 
                    type="number" step="0.01" placeholder="-" 
                    value={b} onChange={e => setB(e.target.value)} onBlur={handleSave}
                    className="w-full h-full p-2 text-right outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500 font-mono text-blue-800 font-medium bg-transparent"
                />
            </td>
            <td className="border-r-2 border-t border-b border-gray-300 p-0 w-24 relative border-r-gray-800">
                <input 
                    type="number" step="0.01" placeholder="-" 
                    value={s} onChange={e => setS(e.target.value)} onBlur={handleSave}
                    className="w-full h-full p-2 text-right outline-none focus:bg-blue-50 focus:ring-2 focus:ring-inset focus:ring-blue-500 font-mono text-blue-800 font-medium bg-transparent"
                />
            </td>

            {/* A & C Group */}
            <td className="border border-gray-300 p-0 w-24 relative">
                <input 
                    type="number" step="0.01" placeholder="-" 
                    value={a} onChange={e => setA(e.target.value)} onBlur={handleSave}
                    className="w-full h-full p-2 text-right outline-none focus:bg-red-50 focus:ring-2 focus:ring-inset focus:ring-red-500 font-mono text-red-800 font-medium bg-transparent"
                />
            </td>
            <td className="border border-gray-300 p-0 w-24 relative">
                <input 
                    type="number" step="0.01" placeholder="-" 
                    value={c} onChange={e => setC(e.target.value)} onBlur={handleSave}
                    className="w-full h-full p-2 text-right outline-none focus:bg-red-50 focus:ring-2 focus:ring-inset focus:ring-red-500 font-mono text-red-800 font-medium bg-transparent"
                />
            </td>

            {/* Net Total */}
            <td className={`border border-gray-300 p-2 text-right font-mono font-bold ${net < 0 ? 'text-red-600' : net > 0 ? 'text-blue-900' : 'text-gray-300'}`}>
                {net !== 0 ? net.toLocaleString(undefined, {minimumFractionDigits: 2}) : '-'}
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
  // Generate the full year structure and merge with existing records
  const yearData = useMemo(() => {
    const groups: MonthGroup[] = [];

    // Loop through months 0-11
    for (let m = 0; m < 12; m++) {
        const monthConfig = DRAW_DATES[m];
        if (!monthConfig) continue;

        // Combine all special days (w, s1, s2, t) and sort
        const days = Array.from(new Set([
            ...monthConfig.w,
            ...monthConfig.s1,
            ...monthConfig.s2,
            ...monthConfig.t
        ])).sort((a, b) => a - b);

        const rowData: DayRowData[] = days.map(day => {
            const dateStr = `${YEAR}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            // Find existing record for this date
            const record = records.find(r => r.date === dateStr);
            return {
                dateStr,
                dayNum: day,
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
  }, [records]);

  // --- Global Totals ---
  const totalB = records.reduce((acc, r) => acc + (r.b || 0), 0);
  const totalS = records.reduce((acc, r) => acc + (r.s || 0), 0);
  const totalA = records.reduce((acc, r) => acc + (r.a || 0), 0);
  const totalC = records.reduce((acc, r) => acc + (r.c || 0), 0);
  const grandNet = (totalB + totalS) - (totalA + totalC);

  if (loading || !client) {
      return (
          <div className="flex items-center justify-center min-h-screen">
              <div className="text-center">
                  <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
                  <p className="text-gray-500">Loading Sales Data...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="bg-gray-100 min-h-screen pb-20 font-sans">
        <style>{`
          /* Hide Input Spinners */
          input[type=number]::-webkit-inner-spin-button, 
          input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type=number] { -moz-appearance: textfield; }
          
          @media print {
              body { background-color: white; }
              .no-print { display: none !important; }
              #printable-area { width: 100%; max-width: none; }
              /* Force breaks between months if needed, or allow flow */
              .month-block { break-inside: avoid; }
          }
        `}</style>

        {/* Header - Sticky */}
        <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-gray-200 no-print">
            <div className="flex items-center justify-between p-4 max-w-6xl mx-auto">
                <div className="flex items-center space-x-3">
                    <Link to={`/clients/${id}`} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 leading-tight">Sales Report {YEAR}</h1>
                        <p className="text-xs text-gray-500 font-mono">{client.name} - {client.code}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                     <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Net Result</p>
                        <p className={`text-lg font-bold font-mono ${grandNet >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                           {grandNet.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </p>
                     </div>
                    <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 shadow-sm flex items-center">
                        <Printer size={18} className="mr-2" /> Print
                    </button>
                </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto p-4 md:p-8">
            <div id="printable-area" className="bg-white shadow-sm border border-gray-200 print:shadow-none print:border-none">
                
                {/* Print Header */}
                <div className="hidden print:flex justify-between items-end border-b-2 border-black pb-4 mb-6 p-8">
                    <div>
                        <h1 className="text-3xl font-bold uppercase tracking-widest">{client.name}</h1>
                        <p className="text-xl font-mono text-gray-600">{client.code}</p>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-bold">ANNUAL SALES REPORT</h2>
                        <p className="text-gray-500">{YEAR}</p>
                    </div>
                </div>

                {/* Iterate Months */}
                {yearData.map((month) => {
                    // Calculate Month Subtotals
                    const mB = month.days.reduce((acc, d) => acc + (d.record?.b || 0), 0);
                    const mS = month.days.reduce((acc, d) => acc + (d.record?.s || 0), 0);
                    const mA = month.days.reduce((acc, d) => acc + (d.record?.a || 0), 0);
                    const mC = month.days.reduce((acc, d) => acc + (d.record?.c || 0), 0);
                    const mNet = (mB + mS) - (mA + mC);

                    return (
                        <div key={month.monthIndex} className="month-block mb-8 last:mb-0">
                            {/* Month Header */}
                            <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center print:bg-gray-200 print:text-black print:border-t print:border-b print:border-black">
                                <span className="font-bold uppercase tracking-widest">{month.monthName}</span>
                                <span className="text-xs opacity-75 print:hidden">Auto-save enabled</span>
                            </div>

                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase text-center border-b border-gray-300">
                                        <th className="p-2 w-16 border-r border-gray-300">Date</th>
                                        <th className="p-2 w-24 border-r border-gray-300 bg-blue-50/50 text-blue-900">B</th>
                                        <th className="p-2 w-24 border-r-2 border-gray-800 bg-blue-50/50 text-blue-900">S</th>
                                        <th className="p-2 w-24 border-r border-gray-300 bg-red-50/50 text-red-900">A</th>
                                        <th className="p-2 w-24 border-r border-gray-300 bg-red-50/50 text-red-900">C</th>
                                        <th className="p-2 text-right">Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {month.days.map((day) => (
                                        <SalesRow
                                            key={day.dateStr}
                                            clientId={id!}
                                            dateStr={day.dateStr}
                                            dayNum={day.dayNum}
                                            initialRecord={day.record}
                                            onUpdate={fetchAllData}
                                        />
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                        <td className="p-2 text-center text-xs uppercase text-gray-500">Subtotal</td>
                                        <td className="p-2 text-right border-r border-gray-300 text-blue-900">{mB > 0 ? mB.toLocaleString() : '-'}</td>
                                        <td className="p-2 text-right border-r-2 border-gray-800 text-blue-900">{mS > 0 ? mS.toLocaleString() : '-'}</td>
                                        <td className="p-2 text-right border-r border-gray-300 text-red-900">{mA > 0 ? mA.toLocaleString() : '-'}</td>
                                        <td className="p-2 text-right border-r border-gray-300 text-red-900">{mC > 0 ? mC.toLocaleString() : '-'}</td>
                                        <td className={`p-2 text-right ${mNet < 0 ? 'text-red-600' : 'text-blue-900'}`}>
                                            {mNet.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    );
                })}

                {/* Grand Total Footer */}
                <div className="bg-gray-900 text-white p-6 print:bg-white print:text-black print:border-t-4 print:border-black mt-4">
                    <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-4">
                        <div>
                            <p className="text-gray-400 text-xs uppercase tracking-widest mb-1 print:text-black">Yearly Grand Total</p>
                            <h3 className="text-2xl font-bold">{YEAR} Summary</h3>
                        </div>
                        <div className="flex gap-8 text-right">
                             <div>
                                <p className="text-xs text-gray-400 uppercase print:text-black">Total (B+S)</p>
                                <p className="text-xl font-mono font-bold text-blue-300 print:text-black">{(totalB + totalS).toLocaleString()}</p>
                             </div>
                             <div>
                                <p className="text-xs text-gray-400 uppercase print:text-black">Total (A+C)</p>
                                <p className="text-xl font-mono font-bold text-red-300 print:text-black">{(totalA + totalC).toLocaleString()}</p>
                             </div>
                             <div className="pl-8 border-l border-gray-700 print:border-black">
                                <p className="text-xs text-gray-400 uppercase print:text-black">Net Result</p>
                                <p className={`text-3xl font-mono font-bold ${grandNet < 0 ? 'text-red-500' : 'text-green-400 print:text-black'}`}>
                                    {grandNet.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </p>
                             </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
  );
};

export default ClientSales;
