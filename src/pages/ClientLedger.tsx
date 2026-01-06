
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Printer, 
  Trash2, 
  Plus, 
  Minus, 
  Pencil, 
  X, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  Zap,
  MoreVertical,
  Calendar as CalendarIcon,
  LayoutTemplate
} from 'lucide-react';
import { 
  getClients, 
  getLedgerRecords, 
  saveLedgerRecord, 
  deleteLedgerRecord, 
  updateLedgerRecord,
  getCategories,
  getNetAmount,
  fetchClientTotalBalance
} from '../services/storageService';
import { Client, LedgerRecord, TransactionCategory } from '../types';
import { useGlobalState } from '../context/GlobalStateContext';
import { getWeeksForMonth, getWeekRangeString, MONTH_NAMES } from '../utils/reportUtils';

// --- Type Definitions ---
type LedgerColumn = 'main' | 'col1' | 'col2';

// --- Helper Components ---

const WinningTicket: React.FC<{ description: string }> = ({ description }) => {
    // Basic structured parser logic (matching logic in other files)
    const parse = (text: string) => {
        const lines = text.split(/;\s*/).filter(Boolean);
        return lines.map(line => {
            const parts = line.split('-').map(p => p.trim());
            return { raw: line, parts };
        });
    };
    
    const tickets = parse(description);

    return (
        <div className="flex flex-col gap-1 w-full text-xs font-mono bg-yellow-50 border border-yellow-200 rounded p-1.5 mt-1">
            {tickets.map((t, i) => (
                <div key={i} className="flex justify-between items-center border-b border-yellow-100 last:border-0 pb-0.5 mb-0.5 last:mb-0 last:pb-0">
                    <span className="font-bold text-gray-800">{t.raw}</span>
                </div>
            ))}
        </div>
    );
};

