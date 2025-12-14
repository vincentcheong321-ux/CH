
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Printer, ExternalLink } from 'lucide-react';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadRecords = async () => {
    if (id) {
      const recs = await getSaleRecords(id);
      setRecords(recs);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    
    // Allow saving 0s, but valid numbers required
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

    // Reset inputs but keep date same for quick fixes
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

  // Calculate totals
  const totals = records.reduce((acc, r) => ({
      b: acc.b + (r.b || 0),
      s: acc.s + (r.s || 0),
      a: acc.a + (r.a || 0),
      c: acc.c + (r.c || 0),
      daily: acc.daily + ((r.b||0) + (r.s||0) + (r.a||0) + (r.c||0))
  }), { b: 0, s: 0, a: 0, c: 0, daily: 0 });

  if (!client) return <div className="p-8">Loading...</div>;

  return (
    <div className="bg-gray-100 min-h-screen pb-20">
        {/* Header */}
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

        <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Input Form */}
                <div className="lg:col-span-1 no-print">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
                        <h2 className="font-bold text-gray-800 mb-4 flex items-center">
                            <Save size={18} className="mr-2" />
                            Daily Entry
                        </h2>
                        <form onSubmit={handleSave} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <input 
                                    type="date" 
                                    required
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                {/* Column 1: B & S */}
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                    <div className="text-xs font-bold text-blue-800 uppercase mb-3 text-center tracking-wider border-b border-blue-200 pb-1">Big / Small</div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm font-bold text-gray-700">B</label>
                                            </div>
                                            <input type="number" step="0.01" value={b} onChange={e => setB(e.target.value)} className="w-full px-2 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none font-mono text-right" placeholder="0.00" />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm font-bold text-gray-700">S</label>
                                            </div>
                                            <input type="number" step="0.01" value={s} onChange={e => setS(e.target.value)} className="w-full px-2 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none font-mono text-right" placeholder="0.00" />
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2: A & C */}
                                <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                    <div className="text-xs font-bold text-indigo-800 uppercase mb-3 text-center tracking-wider border-b border-indigo-200 pb-1">A / C</div>
                                    <div className="space-y-3">
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm font-bold text-gray-700">A</label>
                                            </div>
                                            <input type="number" step="0.01" value={a} onChange={e => setA(e.target.value)} className="w-full px-2 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-right" placeholder="0.00" />
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm font-bold text-gray-700">C</label>
                                            </div>
                                            <input type="number" step="0.01" value={c} onChange={e => setC(e.target.value)} className="w-full px-2 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-right" placeholder="0.00" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold shadow-sm text-sm uppercase tracking-wide">
                                Record Entry
                            </button>
                        </form>
                    </div>
                </div>

                {/* List & Print View */}
                <div className="lg:col-span-2">
                    {/* Screen List View */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden no-print">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold border-b">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3 text-right">B / S</th>
                                    <th className="px-4 py-3 text-right">A / C</th>
                                    <th className="px-4 py-3 text-right">Total</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {records.map(r => {
                                    const dailyTotal = (r.b || 0) + (r.s || 0) + (r.a || 0) + (r.c || 0);
                                    return (
                                        <tr key={r.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap align-top">
                                                {new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-3 text-right align-top">
                                                <div className="flex flex-col gap-1">
                                                    <div className="font-mono text-gray-900 font-bold bg-blue-50 px-2 py-0.5 rounded">{r.b?.toLocaleString() || '-'}</div>
                                                    <div className="font-mono text-gray-500 text-sm px-2">{r.s?.toLocaleString() || '-'}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right align-top">
                                                <div className="flex flex-col gap-1">
                                                    <div className="font-mono text-gray-900 font-bold bg-indigo-50 px-2 py-0.5 rounded">{r.a?.toLocaleString() || '-'}</div>
                                                    <div className="font-mono text-gray-500 text-sm px-2">{r.c?.toLocaleString() || '-'}</div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right align-top">
                                                <span className="font-bold font-mono text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                                    {dailyTotal.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right align-top">
                                                <button onClick={() => handleDelete(r.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {records.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No records found.</td></tr>
                                )}
                            </tbody>
                            {records.length > 0 && (
                                <tfoot className="bg-gray-50 border-t border-gray-200 font-bold text-xs uppercase">
                                    <tr>
                                        <td className="px-4 py-3 text-gray-500">Total</td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="text-gray-900">B: {totals.b.toLocaleString()}</div>
                                            <div className="text-gray-500">S: {totals.s.toLocaleString()}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="text-gray-900">A: {totals.a.toLocaleString()}</div>
                                            <div className="text-gray-500">C: {totals.c.toLocaleString()}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-base text-blue-700">
                                            {totals.daily.toLocaleString()}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Print View - Mimicking the Image Strip Layout */}
                    <div id="printable-area" className="hidden print:block bg-white p-4">
                        {/* Header */}
                        <div className="flex justify-end border-b-2 border-black pb-2 mb-2">
                            <div className="text-right">
                                <h2 className="text-xl font-bold font-serif uppercase tracking-widest">{client.name}</h2>
                                <p className="font-mono">{client.code}</p>
                            </div>
                        </div>

                        {/* Transposed Table Structure */}
                        <div className="flex border-b border-black">
                            {/* Records Columns */}
                            {records.slice(0, 7).map((r, i) => {
                                const dailyTotal = (r.b || 0) + (r.s || 0) + (r.a || 0) + (r.c || 0);
                                return (
                                <div key={r.id} className="flex-1 border-r border-gray-300 last:border-0 flex flex-col text-center">
                                    <div className="border-b border-black p-2 font-bold bg-gray-100 h-10 flex items-center justify-center text-sm">
                                        {new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                    </div>
                                    <div className="flex-1 flex flex-col font-mono text-lg">
                                        <div className="flex-1 border-b border-gray-200 p-2 flex items-center justify-center">{r.b || 0}</div>
                                        <div className="flex-1 border-b border-gray-200 p-2 flex items-center justify-center">{r.s || 0}</div>
                                        <div className="flex-1 border-b border-gray-200 p-2 flex items-center justify-center">{r.a || 0}</div>
                                        <div className="flex-1 border-b border-gray-200 p-2 flex items-center justify-center">{r.c || 0}</div>
                                        <div className="flex-1 p-2 flex items-center justify-center font-bold bg-gray-50">{dailyTotal > 0 ? dailyTotal : '-'}</div>
                                    </div>
                                </div>
                                );
                            })}

                            {/* Labels Column (Far Right as per image logic) */}
                            <div className="w-16 border-l-2 border-black flex flex-col text-center font-bold bg-gray-50 text-sm">
                                <div className="border-b border-black p-2 h-10 flex items-center justify-center">DATE</div>
                                <div className="flex-1 flex flex-col">
                                    <div className="flex-1 border-b border-gray-200 p-2 flex items-center justify-center">B</div>
                                    <div className="flex-1 border-b border-gray-200 p-2 flex items-center justify-center">S</div>
                                    <div className="flex-1 border-b border-gray-200 p-2 flex items-center justify-center">A</div>
                                    <div className="flex-1 border-b border-gray-200 p-2 flex items-center justify-center">C</div>
                                    <div className="flex-1 p-2 flex items-center justify-center">TOTAL</div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-4 flex justify-between items-center border-t border-black pt-4">
                            <span className="text-xs text-gray-400">LedgerPro System</span>
                            <div className="text-xl font-bold">
                                Sheet Total: <span className="font-mono">{totals.daily.toLocaleString()}</span>
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
