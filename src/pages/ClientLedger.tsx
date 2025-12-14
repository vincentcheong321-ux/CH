
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Trash2, Plus, Minus, Pencil, X, Check, AlertTriangle, ExternalLink, GripHorizontal, Hash, Zap, Download, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
// @ts-ignore
import html2canvas from 'html2canvas';
import { 
  getClients, 
  getLedgerRecords, 
  saveLedgerRecord, 
  deleteLedgerRecord, 
  updateLedgerRecord,
  getCategories,
  saveCategory,
  deleteCategory,
  saveCategoriesOrder,
  getNetAmount
} from '../services/storageService';
import { Client, LedgerRecord, TransactionCategory } from '../types';
import { MONTH_NAMES, getWeeksForMonth } from '../utils/reportUtils';

type LedgerColumn = 'main' | 'col1' | 'col2';

const ClientLedger: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [allRecords, setAllRecords] = useState<LedgerRecord[]>([]); // Store ALL records
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  
  // Date/Week State
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);

  // Input State
  const [activeCategory, setActiveCategory] = useState<TransactionCategory | null>(null);
  const [activeColumn, setActiveColumn] = useState<LedgerColumn>('main');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  
  const [currentOperation, setCurrentOperation] = useState<'add'|'subtract'|'none'>('add');
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Modal & Edit State
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatOp, setNewCatOp] = useState<'add'|'subtract'|'none'>('subtract');
  const [editingRecord, setEditingRecord] = useState<LedgerRecord | null>(null);

  // Layout State
  const [draggedCatIndex, setDraggedCatIndex] = useState<number | null>(null);
  const [colWidths, setColWidths] = useState<number[]>([33.33, 33.33, 33.34]);
  const [verticalPadding, setVerticalPadding] = useState<{top: number, bottom: number}>({ top: 40, bottom: 40 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{ type: 'col'|'top'|'bottom', index?: number, startX?: number, startY?: number, startWidths?: number[], startHeight?: number, containerWidth?: number } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: string; targetId?: string; title: string; message: string; } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (id) {
        const clients = await getClients();
        const found = clients.find(c => c.id === id);
        setClient(found || null);
        loadRecords();
        setCategories(getCategories());
      }
    };
    fetchData();
    
    // Auto-select current week
    const now = new Date();
    let y = now.getFullYear();
    if(y < 2025) y = 2025;
    if(y > 2026) y = 2026;
    setCurrentYear(y);

    const m = now.getMonth();
    const weeks = getWeeksForMonth(y, m);
    const todayNum = now.getDate();
    const foundWeek = Object.keys(weeks).find(w => weeks[parseInt(w)].includes(todayNum));
    if(foundWeek) setSelectedWeekNum(parseInt(foundWeek));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadRecords = () => {
    if (id) {
      const recs = getLedgerRecords(id);
      recs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setAllRecords(recs);
    }
  };

  const weeksData = useMemo(() => getWeeksForMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  const activeDays = weeksData[selectedWeekNum] || [];
  
  const activeDateStrings = useMemo(() => 
      activeDays.map(d => {
        const dateObj = new Date(currentYear, currentMonth, d);
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }),
  [activeDays, currentYear, currentMonth]);

  const { weekRecords, weekTotal } = useMemo(() => {
    if (activeDateStrings.length === 0) return { weekRecords: [], openingBalance: 0, weekTotal: 0 };
    const current = [];
    for (const r of allRecords) {
        if (activeDateStrings.includes(r.date)) {
            current.push(r);
        }
    }
    const weekChange = current.reduce((acc, r) => acc + getNetAmount(r), 0);
    return { weekRecords: current, weekTotal: weekChange };
  }, [allRecords, activeDateStrings]);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragInfo.current) return;
    if (dragInfo.current.type === 'col' && dragInfo.current.startWidths && dragInfo.current.containerWidth && dragInfo.current.startX !== undefined && dragInfo.current.index !== undefined) {
        const { index, startX, startWidths, containerWidth } = dragInfo.current;
        const diffPercent = ((e.clientX - startX) / containerWidth) * 100;
        const newWidths = [...startWidths];
        if (newWidths[index] + diffPercent < 10 || newWidths[index + 1] - diffPercent < 10) return;
        newWidths[index] += diffPercent;
        newWidths[index + 1] -= diffPercent;
        setColWidths(newWidths);
    } else if (dragInfo.current.type === 'top' || dragInfo.current.type === 'bottom') {
         const { startY, startHeight } = dragInfo.current;
         if (startY === undefined || startHeight === undefined) return;
         const diffY = e.clientY - startY;
         setVerticalPadding(prev => ({ 
             ...prev, 
             [dragInfo.current!.type]: Math.max(0, startHeight + (dragInfo.current!.type === 'top' ? diffY : -diffY)) 
         }));
    }
  }, []);

  const onMouseUp = useCallback(() => {
      dragInfo.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
  }, [onMouseMove]);

  const startResize = (type: 'col'|'top'|'bottom', index: number | undefined, e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (!containerRef.current) return;
      dragInfo.current = {
          type, index,
          startX: e.clientX, startY: e.clientY,
          startWidths: [...colWidths], 
          startHeight: type === 'col' ? 0 : (type === 'top' ? verticalPadding.top : verticalPadding.bottom),
          containerWidth: containerRef.current.clientWidth
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = type === 'col' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
  };

  const handleCategorySelect = (cat: TransactionCategory) => {
    setActiveCategory(cat);
    setCurrentOperation(cat.operation);
    setAmount(''); setDescription(''); 
  };

  const handleQuickEntry = () => {
      setActiveCategory({ id: 'quick', label: '', operation: 'add', color: 'bg-blue-600 text-white' });
      setCurrentOperation(activeColumn === 'col1' ? 'none' : 'add');
      setAmount(''); setDescription(''); 
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !activeCategory || !amount) return;
    const val = parseFloat(amount);
    if (isNaN(val)) return;
    
    let dateToUse = new Date().toISOString().split('T')[0];
    const todayStr = dateToUse;
    if (activeDateStrings.length > 0 && !activeDateStrings.includes(todayStr)) {
        dateToUse = activeDateStrings[activeDateStrings.length - 1];
    }

    let op = activeCategory.label === '' ? currentOperation : activeCategory.operation;
    if (activeColumn === 'col1' && activeCategory.label === '') op = 'none';

    const newRecord: Omit<LedgerRecord, 'id'> = {
      clientId: id,
      date: dateToUse,
      description: description,
      typeLabel: activeCategory.label, 
      amount: val,
      operation: op,
      column: activeColumn,
      isVisible: isVisible
    };

    const saved = saveLedgerRecord(newRecord);
    setAllRecords(prev => [...prev, saved].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    
    if (activeCategory.label.trim() === '') {
        setAmount(''); setDescription(''); 
        setTimeout(() => amountInputRef.current?.focus(), 10);
    } else {
        setAmount(''); setDescription(''); setActiveCategory(null);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    let colorClass = 'bg-gray-100 text-gray-800';
    if (newCatOp === 'add') colorClass = 'bg-green-100 text-green-800';
    if (newCatOp === 'subtract') colorClass = 'bg-red-100 text-red-800';
    saveCategory({ label: newCatLabel, operation: newCatOp, color: colorClass });
    setCategories(getCategories());
    setIsAddCatModalOpen(false); setNewCatLabel('');
  };

  const handleConfirmAction = () => {
      if (!confirmModal) return;
      if (confirmModal.type === 'DELETE_RECORD' && confirmModal.targetId) {
          deleteLedgerRecord(confirmModal.targetId);
          setAllRecords(prev => prev.filter(r => r.id !== confirmModal.targetId));
      } else if (confirmModal.type === 'DELETE_CATEGORY' && confirmModal.targetId) {
          deleteCategory(confirmModal.targetId);
          setCategories(getCategories());
      }
      setConfirmModal(null);
  };

  const handleUpdateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      updateLedgerRecord(editingRecord.id, editingRecord);
      setAllRecords(prev => prev.map(r => r.id === editingRecord.id ? editingRecord : r));
      setEditingRecord(null);
    }
  };

  const requestDeleteRecord = (id: string) => setConfirmModal({isOpen:true, type:'DELETE_RECORD', targetId:id, title:'Delete', message:'Delete this record?'});

  const handlePrint = () => window.print();
  const handleDownloadImage = async () => {
      setIsDownloading(true);
      const element = document.getElementById('printable-area');
      if (element) {
          const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const link = document.createElement("a");
          link.href = canvas.toDataURL("image/png");
          link.download = `${client?.name}_${MONTH_NAMES[currentMonth]}_Week${selectedWeekNum}.png`;
          link.click();
      }
      setIsDownloading(false);
  };
  const openNewTab = () => window.open(window.location.href, '_blank');

  const calculateColumn = (columnKey: LedgerColumn) => {
      const colRecords = weekRecords.filter(r => r.column === columnKey);
      const processed = colRecords.map(r => ({ ...r, netChange: getNetAmount(r) }));
      const visibleProcessed = processed.filter(r => r.isVisible);
      const finalBalance = visibleProcessed.reduce((acc, curr) => acc + curr.netChange, 0);
      return { processed, finalBalance };
  };

  const mainLedger = useMemo(() => calculateColumn('main'), [weekRecords]);
  const col1Ledger = useMemo(() => calculateColumn('col1'), [weekRecords]);
  const col2Ledger = useMemo(() => calculateColumn('col2'), [weekRecords]);

  const LedgerColumnView = ({ data, footerLabel = "收" }: { data: ReturnType<typeof calculateColumn>, footerLabel?: string }) => {
      if (data.processed.length === 0) return <div className="flex-1 min-h-[50px]" />;

      const isNegative = data.finalBalance < 0;
      let displayLabel = footerLabel;
      if (isNegative && (footerLabel === '收' || footerLabel === '欠')) displayLabel = '补';
      
      return (
      <div className="flex flex-col items-center">
          <div className="flex flex-col w-fit items-end">
                {data.processed.map((r) => {
                    const isReflected = r.id.startsWith('sale_') || r.id.startsWith('adv_');
                    return (
                        <div key={r.id} className={`group flex justify-end items-center leading-none relative gap-1 md:gap-1.5 ${!r.isVisible ? 'opacity-30 grayscale no-print' : ''}`}>
                            {/* Disable Edit/Delete for Reflected Records */}
                            {!isReflected && (
                                <div className="no-print opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 absolute -left-16 z-10 bg-white shadow-sm rounded border border-gray-100 p-1">
                                    <button onClick={() => setEditingRecord(r)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Pencil size={12} /></button>
                                    <button onClick={() => requestDeleteRecord(r.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
                                </div>
                            )}
                            <div className="text-sm md:text-lg font-bold uppercase tracking-wide text-gray-700">{r.typeLabel}</div>
                            {r.description && <div className="text-xs md:text-sm text-gray-500 font-medium mr-1 md:mr-2 max-w-[80px] md:max-w-[120px] truncate">{r.description}</div>}
                            <div className={`text-base md:text-xl font-mono font-bold w-16 md:w-28 text-right ${r.operation === 'add' ? 'text-green-700' : r.operation === 'subtract' ? 'text-red-700' : 'text-gray-600'}`}>
                                {r.operation === 'none' ? r.amount.toLocaleString(undefined, {minimumFractionDigits: 2}) : Math.abs(r.netChange).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </div>
                        </div>
                    );
                })}
          </div>
          <div className="mt-1 pt-1 flex flex-col items-end w-fit border-t-2 border-gray-900">
                <div className="flex items-center gap-1 md:gap-2 justify-end">
                    <span className="text-sm md:text-lg font-bold text-gray-900 uppercase">{displayLabel}</span>
                    <span className={`text-lg md:text-2xl font-mono font-bold w-20 md:w-32 text-right ${data.finalBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {data.finalBalance < 0 ? `(${Math.abs(data.finalBalance).toLocaleString(undefined, {minimumFractionDigits: 2})})` : data.finalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                </div>
          </div>
      </div>
  )};

  const handlePrevMonth = () => {
      if (currentMonth === 0) {
          if (currentYear > 2025) {
              setCurrentYear(y => y - 1);
              setCurrentMonth(11);
          }
      } else {
          setCurrentMonth(m => m - 1);
      }
  };

  const handleNextMonth = () => {
      if (currentMonth === 11) {
          if (currentYear < 2026) {
              setCurrentYear(y => y + 1);
              setCurrentMonth(0);
          }
      } else {
          setCurrentMonth(m => m + 1);
      }
  };

  const sortedWeekKeys = Object.keys(weeksData).map(Number).sort((a,b) => a-b);
  
  useEffect(() => {
     if(sortedWeekKeys.length > 0 && !sortedWeekKeys.includes(selectedWeekNum)) {
         setSelectedWeekNum(sortedWeekKeys[0]);
     }
  }, [sortedWeekKeys, selectedWeekNum]);

  if (!client) return <div className="p-8">Loading...</div>;

  return (
    <div className="bg-gray-100 min-h-screen pb-20">
      <div className="no-print bg-white sticky top-0 z-20 shadow-md">
        <div className="flex items-center justify-between p-3 md:p-4 max-w-5xl mx-auto">
          <div className="flex items-center space-x-2 md:space-x-3">
            <Link to="/clients" className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-base md:text-lg font-bold text-gray-900 leading-tight">{client.name}</h1>
              <p className="text-[10px] md:text-xs text-gray-500 font-mono">{client.code}</p>
            </div>
          </div>
          
          <div className="flex items-center bg-gray-100 rounded-lg p-1 mx-2">
                <button onClick={handlePrevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30"><ChevronLeft size={16}/></button>
                <div className="flex flex-col items-center px-2 w-28">
                     <span className="font-bold text-gray-800 text-xs">{MONTH_NAMES[currentMonth]} {currentYear}</span>
                     <span className="text-[10px] text-gray-500">Week {Object.keys(weeksData).indexOf(String(selectedWeekNum)) + 1}</span>
                </div>
                <button onClick={handleNextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30"><ChevronRight size={16}/></button>
          </div>

          <div className="flex items-center space-x-2">
             <div className="text-right mr-2 hidden md:block">
                <p className={`text-lg font-bold leading-tight ${weekTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>${Math.abs(weekTotal).toLocaleString()}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Week Balance</p>
             </div>
             <div className="hidden md:flex space-x-2">
                 <button onClick={handleDownloadImage} disabled={isDownloading} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 shadow-sm disabled:opacity-50" title="Download Image">
                    {isDownloading ? <span className="animate-spin">⌛</span> : <Download size={18} />}
                 </button>
                 <button onClick={openNewTab} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 shadow-sm"><ExternalLink size={18} /></button>
                 <button onClick={handlePrint} className="bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-900 shadow-sm"><Printer size={18} /></button>
             </div>
          </div>
        </div>
        
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-center space-x-2 overflow-x-auto">
             {sortedWeekKeys.map(wk => (
                <button 
                    key={wk} 
                    onClick={() => setSelectedWeekNum(Number(wk))}
                    className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors whitespace-nowrap ${selectedWeekNum === Number(wk) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                >
                    Week {Object.keys(weeksData).indexOf(String(wk)) + 1}
                </button>
             ))}
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto px-2 md:px-8 py-4 md:py-6">
        
        <div className="no-print mb-6 md:mb-8 space-y-4">
            <div className="flex justify-center">
                <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-200 flex w-full md:w-auto overflow-x-auto">
                    <button onClick={() => setActiveColumn('col1')} className={`flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold rounded-md transition-all ${activeColumn === 'col1' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>Panel 1</button>
                    <button onClick={() => setActiveColumn('col2')} className={`flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold rounded-md transition-all ${activeColumn === 'col2' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>Panel 2</button>
                    <button onClick={() => setActiveColumn('main')} className={`flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold rounded-md transition-all ${activeColumn === 'main' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Main Ledger</button>
                </div>
            </div>
            {!activeCategory ? (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
                    {categories.filter(c => c.label !== '').map((cat, idx) => (
                         <div key={cat.id} className="relative group">
                            <button onClick={() => handleCategorySelect(cat)} className={`w-full h-full flex flex-col items-center justify-center p-3 md:p-4 border-2 rounded-xl transition-all shadow-sm active:scale-95 ${cat.color} ${cat.operation === 'add' ? 'border-green-100 hover:border-green-300' : cat.operation === 'subtract' ? 'border-red-100 hover:border-red-300' : 'border-gray-100 hover:border-gray-300'}`}>
                                <div className={`p-1.5 md:p-2 rounded-full mb-1 md:mb-2 bg-black bg-opacity-5`}>{cat.operation === 'add' ? <Plus size={16}/> : cat.operation === 'subtract' ? <Minus size={16}/> : <Hash size={16}/>}</div>
                                <span className="text-sm md:text-base font-bold text-center truncate w-full">{cat.label}</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setConfirmModal({isOpen:true, type:'DELETE_CATEGORY', targetId:cat.id, title:'Delete Button', message:'Remove this button?'}); }} className="absolute -top-2 -right-2 text-gray-400 hover:text-red-600 bg-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"><X size={14}/></button>
                         </div>
                    ))}
                    <button onClick={handleQuickEntry} className="flex flex-col items-center justify-center p-3 md:p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all text-indigo-700 active:scale-95">
                        <div className="p-1.5 md:p-2 rounded-full mb-1 md:mb-2 bg-indigo-200"><Zap size={16} /></div><span className="text-sm md:text-base font-bold text-center">Quick Entry</span>
                    </button>
                    <button onClick={() => setIsAddCatModalOpen(true)} className="flex flex-col items-center justify-center p-3 md:p-4 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all text-gray-500"><Plus size={20} className="mb-1"/><span className="text-[10px] md:text-xs font-bold uppercase">New</span></button>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in ring-4 ring-blue-50/50">
                     <div className={`p-3 flex items-center justify-between ${activeCategory.label === '' ? 'bg-indigo-50 border-b border-indigo-100' : activeCategory.color}`}>
                        <div className="flex items-center space-x-2">
                             <h3 className="font-bold flex items-center text-sm md:text-base text-gray-900">{activeCategory.label || "Quick Entry"}</h3>
                             <span className="text-[10px] md:text-xs opacity-50 px-2 py-0.5 bg-black/5 rounded-full">{activeColumn === 'main' ? 'Main' : activeColumn === 'col1' ? 'P1' : 'P2'}</span>
                        </div>
                        <button onClick={() => setActiveCategory(null)} className="p-1 hover:bg-black/10 rounded"><X size={20}/></button>
                     </div>
                     <form onSubmit={handleSubmit} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeCategory.label === '' && (
                            <div className="md:col-span-2">
                                {activeColumn === 'col1' ? <div className="bg-gray-100 text-gray-600 p-2 rounded-lg text-center font-bold text-sm mb-2 border border-gray-200">(Ø) Note Only Mode</div> : 
                                <div className="flex space-x-2 mb-2">
                                    <button type="button" onClick={() => setCurrentOperation('add')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${currentOperation === 'add' ? 'bg-green-100 text-green-800 ring-2 ring-green-500' : 'bg-gray-100 text-gray-500'}`}>(+) Add</button>
                                    <button type="button" onClick={() => setCurrentOperation('subtract')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${currentOperation === 'subtract' ? 'bg-red-100 text-red-800 ring-2 ring-red-500' : 'bg-gray-100 text-gray-500'}`}>(-) Deduct</button>
                                    <button type="button" onClick={() => setCurrentOperation('none')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${currentOperation === 'none' ? 'bg-gray-200 text-gray-800 ring-2 ring-gray-500' : 'bg-gray-100 text-gray-500'}`}>(Ø) Note</button>
                                </div>}
                            </div>
                        )}
                        <div className="md:col-span-2"><label className="text-xs font-bold text-gray-500 uppercase">Amount</label><input ref={amountInputRef} autoFocus type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full mt-1 p-3 text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00"/></div>
                        <div><label className="text-xs font-bold text-gray-500 uppercase">Note</label><input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/></div>
                        <div className="flex items-end"><button type="submit" className={`w-full py-3 rounded-lg text-white font-bold shadow-md active:scale-95 transition-transform ${activeCategory.label === '' ? (activeColumn === 'col1' ? 'bg-gray-600' : currentOperation === 'add' ? 'bg-green-600' : currentOperation === 'subtract' ? 'bg-red-600' : 'bg-gray-600') : (activeCategory.operation === 'add' ? 'bg-green-600' : activeCategory.operation === 'subtract' ? 'bg-red-600' : 'bg-gray-600')}`}>Confirm</button></div>
                     </form>
                </div>
            )}
        </div>

        <div id="printable-area" className="relative max-w-5xl mx-auto">
            <div className="bg-white border border-gray-200 shadow-sm min-h-[400px] relative text-lg font-serif">
                <div style={{ height: `${verticalPadding.top}px` }} className="relative group w-full no-print-bg"><div className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize z-20 opacity-0 group-hover:opacity-100 hover:bg-blue-200/50 transition-all flex items-center justify-center no-print" onMouseDown={(e) => startResize('top', undefined, e)}><div className="w-8 h-1 bg-blue-400 rounded-full"></div></div></div>

                <div className="px-4 md:px-8 pb-2 md:pb-4 flex justify-between items-end mb-2 md:mb-4">
                    <div>
                        <h2 className="text-2xl md:text-4xl font-bold text-gray-900 uppercase tracking-widest">{client.name}</h2>
                        {client.code && <p className="text-gray-600 mt-1 font-mono text-sm md:text-xl">{client.code}</p>}
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-500 font-sans uppercase tracking-wider">{MONTH_NAMES[currentMonth]} {currentYear}</p>
                        {/* Week Range Removed from Header */}
                    </div>
                </div>

                <div className="flex w-full min-h-[400px] relative" ref={containerRef}>
                    <div style={{ width: `${colWidths[0]}%` }} className="relative flex flex-col p-1 border-r border-transparent group">
                        <LedgerColumnView data={col1Ledger} footerLabel="收"/>
                        <div className="absolute top-0 right-0 bottom-0 w-4 cursor-col-resize z-20 flex justify-center translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity no-print" onMouseDown={(e) => startResize('col', 0, e)}><div className="w-0.5 h-full bg-blue-400/50" /></div>
                    </div>
                    <div style={{ width: `${colWidths[1]}%` }} className="relative flex flex-col p-1 border-r border-transparent group">
                        <LedgerColumnView data={col2Ledger} footerLabel="收"/>
                        <div className="absolute top-0 right-0 bottom-0 w-4 cursor-col-resize z-20 flex justify-center translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity no-print" onMouseDown={(e) => startResize('col', 1, e)}><div className="w-0.5 h-full bg-blue-400/50" /></div>
                    </div>
                    <div style={{ width: `${colWidths[2]}%` }} className="relative flex flex-col p-1 bg-gray-50/30">
                        <LedgerColumnView data={mainLedger} footerLabel="欠"/>
                    </div>
                </div>
                
                <div style={{ height: `${verticalPadding.bottom}px` }} className="relative group w-full mt-auto no-print-bg"><div className="absolute top-0 left-0 right-0 h-2 cursor-row-resize z-20 opacity-0 group-hover:opacity-100 hover:bg-blue-200/50 transition-all flex items-center justify-center no-print" onMouseDown={(e) => startResize('bottom', undefined, e)}><div className="w-8 h-1 bg-blue-400 rounded-full"></div></div></div>

            </div>
        </div>
      </div>

       {isAddCatModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print font-sans">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">Add Button Option</h2>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Name</label><input type="text" className="w-full px-3 py-2 border rounded-lg" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} placeholder="e.g. Bonus" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setNewCatOp('add')} className={`py-2 border rounded ${newCatOp==='add'?'bg-green-50 border-green-500':''}`}>Add</button><button type="button" onClick={() => setNewCatOp('subtract')} className={`py-2 border rounded ${newCatOp==='subtract'?'bg-red-50 border-red-500':''}`}>Deduct</button><button type="button" onClick={() => setNewCatOp('none')} className={`py-2 border rounded ${newCatOp==='none'?'bg-gray-100':''}`}>Note</button></div></div>
              <div className="flex justify-end space-x-3 mt-4"><button type="button" onClick={() => setIsAddCatModalOpen(false)} className="px-4 py-2 bg-gray-100 rounded">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {confirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 no-print font-sans">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
                  <h3 className="text-xl font-bold mb-2">{confirmModal.title}</h3>
                  <p className="text-gray-500 mb-6">{confirmModal.message}</p>
                  <div className="flex space-x-3">
                      <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2 bg-gray-100 rounded">Cancel</button>
                      <button onClick={handleConfirmAction} className="flex-1 px-4 py-2 bg-red-600 text-white rounded">Confirm</button>
                  </div>
              </div>
          </div>
      )}

      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print font-sans">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Edit Transaction</h2><button onClick={() => setEditingRecord(null)}><X size={24} /></button></div>
                <form onSubmit={handleUpdateRecord} className="space-y-4">
                    <div><label className="block text-sm font-bold text-gray-500 uppercase">Amount</label><input type="number" step="0.01" value={editingRecord.amount} onChange={e => setEditingRecord({...editingRecord, amount: parseFloat(e.target.value)})} className="w-full p-2 border rounded"/></div>
                    <div><label className="block text-sm font-bold text-gray-500 uppercase">Description</label><input type="text" value={editingRecord.description} onChange={e => setEditingRecord({...editingRecord, description: e.target.value})} className="w-full p-2 border rounded"/></div>
                    <div><label className="block text-sm font-bold text-gray-500 uppercase">Column</label><select value={editingRecord.column} onChange={e => setEditingRecord({...editingRecord, column: e.target.value as any})} className="w-full p-2 border rounded"><option value="main">Main</option><option value="col1">Panel 1</option><option value="col2">Panel 2</option></select></div>
                    <div className="flex justify-end pt-4"><button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Update</button></div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default ClientLedger;
