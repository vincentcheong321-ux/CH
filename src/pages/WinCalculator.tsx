
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Trophy, RotateCcw, Plus, Trash2, Save, User, CheckCircle } from 'lucide-react';
import { getClients, saveLedgerRecord } from '../services/storageService';
import { Client } from '../types';

type GameMode = '4D' | '3D';
type PrizePosition = '1' | '2' | '3' | 'S' | 'C';

interface WinningEntry {
  id: string;
  number: string;
  mode: GameMode;
  position: PrizePosition;
  positionLabel: string; // Chinese char
  sides: string[]; // ['M', 'K', 'T']
  betType: 'Big' | 'Small' | '3A' | '3ABC';
  betAmount: number;
  winAmount: number;
}

const PAYOUTS_4D = {
    BIG: { '1': 2750, '2': 1100, '3': 550, 'S': 220, 'C': 66 },
    SMALL: { '1': 3850, '2': 2200, '3': 1100, 'S': 0, 'C': 0 }
};

const PAYOUTS_3D = { '3A': 720, '3ABC': 240 };

const PRIZE_LABELS_CHINESE: Record<PrizePosition, string> = {
    '1': '头', '2': '二', '3': '三', 'S': '入', 'C': '安'
};

const WinCalculator: React.FC = () => {
    const navigate = useNavigate();
    
    // Form State
    const [mode, setMode] = useState<GameMode>('4D');
    const [winningNumber, setWinningNumber] = useState('');
    const [position, setPosition] = useState<PrizePosition>('1');
    const [sides, setSides] = useState<string[]>([]);
    const [betBig, setBetBig] = useState('');
    const [betSmall, setBetSmall] = useState('');
    const [betA, setBetA] = useState('');
    const [betABC, setBetABC] = useState('');

    const [entries, setEntries] = useState<WinningEntry[]>([]);
    
    // Client selection
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        const fetchClients = async () => {
            const clientList = await getClients();
            setClients(clientList);
        };
        fetchClients();
    }, []);

    // FIX: Corrected variable 's' to 'side' in the array spread.
    const handleSideToggle = (side: string) => {
        setSides(prev => 
            prev.includes(side) ? prev.filter(s => s !== side) : [...prev, side].sort()
        );
    };

    const handleAddEntry = (e: React.FormEvent) => {
        e.preventDefault();
        if (!winningNumber || sides.length === 0) return;

        const newEntries: WinningEntry[] = [];
        
        if (mode === '4D') {
            const bigAmt = parseFloat(betBig) || 0;
            const smallAmt = parseFloat(betSmall) || 0;

            if (bigAmt > 0) {
                const winAmount = bigAmt * PAYOUTS_4D.BIG[position];
                if (winAmount > 0) {
                    newEntries.push({
                        id: Date.now() + 'b', number: winningNumber, mode, position, sides,
                        positionLabel: PRIZE_LABELS_CHINESE[position], betType: 'Big',
                        betAmount: bigAmt, winAmount
                    });
                }
            }
            if (smallAmt > 0) {
                const winAmount = smallAmt * PAYOUTS_4D.SMALL[position];
                if (winAmount > 0) {
                    newEntries.push({
                        id: Date.now() + 's', number: winningNumber, mode, position, sides,
                        positionLabel: PRIZE_LABELS_CHINESE[position], betType: 'Small',
                        betAmount: smallAmt, winAmount
                    });
                }
            }
        } else { // 3D mode
            const aAmt = parseFloat(betA) || 0;
            const abcAmt = parseFloat(betABC) || 0;

            if (aAmt > 0 && position === '1') {
                const winAmount = aAmt * PAYOUTS_3D['3A'];
                if(winAmount > 0) {
                    newEntries.push({
                        id: Date.now() + 'a', number: winningNumber, mode, position, sides,
                        positionLabel: PRIZE_LABELS_CHINESE[position], betType: '3A',
                        betAmount: aAmt, winAmount
                    });
                }
            }
            if (abcAmt > 0 && ['1', '2', '3'].includes(position)) {
                const winAmount = abcAmt * PAYOUTS_3D['3ABC'];
                if(winAmount > 0) {
                     newEntries.push({
                        id: Date.now() + 'abc', number: winningNumber, mode, position, sides,
                        positionLabel: PRIZE_LABELS_CHINESE[position], betType: '3ABC',
                        betAmount: abcAmt, winAmount
                    });
                }
            }
        }

        if (newEntries.length > 0) {
            setEntries(prev => [...newEntries, ...prev]);
            handleResetForm();
        }
    };

    const handleDeleteEntry = (id: string) => {
        setEntries(prev => prev.filter(entry => entry.id !== id));
    };

    const handleResetForm = () => {
        setWinningNumber('');
        setBetBig('');
        setBetSmall('');
        setBetA('');
        setBetABC('');
        setSides([]);
    };
    
    const handleClearAll = () => {
        setEntries([]);
        setSelectedClientId('');
    };

    const totalWinnings = useMemo(() => entries.reduce((acc, curr) => acc + curr.winAmount, 0), [entries]);
    
    const handleSaveToLedger = async () => {
        if (!selectedClientId || entries.length === 0) return;
        
        setIsSaving(true);
        const description = entries
            .map(e => `${e.sides.join('')} ${e.number}-${e.betAmount}-${e.winAmount.toFixed(0)} ${e.positionLabel}`)
            .join('; ');

        await saveLedgerRecord({
            clientId: selectedClientId,
            date: new Date().toISOString().split('T')[0],
            description: `Winnings: ${description}`,
            typeLabel: '中',
            amount: totalWinnings,
            operation: 'subtract', // Company Payout is a subtraction from client's debt
            column: 'col1', // Save to Panel 1
            isVisible: true
        });

        setIsSaving(false);
        setShowSuccess(true);
        
        setTimeout(() => {
            setShowSuccess(false);
            navigate(`/clients/${selectedClientId}`);
        }, 1500);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Calculator Form */}
            <div className="lg:col-span-1">
                 <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 p-3 rounded-xl shadow-lg text-white">
                        <Calculator size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Prize Calculator</h1>
                        <p className="text-gray-500 text-sm">Add multiple winning entries.</p>
                    </div>
                </div>

                <form onSubmit={handleAddEntry} className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="flex border-b border-gray-100">
                        <button type="button" onClick={() => { setMode('4D'); handleResetForm(); }} className={`flex-1 py-3 text-center font-bold transition-colors ${mode === '4D' ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>4D</button>
                        <button type="button" onClick={() => { setMode('3D'); handleResetForm(); }} className={`flex-1 py-3 text-center font-bold transition-colors ${mode === '3D' ? 'bg-purple-600 text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>3D</button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Sides (M/K/T)</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['M', 'K', 'T'].map(side => (
                                    <button
                                        type="button" key={side} onClick={() => handleSideToggle(side)}
                                        className={`py-2 rounded-lg border-2 font-bold transition-all text-sm ${sides.includes(side) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white'}`}
                                    >
                                        {side}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Winning Number</label>
                            <input type="text" value={winningNumber} onChange={(e) => setWinningNumber(e.target.value.replace(/\D/g,'').slice(0, mode === '4D' ? 4 : 3))} className="w-full text-center text-3xl font-mono tracking-widest font-bold border-2 border-gray-200 rounded-xl py-2 focus:outline-none focus:border-blue-500 transition-all" placeholder={mode === '4D' ? '8888' : '888'} required />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Winning Position</label>
                            <div className="grid grid-cols-3 gap-2">
                                <button type="button" onClick={() => setPosition('1')} className={`py-2 rounded-lg border-2 font-bold transition-all text-xs ${position === '1' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 bg-white'}`}>{PRIZE_LABELS_CHINESE['1']}</button>
                                <button type="button" onClick={() => setPosition('2')} className={`py-2 rounded-lg border-2 font-bold transition-all text-xs ${position === '2' ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-white'}`}>{PRIZE_LABELS_CHINESE['2']}</button>
                                <button type="button" onClick={() => setPosition('3')} className={`py-2 rounded-lg border-2 font-bold transition-all text-xs ${position === '3' ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'}`}>{PRIZE_LABELS_CHINESE['3']}</button>
                                {mode === '4D' && <>
                                    <button type="button" onClick={() => setPosition('S')} className={`py-2 rounded-lg border-2 font-bold transition-all text-xs ${position === 'S' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>{PRIZE_LABELS_CHINESE['S']}</button>
                                    <button type="button" onClick={() => setPosition('C')} className={`col-span-2 py-2 rounded-lg border-2 font-bold transition-all text-xs ${position === 'C' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>{PRIZE_LABELS_CHINESE['C']}</button>
                                </>}
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            {mode === '4D' ? <>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Big (大)</label>
                                    <input type="number" value={betBig} onChange={(e) => setBetBig(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg font-mono" placeholder="0" />
                                </div>
                                <div>
                                    <label className={`block text-xs font-bold mb-1 ${['S','C'].includes(position) ? 'text-gray-400' : 'text-gray-700'}`}>Small (小)</label>
                                    <input type="number" value={betSmall} onChange={(e) => setBetSmall(e.target.value)} disabled={['S','C'].includes(position)} className="w-full p-2 border border-gray-300 rounded-lg font-mono disabled:bg-gray-100" placeholder="0" />
                                </div>
                            </> : <>
                                <div>
                                    <label className={`block text-xs font-bold mb-1 ${position !== '1' ? 'text-gray-400' : 'text-gray-700'}`}>3A</label>
                                    <input type="number" value={betA} onChange={(e) => setBetA(e.target.value)} disabled={position !== '1'} className="w-full p-2 border border-gray-300 rounded-lg font-mono disabled:bg-gray-100" placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">3ABC</label>
                                    <input type="number" value={betABC} onChange={(e) => setBetABC(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg font-mono" placeholder="0" />
                                </div>
                            </>}
                        </div>

                        <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors">
                            <Plus size={20} className="mr-2" /> Add to List
                        </button>
                    </div>
                </form>
            </div>

            {/* Right Column: List and Save */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Winning Entries ({entries.length})</h2>
                    {entries.length === 0 ? (
                        <div className="text-center text-gray-400 py-12">No winnings added yet.</div>
                    ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                            {entries.map(entry => (
                                <div key={entry.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between animate-in fade-in">
                                    <div className="flex items-center space-x-4">
                                        <span className="font-mono font-bold text-lg text-blue-600 bg-white px-2 py-1 rounded border border-gray-200">{entry.number}</span>
                                        <div>
                                            <p className="font-semibold text-gray-800">
                                                <span className="font-bold text-indigo-600">{entry.sides.join('')}</span> - {entry.positionLabel}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Bet on <span className="font-bold">{entry.betType}</span>: ${entry.betAmount}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <span className="font-mono font-bold text-green-600 text-lg">${entry.winAmount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                                        <button onClick={() => handleDeleteEntry(entry.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className={`rounded-2xl p-6 text-center text-white shadow-lg transition-all transform ${totalWinnings > 0 ? 'bg-gradient-to-br from-green-500 to-emerald-700' : 'bg-gray-800'}`}>
                    <h2 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">Total to Pay Out</h2>
                    <div className="flex items-center justify-center text-5xl font-bold font-mono"><span className="text-2xl mr-1 self-start mt-2">$</span>{totalWinnings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                </div>

                {entries.length > 0 && (
                     <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 animate-in fade-in space-y-4">
                        <h3 className="font-bold text-lg text-gray-800">Save to Client Ledger</h3>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                                <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">-- Select a Client --</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                                </select>
                            </div>
                            <button onClick={handleSaveToLedger} disabled={!selectedClientId || isSaving} className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg shadow-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center">
                                <Save size={18} className="mr-2"/> {isSaving ? 'Saving...' : 'Save Winnings'}
                            </button>
                        </div>
                        <button onClick={handleClearAll} className="w-full py-2 text-gray-500 hover:bg-gray-100 rounded-lg flex items-center justify-center font-semibold transition-colors mt-4">
                            <RotateCcw size={16} className="mr-2" /> Clear All
                        </button>
                     </div>
                )}
            </div>
            
            {showSuccess && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center">
                        <CheckCircle size={48} className="text-green-500 mb-4"/>
                        <h2 className="text-xl font-bold text-gray-800">Saved Successfully!</h2>
                        <p className="text-gray-500 mt-2">Redirecting to client's ledger...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WinCalculator;
