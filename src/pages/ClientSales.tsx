
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Loader2, ChevronDown } from 'lucide-react';
import { getClients, getSaleRecords, saveSaleRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';
import { MONTH_NAMES } from '../utils/reportUtils';

// --- Sub-Component: Sales Row ---
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
    const [b, setB] = useState(initialRecord?.b?.toString() || '');
    const [a, setA] = useState(initialRecord?.a?.toString() || '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setB(initialRecord?.b?.toString() || '');
        setA(initialRecord?.a?.toString() || '');
    }, [initialRecord]);

    const handleSave = async () => {
        const valB = parseFloat(b) || 0;
        const valA = parseFloat(a) || 0;

        if (valB === (initialRecord?.b || 0) && valA === (initialRecord?.a || 0)) return;

        setIsSaving(true);
        await saveSaleRecord({ clientId, date: dateStr, b: valB, s: 0, a: valA, c: 0 });
        setIsSaving(false);
        onUpdate(); 
    };

    return (
        <tr className="hover:bg-blue-50/30 h-12">
            <td className="border border-black p-1 text-center font-mono text-sm text-gray-500 bg-gray-50/50">{displayDate}</td>
            <td className="border border-black p-0 relative">
                <input 
                    type="number" step="0.01" 
                    value={b} onChange={e => setB(e.target.value)} onBlur={handleSave}
                    className="w-full h-full p-1 text-center outline-none focus:bg-blue-50 font-mono font-black text-lg text-blue-900 bg-transparent"
                />
            </td>
            <td className="border-r-2 border-t border-b border-black p-0 bg-gray-50/20 border-r-black flex items-center justify-center font-mono font-black text-gray-200 text-2xl h-full">0</td>
            <td className="border border-black p-0 relative">
                <input 
                    type="number" step="0.01" 
                    value={a} onChange={e => setA(e.target.value)} onBlur={handleSave}
                    className="w-full h-full p-1 text-center outline-none focus:bg-red-50 font-mono font-black text-lg text-red-700 bg-transparent"
                />
            </td>
            <td className="border border-black p-0 bg-gray-50/20 flex items-center justify-center font-mono font-black text-gray-200 text-2xl h-full">0</td>
        </tr>
    );
});

const ClientSales: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2025);
  const [month, setMonth] = useState(new Date().getMonth());

  const fetchAllData = useCallback(async () => {
    if (!id) return;
    const [allClients, allRecords] = await Promise.all([getClients(), getSaleRecords(id)]);
    setClient(allClients.find(c => c.id === id) || null);
    setRecords(allRecords);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const drawDays = useMemo(() => {
    const days = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        if ([0, 2, 3, 6].includes(date.getDay())) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const display = `${String(d).padStart(2,'0')}-${MONTH_NAMES[month].slice(0, 3)}`;
            const record = records.find(r => r.date === dateStr);
            days.push({ dateStr, display, record });
        }
    }
    return days;
  }, [year, month, records]);

  const totals = useMemo(() => {
      let b = 0, a = 0;
      drawDays.forEach(d => {
          b += d.record?.b || 0;
          a += d.record?.a || 0;
      });
      return { b, a, bs: b, ac: a, grand: b + a };
  }, [drawDays]);

  if (loading || !client) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="bg-gray-100 min-h-screen">
        <div className="bg-white sticky top-0 z-20 shadow-sm border-b border-gray-200 no-print">
            <div className="flex items-center justify-between p-4 max-w-5xl mx-auto">
                <div className="flex items-center space-x-3">
                    <Link to="/sales" className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ArrowLeft size={20} /></Link>
                    <div><h1 className="text-lg font-bold text-gray-900 leading-tight">Sales Opening</h1><p className="text-xs text-gray-500 font-mono">{client.name} - {client.code}</p></div>
                </div>
                <div className="flex items-center space-x-2">
                    <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-gray-100 px-2 py-1 rounded text-sm font-bold"><option value={2025}>2025</option><option value={2026}>2026</option></select>
                    <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-gray-100 px-2 py-1 rounded text-sm font-bold">{MONTH_NAMES.map((m, i) => <option key={m} value={i}>{m.slice(0,3)}</option>)}</select>
                    <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-1 rounded hover:bg-gray-900 flex items-center text-sm font-bold ml-2"><Printer size={16} className="mr-2" /> Print</button>
                </div>
            </div>
        </div>

        <div className="max-w-3xl mx-auto p-4 md:p-8">
            <div id="printable-area" className="bg-white border-2 border-black p-0 overflow-hidden shadow-xl">
                <table className="w-full border-collapse text-center">
                    <thead>
                        <tr className="bg-gray-100 h-16">
                            <th className="border border-black w-1/4 text-left pl-6 relative">
                                <span className="text-3xl font-black block uppercase tracking-tight">{client.name}</span>
                                <span className="text-xs font-mono absolute top-2 right-2 text-gray-400">{client.code}</span>
                            </th>
                            <th colSpan={2} className="border border-black w-3/8 text-4xl font-serif italic relative">
                                万
                                <div className="absolute bottom-3 left-1/4 right-1/4 h-0.5 bg-black transform -rotate-1 opacity-20"></div>
                            </th>
                            <th colSpan={2} className="border border-black w-3/8 text-4xl font-serif italic">千</th>
                        </tr>
                        <tr className="bg-gray-50 h-10 font-bold text-gray-400 text-xs tracking-widest">
                            <th className="border border-black">DATE</th>
                            <th className="border border-black">B</th>
                            <th className="border-r-2 border-t border-b border-black border-r-black">S</th>
                            <th className="border border-black">A</th>
                            <th className="border border-black">C</th>
                        </tr>
                    </thead>
                    <tbody>
                        {drawDays.map(day => <SalesRow key={day.dateStr} clientId={id!} dateStr={day.dateStr} displayDate={day.display} initialRecord={day.record} onUpdate={fetchAllData} />)}
                    </tbody>
                    <tfoot className="font-mono font-black bg-gray-50">
                        <tr className="h-10 text-lg">
                            <td className="border-none text-right pr-6 text-xs text-gray-400 uppercase tracking-tighter">Subtotal</td>
                            <td className="text-gray-900">{totals.b || ''}</td>
                            <td className="text-gray-900 border-r-2 border-black border-r-black">0</td>
                            <td className="text-gray-900">{totals.a || ''}</td>
                            <td className="text-gray-900">0</td>
                        </tr>
                        <tr className="h-20 text-4xl">
                            <td className="border-none"></td>
                            <td colSpan={2} className="text-blue-700 border-r-2 border-black border-r-black">{totals.bs.toLocaleString(undefined, {minimumFractionDigits: 2}) || ''}</td>
                            <td colSpan={2} className="text-red-600">{totals.ac.toLocaleString(undefined, {minimumFractionDigits: 2}) || ''}</td>
                        </tr>
                        <tr className="h-24 bg-white border-t-2 border-black">
                            <td colSpan={5} className="text-6xl font-black tracking-tighter text-gray-900">
                                {totals.grand.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>
  );
};

export default ClientSales;
