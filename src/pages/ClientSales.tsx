
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Printer, Calendar, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { getClients, getSaleRecords, saveSaleRecord, deleteSaleRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';
import { MONTH_NAMES, YEAR, DRAW_DATES } from '../utils/reportUtils';

const ClientSales: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [records, setRecords] = useState<SaleRecord[]>([]);
  
  // Selection State
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Form State
  const [b, setB] = useState('');
  const [s, setS] = useState('');
  const [a, setA] = useState('');
  const [c, setC] = useState('');
  
  // UX State
  const [isSavedIndicator, setIsSavedIndicator] = useState(false);

  useEffect(() => {
    const fetchClient = async () => {
        if (id) {
            const clients = await getClients();
            const found = clients.find(c => c.id === id);
            setClient(found || null);
            await loadRecords();
        }
    }
    fetchClient();
  }, [id]);

  // When records or date changes, populate form
  useEffect(() => {
    if (selectedDate && records) {
        const record = records.find(r => r.date === selectedDate);
        if (record) {
            setB(record.b === 0 ? '' : record.b.toString());
            setS(record.s === 0 ? '' : record.s.toString());
            setA(record.a === 0 ? '' : record.a.toString());
            setC(record.c === 0 ? '' : record.c.toString());
        } else {
            // Clear form for new entry
            setB('');
            setS('');
            setA('');
            setC('');
        }
    }
  }, [selectedDate, records]);

  // Initialize selectedDate to today or nearest draw date
  useEffect(() => {
      if (!selectedDate) {
          const today = new Date();
          const m = today.getMonth();
          const d = today.getDate();
          setCurrentMonth(m);
          // Default to today if standard format, or just let user pick
          const todayStr = `${YEAR}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          setSelectedDate(todayStr);
      }
  }, []);

  const loadRecords = async () => {
    if (id) {
      const recs = await getSaleRecords(id);
      // Sort Ascending for the report view
      setRecords(recs.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !selectedDate) return;
    
    const valB = b === '' ? 0 : parseFloat(b);
    const valS = s === '' ? 0 : parseFloat(s);
    const valA = a === '' ? 0 : parseFloat(a);
    const valC = c === '' ? 0 : parseFloat(c);

    await saveSaleRecord({
        clientId: id,
        date: selectedDate,
        b: valB,
        s: valS,
        a: valA,
        c: valC
    });

    await loadRecords();
    setIsSavedIndicator(true);
    setTimeout(() => setIsSavedIndicator(false), 2000);
  };

  const handleDelete = async (recordId: string) => {
      if (confirm('Delete this record?')) {
          await deleteSaleRecord(recordId);
          await loadRecords();
      }
  };

  const handlePrint = () => {
      window.print();
  };

  // Calendar Logic
  const validDates = useMemo(() => {
      const data = DRAW_DATES[currentMonth];
      if (!data) return [];
      const allDays = [...data.w, ...data.s1, ...data.s2, ...data.t].sort((a,b) => a-b);
      return allDays.map(d => ({
          day: d,
          fullDate: `${YEAR}-${String(currentMonth+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }));
  }, [currentMonth]);

  // Calculations
  const totalB = records.reduce((acc, r) => acc + (r.b || 0), 0);
  const totalS = records.reduce((acc, r) => acc + (r.s || 0), 0);
  const totalA = records.reduce((acc, r) => acc + (r.a || 0), 0);
  const totalC = records.reduce((acc, r) => acc + (r.c || 0), 0);
  
  const totalBS = totalB + totalS;
  const totalAC = totalA + totalC;
  const netTotal = totalBS - totalAC;

  if (!client) return <div className="p-8">Loading...</div>;

  return (
    <div className="bg-gray-100 min-h-screen pb-20 font-sans flex flex-col md:flex-row">
        <style>{`
          /* Hide Spinners */
          input[type=number]::-webkit-inner-spin-button, 
          input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
          }
          input[type=number] {
            -moz-appearance: textfield;
          }
        `}</style>

        {/* Sidebar - Date Selection */}
        <div className="w-full md:w-64 bg-white border-r border-gray-200 flex-shrink-0 no-print">
            <div className="p-4 border-b border-gray-100">
                <Link to={`/clients/${id}`} className="flex items-center text-gray-500 hover:text-gray-900 mb-4">
                    <ArrowLeft size={16} className="mr-1" /> Back to Ledger
                </Link>
                <div className="mb-2">
                    <h1 className="font-bold text-lg text-gray-900 leading-tight">{client.name}</h1>
                    <p className="text-xs text-gray-500 font-mono">{client.code}</p>
                </div>
            </div>
            
            <div className="p-2">
                 <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg mb-2">
                    <button onClick={() => setCurrentMonth(prev => Math.max(0, prev - 1))} disabled={currentMonth === 0} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronLeft size={16}/></button>
                    <span className="font-bold text-sm uppercase">{MONTH_NAMES[currentMonth]} {YEAR}</span>
                    <button onClick={() => setCurrentMonth(prev => Math.min(11, prev + 1))} disabled={currentMonth === 11} className="p-1 hover:bg-gray-200 rounded disabled:opacity-30"><ChevronRight size={16}/></button>
                 </div>

                 <div className="space-y-1 max-h-[calc(100vh-250px)] overflow-y-auto">
                     {validDates.map(({ day, fullDate }) => {
                         const hasData = records.some(r => r.date === fullDate);
                         const isSelected = selectedDate === fullDate;
                         return (
                             <button
                                key={fullDate}
                                onClick={() => setSelectedDate(fullDate)}
                                className={`
                                    w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors
                                    ${isSelected ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 hover:bg-gray-100'}
                                `}
                             >
                                <span className="font-mono font-bold">{String(day).padStart(2, '0')} {MONTH_NAMES[currentMonth].slice(0,3)}</span>
                                {hasData && (
                                    <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`} />
                                )}
                             </button>
                         )
                     })}
                     {validDates.length === 0 && <div className="text-center text-xs text-gray-400 py-4">No dates configured</div>}
                 </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto h-screen">
            
            {/* Top Bar */}
            <div className="bg-white border-b border-gray-200 p-4 flex justify-between items-center sticky top-0 z-10 no-print">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Sales Entry</h2>
                    <p className="text-xs text-gray-500">
                        Date: <span className="font-mono font-bold text-gray-700">{selectedDate}</span>
                    </p>
                </div>
                <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 shadow-sm flex items-center">
                    <Printer size={18} className="mr-2" /> Print Slip
                </button>
            </div>

            <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
                
                {/* Input Form */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 no-print max-w-lg mx-auto md:mx-0">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-gray-800 flex items-center uppercase tracking-wide">
                            <Save size={18} className="mr-2" />
                            Data Entry
                        </h2>
                        {isSavedIndicator && <span className="text-green-600 text-xs font-bold flex items-center animate-in fade-in"><CheckCircle2 size={14} className="mr-1"/> Saved</span>}
                    </div>
                    
                    <form onSubmit={handleSave} className="space-y-4">
                        {/* B / S Row */}
                        <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                            <div className="text-center mb-1">
                                <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">Group B / S</span>
                            </div>
                            <div className="flex space-x-2">
                                <div className="flex-1 relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-400">B</span>
                                    <input 
                                        type="number" step="0.01" 
                                        value={b} onChange={e => setB(e.target.value)} 
                                        className="w-full pl-6 pr-2 py-2 border border-blue-200 rounded text-center font-mono font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                        placeholder="0" 
                                    />
                                </div>
                                <div className="flex-1 relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-400">S</span>
                                    <input 
                                        type="number" step="0.01" 
                                        value={s} onChange={e => setS(e.target.value)} 
                                        className="w-full pl-6 pr-2 py-2 border border-blue-200 rounded text-center font-mono font-bold text-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                        placeholder="0" 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* A / C Row */}
                        <div className="bg-red-50/50 p-3 rounded-lg border border-red-100">
                            <div className="text-center mb-1">
                                <span className="text-[10px] font-bold text-red-900 uppercase tracking-wider">Group A / C</span>
                            </div>
                            <div className="flex space-x-2">
                                <div className="flex-1 relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-red-400">A</span>
                                    <input 
                                        type="number" step="0.01" 
                                        value={a} onChange={e => setA(e.target.value)} 
                                        className="w-full pl-6 pr-2 py-2 border border-red-200 rounded text-center font-mono font-bold text-lg focus:ring-2 focus:ring-red-500 outline-none" 
                                        placeholder="0" 
                                    />
                                </div>
                                <div className="flex-1 relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-red-400">C</span>
                                    <input 
                                        type="number" step="0.01" 
                                        value={c} onChange={e => setC(e.target.value)} 
                                        className="w-full pl-6 pr-2 py-2 border border-red-200 rounded text-center font-mono font-bold text-lg focus:ring-2 focus:ring-red-500 outline-none" 
                                        placeholder="0" 
                                    />
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-lg hover:bg-slate-800 font-bold shadow-md text-sm uppercase tracking-wide active:scale-95 transition-all">
                            Save Entry
                        </button>
                    </form>
                </div>

                {/* Printable Receipt Area */}
                <div id="printable-area" className="bg-white p-8 shadow-sm border border-gray-200 print:shadow-none print:border-none print:p-0 max-w-3xl">
                    {/* Header */}
                    <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-4">
                        <div className="text-left">
                            <h2 className="text-3xl font-bold uppercase tracking-widest leading-none">{client.name}</h2>
                            <p className="font-mono text-xl text-gray-600 print:text-black mt-1">{client.code}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs uppercase text-gray-500 print:text-black mb-1">Sales Statement</p>
                            <p className="font-bold text-sm">{MONTH_NAMES[currentMonth]} {YEAR}</p>
                        </div>
                    </div>

                    {/* Table */}
                    <table className="w-full border-collapse border border-black text-center text-sm font-mono mb-6">
                        <thead>
                            <tr className="bg-gray-100 print:bg-gray-200 text-black font-bold">
                                <th className="border border-black p-2 w-24">DATE</th>
                                <th className="border border-black p-2 w-1/5">B</th>
                                <th className="border-r-2 border-b border-t border-l border-black p-2 w-1/5">S</th>
                                <th className="border border-black p-2 w-1/5">A</th>
                                <th className="border border-black p-2 w-1/5 relative">C</th>
                            </tr>
                        </thead>
                        <tbody>
                            {records.map((r) => {
                                const isCurrent = r.date === selectedDate;
                                return (
                                <tr key={r.id} className={`group ${isCurrent ? 'bg-yellow-50 print:bg-transparent font-bold' : 'hover:bg-gray-50'}`}>
                                    <td className="border border-black p-2 text-gray-900 print:text-black whitespace-nowrap">
                                        {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        {isCurrent && <span className="ml-2 text-blue-600 no-print">●</span>}
                                    </td>
                                    <td className="border border-black p-2 text-right">{r.b || 0}</td>
                                    <td className="border-t border-b border-l border-r-2 border-black p-2 text-right">{r.s || 0}</td>
                                    <td className="border border-black p-2 text-right">{r.a || 0}</td>
                                    <td className="border border-black p-2 text-right relative">
                                        {r.c || 0}
                                        <button 
                                            onClick={() => handleDelete(r.id)} 
                                            className="absolute right-1 top-1.5 text-red-400 hover:text-red-600 no-print opacity-0 group-hover:opacity-100"
                                            title="Delete Entry"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            )})}
                            {records.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="border border-black p-8 text-gray-400 italic">No records found. Select a date to add.</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="font-bold bg-gray-50 print:bg-transparent">
                                <td className="border border-black p-2 text-center bg-gray-200 print:bg-gray-200">TOTAL</td>
                                <td className="border border-black p-2 text-right">{totalB}</td>
                                <td className="border-t border-b border-l border-r-2 border-black p-2 text-right">{totalS}</td>
                                <td className="border border-black p-2 text-right">{totalA}</td>
                                <td className="border border-black p-2 text-right">{totalC}</td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Summary Boxes */}
                    <div className="flex border-t-2 border-black pt-4">
                        <div className="w-1/2 pr-4 border-r border-gray-300">
                             <div className="flex justify-between items-center mb-2">
                                <span className="font-bold uppercase text-xs">Total (B + S)</span>
                                <span className="font-mono font-bold text-lg">{totalBS.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                             </div>
                        </div>
                        <div className="w-1/2 pl-4">
                             <div className="flex justify-between items-center mb-2">
                                <span className="font-bold uppercase text-xs">Total (A + C)</span>
                                <span className="font-mono font-bold text-lg">{totalAC.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                             </div>
                        </div>
                    </div>
                    
                    <div className="mt-4 flex justify-end">
                        <div className="border-2 border-black px-4 py-2 bg-gray-50 print:bg-transparent">
                            <span className="font-bold uppercase text-sm mr-4">Net Result:</span>
                            <span className="font-mono font-bold text-xl">
                                {netTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    </div>
  );
};

export default ClientSales;
