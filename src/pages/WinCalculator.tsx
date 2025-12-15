
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Calculator, Trophy, RotateCcw, Plus, Trash2, Save, User, CheckCircle, Calendar, Hash, Medal, Layers, RefreshCw } from 'lucide-react';
import { getClients, saveLedgerRecord, getWinningsByDateRange } from '../services/storageService';
import { Client } from '../types';
import { getWeeksForMonth, MONTH_NAMES, getWeekRangeString } from '../utils/reportUtils';

type GameMode = '4D' | '3D';
type PrizePosition = '1' | '2' | '3' | 'S' | 'C';
type BetType = 'Straight' | 'Box' | 'Pau';

interface WinningEntry {
  id: string;
  number: string;
  mode: GameMode;
  position: PrizePosition;
  positionLabel: string;
  sides: string[]; 
  betType: 'Big' | 'Small' | '3A' | '3ABC';
  betAmount: number;
  winAmount: number;
  playType: BetType;
}

const PAYOUTS_4D = {
    BIG: { '1': 2750, '2': 1100, '3': 550, 'S': 220, 'C': 66 },
    SMALL: { '1': 3850, '2': 2200, '3': 1100, 'S': 0, 'C': 0 }
};

const PAYOUTS_3D = { '3A': 720, '3ABC': 240 };

const PRIZE_LABELS_CHINESE: Record<PrizePosition, string> = {
    '1': '头', '2': '二', '3': '三', 'S': '入', 'C': '安'
};

const getPermutationCount = (str: string, mode: GameMode): number => {
    const chars = str.split('');
    const len = mode === '4D' ? 4 : 3;
    if (chars.length !== len) return 1;

    const counts: Record<string, number> = {};
    chars.forEach(c => counts[c] = (counts[c] || 0) + 1);
    
    if (mode === '4D') {
        const unique = Object.keys(counts).length;
        if (unique === 4) return 24; 
        if (unique === 3) return 12; 
        if (unique === 2) return Object.values(counts).includes(3) ? 4 : 6;
        if (unique === 1) return 1; 
    } 
    else {
        const unique = Object.keys(counts).length;
        if (unique === 3) return 6;
        if (unique === 2) return 3;
        if (unique === 1) return 1;
    }
    return 1;
};

const ClientWinInputRow = React.memo(({ 
    client, 
    value, 
    onChange, 
    onBlur,
    navState
}: { 
    client: Client, 
    value: string, 
    onChange: (id: string, val: string) => void, 
    onBlur: (id: string) => void,
    navState: any
}) => {
    return (
        <div className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors group relative">
            <div className="flex items-center space-x-3 relative z-10">
                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600 font-bold text-xs">
                    {client.code.substring(0,2)}
                </div>
                <div>
                    <Link to={`/clients/${client.id}`} state={navState} className="font-bold text-gray-800 hover:text-blue-600 transition-colors relative z-20 block">{client.name}</Link>
                    <div className="text-xs text-gray-500 font-mono">{client.code}</div>
                </div>
            </div>
            <div className="w-32 relative z-10">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">$</span>
                <input 
                    type="text" 
                    inputMode="decimal"
                    placeholder="0.00"
                    value={value}
                    onChange={(e) => onChange(client.id, e.target.value)}
                    onBlur={() => onBlur(client.id)}
                    onFocus={(e) => e.target.select()}
                    className={`
                        w-full pl-5 pr-2 py-1.5 text-right font-mono font-bold rounded-lg border transition-all
                        focus:outline-none focus:ring-2 focus:ring-red-500
                        ${parseFloat(value) > 0 ? 'text-red-600 border-red-200 bg-red-50/30' : 'text-gray-400 border-gray-200 bg-white'}
                    `}
                />
            </div>
        </div>
    );
});

