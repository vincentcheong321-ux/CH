import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Save, Calendar, FileText, ArrowRight, Printer } from 'lucide-react';
import { getClients, getSalesForDates, saveSaleRecord } from '../services/storageService';
import { Client, SaleRecord } from '../types';
import { MONTH_NAMES, getWeeksForMonth, getWeekRangeString } from '../utils/reportUtils';
import { useGlobalState } from '../context/GlobalStateContext';

// Helper Input Component
const SpreadsheetInput = ({ value, onChange, onBlur, colorClass }: { value: number, onChange: (v: number) => void, onBlur: () => void, colorClass?: string }) => {
    const [localVal, setLocalVal] = useState(value === 0 ? '' : value.toString());

    useEffect(() => {
        setLocalVal(value === 0 ? '' : value.toString());
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalVal(e.target.value);
    };

    const handleBlur = () => {
        const num = parseFloat(localVal);
        if (!isNaN(num) && num !== value) {
            onChange(num);
        }
        if (localVal === '' && value !== 0) {
            onChange(0);
        }
        onBlur();
    };

    return (
        <input
            type="number"
            step="0.01"
            value={localVal}
            onChange={handleChange}
            onBlur={handleBlur}
            className={`w-full h-full text-center bg-transparent outline-none focus:bg-blue-50/50 font-mono font-bold ${colorClass || 'text-gray-800'}`}
            placeholder="-"
        />
    );
};

// Detailed Client Table Component
const ClientWeeklyTable: React.FC<{
    client: Client,
    dates: string[],
    salesData: SaleRecord[],
    onUpdate: (clientId: string, date: string, b: number, s: number, a: number, c: number) => Promise<void>
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
                    const dateLabel = `${d}-${MONTH_NAMES[parseInt(m) - 1].slice(0, 3)}`;

                    return (
                        <div key={row.date} className="flex border-b border-gray-200 hover:bg-blue-50/20 h-10 items-stretch">
                            <div className="w-[20%] flex items-center justify-center border-r border-black text-[11px] font-mono font-bold text-gray-500 bg-gray-50/30">
                                {dateLabel}
                            </div>
                            <div className="w-[20%] border-r border-gray-300 relative p-0">
                                <SpreadsheetInput
                                    value={row.record?.b || 0}
                                    onChange={(v) => onUpdate(client.id, row.date, v, row.record?.s || 0, row.record?.a || 0, row.record?.c || 0)}
                                    onBlur={() => { }}
                                    colorClass="text-blue-700 text-base"
                                />
                            </div>
                            <div className="w-[20%] border-r border-black relative p-0">
                                 <SpreadsheetInput
                                    value={row.record?.s || 0}
                                    onChange={(v) => onUpdate(client.id, row.date, row.record?.b || 0, v, row.record?.a || 0, row.record?.c || 0)}
                                    onBlur={() => { }}
                                    colorClass="text-blue-700 text-base"
                                />
                            </div>
                            <div className="w-[20%] border-r border-gray-300 relative p-0">
                                <SpreadsheetInput
                                    value={row.record?.a || 0}
                                    onChange={(v) => onUpdate(client.id, row.date, row.record?.b || 0, row.record?.s || 0, v, row.record?.c || 0)}
                                    onBlur={() => { }}
                                    colorClass="text-red-600 text-base"
                                />
                            </div>
                            <div className="w-[20%] relative p-0">
                                 <SpreadsheetInput
                                    value={row.record?.c || 0}
                                    onChange={(v) => onUpdate(client.id, row.date, row.record?.b || 0, row.record?.s || 0, row.record?.a || 0, v)}
                                    onBlur={() => { }}
                                    colorClass="text-red-600 text-base"
                                />
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
                    {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
            </div>
        </div>
    );
};

// Main SalesIndex Component
const SalesIndex: React.FC = () => {
    const { currentDate, setCurrentDate } = useGlobalState();
    const [clients, setClients] = useState<Client[]>([]);
    const [salesData, setSalesData] = useState<SaleRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const weeksData = useMemo(() => getWeeksForMonth(currentYear, currentMonth), [currentYear, currentMonth]);
    const sortedWeekKeys = Object.keys(weeksData).map(Number).sort((a, b) => a - b);

    // Determine active week based on selected date
    const selectedWeekNum = useMemo(() => {
        const todayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        const foundWeek = Object.keys(weeksData).find(w => {
            return weeksData[parseInt(w)].some(d => {
                const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                return dStr === todayStr;
            });
        });
        return foundWeek ? parseInt(foundWeek) : sortedWeekKeys[0] || 1;
    }, [weeksData, currentDate, currentYear, currentMonth, sortedWeekKeys]);

    const activeDates = useMemo(() => {
        const days = weeksData[selectedWeekNum] || [];
        // Only include Sun, Tue, Wed, Sat (0, 2, 3, 6)
        return days
            .filter(d => [0, 2, 3, 6].includes(d.getDay()))
            .map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }, [weeksData, selectedWeekNum]);

    const activeDaysRaw = weeksData[selectedWeekNum] || [];
    const rangeLabel = getWeekRangeString(null, null, activeDaysRaw);

    useEffect(() => {
        loadData();
    }, [activeDates]);

    const loadData = async () => {
        setLoading(true);
        const allClients = await getClients();
        const paperClients = allClients.filter(c => (c.category || 'paper') === 'paper');
        setClients(paperClients);

        if (activeDates.length > 0) {
            const records = await getSalesForDates(activeDates);
            setSalesData(records);
        } else {
            setSalesData([]);
        }
        setLoading(false);
    };

    const handleUpdate = async (clientId: string, date: string, b: number, s: number, a: number, c: number) => {
        // Optimistic Update
        setSalesData(prev => {
            const idx = prev.findIndex(r => r.clientId === clientId && r.date === date);
            if (idx >= 0) {
                const newArr = [...prev];
                newArr[idx] = { ...newArr[idx], b, s, a, c };
                return newArr;
            } else {
                return [...prev, { id: 'temp', clientId, date, b, s, a, c }];
            }
        });

        await saveSaleRecord({ clientId, date, b, s, a, c });
    };

    const handleWeekSelect = (weekNum: number) => {
        const days = weeksData[weekNum];
        if (days && days.length > 0) {
            setCurrentDate(days[0]);
        }
    };

    const handlePrevMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(1);
        newDate.setMonth(newDate.getMonth() - 1);
        if (newDate.getFullYear() < 2025) return;
        setCurrentDate(newDate);
    };

    const handleNextMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(1);
        newDate.setMonth(newDate.getMonth() + 1);
        if (newDate.getFullYear() > 2026) return;
        setCurrentDate(newDate);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="bg-gray-100 min-h-screen pb-20">
            <style>{`
                @media print {
                    body { background-color: white; }
                    .no-print { display: none !important; }
                    .page-break { page-break-after: always; }
                    .break-inside-avoid { break-inside: avoid; }
                }
            `}</style>

            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm no-print">
                <div className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center space-x-4">
                        <div className="bg-blue-600 p-2 rounded-xl text-white">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">Sales Opening</h1>
                            <p className="text-xs text-gray-500 font-medium">Weekly Entry Grid</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 bg-gray-50 p-1 rounded-lg border border-gray-200">
                        <button onClick={handlePrevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-2 hover:bg-white rounded-md disabled:opacity-30 transition-colors"><ChevronLeft size={18} /></button>
                        <span className="font-bold text-sm w-24 text-center">{MONTH_NAMES[currentMonth]} {currentYear}</span>
                        <button onClick={handleNextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-2 hover:bg-white rounded-md disabled:opacity-30 transition-colors"><ChevronRight size={18} /></button>
                    </div>

                    <div className="flex space-x-2">
                        <Link to="/sales/mobile-report" className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-bold text-sm shadow-sm">
                            <FileText size={16} className="mr-2" />
                            Mobile Import
                        </Link>
                        <button onClick={handlePrint} className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors font-bold text-sm shadow-sm">
                            <Printer size={16} className="mr-2" /> Print
                        </button>
                    </div>
                </div>

                {/* Week Selector */}
                <div className="px-4 pb-3 flex space-x-2 overflow-x-auto">
                    {sortedWeekKeys.map(wk => {
                        const days = weeksData[wk];
                        const label = getWeekRangeString(null, null, days);
                        return (
                            <button
                                key={wk}
                                onClick={() => handleWeekSelect(wk)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border flex-shrink-0 ${selectedWeekNum === wk ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                            >
                                Week {sortedWeekKeys.indexOf(wk) + 1}: {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="max-w-[1920px] mx-auto p-4 md:p-6">
                {loading ? (
                    <div className="p-12 text-center text-gray-500">Loading sales data...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {clients.map(client => (
                            <ClientWeeklyTable
                                key={client.id}
                                client={client}
                                dates={activeDates}
                                salesData={salesData}
                                onUpdate={handleUpdate}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SalesIndex;