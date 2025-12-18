
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Printer, Trash2, Plus, Minus, Pencil, X, Check, AlertTriangle, ExternalLink, GripHorizontal, Hash, Zap, Download, ChevronLeft, ChevronRight, Calendar, Trophy, Medal } from 'lucide-react';
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
import { MONTH_NAMES, getWeeksForMonth, getWeekRangeString } from '../utils/reportUtils';

type LedgerColumn = 'main' | 'col1' | 'col2';

const PositionBadge = ({ label }: { label: string }) => {
    let colorClass = 'bg-gray-100 text-gray-600';
    let text = label;

    if (label.includes('头')) { colorClass = 'bg-yellow-100 text-yellow-800 border border-yellow-300'; text = '头'; }
    else if (label.includes('二')) { colorClass = 'bg-slate-100 text-slate-700 border border-slate-300'; text = '二'; }
    else if (label.includes('三')) { colorClass = 'bg-orange-100 text-orange-800 border border-orange-300'; text = '三'; }
    else if (label.includes('入')) { colorClass = 'bg-blue-100 text-blue-800 border border-blue-300'; text = '入'; }
    else if (label.includes('安')) { colorClass = 'bg-green-100 text-green-800 border border-green-300'; text = '安'; }

    return (
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${colorClass} shadow-sm ml-2`}>
            {text}
        </span>
    );
};

// --- Winning Breakdown Component ---
interface WinningBreakdownProps {
    description: string;
    totalAmount: number;
    recordId: string;
    onDelete: () => void;
    onEdit: () => void;
}

const WinningBreakdown: React.FC<WinningBreakdownProps> = ({ description, totalAmount, recordId, onDelete, onEdit }) => {
    // Extract date if present (Format: "22/11 Winnings: ...")
    const dateMatch = description.match(/^(\d{1,2}\/\d{1,2})\s+Winnings:/i);
    const displayDate = dateMatch ? dateMatch[1] : null;

    // Robustly remove prefix like "22/11 Winnings: " or just "Winnings: "
    const rawContent = description.replace(/^.*?Winnings:\s*/i, '');
    const entries = rawContent.split(';').map(s => s.trim()).filter(s => s);

    return (
        <div className="w-full relative group mb-3 border-b-2 border-gray-200 pb-2 bg-white">
             {/* Edit/Delete Actions */}
             <div className="no-print opacity-0 group-hover:opacity-100 transition-opacity flex flex-col space-y-1 absolute -left-8 top-0 z-20">
                <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 text-blue-600 hover:bg-blue-50 bg-white shadow-md rounded-lg border border-gray-200"><Pencil size={12} /></button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 text-red-600 hover:bg-red-50 bg-white shadow-md rounded-lg border border-gray-200"><Trash2 size={12} /></button>
            </div>

            {/* Date Header */}
            {displayDate && (
                <div className="mb-2 flex justify-start">
                    <span className="text-sm font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-mono">
                        {displayDate}
                    </span>
                </div>
            )}

            <div className="space-y-3">
                {entries.map((entry, idx) => {
                    // Expected: "MKT 5990-6-2200 头"
                    const parts = entry.match(/^([A-Z]+)\s+(\d+)-([\d.]+)-([\d.]+)\s+(.+)$/);
                    
                    if (parts) {
                        const [_, sides, number, bet, win, pos] = parts;
                        return (
                            <div key={idx} className="flex items-center text-sm leading-snug w-full">
                                {/* Left: Sides (Fixed Width) */}
                                <div className="w-10 flex-shrink-0 text-left">
                                    <span className="font-bold text-gray-400 font-mono text-[11px] uppercase block">{sides}</span>
                                </div>
                                
                                {/* Right: Grid for Number | Bet | Win */}
                                <div className="flex-1 flex items-center justify-between font-mono">
                                    {/* Number */}
                                    <div className="text-xl font-bold text-gray-900 w-16 text-center">{number}</div>
                                    
                                    {/* Separator */}
                                    <div className="h-6 w-px bg-gray-300 mx-1"></div>
                                    
                                    {/* Bet */}
                                    <div className="text-gray-600 font-bold w-10 text-center">{Number(bet).toLocaleString()}</div>
                                    
                                    {/* Separator */}
                                    <div className="h-6 w-px bg-red-400 mx-1"></div>
                                    
                                    {/* Win */}
                                    <div className="font-bold text-red-600 text-lg w-16 text-center">
                                        {Number(win).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                    </div>
                                </div>

                                {/* Position Badge */}
                                <div className="flex-shrink-0 w-8 flex justify-end">
                                    <PositionBadge label={pos} />
                                </div>
                            </div>
                        );
                    }
                    return <div key={idx} className="text-xs text-gray-500">{entry}</div>;
                })}
            </div>
            {/* Total Footer */}
            <div className="mt-3 pt-2 border-t border-gray-300 flex justify-end items-center gap-3">
                <span className="text-sm text-gray-400 uppercase font-bold tracking-widest font-serif">共中</span>
                <span className="text-3xl font-mono font-bold text-red-600 leading-none">
                    {totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
            </div>
        </div>
    );
};

const ClientLedger: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [client, setClient] = useState<Client | null>(null);
  const [allRecords, setAllRecords] = useState<LedgerRecord[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);

  const [activeCategory, setActiveCategory] = useState<TransactionCategory | null>(null);
  const [activeColumn, setActiveColumn] = useState<LedgerColumn>('main');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  
  const [currentOperation, setCurrentOperation] = useState<'add'|'subtract'|'none'>('add');
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatOp, setNewCatOp] = useState<'add'|'subtract'|'none'>('subtract');
  const [editingRecord, setEditingRecord] = useState<LedgerRecord | null>(null);
  const [winningsEntries, setWinningsEntries] = useState<any[]>([]);

  const [colWidths, setColWidths] = useState<number[]>([33.33, 33.33, 33.34]);
  const [verticalPadding, setVerticalPadding] = useState<{top: number, bottom: number}>({ top: 40, bottom: 40 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{ type: 'col'|'top'|'bottom', index?: number, startX?: number, startY?: number, startWidths?: number[], startHeight?: number, containerWidth?: number } | null>(null);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: string; targetId?: string; title: string; message: string; } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    
    if (location.state && typeof (location.state as any).year === 'number') {
        const s = location.state as any;
        setCurrentYear(s.year);
        setCurrentMonth(s.month);
        setSelectedWeekNum(s.week);
    } else {
        const now = new Date();
        let y = now.getFullYear();
        if(y < 2025) y = 2025;
        if(y > 2026) y = 2026;
        setCurrentYear(y);
        const m = now.getMonth();
        setCurrentMonth(m);
        const weeks = getWeeksForMonth(y, m);
        const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        const foundWeek = Object.keys(weeks).find(w => {
            return weeks[parseInt(w)].some(d => {
                const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                return dStr === todayStr;
            });
        });
        if(foundWeek) setSelectedWeekNum(parseInt(foundWeek));
    }
  }, [id, location.state]);

  const loadRecords = async () => {
    if (id) {
      const recs = await getLedgerRecords(id); 
      setAllRecords(recs);
    }
  };

  const weeksData = useMemo<Record<number, Date[]>>(() => getWeeksForMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  const activeDays = weeksData[selectedWeekNum] || [];
  
  const activeDateStrings = useMemo(() => 
      activeDays.map(d => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }),
  [activeDays]);

  const { weekRecords, weekTotal } = useMemo(() => {
    if (activeDateStrings.length === 0) return { weekRecords: [], weekTotal: 0 };
    const current = allRecords.filter(r => activeDateStrings.includes(r.date));
    const salesRecords = current.filter(r => r.id.startsWith('sale_'));
    const otherRecords = current.filter(r => !r.id.startsWith('sale_'));
    let finalRecords = [...otherRecords];

    if (salesRecords.length > 0) {
        const totalSalesNet = salesRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
        const latestDate = salesRecords.reduce((max, r) => r.date > max ? r.date : max, salesRecords[0].date);
        const aggregatedSale: LedgerRecord = {
            id: 'agg_sale_week',
            clientId: id!,
            date: latestDate,
            description: '',
            typeLabel: '收',
            amount: Math.abs(totalSalesNet),
            operation: totalSalesNet >= 0 ? 'add' : 'subtract',
            column: 'main',
            isVisible: true
        };
        finalRecords.push(aggregatedSale);
    }

    // Sort by custom priority
    // New Order: 上欠 -> 收 -> 电 -> 中 -> 来 -> 支 -> Manual
    const getPriority = (record: LedgerRecord): number => {
        if (record.id.startsWith('draw_') || record.typeLabel === '上欠') return 1;
        if (record.id.startsWith('sale_') || record.id === 'agg_sale_week' || record.typeLabel === '收') return 2;
        if (record.typeLabel === '电') return 3;
        if (record.typeLabel === '中') return 4;
        if (record.id.startsWith('cred_') || record.typeLabel === '来') return 5;
        if (record.id.startsWith('adv_') || record.typeLabel === '支' || record.typeLabel === '支钱') return 6;
        return 7;
    };

    finalRecords.sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return getPriority(a) - getPriority(b);
    });

    const weekChange = current.reduce((acc, r) => acc + getNetAmount(r), 0);
    return { weekRecords: finalRecords, weekTotal: weekChange };
  }, [allRecords, activeDateStrings, id]);

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
      setCurrentOperation('add');
      setAmount(''); setDescription(''); 
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

    const saved = await saveLedgerRecord(newRecord);
    setAllRecords(prev => {
        const newArray = [...prev, saved];
        return newArray;
    });
    loadRecords();
    
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

  const openEditModal = (record: LedgerRecord) => {
      setEditingRecord(record);
      // Robust regex check for Winnings prefix
      if (record.description.includes('Winnings:')) {
          const rawContent = record.description.replace(/^.*?Winnings:\s*/i, '');
          const entries = rawContent.split(';').map(s => s.trim()).filter(s => s);
          const parsed = entries.map((entry, idx) => {
              const parts = entry.match(/^([A-Z]+)\s+(\d+)-([\d.]+)-([\d.]+)\s+(.+)$/);
              if (parts) {
                  return { id: idx, sides: parts[1], number: parts[2], bet: parts[3], win: parts[4], pos: parts[5] };
              }
              return { id: idx, raw: entry };
          });
          setWinningsEntries(parsed);
      } else {
          setWinningsEntries([]);
      }
  };

  const handleUpdateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      let finalDescription = editingRecord.description;
      let finalAmount = editingRecord.amount;

      if (editingRecord.description.includes('Winnings:') && winningsEntries.length > 0) {
          const newDescParts = winningsEntries.map(entry => {
              if (entry.raw) return entry.raw;
              return `${entry.sides} ${entry.number}-${entry.bet}-${entry.win} ${entry.pos}`;
          });
          // Preserve prefix if it exists (e.g. date label)
          const prefixMatch = editingRecord.description.match(/^(.*?Winnings:\s*)/i);
          const prefix = prefixMatch ? prefixMatch[1] : 'Winnings: ';
          finalDescription = `${prefix}${newDescParts.join('; ')}`;
          
          finalAmount = winningsEntries.reduce((acc, curr) => {
              return acc + (parseFloat(curr.win) || 0);
          }, 0);
      }

      const updated = { ...editingRecord, description: finalDescription, amount: finalAmount };
      updateLedgerRecord(editingRecord.id, updated);
      setAllRecords(prev => prev.map(r => r.id === editingRecord.id ? updated : r));
      setEditingRecord(null);
      setWinningsEntries([]);
    }
  };
  
  const updateWinningEntry = (idx: number, field: string, val: string) => {
      setWinningsEntries(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
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

  const mainLedger = useMemo(() => {
      const data = calculateColumn('main');
      
      // Global Logic: Hide '上欠' records from the Main Ledger view if amount is 0
      data.processed = data.processed.filter(r => !(r.typeLabel === '上欠' && r.amount === 0));

      // SPECIAL LOGIC: Hide '上欠' records for Z21 and C19 from Main Ledger view
      if (client && (client.code.toUpperCase() === 'Z21' || client.code.toUpperCase() === 'C19')) {
          data.processed = data.processed.filter(r => r.typeLabel !== '上欠');
      }

      // Recalculate visual balance for the column (keeping data integrity, just hiding from column calc)
      const visibleProcessed = data.processed.filter(r => r.isVisible);
      data.finalBalance = visibleProcessed.reduce((acc, curr) => acc + curr.netChange, 0);

      return data;
  }, [weekRecords, client]);

  const col1Ledger = useMemo(() => calculateColumn('col1'), [weekRecords]);
  const col2Ledger = useMemo(() => calculateColumn('col2'), [weekRecords]);

  const LedgerColumnView = ({ data, footerLabel = "收", isPanel1 = false }: { data: ReturnType<typeof calculateColumn>, footerLabel?: string, isPanel1?: boolean }) => {
      if (data.processed.length === 0) return <div className="flex-1 min-h-[50px]" />;

      const isNegative = data.finalBalance < 0;
      let displayLabel = footerLabel;
      if (isNegative && (footerLabel === '收' || footerLabel === '欠')) displayLabel = '补';
      
      return (
      <div className="flex flex-col items-center w-full">
          <div className="flex flex-col w-full md:w-fit items-end">
                {data.processed.map((r) => {
                    // Check for Winnings Record (Panel 1 Special Display)
                    if (isPanel1 && r.description && r.description.includes('Winnings:')) {
                        return (
                            <WinningBreakdown 
                                key={r.id} 
                                description={r.description} 
                                totalAmount={r.amount}
                                recordId={r.id}
                                onDelete={() => requestDeleteRecord(r.id)}
                                onEdit={() => openEditModal(r)}
                            />
                        );
                    }

                    const isCrossedOut = r.operation === 'none';
                    const isNetNegative = r.operation !== 'none' && r.netChange < 0;
                    const absValue = Math.abs(r.operation === 'none' ? r.amount : r.netChange).toLocaleString(undefined, {minimumFractionDigits: 2});
                    const useBrackets = isNetNegative && (r.typeLabel === '收' || r.id === 'agg_sale_week');
                    const displayValue = useBrackets ? `(${absValue})` : absValue;
                    
                    let textColor = 'text-gray-600';
                    if (r.operation === 'add') textColor = isNetNegative ? 'text-red-700' : 'text-green-700';
                    else if (r.operation === 'subtract') textColor = 'text-red-700';
                    else if (r.operation === 'none') textColor = 'text-gray-400';

                    return (
                        <div key={r.id} className={`group flex justify-between md:justify-end items-center leading-none relative gap-1 md:gap-1.5 w-full md:w-auto py-1 ${!r.isVisible ? 'opacity-30 grayscale no-print' : ''}`}>
                            <div className="no-print opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 absolute -left-12 z-10 bg-white shadow-sm rounded border border-gray-100 p-0.5">
                                <button onClick={() => openEditModal(r)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Pencil size={10} /></button>
                                <button onClick={() => requestDeleteRecord(r.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={10} /></button>
                            </div>
                            
                            <div className={`text-sm md:text-lg font-bold uppercase tracking-wide w-1/3 md:w-auto text-left md:text-right ${isCrossedOut ? 'text-gray-400 line-through decoration-gray-400' : 'text-gray-700'}`}>{r.typeLabel}</div>
                            <div className="flex-1 text-right">
                                {r.description && r.description !== r.typeLabel && <div className={`text-sm md:text-base font-medium mr-1 md:mr-2 truncate inline-block ${isCrossedOut ? 'text-gray-400 line-through decoration-gray-400' : 'text-gray-700'}`}>{r.description}</div>}
                            </div>
                            <div className={`text-base md:text-xl font-mono font-bold w-24 md:w-28 text-right ${textColor} ${isCrossedOut ? 'line-through decoration-gray-400' : ''}`}>
                                {displayValue}
                            </div>
                        </div>
                    );
                })}
          </div>
          
          {/* Hide Total Footer if it is Panel 1 */}
          {!isPanel1 && (
              <div className="mt-2 pt-2 flex flex-col items-end w-full md:w-fit border-t-2 border-gray-900">
                    <div className="flex items-center gap-2 justify-between w-full md:justify-end">
                        <span className="text-sm md:text-lg font-bold text-gray-900 uppercase">{displayLabel}</span>
                        <span className={`text-lg md:text-2xl font-mono font-bold w-auto md:w-32 text-right ${data.finalBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                            {data.finalBalance < 0 ? `(${Math.abs(data.finalBalance).toLocaleString(undefined, {minimumFractionDigits: 2})})` : data.finalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </span>
                    </div>
              </div>
          )}
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
        <div className="flex items-center justify-between p-3 md:p-4 max-w-7xl mx-auto">
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
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Week Activity</p>
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
             {sortedWeekKeys.map(wk => {
                const days = weeksData[Number(wk)];
                const rangeStr = getWeekRangeString(null, null, days);
                return (
                    <button 
                        key={wk} 
                        onClick={() => setSelectedWeekNum(Number(wk))}
                        className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors whitespace-nowrap ${selectedWeekNum === Number(wk) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                    >
                        {rangeStr}
                    </button>
                );
             })}
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-8">
            {/* --- LEFT COLUMN: CONTROLS --- */}
            <div className="lg:w-80 xl:w-96 flex-shrink-0 space-y-6 no-print">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="font-bold text-gray-500 text-xs uppercase tracking-wider mb-2">Panel Selector</h3>
                    <div className="bg-gray-100 rounded-lg p-1 flex w-full">
                        <button onClick={() => setActiveColumn('col1')} className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${activeColumn === 'col1' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200/50'}`}>Panel 1</button>
                        <button onClick={() => setActiveColumn('col2')} className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${activeColumn === 'col2' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200/50'}`}>Panel 2</button>
                        <button onClick={() => setActiveColumn('main')} className={`flex-1 px-3 py-2 text-xs font-bold rounded-md transition-all ${activeColumn === 'main' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Main Ledger</button>
                    </div>
                </div>

                {!activeCategory ? (
                    <div className="grid grid-cols-3 gap-2">
                        {categories.filter(c => c.label !== '').map((cat, idx) => (
                            <div key={cat.id} className="relative group">
                                <button onClick={() => handleCategorySelect(cat)} className={`w-full flex flex-col items-center justify-center p-3 border rounded-lg transition-all shadow-sm active:scale-95 ${cat.color} ${cat.operation === 'add' ? 'border-green-100 hover:border-green-300' : cat.operation === 'subtract' ? 'border-red-100 hover:border-red-300' : 'border-gray-100 hover:border-gray-300'}`}>
                                    <div className="p-1.5 rounded-full mb-1 bg-black bg-opacity-5">{cat.operation === 'add' ? <Plus size={14}/> : cat.operation === 'subtract' ? <Minus size={14}/> : <Hash size={14}/>}</div>
                                    <span className="text-xs font-bold text-center truncate w-full">{cat.label}</span>
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); setConfirmModal({isOpen:true, type:'DELETE_CATEGORY', targetId:cat.id, title:'DELETE', message:'Remove this button?'}); }} className="absolute -top-1.5 -right-1.5 text-gray-400 hover:text-red-600 bg-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                            </div>
                        ))}
                        <button onClick={handleQuickEntry} className="flex flex-col items-center justify-center p-3 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-all text-indigo-700 active:scale-95">
                            <div className="p-1.5 rounded-full mb-1 bg-indigo-200"><Zap size={14} /></div><span className="text-xs font-bold text-center">Quick Entry</span>
                        </button>
                        <button onClick={() => setIsAddCatModalOpen(true)} className="flex flex-col items-center justify-center p-3 bg-white border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all text-gray-500"><Plus size={16} className="mb-1"/><span className="text-[10px] font-bold uppercase">New</span></button>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in ring-2 ring-blue-100">
                        <div className={`p-3 flex items-center justify-between ${activeCategory.label === '' ? 'bg-indigo-50 border-b border-indigo-100' : activeCategory.color}`}>
                            <div className="flex items-center space-x-2">
                                <h3 className="font-bold flex items-center text-sm text-gray-900">{activeCategory.label || "Quick Entry"}</h3>
                                <span className="text-[10px] opacity-50 px-2 py-0.5 bg-black/5 rounded-full">{activeColumn === 'main' ? 'Main' : activeColumn === 'col1' ? 'P1' : 'P2'}</span>
                            </div>
                            <button onClick={() => setActiveCategory(null)} className="p-1 hover:bg-black/10 rounded"><X size={20}/></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {activeCategory.label === '' && (
                                <div>
                                    <div className="flex space-x-2">
                                        <button type="button" onClick={() => setCurrentOperation('add')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${currentOperation === 'add' ? 'bg-green-100 text-green-800 ring-2 ring-green-500' : 'bg-gray-100 text-gray-500'}`}>(+) Add</button>
                                        <button type="button" onClick={() => setCurrentOperation('subtract')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${currentOperation === 'subtract' ? 'bg-red-100 text-red-800 ring-2 ring-red-500' : 'bg-gray-100 text-gray-500'}`}>(-) Deduct</button>
                                        <button type="button" onClick={() => setCurrentOperation('none')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${currentOperation === 'none' ? 'bg-gray-200 text-gray-800 ring-2 ring-gray-500' : 'bg-gray-100 text-gray-500'}`}>(Ø) Note</button>
                                    </div>
                                </div>
                            )}
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Amount</label><input ref={amountInputRef} autoFocus type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full mt-1 p-3 text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00"/></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Note</label><input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/></div>
                            <div><button type="submit" className={`w-full py-3 rounded-lg text-white font-bold shadow-md active:scale-95 transition-transform ${activeCategory.label === '' ? (currentOperation === 'add' ? 'bg-green-600' : currentOperation === 'subtract' ? 'bg-red-600' : 'bg-gray-600') : (activeCategory.operation === 'add' ? 'bg-green-600' : activeCategory.operation === 'subtract' ? 'bg-red-600' : 'bg-gray-600')}`}>Confirm</button></div>
                        </form>
                    </div>
                )}
            </div>

            {/* --- RIGHT COLUMN: LEDGER --- */}
            <div className="flex-1 min-w-0">
                <div id="printable-area" className="relative">
                    <div className="bg-white border border-gray-200 shadow-sm min-h-[600px] relative text-lg font-serif">
                        <div style={{ height: `${verticalPadding.top}px` }} className="relative group w-full no-print-bg"><div className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize z-20 opacity-0 group-hover:opacity-100 hover:bg-blue-200/50 transition-all flex items-center justify-center no-print" onMouseDown={(e) => startResize('top', undefined, e)}><div className="w-8 h-1 bg-blue-400 rounded-full"></div></div></div>

                        <div className="px-4 md:px-8 pb-2 md:pb-4 flex justify-between items-end mb-2 md:mb-4">
                            <div>
                                <h2 className="text-2xl md:text-4xl font-bold text-gray-900 uppercase tracking-widest">{client.name}</h2>
                                {client.code && <p className="text-gray-600 mt-1 font-mono text-sm md:text-xl">{client.code}</p>}
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row w-full min-h-[400px] relative" ref={containerRef}>
                            <div style={{ width: isMobile ? '100%' : `${colWidths[0]}%` }} className={`relative flex-col p-1 border-r border-transparent group overflow-hidden ${isMobile && activeColumn !== 'col1' ? 'hidden' : 'flex'}`}>
                                <LedgerColumnView data={col1Ledger} footerLabel="收" isPanel1={true}/>
                                <div className="absolute top-0 right-0 bottom-0 w-4 cursor-col-resize z-20 flex justify-center translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity no-print" onMouseDown={(e) => startResize('col', 0, e)}><div className="w-0.5 h-full bg-blue-400/50" /></div>
                            </div>
                            <div style={{ width: isMobile ? '100%' : `${colWidths[1]}%` }} className={`relative flex-col p-1 border-r border-transparent group overflow-hidden ${isMobile && activeColumn !== 'col2' ? 'hidden' : 'flex'}`}>
                                <LedgerColumnView data={col2Ledger} footerLabel="收"/>
                                <div className="absolute top-0 right-0 bottom-0 w-4 cursor-col-resize z-20 flex justify-center translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity no-print" onMouseDown={(e) => startResize('col', 1, e)}><div className="w-0.5 h-full bg-blue-400/50" /></div>
                            </div>
                            <div style={{ width: isMobile ? '100%' : `${colWidths[2]}%` }} className={`relative flex-col p-1 bg-gray-50/30 overflow-hidden ${isMobile && activeColumn !== 'main' ? 'hidden' : 'flex'}`}>
                                <LedgerColumnView data={mainLedger} footerLabel="欠"/>
                            </div>
                        </div>
                        
                        <div style={{ height: `${verticalPadding.bottom}px` }} className="relative group w-full mt-auto no-print-bg"><div className="absolute top-0 left-0 right-0 h-2 cursor-row-resize z-20 opacity-0 group-hover:opacity-100 hover:bg-blue-200/50 transition-all flex items-center justify-center no-print" onMouseDown={(e) => startResize('bottom', undefined, e)}><div className="w-8 h-1 bg-blue-400 rounded-full"></div></div></div>
                    </div>
                </div>
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
            <div className="bg-white rounded-xl shadow-xl w-full max-md p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Edit Transaction</h2><button onClick={() => setEditingRecord(null)}><X size={24} /></button></div>
                <form onSubmit={handleUpdateRecord} className="space-y-4">
                    {/* Advanced Winnings Editor */}
                    {winningsEntries.length > 0 ? (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                            <h3 className="text-sm font-bold text-gray-600 uppercase">Winning Entries Breakdown</h3>
                            {winningsEntries.map((entry, idx) => (
                                <div key={idx} className="grid grid-cols-[2rem_3rem_3rem_3rem_2rem] gap-2 items-center text-xs">
                                    <input type="text" className="border p-1 rounded font-bold uppercase" value={entry.sides || ''} onChange={e => updateWinningEntry(idx, 'sides', e.target.value)} />
                                    <input type="text" className="border p-1 rounded font-mono" value={entry.number || ''} onChange={e => updateWinningEntry(idx, 'number', e.target.value)} />
                                    <input type="text" className="border p-1 rounded text-right" value={entry.bet || ''} onChange={e => updateWinningEntry(idx, 'bet', e.target.value)} />
                                    <input type="text" className="border p-1 rounded text-right font-bold" value={entry.win || ''} onChange={e => updateWinningEntry(idx, 'win', e.target.value)} />
                                    <input type="text" className="border p-1 rounded text-center" value={entry.pos || ''} onChange={e => updateWinningEntry(idx, 'pos', e.target.value)} />
                                </div>
                            ))}
                            <div className="text-xs text-center text-gray-400 mt-2">Modify values directly. Total amount will recalculate on save.</div>
                        </div>
                    ) : (
                        // Standard Editor Fields
                        <>
                            <div><label className="block text-sm font-bold text-gray-500 uppercase">Amount</label><input type="number" step="0.01" value={editingRecord.amount} onChange={e => setEditingRecord({...editingRecord, amount: parseFloat(e.target.value)})} className="w-full p-2 border rounded"/></div>
                            <div><label className="block text-sm font-bold text-gray-500 uppercase">Description</label><input type="text" value={editingRecord.description} onChange={e => setEditingRecord({...editingRecord, description: e.target.value})} className="w-full p-2 border rounded"/></div>
                        </>
                    )}
                    
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
