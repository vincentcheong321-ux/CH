
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Printer } from 'lucide-react';
import { getClients, getSaleRecords, saveSaleRecord, deleteSaleRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';

const ClientSales: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [records, setRecords] = useState<SaleRecord[]>([]);
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [b, setB] = useState('');
  const [s, setS] = useState('');
  const [a, setA] = useState('');
  const [c, setC] = useState('');

  useEffect(() => {
    const fetchClient = async () => {
        if (id) {
            const clients = await getClients();
            const found = clients.find(c => c.id === id);
            setClient(found || null);
            loadRecords();
        }
    }
    fetchClient();
  }, [id]);

  const loadRecords = async () => {
    if (id) {
      const recs = await getSaleRecords(id);
      // Sort by date ascending for the table view like the image usually implies (chronological), 
      // though the image shows Nov 12, 15, 16. So Ascending.
      // But usually latest at bottom? Let's stick to Ascending for the "report" feel.
      setRecords(recs.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    const valB = b === '' ? 0 : parseFloat(b);
    const valS = s === '' ? 0 : parseFloat(s);
    const valA = a === '' ? 0 : parseFloat(a);
    const valC = c === '' ? 0 : parseFloat(c);

    await saveSaleRecord({
        clientId: id,
        date: date,
        b: valB,
        s: valS,
        a: valA,
        c: valC
    });

    setB('');
    setS('');
    setA('');
    setC('');
    loadRecords();
  };

  const handleDelete = async (recordId: string) => {
      if (confirm('Delete this record?')) {
          await deleteSaleRecord(recordId);
          loadRecords();
      }
  };

  const handlePrint = () => {
      window.print();
  };

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
    <div className="bg-gray-100 min-h-screen pb-20 font-sans">
        {/* Header - No Print */}
        <div className="bg-white sticky top-0 z-20 shadow-sm no-print">
            <div className="flex items-center justify-between p-4 max-w-5xl mx-auto">
                <div className="flex items-center space-x-3">
                    <Link to={`/clients/${id}`} className="p-2 hover:bg-gray-100 rounded-full text-gray-600">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 leading-tight">Sales Sheet</h1>
                        <p className="text-xs text-gray-500 font-mono">{client.name} - {client.code}</p>
                    </div>
                </div>
                <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 shadow-sm flex items-center">
                    <Printer size={18} className="mr-2" /> Print Slip
                </button>
            </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Input Form - No Print */}
                <div className="lg:col-span-1 no-print">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sticky top-24">
                        <h2 className="font-bold text-gray-800 mb-4 flex items-center text-sm uppercase tracking-wide">
                            <Save size={16} className="mr-2" />
                            New Entry
                        </h2>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                <input 
                                    type="date" 
                                    required
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                {/* Group B/S */}
                                <div className="bg-blue-50/50 p-2 rounded border border-blue-100 space-y-2">
                                    <div>
                                        <label className="block text-xs font-bold text-blue-800 text-center mb-1">B (Big)</label>
                                        <input type="number" step="0.01" value={b} onChange={e => setB(e.target.value)} className="w-full px-2 py-1.5 border border-blue-200 rounded text-right font-mono text-sm" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-blue-800 text-center mb-1">S (Small)</label>
                                        <input type="number" step="0.01" value={s} onChange={e => setS(e.target.value)} className="w-full px-2 py-1.5 border border-blue-200 rounded text-right font-mono text-sm" placeholder="0" />
                                    </div>
                                </div>

                                {/* Group A/C */}
                                <div className="bg-red-50/50 p-2 rounded border border-red-100 space-y-2">
                                    <div>
                                        <label className="block text-xs font-bold text-red-800 text-center mb-1">A</label>
                                        <input type="number" step="0.01" value={a} onChange={e => setA(e.target.value)} className="w-full px-2 py-1.5 border border-red-200 rounded text-right font-mono text-sm" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-red-800 text-center mb-1">C</label>
                                        <input type="number" step="0.01" value={c} onChange={e => setC(e.target.value)} className="w-full px-2 py-1.5 border border-red-200 rounded text-right font-mono text-sm" placeholder="0" />
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-slate-900 text-white py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm text-sm uppercase tracking-wide">
                                Add Record
                            </button>
                        </form>
                    </div>
                </div>

                {/* Report View (Screen & Print) */}
                <div className="lg:col-span-2">
                    <div id="printable-area" className="bg-white p-6 shadow-sm border border-gray-200 print:shadow-none print:border-none print:p-0">
                        
                        {/* Slip Header */}
                        <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-1">
                            <div className="text-left">
                                <h2 className="text-2xl font-bold uppercase tracking-widest leading-none">{client.name}</h2>
                                <p className="font-mono text-lg text-gray-600 print:text-black mt-1">{client.code}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase text-gray-500 print:text-black">Sales Report</p>
                            </div>
                        </div>

                        {/* The Table */}
                        <table className="w-full border-collapse border border-black text-center text-sm font-mono">
                            <thead>
                                <tr className="bg-gray-100 print:bg-gray-200 text-black font-bold">
                                    <th className="border border-black p-1 w-24">DATE</th>
                                    <th className="border border-black p-1 w-1/5">B</th>
                                    <th className="border-r-2 border-b border-t border-l border-black p-1 w-1/5">S</th>
                                    <th className="border border-black p-1 w-1/5">A</th>
                                    <th className="border border-black p-1 w-1/5 relative">
                                        C
                                        <span className="absolute right-1 top-1 no-print">
                                            {/* Action column placeholder for screen layout */}
                                        </span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((r) => (
                                    <tr key={r.id} className="group hover:bg-blue-50/30 print:hover:bg-transparent">
                                        <td className="border border-black p-2 text-gray-900 print:text-black whitespace-nowrap">
                                            {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td className="border border-black p-2 text-right">{r.b || 0}</td>
                                        {/* Thick border on the right of S column to separate groups */}
                                        <td className="border-t border-b border-l border-r-2 border-black p-2 text-right">{r.s || 0}</td>
                                        <td className="border border-black p-2 text-right">{r.a || 0}</td>
                                        <td className="border border-black p-2 text-right relative">
                                            {r.c || 0}
                                            <button 
                                                onClick={() => handleDelete(r.id)} 
                                                className="absolute right-1 top-1.5 text-red-400 hover:text-red-600 no-print opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {/* Empty Rows Filler for print aesthetics if needed */}
                                {records.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="border border-black p-8 text-gray-400 italic">No records</td>
                                    </tr>
                                )}
                            </tbody>
                            
                            {/* Footer / Totals */}
                            <tfoot>
                                {/* Column Totals */}
                                <tr className="font-bold bg-gray-50 print:bg-transparent">
                                    <td className="border border-black p-2 text-center bg-gray-200 print:bg-gray-200">TOTAL</td>
                                    <td className="border border-black p-2 text-right">{totalB}</td>
                                    <td className="border-t border-b border-l border-r-2 border-black p-2 text-right">{totalS}</td>
                                    <td className="border border-black p-2 text-right">{totalA}</td>
                                    <td className="border border-black p-2 text-right">{totalC}</td>
                                </div>

                                {/* Summary Rows below table */}
                            </tfoot>
                        </table>

                        {/* Grand Totals Section */}
                        <div className="mt-2 flex">
                            {/* Left Side: B+S */}
                            <div className="w-1/2 pr-2 border-r-2 border-transparent">
                                <div className="flex justify-between items-center p-2 border-b border-black border-dashed">
                                    <span className="text-xs font-bold uppercase">Total (B+S)</span>
                                    <span className="font-mono font-bold text-lg">{totalBS.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                            
                            {/* Right Side: A+C */}
                            <div className="w-1/2 pl-2">
                                <div className="flex justify-between items-center p-2 border-b border-black border-dashed">
                                    <span className="text-xs font-bold uppercase">Total (A+C)</span>
                                    <span className="font-mono font-bold text-lg">{totalAC.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                        </div>

                        {/* Net Result */}
                        <div className="mt-4 flex justify-end">
                             <div className="bg-gray-100 print:bg-transparent border-2 border-black p-2 px-4 rounded-sm flex items-center space-x-4">
                                <span className="font-bold uppercase text-sm">Net Result:</span>
                                <span className="font-mono font-bold text-xl">
                                    {netTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </span>
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
