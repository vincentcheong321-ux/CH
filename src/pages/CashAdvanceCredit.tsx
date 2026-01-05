
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getClients, getCashAdvances, saveCashAdvance, getCashCredits, saveCashCredit, getLedgerRecords, getNetAmount } from '../services/storageService';
import { Client, LedgerRecord } from '../types';
import { Calendar, ChevronLeft, ChevronRight, Banknote, CreditCard, Search, Plus, UserPlus, X, Trash2, Repeat, Filter, Save } from 'lucide-react';
import { MONTH_NAMES, getWeeksForMonth, getWeekRangeString } from '../utils/reportUtils';
import { Link } from 'react-router-dom';
import { useGlobalState } from '../context/GlobalStateContext';

// Preview Component for showing weekly main ledger status
const LedgerPreviewOverlay = ({ clientId, selectedDate }: { clientId: string, selectedDate: string }) => {
    const [balance, setBalance] = useState<number | null>(null);
    const [dailyRecords, setDailyRecords] = useState<LedgerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [clientName, setClientName] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const records = await getLedgerRecords(clientId);
            const clients = await getClients();
            const c = clients.find(cl => cl.id === clientId);
            if (c) setClientName(c.name);

            const dateObj = new Date(selectedDate);
            const dayOfWeek = dateObj.getDay(); 
            const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const startObj = new Date(dateObj);
            startObj.setDate(dateObj.getDate() - diffToMon);
            const endObj = new Date(startObj);
            endObj.setDate(startObj.getDate() + 6);
            
            const startStr = startObj.toISOString().split('T')[0];
            const endStr = endObj.toISOString().split('T')[0];

            const weekRecords = records.filter(r => 
                r.date >= startStr && 
                r.date <= endStr && 
                (r.column === 'main' || !r.column)
            );
            
            weekRecords.sort((a, b) => a.date.localeCompare(b.date));
            const visibleWeekRecords = weekRecords.filter(r => r.isVisible);
            const bal = visibleWeekRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
            
            setBalance(bal);
            setDailyRecords(weekRecords);
            setLoading(false);
        };
        load();
    }, [clientId, selectedDate]);

    if (loading) return null;

    return (
        <div className="fixed bottom-20 left-4 md:left-8 md:right-auto bg-white border border-gray-200 shadow-2xl rounded-xl z-[60] w-[320px] md:w-[400px] overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300 flex flex-col max-h-[50vh]">
            <div className="bg-gray-900 text-white p-3 flex justify-between items-center flex-shrink-0">
                <div className="flex flex-col min-w-0">
                    <span className="font-bold truncate text-sm md:text-base">{clientName}</span>
                    <span className="text-[10px] text-gray-400">Week Balance</span>
                </div>
                <span className={`font-mono font-bold text-lg ${balance! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${Math.abs(balance!).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-50">
                {dailyRecords.map(r => (
                    <div key={r.id} className="flex justify-between items-center px-4 py-2 border-b border-gray-100 last:border-0 bg-white text-xs">
                        <span className="text-gray-400 font-mono">{r.date.slice(5)}</span>
                        <span className="flex-1 px-2 truncate text-gray-600 font-medium">{r.typeLabel} {r.description && `(${r.description})`}</span>
                        <span className={`font-mono font-bold ${r.operation === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                            {r.operation === 'add' ? '+' : r.operation === 'subtract' ? '-' : ''}{r.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </span>
                    </div>
                ))}
                {dailyRecords.length === 0 && <p className="p-8 text-center text-gray-400 italic text-xs">No activity this week.</p>}
            </div>
        </div>
    );
};