const ClientLedger: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentDate, setCurrentDate } = useGlobalState();
  const [client, setClient] = useState<Client | null>(null);
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [totalOwed, setTotalOwed] = useState(0);
  const [activeColumn, setActiveColumn] = useState<LedgerColumn>('main'); // For mobile tab view
  
  // Input State
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Date Logic
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const weeksData = useMemo(() => getWeeksForMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  const sortedWeekKeys = Object.keys(weeksData).map(Number).sort((a,b) => a-b);
  
  const selectedWeekNum = useMemo(() => {
      const todayStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;
      const foundWeek = Object.keys(weeksData).find(w => {
          return weeksData[parseInt(w)].some(d => {
              const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              return dStr === todayStr;
          });
      });
      return foundWeek ? parseInt(foundWeek) : 1;
  }, [weeksData, currentDate, currentYear, currentMonth]);

  useEffect(() => {
    if (id) {
      getClients().then(clients => setClient(clients.find(c => c.id === id) || null));
      loadRecords();
      setCategories(getCategories());
    }
  }, [id]);

  const loadRecords = async () => {
    if (id) {
      const recs = await getLedgerRecords(id);
      setRecords(recs);
      fetchClientTotalBalance(id).then(setTotalOwed);
    }
  };

  const filteredRecords = useMemo(() => {
      const days = weeksData[selectedWeekNum];
      if (!days || days.length === 0) return [];
      const start = days[0];
      const end = days[days.length - 1];
      const startStr = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
      const endStr = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`;
      return records.filter(r => r.date >= startStr && r.date <= endStr);
  }, [records, weeksData, selectedWeekNum]);

  // --- Core Calculation Logic (Preserves V1 Z21/C19 Rules) ---
  const calculateColumn = (columnKey: LedgerColumn) => {
      const colRecords = filteredRecords.filter(r => r.column === columnKey);
      const clientCode = client?.code?.toUpperCase();
      const isSpecialClient = clientCode === 'Z21' || clientCode === 'C19';

      const processed = colRecords.map(r => {
          const netChange = getNetAmount(r);
          // V1 Logic Ported: Exclude calculation for Quick Entries in Panel 1 for special clients
          const isCalculationExcluded = isSpecialClient && columnKey === 'col1' && r.typeLabel === '';
          return { ...r, netChange, isCalculationExcluded };
      });
      
      const visibleProcessed = processed.filter(r => r.isVisible);
      const finalBalance = visibleProcessed.reduce((acc, curr) => {
          if (curr.isCalculationExcluded) return acc;
          return acc + curr.netChange;
      }, 0);
      return { processed, finalBalance };
  };

  const mainLedger = useMemo(() => calculateColumn('main'), [filteredRecords, client]);
  const col1Ledger = useMemo(() => calculateColumn('col1'), [filteredRecords, client]);
  const col2Ledger = useMemo(() => calculateColumn('col2'), [filteredRecords, client]);

  // --- Handlers ---
  const handleQuickSubmit = async (category: TransactionCategory | null, forcedColumn?: LedgerColumn) => {
      if (!amount) return;
      const val = parseFloat(amount);
      if (isNaN(val)) return;

      const targetColumn = forcedColumn || activeColumn;
      let label = category ? category.label : '';
      let operation = category ? category.operation : 'add';
      
      // Panel 1 Special Logic
      if (targetColumn === 'col1' && label === '') {
          operation = 'none'; // Default to Note for Quick Entry in Panel 1
      }

      const entryDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;
      
      await saveLedgerRecord({
          clientId: id!,
          date: entryDate,
          description,
          typeLabel: label,
          amount: val,
          operation,
          column: targetColumn,
          isVisible: true
      });
      
      setAmount('');
      setDescription('');
      loadRecords();
      if (amountInputRef.current) amountInputRef.current.focus();
  };

  const handleDelete = async (rId: string) => {
      if(window.confirm('Delete transaction?')) {
          await deleteLedgerRecord(rId);
          loadRecords();
      }
  };

  const handleWeekSelect = (weekNum: number) => {
      const days = weeksData[weekNum];
      if (days && days.length > 0) setCurrentDate(new Date(days[0]));
  };

  const nextMonth = () => {
      const newDate = new Date(currentDate);
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() + 1);
      setCurrentDate(newDate);
  };

  const prevMonth = () => {
      const newDate = new Date(currentDate);
      newDate.setDate(1);
      newDate.setMonth(newDate.getMonth() - 1);
      setCurrentDate(newDate);
  };

  // --- Components ---

  const TransactionCard = ({ record, index }: { record: any, index: number }) => {
      const isWinning = record.typeLabel === '中';
      const clientCode = client?.code?.toUpperCase();
      
      let amountClass = 'text-gray-600';
      if (record.isCalculationExcluded) {
          if (clientCode === 'C19') amountClass = 'text-gray-900 font-black';
          else if (clientCode === 'Z21') amountClass = index === 0 ? 'text-gray-400' : 'text-gray-900 font-black';
          else amountClass = 'text-gray-400';
      } else if (record.operation === 'add') amountClass = 'text-emerald-600 font-bold';
      else if (record.operation === 'subtract') amountClass = 'text-rose-600 font-bold';

      return (
          <div className="group relative bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-all mb-2">
              <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                          {record.typeLabel && (
                              <span className={`text-xs font-black uppercase px-2 py-0.5 rounded ${isWinning ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}>
                                  {record.typeLabel}
                              </span>
                          )}
                          <span className="text-[10px] text-gray-400 font-mono">{record.date.slice(5)}</span>
                      </div>
                      {isWinning ? (
                          <WinningTicket description={record.description} />
                      ) : (
                          <div className="text-sm text-gray-700 font-medium mt-1 truncate">{record.description || '-'}</div>
                      )}
                  </div>
                  <div className="text-right">
                      <div className={`text-lg font-mono tracking-tight ${amountClass}`}>
                          {record.isCalculationExcluded || record.operation === 'none' 
                              ? record.amount.toLocaleString(undefined, {minimumFractionDigits: 2})
                              : Math.abs(record.netChange).toLocaleString(undefined, {minimumFractionDigits: 2})}
                      </div>
                      <button onClick={() => handleDelete(record.id)} className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 p-1 text-gray-300 hover:text-red-500 transition-opacity">
                          <X size={12} />
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  const LedgerColumnPanel = ({ title, data, type }: { title: string, data: ReturnType<typeof calculateColumn>, type: LedgerColumn }) => (
      <div className={`flex flex-col h-full bg-gray-50 rounded-xl border border-gray-200 overflow-hidden ${activeColumn === type ? 'block' : 'hidden lg:flex'}`}>
          <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10 shadow-sm">
              <span className="font-bold text-gray-500 uppercase text-xs tracking-widest">{title}</span>
              <div className={`text-xl font-black font-mono ${data.finalBalance >= 0 ? 'text-gray-900' : 'text-rose-600'}`}>
                  {data.finalBalance < 0 ? `(${Math.abs(data.finalBalance).toLocaleString()})` : data.finalBalance.toLocaleString()}
              </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              {data.processed.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-300 text-sm italic">
                      No transactions
                  </div>
              ) : (
                  data.processed.map((r, idx) => <TransactionCard key={r.id} record={r} index={idx} />)
              )}
          </div>
      </div>
  );

  if (!client) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div></div>;

  return (
    <div className="bg-gray-100 min-h-screen flex flex-col font-sans">
      {/* 1. Pro Header */}
      <header className="bg-slate-900 text-white shadow-lg z-30 sticky top-0">
          <div className="max-w-[1920px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-4">
                  <Link to="/clients" className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-300 hover:text-white">
                      <ArrowLeft size={20} />
                  </Link>
                  <div className="flex flex-col">
                      <h1 className="text-lg font-bold leading-tight flex items-center gap-2">
                          {client.name}
                          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300 font-mono">{client.code}</span>
                      </h1>
                      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider flex items-center gap-2">
                          <span>Total Balance:</span>
                          <span className={`${totalOwed >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold font-mono text-sm`}>
                              ${Math.abs(totalOwed).toLocaleString()}
                          </span>
                      </div>
                  </div>
              </div>

              <div className="flex items-center gap-3">
                  <div className="hidden md:flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
                      <button onClick={prevMonth} className="p-1 hover:bg-slate-700 rounded text-slate-400"><ChevronLeft size={16}/></button>
                      <span className="text-xs font-bold px-3 text-slate-200 w-24 text-center">{MONTH_NAMES[currentMonth].slice(0,3)} {currentYear}</span>
                      <button onClick={nextMonth} className="p-1 hover:bg-slate-700 rounded text-slate-400"><ChevronRight size={16}/></button>
                  </div>
                  <button onClick={() => navigate(`/clients/${id}`)} className="hidden md:flex items-center text-xs font-bold text-slate-400 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors">
                      <LayoutTemplate size={14} className="mr-2" /> Back to Default
                  </button>
                  <button onClick={() => window.print()} className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white shadow-lg transition-colors">
                      <Printer size={18} />
                  </button>
              </div>
          </div>
          
          {/* Week Scroller */}
          <div className="bg-slate-800 border-t border-slate-700 px-4 md:px-6 py-2 overflow-x-auto no-scrollbar">
              <div className="flex gap-2">
                  {sortedWeekKeys.map(wk => {
                      const isActive = wk === selectedWeekNum;
                      return (
                          <button 
                              key={wk} 
                              onClick={() => handleWeekSelect(wk)}
                              className={`
                                  px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all
                                  ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}
                              `}
                          >
                              Week {Object.keys(weeksData).indexOf(String(wk)) + 1}
                          </button>
                      )
                  })}
              </div>
          </div>
      </header>

      {/* 2. Command Bar (Input) */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm z-20">
          <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 w-full md:w-auto flex items-center gap-2">
                  <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                      <input 
                          ref={amountInputRef}
                          type="number" 
                          step="0.01" 
                          value={amount} 
                          onChange={(e) => setAmount(e.target.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && handleQuickSubmit(null)}
                          className="w-full pl-7 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-gray-900"
                          placeholder="0.00"
                      />
                  </div>
                  <input 
                      type="text" 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleQuickSubmit(null)}
                      className="flex-[2] py-2 px-4 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      placeholder="Note / Description..."
                  />
              </div>
              
              <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                  <button onClick={() => handleQuickSubmit({ label: '', operation: 'add', id: 'q', color: '' }, 'col1')} className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm text-sm font-bold whitespace-nowrap transition-colors active:scale-95">
                      <Zap size={14} className="mr-1.5" /> P1 Quick
                  </button>
                  
                  {/* Common Categories as Chips */}
                  {categories.slice(0,4).map(cat => (
                      <button 
                          key={cat.id} 
                          onClick={() => handleQuickSubmit(cat)}
                          className={`px-3 py-2 border rounded-lg text-xs font-bold uppercase transition-all whitespace-nowrap hover:shadow-sm active:scale-95 ${cat.color} border-gray-200`}
                      >
                          {cat.label}
                      </button>
                  ))}
                  
                  {/* More Menu Placeholder */}
                  <button className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50">
                      <MoreVertical size={16} />
                  </button>
              </div>
          </div>
      </div>

      {/* 3. Main Dashboard Grid */}
      <main className="flex-1 p-4 md:p-6 overflow-hidden">
          <div className="max-w-[1920px] mx-auto h-full flex flex-col">
              
              {/* Mobile Tab Switcher */}
              <div className="lg:hidden flex bg-white p-1 rounded-xl shadow-sm mb-4 border border-gray-200">
                  {(['col1', 'col2', 'main'] as LedgerColumn[]).map(col => (
                      <button
                          key={col}
                          onClick={() => setActiveColumn(col)}
                          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${activeColumn === col ? 'bg-slate-800 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                          {col === 'main' ? 'Main' : col === 'col1' ? 'Panel 1' : 'Panel 2'}
                      </button>
                  ))}
              </div>

              {/* Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-[500px]">
                  <LedgerColumnPanel title="Panel 1" data={col1Ledger} type="col1" />
                  <LedgerColumnPanel title="Panel 2" data={col2Ledger} type="col2" />
                  <LedgerColumnPanel title="Main Ledger" data={mainLedger} type="main" />
              </div>
          </div>
      </main>
    </div>
  );
};

export default ClientLedger;
