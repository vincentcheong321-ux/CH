import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Search, FileText, Smartphone } from 'lucide-react';
import { getClients, getSalesForDates, saveSaleRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';
import { getWeeksForMonth, MONTH_NAMES, getWeekRangeString } from '../utils/reportUtils';
import { useGlobalState } from '../context/GlobalStateContext';

// Simple Input Component for the table
const SpreadsheetInput = ({ value, onChange, onBlur, colorClass }: { value: number, onChange: (val: number) => void, onBlur: () => void, colorClass?: string }) => {
    const [localValue, setLocalValue] = useState(value.toString());

    useEffect(() => {
        setLocalValue(value === 0 ? '' : value.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val === '' || /^\d*\.?\d*$/.test(val)) {
            setLocalValue(val);
            const num = parseFloat(val);
            if (!isNaN(num)) {
                onChange(num);
            } else {
                onChange(0);
            }
        }
    };

    return (
        <input
            type="text"
            className={`w-full h-full text-center outline-none bg-transparent ${colorClass || ''}`}
            value={localValue}
            onChange={handleChange}
            onBlur={onBlur}
            placeholder=""
        />
    );
};

// Detailed Client Table Component
const ClientWeeklyTable: React.FC<{ 
    client: Client, 
    dates: string[], 
    salesData: SaleRecord[], 
    onUpdate: (clientId: string, date: string, b: number, a: number) => Promise<void> 
}> = ({ 
    client, 
    dates, 
    salesData, 
    onUpdate 
}) => {
    // Filter rows for this specific client and the active dates
    const rows = dates.map(date => {
        const record = salesData.find(s => s.clientId === client.id && s.date === date);
        return { date, record };
    });

    const totals = rows.reduce((acc, row) => ({
        b: acc.b + (row.record?.b || 0),
        s: acc.s + (row.record?.s || 0),
        a: acc.a + (row.record?.a || 0),
        c: acc.c + (row.record?.c || 0),
    }), { b: 0, s: 0, a: 0, c: 0 });

    const totalWan = totals.b + totals.s;
    const totalQian = totals.a + totals.c;
    const grandTotal = totalWan + totalQian;

    return (
        <div className="bg-white border-2 border-black shadow-sm flex flex-col h-full break-inside-avoid">
            {/* Header */}
            <div className="flex border-b-2 border-black h-14">
                <div className="w-[20%] px-3 border-r border-black flex flex-col justify-center bg-gray-50">
                    <Link to={`/clients/${client.id}/sales`} className="font-black text-xl uppercase leading-none text-blue-900 hover:underline truncate">
                        {client.name}
                    </Link>
                    <span className="text-[10px] font-mono text-gray-500 font-bold mt-1">{client.code}</span>
                </div>
                <div className="w-[40%] border-r border-black flex items-center justify-center font-serif italic text-3xl relative bg-white">
                    万
                </div>
                <div className="w-[40%] flex items-center justify-center font-serif italic text-3xl bg-white">
                    千
                </div>
            </div>

            {/* Column Headers */}
            <div className="flex border-b border-black text-xs font-bold bg-gray-100 text-gray-600">
                <div className="w-[20%] text-center py-1.5 border-r border-black">DATE</div>
                <div className="w-[20%] text-center py-1.5 border-r border-gray-300">B</div>
                <div className="w-[20%] text-center py-1.5 border-r border-black">S</div>
                <div className="w-[20%] text-center py-1.5 border-r border-gray-300">A</div>
                <div className="w-[20%] text-center py-1.5">C</div>
            </div>

            {/* Rows */}
            <div className="flex-1">
                {rows.map(row => {
                    const [y, m, d] = row.date.split('-');
                    const dateLabel = `${d}-${MONTH_NAMES[parseInt(m)-1].slice(0,3)}`;
                    
                    return (
                        <div key={row.date} className="flex border-b border-gray-200 hover:bg-blue-50/20 h-10 items-stretch">
                            <div className="w-[20%] flex items-center justify-center border-r border-black text-[11px] font-mono font-bold text-gray-500 bg-gray-50/30">
                                {dateLabel}
                            </div>
                            <div className="w-[20%] border-r border-gray-300 relative p-0">
                                <SpreadsheetInput 
                                    value={row.record?.b || 0} 
                                    onChange={(v) => onUpdate(client.id, row.date, v, row.record?.a || 0)} 
                                    onBlur={() => {}} 
                                    colorClass="text-blue-700 text-base font-mono font-bold"
                                />
                            </div>
                            <div className="w-[20%] border-r border-black bg-gray-50/50 flex items-center justify-center text-xs text-gray-300 font-mono">
                                0
                            </div>
                            <div className="w-[20%] border-r border-gray-300 relative p-0">
                                <SpreadsheetInput 
                                    value={row.record?.a || 0} 
                                    onChange={(v) => onUpdate(client.id, row.date, row.record?.b || 0, v)} 
                                    onBlur={() => {}} 
                                    colorClass="text-red-600 text-base font-mono font-bold"
                                />
                            </div>
                            <div className="w-[20%] bg-gray-50/50 flex items-center justify-center text-xs text-gray-300 font-mono">
                                0
                            </div>
                        </div>
                    );
                })}
                {rows.length === 0 && (
                    <div className="p-4 text-center text-gray-400 text-xs italic">No dates in this week.</div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t-2 border-black bg-gray-50 mt-auto">
                <div className="flex border-b border-black text-xs font-bold text-gray-600 font-mono">
                    <div className="w-[20%] text-right pr-2 py-1 border-r border-black uppercase tracking-tighter">Sub</div>
                    <div className="w-[20%] text-center py-1 border-r border-gray-300">{totals.b > 0 ? totals.b : ''}</div>
                    <div className="w-[20%] text-center py-1 border-r border-black">{totals.s > 0 ? totals.s : ''}</div>
                    <div className="w-[20%] text-center py-1 border-r border-gray-300">{totals.a > 0 ? totals.a : ''}</div>
                    <div className="w-[20%] text-center py-1">{totals.c > 0 ? totals.c : ''}</div>
                </div>
                <div className="flex border-b border-black text-xl font-bold h-9 items-center font-mono">
                    <div className="w-[20%] border-r border-black bg-gray-100 h-full"></div>
                    <div className="w-[40%] text-center border-r border-black text-blue-800">
                        {totalWan > 0 ? totalWan.toLocaleString() : ''}
                    </div>
                    <div className="w-[40%] text-center text-red-700">
                        {totalQian > 0 ? totalQian.toLocaleString() : ''}
                    </div>
                </div>
                <div className="text-center py-2 text-3xl font-black text-gray-900 bg-white font-mono tracking-tighter">
                    {grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
            </div>
        </div>
    );
};

const SalesIndex: React.FC = () => {
    const { currentDate, setCurrentDate } = useGlobalState();
    const [clients, setClients] = useState<Client[]>([]);
    const [salesData, setSalesData] = useState<SaleRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const weeksData = useMemo(() => getWeeksForMonth(currentYear, currentMonth), [currentYear, currentMonth]);
    
    // Find active week
    const selectedDateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;
    const activeWeekNum = useMemo(() => {
        const found = Object.keys(weeksData).find(w => 
            weeksData[parseInt(w)].some(d => {
                const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                return dStr === selectedDateStr;
            })
        );
        return found ? parseInt(found) : 1;
    }, [weeksData, selectedDateStr]);

    const activeWeekDays = weeksData[activeWeekNum] || [];
    const activeDateStrings = useMemo(() => activeWeekDays.map(d => {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }), [activeWeekDays]);

    const loadData = useCallback(async () => {
        setLoading(true);
        const [allClients, sales] = await Promise.all([
            getClients(),
            getSalesForDates(activeDateStrings)
        ]);
        // Filter: Paper clients only for this view
        setClients(allClients.filter(c => (c.category || 'paper') === 'paper'));
        setSalesData(sales);
        setLoading(false);
    }, [activeDateStrings]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleUpdate = async (clientId: string, date: string, b: number, a: number) => {
        // Optimistic update
        setSalesData(prev => {
            const idx = prev.findIndex(r => r.clientId === clientId && r.date === date);
            if (idx >= 0) {
                const newRecs = [...prev];
                newRecs[idx] = { ...newRecs[idx], b, a };
                return newRecs;
            } else {
                return [...prev, { id: 'temp', clientId, date, b, s: 0, a, c: 0 }];
            }
        });

        // Backend update
        await saveSaleRecord({
            clientId,
            date,
            b,
            s: 0,
            a,
            c: 0
        });
        // Reload to ensure consistency (optional, or rely on optimistic)
    };

    const handlePrevWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() - 7);
        setCurrentDate(d);
    };

    const handleNextWeek = () => {
        const d = new Date(currentDate);
        d.setDate(d.getDate() + 7);
        setCurrentDate(d);
    };

    const filteredClients = clients.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-4 md:p-8 max-w-[1800px] mx-auto min-h-screen flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                        <FileText className="mr-3 text-blue-600" />
                        Sales Opening
                    </h1>
                    <p className="text-gray-500 mt-1">Weekly sales entry for paper clients.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/sales/mobile-report" className="flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-bold text-sm">
                        <Smartphone size={18} className="mr-2" />
                        Import Mobile Report
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 sticky top-0 z-30">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button onClick={handlePrevWeek} className="p-2 hover:bg-white rounded shadow-sm"><ChevronLeft size={20}/></button>
                        <div className="px-6 text-center font-bold text-gray-700 min-w-[200px]">
                            {getWeekRangeString(null, null, activeWeekDays)}
                        </div>
                        <button onClick={handleNextWeek} className="p-2 hover:bg-white rounded shadow-sm"><ChevronRight size={20}/></button>
                    </div>
                    
                    <div className="relative w-full md:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Filter clients..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex-1 flex justify-center items-center text-gray-400">Loading...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20">
                    {filteredClients.map(client => (
                        <ClientWeeklyTable 
                            key={client.id}
                            client={client}
                            dates={activeDateStrings}
                            salesData={salesData}
                            onUpdate={handleUpdate}
                        />
                    ))}
                    {filteredClients.length === 0 && (
                        <div className="col-span-full text-center py-12 text-gray-400">No clients found.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SalesIndex;