// Component for Individual Client Input
const TransactionRow = React.memo(({ client, value, onChange, onBlur, onFocus, onRemove, type, navState, shouldAutoFocus }: { 
    client: Client, value: string, onChange: (id: string, val: string) => void, onBlur: (id: string) => void, onFocus: (id: string) => void, onRemove: (id: string) => void, type: 'ADV' | 'CRED', navState: any, shouldAutoFocus?: boolean 
}) => {
    const isAdv = type === 'ADV';
    const numVal = parseFloat(value);
    const hasValue = !isNaN(numVal) && numVal !== 0;
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (shouldAutoFocus && inputRef.current) {
            inputRef.current.focus();
        }
    }, [shouldAutoFocus]);

    return (
        <div className="flex items-center justify-between p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors animate-in fade-in">
            <div className="flex-1 min-w-0 pr-4">
                <Link to={`/clients/${client.id}`} state={navState} className="font-bold text-gray-800 text-sm md:text-base hover:text-blue-600 truncate block">{client.name}</Link>
                <div className="text-[10px] text-gray-400 font-mono">{client.code}</div>
            </div>
            <div className="w-32 md:w-40 relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 font-bold text-xs">$</span>
                <input 
                    ref={inputRef}
                    type="text" inputMode="decimal" placeholder="0.00" value={value} 
                    onChange={(e) => onChange(client.id, e.target.value)} 
                    onBlur={() => onBlur(client.id)}
                    onFocus={() => onFocus(client.id)}
                    className={`w-full pl-6 pr-2 py-1.5 text-right font-mono font-bold rounded-lg border outline-none transition-all focus:ring-2 ${isAdv ? 'focus:ring-blue-500' : 'focus:ring-green-500'} ${hasValue ? (isAdv ? 'text-blue-700 border-blue-200 bg-blue-50/30' : 'text-green-700 border-green-200 bg-blue-50/30') : 'text-gray-600 border-gray-200 bg-white'}`}
                />
            </div>
            <button 
                onClick={() => onRemove(client.id)} 
                className="ml-2 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Remove client from list"
            >
                <Trash2 size={14}/>
            </button>
        </div>
    );
});