const WinCalculator: React.FC = () => {
    const navigate = useNavigate();
    const [mode, setMode] = useState<GameMode>('4D');
    const [winningNumber, setWinningNumber] = useState('');
    const [position, setPosition] = useState<PrizePosition>('1');
    const [sides, setSides] = useState<string[]>([]);
    const [betBig, setBetBig] = useState('');
    const [betSmall, setBetSmall] = useState('');
    const [betA, setBetA] = useState('');
    const [betABC, setBetABC] = useState('');
    const [playType, setPlayType] = useState<BetType>('Straight');
    const [entries, setEntries] = useState<WinningEntry[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [clientWinnings, setClientWinnings] = useState<Record<string, string>>({});
    const [loadingList, setLoadingList] = useState(false);

    useEffect(() => {
        const fetchClients = async () => {
            const clientList = await getClients();
            const paperClients = clientList.filter(c => (c.category || 'paper') === 'paper');
            setClients(paperClients);
        };
        fetchClients();
    }, []);

    useEffect(() => {
        if (selectedDate && clients.length > 0) {
            fetchWeeklyWinnings();
        }
    }, [selectedDate, clients]);

    const fetchWeeklyWinnings = async () => {
        setLoadingList(true);
        const d = new Date(selectedDate);
        const y = d.getFullYear();
        const m = d.getMonth();
        const weeks = getWeeksForMonth(y, m);
        const targetStr = selectedDate;
        
        const weekDays = Object.values(weeks).find(days => 
            days.some(day => {
                const ds = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
                return ds === targetStr;
            })
        );

        if (weekDays && weekDays.length > 0) {
            const start = weekDays[0];
            const end = weekDays[weekDays.length - 1];
            const sStr = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
            const eStr = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
            
            const data = await getWinningsByDateRange(sStr, eStr);
            const mapped: Record<string, string> = {};
            clients.forEach(c => {
                mapped[c.id] = data[c.id] ? data[c.id].toString() : '';
            });
            setClientWinnings(mapped);
        } else {
            setClientWinnings({});
        }
        setLoadingList(false);
    };

    const handleSideToggle = (side: string) => {
        setSides(prev => prev.includes(side) ? prev.filter(s => s !== side) : [...prev, side].sort());
    };

    const handleAddEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!winningNumber || sides.length === 0) return;

        const newEntries: WinningEntry[] = [];
        const sideCount = sides.length;
        const permutationCount = getPermutationCount(winningNumber, mode);
        
        if (mode === '4D') {
            const bigAmt = parseFloat(betBig) || 0;
            const smallAmt = parseFloat(betSmall) || 0;

            if (bigAmt > 0) {
                let effectiveBet = bigAmt;
                if (playType === 'Box') effectiveBet = bigAmt / permutationCount;
                const winAmount = (effectiveBet / sideCount) * PAYOUTS_4D.BIG[position];
                if (winAmount > 0) {
                    newEntries.push({
                        id: Date.now() + 'b', number: winningNumber, mode, position, sides: sides.sort(),
                        positionLabel: PRIZE_LABELS_CHINESE[position], betType: 'Big', betAmount: bigAmt, winAmount, playType
                    });
                }
            }
            if (smallAmt > 0) {
                let effectiveBet = smallAmt;
                if (playType === 'Box') effectiveBet = smallAmt / permutationCount;
                const winAmount = (effectiveBet / sideCount) * PAYOUTS_4D.SMALL[position];
                if (winAmount > 0) {
                    newEntries.push({
                        id: Date.now() + 's', number: winningNumber, mode, position, sides: sides.sort(),
                        positionLabel: PRIZE_LABELS_CHINESE[position], betType: 'Small', betAmount: smallAmt, winAmount, playType
                    });
                }
            }
        } else { 
            const aAmt = parseFloat(betA) || 0;
            const abcAmt = parseFloat(betABC) || 0;

            if (aAmt > 0 && position === '1') {
                let effectiveBet = aAmt;
                if (playType === 'Box') effectiveBet = aAmt / permutationCount;
                const winAmount = (effectiveBet / sideCount) * PAYOUTS_3D['3A'];
                if(winAmount > 0) newEntries.push({ id: Date.now() + 'a', number: winningNumber, mode, position, sides: sides.sort(), positionLabel: PRIZE_LABELS_CHINESE[position], betType: '3A', betAmount: aAmt, winAmount, playType });
            }
            if (abcAmt > 0 && ['1', '2', '3'].includes(position)) {
                let effectiveBet = abcAmt;
                if (playType === 'Box') effectiveBet = abcAmt / permutationCount;
                const winAmount = (effectiveBet / sideCount) * PAYOUTS_3D['3ABC'];
                if(winAmount > 0) newEntries.push({ id: Date.now() + 'abc', number: winningNumber, mode, position, sides: sides.sort(), positionLabel: PRIZE_LABELS_CHINESE[position], betType: '3ABC', betAmount: abcAmt, winAmount, playType });
            }
        }

        if (newEntries.length > 0) {
            setEntries(prev => [...newEntries, ...prev]);
            setWinningNumber('');
            setBetBig(''); setBetSmall(''); setBetA(''); setBetABC('');
        }
    };

    const handleDeleteEntry = (id: string) => {
        setEntries(prev => prev.filter(entry => entry.id !== id));
    };

    const handleResetForm = () => {
        setWinningNumber('');
        setBetBig(''); setBetSmall(''); setBetA(''); setBetABC('');
        setSides([]);
        setPlayType('Straight');
    };
    
    const handleClearAll = () => {
        setEntries([]);
        setSelectedClientId('');
    };

    const totalWinnings = useMemo(() => entries.reduce((acc, curr) => acc + curr.winAmount, 0), [entries]);
    
    const handleSaveToLedger = async () => {
        if (!selectedClientId || entries.length === 0 || !selectedDate) return;
        setIsSaving(true);

        const [yStr, mStr, dStr] = selectedDate.split('-');
        const dateLabel = `${dStr}/${mStr}`;

        const description = entries
            .map(e => {
                const typeStr = e.playType === 'Box' ? 'iBox' : e.playType === 'Pau' ? '包' : '';
                const exactWinStr = e.winAmount.toFixed(2);
                return `${e.sides.join('')} ${e.number}-${e.betAmount}-${exactWinStr} ${e.positionLabel} ${typeStr}`.trim();
            })
            .join('; ');

        const finalDescription = `${dateLabel} Winnings: ${description}`;

        await saveLedgerRecord({
            clientId: selectedClientId,
            date: selectedDate,
            description: finalDescription,
            typeLabel: '中',
            amount: totalWinnings,
            operation: 'subtract', 
            column: 'col1',
            isVisible: true
        });

        await saveLedgerRecord({
            clientId: selectedClientId,
            date: selectedDate,
            description: '', 
            typeLabel: '中',
            amount: totalWinnings,
            operation: 'subtract', 
            column: 'main',
            isVisible: true
        });

        setClientWinnings((prev) => {
            const record = prev as Record<string, string>;
            const raw = record[selectedClientId];
            const currentVal = parseFloat(raw || '0') || 0;
            return { ...record, [selectedClientId]: (currentVal + totalWinnings).toString() };
        });

        setIsSaving(false);
        setShowSuccess(true);
        
        setTimeout(() => {
            navigate(`/clients/${selectedClientId}`, { state: navState });
        }, 800);
        
        handleClearAll();
    };

    const handleListInputChange = useCallback((clientId: string, val: string) => {
        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
            setClientWinnings((prev) => ({ ...prev, [clientId]: val }));
        }
    }, []);

    const handleListInputBlur = useCallback(async (clientId: string) => {
        setClientWinnings((current) => {
            const typedCurrent = current as Record<string, string>;
            const newVal = parseFloat(typedCurrent[clientId]) || 0;
            
            (async () => {
                const d = new Date(selectedDate);
                const weeks = getWeeksForMonth(d.getFullYear(), d.getMonth());
                const targetStr = selectedDate;
                const weekDays = Object.values(weeks).find(days => 
                    days.some(day => `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}` === targetStr)
                );
                
                if (weekDays) {
                    const start = weekDays[0];
                    const end = weekDays[weekDays.length - 1];
                    const sStr = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
                    const eStr = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
                    
                    const dbData = await getWinningsByDateRange(sStr, eStr);
                    const oldVal = dbData[clientId] || 0;
                    
                    if (newVal !== oldVal) {
                        const diff = newVal - oldVal;
                        // To INCREASE winning (red number), we need 'subtract' op.
                        // To DECREASE winning, we need 'add' op.
                        const op = diff > 0 ? 'subtract' : 'add'; 
                        
                        await saveLedgerRecord({
                            clientId,
                            date: selectedDate,
                            description: 'Weekly Win Adjustment',
                            typeLabel: '中',
                            amount: Math.abs(diff),
                            operation: op, 
                            column: 'main', // Save to MAIN ledger
                            isVisible: true
                        });
                    }
                }
            })();

            return typedCurrent;
        });
    }, [selectedDate]);

    const weekLabel = useMemo(() => {
        const d = new Date(selectedDate);
        const weeks = getWeeksForMonth(d.getFullYear(), d.getMonth());
        const dateStr = selectedDate;
        const foundDays = Object.values(weeks).find(days => 
            days.some(day => `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}` === dateStr)
        );
        if (foundDays) return getWeekRangeString(null, null, foundDays);
        return selectedDate;
    }, [selectedDate]);

    const navState = useMemo(() => {
        const d = new Date(selectedDate);
        const y = d.getFullYear();
        const m = d.getMonth();
        const weeks = getWeeksForMonth(y, m);
        const dateStr = selectedDate;
        let weekNum = 1;
        const foundWeek = Object.keys(weeks).find(w => weeks[parseInt(w)].some(day => 
            `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}` === dateStr
        ));
        if (foundWeek) weekNum = parseInt(foundWeek);
        return { year: y, month: m, week: weekNum };
    }, [selectedDate]);

    const midPoint = Math.ceil(clients.length / 2);
    const leftClients = clients.slice(0, midPoint);
    const rightClients = clients.slice(midPoint);

    const totalDailyWinnings: number = (Object.values(clientWinnings) as string[]).reduce((acc: number, val: string) => acc + (parseFloat(val) || 0), 0);

    return (
        <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <div className="bg-red-100 p-2 rounded-lg text-red-600"><Calendar size={24} /></div>
                    <div><h2 className="font-bold text-gray-800">Calculation Date</h2><p className="text-xs text-gray-500">Determines ledger entry date & summary week.</p></div>
                </div>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border-2 border-gray-300 rounded-lg px-4 py-2 font-bold text-gray-700 focus:border-blue-500 outline-none"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 xl:col-span-3">
                     <div className="flex items-center space-x-3 mb-6">
                        <div className="bg-gradient-to-r from-red-500 to-orange-600 p-3 rounded-xl shadow-lg text-white"><Calculator size={24} /></div>
                        <div><h1 className="text-2xl font-bold text-gray-800">Win Calculator</h1><p className="text-gray-500 text-xs">Calculate prize payouts.</p></div>
                    </div>
                    <form onSubmit={handleAddEntry} className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                        <div className="flex border-b border-gray-100">
                            <button type="button" onClick={() => { setMode('4D'); handleResetForm(); }} className={`flex-1 py-3 text-center font-bold transition-colors ${mode === '4D' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>4D</button>
                            <button type="button" onClick={() => { setMode('3D'); handleResetForm(); }} className={`flex-1 py-3 text-center font-bold transition-colors ${mode === '3D' ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>3D</button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                {['Straight', 'Box', 'Pau'].map((type) => (
                                    <button key={type} type="button" onClick={() => setPlayType(type as BetType)} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${playType === type ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
                                        {type === 'Box' ? 'iBox' : type === 'Pau' ? '包 (Pau)' : 'Straight'}
                                    </button>
                                ))}
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Sides</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['K', 'M', 'T'].map(side => (
                                        <button type="button" key={side} onClick={() => handleSideToggle(side)} className={`py-2 rounded-lg border-2 font-bold transition-all text-sm ${sides.includes(side) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white'}`}>{side}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Number</label>
                                <input type="text" value={winningNumber} onChange={(e) => setWinningNumber(e.target.value.replace(/\D/g,'').slice(0, mode === '4D' ? 4 : 3))} className="w-full text-center text-3xl font-mono tracking-widest font-bold border-2 border-gray-200 rounded-xl py-2 focus:outline-none focus:border-blue-500 transition-all" placeholder={mode === '4D' ? '8888' : '888'} required />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Position</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['1', '2', '3'].map(p => (
                                        <button key={p} type="button" onClick={() => setPosition(p as PrizePosition)} className={`py-2 rounded-lg border-2 font-bold text-xs ${position === p ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200'}`}>{PRIZE_LABELS_CHINESE[p as PrizePosition]}</button>
                                    ))}
                                    {mode === '4D' && ['S', 'C'].map(p => (
                                        <button key={p} type="button" onClick={() => setPosition(p as PrizePosition)} className={`py-2 rounded-lg border-2 font-bold text-xs ${position === p ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>{PRIZE_LABELS_CHINESE[p as PrizePosition]}</button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {mode === '4D' ? <>
                                    <div><label className="block text-[10px] font-bold text-gray-500 mb-1">Big (大)</label><input type="number" value={betBig} onChange={(e) => setBetBig(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg font-mono" placeholder="0" /></div>
                                    <div><label className={`block text-[10px] font-bold mb-1 ${['S','C'].includes(position) ? 'text-gray-300' : 'text-gray-500'}`}>Small (小)</label><input type="number" value={betSmall} onChange={(e) => setBetSmall(e.target.value)} disabled={['S','C'].includes(position)} className="w-full p-2 border border-gray-300 rounded-lg font-mono disabled:bg-gray-50" placeholder="0" /></div>
                                </> : <>
                                    <div><label className={`block text-[10px] font-bold mb-1 ${position !== '1' ? 'text-gray-300' : 'text-gray-500'}`}>3A</label><input type="number" value={betA} onChange={(e) => setBetA(e.target.value)} disabled={position !== '1'} className="w-full p-2 border border-gray-300 rounded-lg font-mono disabled:bg-gray-50" placeholder="0" /></div>
                                    <div><label className="block text-[10px] font-bold text-gray-500 mb-1">3ABC</label><input type="number" value={betABC} onChange={(e) => setBetABC(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg font-mono" placeholder="0" /></div>
                                </>}
                            </div>
                            <button type="submit" className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition-colors"><Plus size={18} className="mr-2" /> Add Entry</button>
                        </div>
                    </form>
                </div>

                <div className="lg:col-span-8 xl:col-span-9 flex flex-col h-full">
                    <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Current Calculation</h2>
                            <div className="text-right">
                                <span className="text-sm text-gray-400 font-bold uppercase tracking-wider">Total Payout</span>
                                <div className="text-3xl font-mono font-bold text-red-600">${totalWinnings.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100 min-h-[200px]">
                            {entries.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400"><Trophy size={48} className="mb-2 opacity-20" /><p>No entries added.</p></div>
                            ) : (
                                <div className="space-y-2">
                                    {entries.map(entry => (
                                        <div key={entry.id} className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm">
                                            <div className="flex items-center space-x-4">
                                                <div className="bg-yellow-100 text-yellow-800 font-bold px-2 py-1 rounded text-xs">{entry.positionLabel}</div>
                                                <div className="font-mono text-lg font-bold text-gray-800">{entry.number}</div>
                                                <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{entry.sides.join('')}</div>
                                                <div className="text-xs text-gray-400">Bet: ${entry.betAmount} {entry.playType !== 'Straight' ? `(${entry.playType === 'Box' ? 'iBox' : 'Pau'})` : ''}</div>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <span className="font-mono font-bold text-red-600">+ ${entry.winAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                <button onClick={() => handleDeleteEntry(entry.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {entries.length > 0 && (
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in slide-in-from-bottom-2">
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1 w-full">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Client Account</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                            <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm font-medium appearance-none">
                                                <option value="">-- Select Client --</option>
                                                {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <button onClick={handleSaveToLedger} disabled={!selectedClientId || isSaving} className="w-full md:w-auto px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md flex items-center justify-center disabled:opacity-50">
                                        {isSaving ? 'Saving...' : <><Save size={18} className="mr-2" /> Save & Redirect</>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center"><Layers size={20} className="mr-2 text-blue-500" />Weekly Winnings Summary</h2>
                        <div className="flex items-center mt-2"><p className="text-sm text-gray-500">Showing total winnings for week: <strong>{weekLabel}</strong></p></div>
                    </div>
                    <div className="text-right"><div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Weekly Total Payout</div><div className="text-2xl font-mono font-bold text-red-600">${totalDailyWinnings.toLocaleString('en-US', {minimumFractionDigits: 2})}</div></div>
                </div>
                {loadingList ? (
                    <div className="p-12 text-center text-gray-400">Loading weekly data...</div>
                ) : (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-0">
                        <div className="flex flex-col">
                            {leftClients.map(c => (
                                <ClientWinInputRow key={c.id} client={c} value={clientWinnings[c.id] || ''} onChange={handleListInputChange} onBlur={handleListInputBlur} navState={navState} />
                            ))}
                        </div>
                        <div className="flex flex-col border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-12">
                            {rightClients.map(c => (
                                <ClientWinInputRow key={c.id} client={c} value={clientWinnings[c.id] || ''} onChange={handleListInputChange} onBlur={handleListInputBlur} navState={navState} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {showSuccess && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-white px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3"><CheckCircle size={28} className="text-green-600" /></div>
                        <h3 className="text-lg font-bold text-gray-800">Saved!</h3>
                        <p className="text-sm text-gray-500 mt-1">Redirecting to ledger...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WinCalculator;