const CashAdvanceCredit: React.FC = () => {
    const { currentDate, setCurrentDate } = useGlobalState();
    
    // Derived Date State
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const selectedDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

    const [clients, setClients] = useState<Client[]>([]);
    
    const [advances, setAdvances] = useState<Record<string, string>>({});
    const [credits, setCredits] = useState<Record<string, string>>({});
    
    const [loading, setLoading] = useState(false);
    const [previewClientId, setPreviewClientId] = useState<string | null>(null);
    const [isSelectingClient, setIsSelectingClient] = useState<{ type: 'ADV' | 'CRED' | null }>({ type: null });
    const [clientSearch, setClientSearch] = useState('');
    
    const [autoFocusClientId, setAutoFocusClientId] = useState<string | null>(null);
    
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const init = async () => {
            const list = await getClients();
            setClients(list.filter(c => (c.category || 'paper') === 'paper'));
        };
        init();
    }, []);

    const fetchDailyData = async () => {
        if (!selectedDate) return;
        setLoading(true);
        const [advData, credData] = await Promise.all([getCashAdvances(selectedDate), getCashCredits(selectedDate)]);
        const mapA: Record<string, string> = {};
        const mapC: Record<string, string> = {};
        Object.entries(advData).forEach(([cid, val]) => { if(val !== 0) mapA[cid] = val.toFixed(2); });
        Object.entries(credData).forEach(([cid, val]) => { if(val !== 0) mapC[cid] = val.toFixed(2); });
        setAdvances(mapA); setCredits(mapC);
        setLoading(false);
    };

    useEffect(() => { fetchDailyData(); }, [selectedDate]);

    const handleInputFocus = useCallback((cid: string) => {
        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }
        setPreviewClientId(cid);
    }, []);

    const handleInputBlur = useCallback(async (cid: string, type: 'ADV' | 'CRED') => {
        if (autoFocusClientId === cid) setAutoFocusClientId(null);

        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = setTimeout(() => {
            setPreviewClientId(null);
            blurTimeoutRef.current = null;
        }, 150);

        if (type === 'ADV') {
            const val = parseFloat(advances[cid]) || 0;
            await saveCashAdvance(selectedDate, cid, val);
            if (val === 0) setAdvances(prev => { const n = {...prev}; delete n[cid]; return n; });
            else setAdvances(prev => ({...prev, [cid]: val.toFixed(2)}));
        } else {
            const val = parseFloat(credits[cid]) || 0;
            await saveCashCredit(selectedDate, cid, val);
            if (val === 0) setCredits(prev => { const n = {...prev}; delete n[cid]; return n; });
            else setCredits(prev => ({...prev, [cid]: val.toFixed(2)}));
        }
    }, [selectedDate, advances, credits, autoFocusClientId]);

    const handleRemoveClient = useCallback(async (cid: string, type: 'ADV' | 'CRED') => {
        if (type === 'ADV') {
            await saveCashAdvance(selectedDate, cid, 0);
            setAdvances(prev => {
                const newState = { ...prev };
                delete newState[cid];
                return newState;
            });
        } else {
            await saveCashCredit(selectedDate, cid, 0);
            setCredits(prev => {
                const newState = { ...prev };
                delete newState[cid];
                return newState;
            });
        }
        setPreviewClientId(null);
    }, [selectedDate]);

    const handleAddClient = (client: Client) => {
        const type = isSelectingClient.type;
        if (type === 'ADV') setAdvances(prev => ({ ...prev, [client.id]: '' }));
        else setCredits(prev => ({ ...prev, [client.id]: '' }));
        setIsSelectingClient({ type: null });
        setClientSearch('');
        setAutoFocusClientId(client.id);
    };

    const filteredClientList = useMemo(() => {
        const addedIds = new Set(Object.keys(isSelectingClient.type === 'ADV' ? advances : credits));
        return clients.filter(c => !addedIds.has(c.id) && (c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.code.toLowerCase().includes(clientSearch.toLowerCase())));
    }, [clients, advances, credits, isSelectingClient, clientSearch]);

    const totals = useMemo(() => {
        const a = Object.values(advances).reduce((sum: number, v: string) => sum + (parseFloat(v) || 0), 0);
        const c = Object.values(credits).reduce((sum: number, v: string) => sum + (parseFloat(v) || 0), 0);
        return { advances: a, credits: c };
    }, [advances, credits]);

    const weekWeeks = useMemo(() => getWeeksForMonth(currentYear, currentMonth), [currentYear, currentMonth]);
    const sortedWeeks = Object.keys(weekWeeks).map(Number).sort((a,b) => a-b);
    const activeWeekNum = Object.keys(weekWeeks).find(w => weekWeeks[parseInt(w)].some(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === selectedDate));

    const prevMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(1);
        newDate.setMonth(newDate.getMonth() - 1);
        if (newDate.getFullYear() < 2025) return;
        setCurrentDate(newDate);
    };

    const nextMonth = () => {
        const newDate = new Date(currentDate);
        newDate.setDate(1);
        newDate.setMonth(newDate.getMonth() + 1);
        if (newDate.getFullYear() > 2026) return;
        setCurrentDate(newDate);
    };

    const handleDateClick = (dateObj: Date) => {
        setCurrentDate(dateObj);
    };

    return (
        <div className="flex flex-col lg:flex-row min-h-screen pb-20 relative">
            {previewClientId && <LedgerPreviewOverlay clientId={previewClientId} selectedDate={selectedDate} />}

            {/* Sidebar */}
            <div className="lg:w-80 flex-shrink-0 no-print hidden lg:flex flex-col border-r border-gray-200 bg-white p-6 overflow-y-auto h-screen sticky top-0">
                <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center">
                    <Repeat className="mr-2 text-blue-600" /> Advance & Credit
                </h1>
                <p className="text-gray-500 mb-6 text-sm">Record data for paper clients.</p>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b">
                        <button onClick={prevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"><ChevronLeft size={20}/></button>
                        <h2 className="text-sm font-bold text-gray-800">{MONTH_NAMES[currentMonth]} {currentYear}</h2>
                        <button onClick={nextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-30"><ChevronRight size={20}/></button>
                    </div>
                    <div className="space-y-2">
                        {sortedWeeks.map((weekNum, idx) => {
                            const days = weekWeeks[weekNum];
                            const isActiveWeek = weekNum.toString() === activeWeekNum;
                            const rangeStr = getWeekRangeString(null, null, days);
                            return (
                                <button key={weekNum} onClick={() => handleDateClick(days[0])} className={`w-full p-3 rounded-lg font-bold transition-all flex flex-col items-center justify-center text-center ${isActiveWeek ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
                                    <span className={`text-[10px] uppercase tracking-wider opacity-70 ${isActiveWeek ? 'text-blue-100' : 'text-gray-400'}`}>Week {idx + 1}</span>
                                    <span className="text-sm font-mono mt-1 whitespace-nowrap">{rangeStr}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
                
                {/* Unified Header with Summary - Optimized for Mobile Layout */}
                <div className="bg-white border-b border-gray-200 p-3 md:p-4 sticky top-0 z-10 shadow-sm flex-shrink-0">
                    {/* Top Row for Mobile: Title + Month Nav */}
                    <div className="flex lg:hidden justify-between items-center mb-3">
                        <h1 className="text-lg font-bold text-gray-800 flex items-center">
                            <Repeat className="mr-2 text-blue-600" size={20} /> 
                            Trans
                        </h1>
                        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200 shadow-sm">
                             <button onClick={prevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-1.5 hover:bg-white rounded-md disabled:opacity-30 text-gray-600"><ChevronLeft size={16}/></button>
                             <span className="text-[11px] font-bold text-gray-700 w-16 text-center">{MONTH_NAMES[currentMonth].slice(0,3)} {currentYear}</span>
                             <button onClick={nextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-1.5 hover:bg-white rounded-md disabled:opacity-30 text-gray-600"><ChevronRight size={16}/></button>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Summary Cards Row */}
                        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-shrink-0">
                             <div className="hidden lg:block mr-2">
                                <h1 className="text-xl font-bold text-gray-800 flex items-center">
                                    <Repeat className="mr-2 text-blue-600" size={20} /> 
                                    Transactions
                                </h1>
                             </div>

                             <div className="flex items-center px-3 py-2 bg-blue-50 rounded-xl border border-blue-100 flex-shrink-0 min-w-[130px]">
                                <Banknote size={16} className="mr-2 text-blue-600" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-blue-800 uppercase leading-none mb-0.5">Advance</span>
                                    <span className="text-sm font-mono font-bold text-blue-600 leading-none">${totals.advances.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                            <div className="flex items-center px-3 py-2 bg-green-50 rounded-xl border border-green-100 flex-shrink-0 min-w-[130px]">
                                <CreditCard size={16} className="mr-2 text-green-600" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-green-800 uppercase leading-none mb-0.5">Credit</span>
                                    <span className="text-sm font-mono font-bold text-green-600 leading-none">${totals.credits.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                        </div>

                        {/* Auto Save Badge */}
                        <div className="flex items-center justify-end flex-shrink-0">
                            <div className="flex items-center text-[10px] md:text-xs text-gray-500 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200 whitespace-nowrap">
                                <Save size={14} className="mr-1.5" /> Auto-saves
                            </div>
                        </div>
                    </div>
                </div>

                {/* Week Pills Mobile */}
                <div className="bg-gray-50/95 backdrop-blur px-2 py-2 lg:hidden overflow-x-auto flex space-x-2 no-scrollbar border-b border-gray-200 sticky top-[108px] z-10 shadow-sm flex-shrink-0">
                    {sortedWeeks.map(wn => {
                        const days = weekWeeks[wn];
                        const isActive = wn.toString() === activeWeekNum;
                        return (
                            <button key={wn} onClick={() => handleDateClick(days[0])} className={`px-3 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border flex-shrink-0 ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                                W{sortedWeeks.indexOf(wn) + 1}: {getWeekRangeString(null, null, days)}
                            </button>
                        );
                    })}
                </div>

                {!selectedDate ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12">
                        <Filter size={48} className="mb-4 opacity-20" />
                        <p>Select a date to start entering data.</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col md:flex-row">
                        {/* Left Column: Advance */}
                        <div className="flex-1 flex flex-col border-r border-gray-200 bg-white min-w-0">
                            <div className="p-3 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between sticky top-0 z-0">
                                <div className="flex items-center space-x-2">
                                    <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-sm"><Banknote size={16} /></div>
                                    <h3 className="font-bold text-blue-900 text-sm">Advance</h3>
                                </div>
                                <button onClick={() => setIsSelectingClient({ type: 'ADV' })} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center"><UserPlus size={14} className="mr-1"/> Add</button>
                            </div>
                            
                            <div className="flex-1">
                                {loading ? <div className="p-12 text-center text-gray-400 text-sm">Loading...</div> : (
                                    Object.keys(advances).length === 0 ? (
                                        <div className="p-8 text-center text-gray-300 italic text-xs">No advance records.</div>
                                    ) : (
                                        <div className="divide-y divide-gray-100">
                                            {Object.entries(advances).map(([cid, val]) => {
                                                const c = clients.find(cl => cl.id === cid);
                                                return c ? (
                                                    <TransactionRow 
                                                        key={cid} client={c} value={val} type="ADV" 
                                                        navState={{ year: currentYear, month: currentMonth, week: activeWeekNum ? parseInt(activeWeekNum) : 1 }} 
                                                        onChange={(id, v) => setAdvances(p => ({...p, [id]: v}))} 
                                                        onBlur={(id) => handleInputBlur(id, 'ADV')} 
                                                        onFocus={handleInputFocus}
                                                        onRemove={(id) => handleRemoveClient(id, 'ADV')}
                                                        shouldAutoFocus={cid === autoFocusClientId}
                                                    />
                                                ) : null;
                                            })}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* Right Column: Credit */}
                        <div className="flex-1 flex flex-col bg-white min-w-0">
                            <div className="p-3 bg-green-50/50 border-b border-green-100 flex items-center justify-between sticky top-0 z-0">
                                <div className="flex items-center space-x-2">
                                    <div className="bg-green-600 p-1.5 rounded-lg text-white shadow-sm"><CreditCard size={16} /></div>
                                    <h3 className="font-bold text-green-900 text-sm">Credit</h3>
                                </div>
                                <button onClick={() => setIsSelectingClient({ type: 'CRED' })} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center"><UserPlus size={14} className="mr-1"/> Add</button>
                            </div>

                            <div className="flex-1">
                                {loading ? <div className="p-12 text-center text-gray-400 text-sm">Loading...</div> : (
                                    Object.keys(credits).length === 0 ? (
                                        <div className="p-8 text-center text-gray-300 italic text-xs">No credit records.</div>
                                    ) : (
                                        <div className="divide-y divide-gray-100">
                                            {Object.entries(credits).map(([cid, val]) => {
                                                const c = clients.find(cl => cl.id === cid);
                                                return c ? (
                                                    <TransactionRow 
                                                        key={cid} client={c} value={val} type="CRED" 
                                                        navState={{ year: currentYear, month: currentMonth, week: activeWeekNum ? parseInt(activeWeekNum) : 1 }} 
                                                        onChange={(id, v) => setCredits(p => ({...p, [id]: v}))} 
                                                        onBlur={(id) => handleInputBlur(id, 'CRED')} 
                                                        onFocus={handleInputFocus}
                                                        onRemove={(id) => handleRemoveClient(id, 'CRED')}
                                                        shouldAutoFocus={cid === autoFocusClientId}
                                                    />
                                                ) : null;
                                            })}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Client Selection Modal */}
            {isSelectingClient.type && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className={`p-4 flex items-center justify-between text-white ${isSelectingClient.type === 'ADV' ? 'bg-blue-600' : 'bg-green-600'}`}>
                            <h3 className="font-bold flex items-center">
                                <Search size={18} className="mr-2" />
                                {isSelectingClient.type === 'ADV' ? 'Add for Advance (支)' : 'Add for Credit (来)'}
                            </h3>
                            <button onClick={() => { setIsSelectingClient({ type: null }); setClientSearch(''); }} className="hover:bg-black/10 rounded-full p-1"><X size={20}/></button>
                        </div>
                        <div className="p-4">
                            <div className="relative mb-4">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                <input autoFocus type="text" placeholder="Search client..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" />
                            </div>
                            <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
                                {filteredClientList.map(c => (
                                    <button key={c.id} onClick={() => handleAddClient(c)} className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                        <div className="text-left">
                                            <div className="font-bold text-gray-800 text-sm">{c.name}</div>
                                            <div className="text-[10px] text-gray-400 font-mono">{c.code}</div>
                                        </div>
                                        <Plus size={16} className="text-gray-300 group-hover:text-blue-500" />
                                    </button>
                                ))}
                                {filteredClientList.length === 0 && <div className="p-8 text-center text-gray-400 text-xs italic">No matching clients found.</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CashAdvanceCredit;
