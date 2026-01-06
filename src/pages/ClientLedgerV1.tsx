
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Trash2, Plus, Minus, Pencil, X, Check, AlertTriangle, ExternalLink, GripHorizontal, Hash, Zap, ChevronLeft, ChevronRight, ImageDown, Trash } from 'lucide-react';
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
  getNetAmount,
  fetchClientTotalBalance
} from '../services/storageService';
import { Client, LedgerRecord, TransactionCategory } from '../types';
import { useGlobalState } from '../context/GlobalStateContext';
import { getWeeksForMonth, getWeekRangeString, MONTH_NAMES } from '../utils/reportUtils';

type LedgerColumn = 'main' | 'col1' | 'col2';

interface WinningLineData {
    sides: string;
    number: string;
    big: string;
    small: string;
    win: string;
    type: string;
    pos: string;
}

const ClientLedgerV1: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentDate, setCurrentDate } = useGlobalState();
  const [client, setClient] = useState<Client | null>(null);
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [totalOwed, setTotalOwed] = useState(0);
  
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
  const [draggedCatIndex, setDraggedCatIndex] = useState<number | null>(null);

  const [editWinDate, setEditWinDate] = useState('');
  const [editWinLines, setEditWinLines] = useState<WinningLineData[]>([]);

  const [colWidths, setColWidths] = useState<number[]>([35, 30, 35]);
  const [verticalPadding, setVerticalPadding] = useState<{top: number, bottom: number}>({ top: 40, bottom: 40 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{ 
      type: 'col' | 'top' | 'bottom';
      index?: number; 
      startX?: number; 
      startY?: number;
      startWidths?: number[]; 
      startHeight?: number;
      containerWidth?: number 
  } | null>(null);

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

  const handleWeekSelect = (weekNum: number) => {
      const days = weeksData[weekNum];
      if (days && days.length > 0) setCurrentDate(new Date(days[0]));
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

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'DELETE_RECORD' | 'DELETE_CATEGORY' | 'PRINT_ERROR';
    targetId?: string;
    title: string;
    message: string;
  } | null>(null);

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

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragInfo.current) return;
    if (dragInfo.current.type === 'col' && dragInfo.current.index !== undefined && dragInfo.current.startX !== undefined && dragInfo.current.startWidths && dragInfo.current.containerWidth) {
        const { index, startX, startWidths, containerWidth } = dragInfo.current;
        const diffX = e.clientX - startX;
        const diffPercent = (diffX / containerWidth) * 100;
        const newWidths = [...startWidths];
        if (newWidths[index] + diffPercent < 10 || newWidths[index + 1] - diffPercent < 10) return;
        newWidths[index] += diffPercent;
        newWidths[index + 1] -= diffPercent;
        setColWidths(newWidths);
    } else if (dragInfo.current.type === 'top' || dragInfo.current.type === 'bottom') {
        const { startY, startHeight } = dragInfo.current;
        if (startY === undefined || startHeight === undefined) return;
        const diffY = e.clientY - startY;
        if (dragInfo.current.type === 'top') setVerticalPadding(prev => ({ ...prev, top: Math.max(0, startHeight + diffY) }));
        else setVerticalPadding(prev => ({ ...prev, bottom: Math.max(0, startHeight - diffY) }));
    }
  }, []);

  const onMouseUp = useCallback(() => {
      dragInfo.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
  }, [onMouseMove]);

  const startResizeCol = (index: number, e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (!containerRef.current) return;
      dragInfo.current = { type: 'col', index, startX: e.clientX, startWidths: [...colWidths], containerWidth: containerRef.current.clientWidth };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
  };

  const startResizeVertical = (type: 'top' | 'bottom', e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      dragInfo.current = { type, startY: e.clientY, startHeight: type === 'top' ? verticalPadding.top : verticalPadding.bottom };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
  };

  const handleCategorySelect = (cat: TransactionCategory) => {
    setActiveCategory(cat);
    setCurrentOperation(cat.operation);
    setAmount('');
    setDescription('');
  };

  const handleQuickEntry = () => {
      const quickCat: TransactionCategory = { id: 'quick_entry', label: '', operation: 'add', color: 'bg-blue-600 text-white' };
      setActiveCategory(quickCat);
      setCurrentOperation(activeColumn === 'col1' ? 'none' : 'add');
      setAmount('');
      setDescription('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !activeCategory || !amount) return;
    const val = parseFloat(amount);
    if (isNaN(val)) return;
    
    let op = activeCategory.label === '' ? currentOperation : activeCategory.operation;
    
    const entryDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')}`;
    const newRecord: Omit<LedgerRecord, 'id'> = {
      clientId: id, date: entryDate, description: description, typeLabel: activeCategory.label, amount: val, operation: op, column: activeColumn, isVisible: isVisible
    };
    await saveLedgerRecord(newRecord);
    loadRecords();
    if (activeCategory.label.trim() === '') {
        setAmount(''); setDescription('');
        setTimeout(() => { if (amountInputRef.current) amountInputRef.current.focus(); }, 10);
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
    setIsAddCatModalOpen(false);
    setNewCatLabel('');
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
      setDraggedCatIndex(index);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedCatIndex === null || draggedCatIndex === index) return;
      const newCategories = [...categories];
      const draggedItem = newCategories[draggedCatIndex];
      newCategories.splice(draggedCatIndex, 1);
      newCategories.splice(index, 0, draggedItem);
      setCategories(newCategories);
      setDraggedCatIndex(index);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDraggedCatIndex(null);
      saveCategoriesOrder(categories);
  };

  const requestDeleteCategory = (e: React.MouseEvent, catId: string) => {
    e.stopPropagation();
    setConfirmModal({ isOpen: true, type: 'DELETE_CATEGORY', targetId: catId, title: 'Delete Button', message: 'Remove this category button?' });
  };

  const requestDeleteRecord = (recordId: string) => {
    setConfirmModal({ isOpen: true, type: 'DELETE_RECORD', targetId: recordId, title: 'Delete Transaction', message: 'Delete this transaction?' });
  };

  const handleConfirmAction = async () => {
      if (!confirmModal) return;
      if (confirmModal.type === 'DELETE_RECORD' && confirmModal.targetId) {
          await deleteLedgerRecord(confirmModal.targetId);
          loadRecords();
      } else if (confirmModal.type === 'DELETE_CATEGORY' && confirmModal.targetId) {
          deleteCategory(confirmModal.targetId);
          setCategories(getCategories());
      }
      setConfirmModal(null);
  };

  const handlePrint = () => window.print();
  const openNewTab = () => window.open(window.location.href, '_blank');

  const handleDownloadImage = async () => {
      const element = document.getElementById('printable-area');
      if (element) {
          try {
              const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
              const link = document.createElement('a');
              link.download = `${client?.name || 'ledger'}_statement.png`;
              link.href = canvas.toDataURL('image/png');
              link.click();
          } catch (error) {
              console.error("Image capture failed", error);
              setConfirmModal({ isOpen: true, type: 'PRINT_ERROR', title: 'Image Error', message: 'Failed to generate image. Please try again.' });
          }
      }
  };

  const parseAllWinningDetails = (desc: string) => {
      const safeDesc = desc || '';
      const dateMatch = safeDesc.match(/^(\d{1,2}[\/\.]\d{1,2})\s+(.*)/);
      const dateStr = dateMatch ? dateMatch[1] : '';
      const content = dateMatch ? dateMatch[2] : safeDesc;
      
      const lines = content.split(/;\s*/).filter(Boolean);

      const parsedLines: WinningLineData[] = lines.map(line => {
          const parts = line.split('-').map(p => p.trim());
          let sides = '', num = '', big = '0', small = '0', win = '0', type = '', pos = '';
          
          if (parts.length >= 3) {
              const head = parts[0].split(/\s+/).filter(Boolean);
              if (head.length >= 3) {
                  sides = head[0]; num = head[1]; big = head[2];
              } else if (head.length === 2) {
                  num = head[0]; big = head[1];
              }

              const mid = parts[1].split(/\s+/).filter(Boolean);
              if (mid.length >= 3) {
                  small = mid[0]; type = mid[1]; pos = mid[2].replace(/\(|\)/g, '');
              } else if (mid.length === 2) {
                  small = mid[0]; type = mid[1];
              } else if (mid.length === 1) {
                  small = mid[0];
              }

              win = parts[2];
          } else if (parts.length === 2) {
               const head = parts[0].split(/\s+/).filter(Boolean);
               sides = head[0] || '';
               num = head[1] || '';
               win = parts[1];
          } else {
              num = line;
          }
          return { sides, number: num, big, small, win, type, pos };
      });
      return { dateStr, parsedLines };
  };

  const startEditing = (record: LedgerRecord) => {
      if (record.typeLabel === '中') {
          const { dateStr, parsedLines } = parseAllWinningDetails(record.description);
          setEditWinDate(dateStr);
          setEditWinLines(parsedLines.length > 0 ? parsedLines : [{ sides: '', number: '', big: '0', small: '0', win: '0', type: 'ibox', pos: '头' }]);
      } else {
          setEditWinDate('');
          setEditWinLines([]);
      }
      setEditingRecord(record);
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    
    let finalDesc = editingRecord.description;
    if (editingRecord.typeLabel === '中') {
        const assembledLines = editWinLines.map(l => `${l.sides} ${l.number} ${l.big} - ${l.small} ${l.type} ${l.pos} - ${l.win}`).join('; ');
        finalDesc = `${editWinDate} ${assembledLines}`.trim();
    }

    await updateLedgerRecord(editingRecord.id, { 
        amount: editingRecord.amount, 
        description: finalDesc, 
        typeLabel: editingRecord.typeLabel,
        operation: editingRecord.operation, 
        date: editingRecord.date, 
        isVisible: editingRecord.isVisible, 
        column: editingRecord.column 
    });
    loadRecords();
    setEditingRecord(null);
  };

  const calculateColumn = (columnKey: LedgerColumn) => {
      const colRecords = filteredRecords.filter(r => r.column === columnKey);
      const clientCode = client?.code?.toUpperCase();
      const isSpecialClient = clientCode === 'Z21' || clientCode === 'C19';

      const processed = colRecords.map(r => {
          const netChange = getNetAmount(r);
          // NEW: For Z21 and C19 Panel 1, Quick Entries (empty label) should NOT be in calculation
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

  const handleClearPanel1 = async () => {
    if (!window.confirm("Delete ALL entries in Panel 1 for this week?")) return;
    for (const r of col1Ledger.processed) {
        await deleteLedgerRecord(r.id);
    }
    loadRecords();
  };

  const renderFormattedDescription = (text: string | undefined) => {
    if (!text) return null;
    const dateMatch = text.match(/^(\d{1,2}\/\d{1,2})\s+(.*)/);
    if (dateMatch) {
        return (
            <div className="flex items-start w-full whitespace-nowrap">
                <span className="text-[10px] md:text-[13px] font-mono text-gray-400 shrink-0 w-[36px] md:w-[46px]">{dateMatch[1]}</span>
                <span className="text-[11px] md:text-[16px] text-gray-700 font-bold leading-tight flex-1 truncate">{dateMatch[2]}</span>
            </div>
        );
    }
    return <span className="text-[11px] md:text-[16px] text-gray-700 font-bold leading-tight truncate">{text}</span>;
  };

  const renderWinningContent = (description: string | undefined, columnType?: LedgerColumn) => {
    const { dateStr, parsedLines } = parseAllWinningDetails(description || '');
    const isPanel1 = columnType === 'col1';
    
    return (
        <div className="flex flex-col w-full min-w-0 pt-0.5 overflow-visible font-mono">
            {dateStr && (
                <div className="text-[11px] md:text-[13px] text-gray-400 select-none pb-0.5 mb-1 pl-2 md:pl-4">
                    {dateStr}
                </div>
            )}
            
            <div className={`flex flex-col w-full min-w-0 overflow-visible ${isPanel1 ? 'gap-0.5' : 'gap-1'}`}>
                {parsedLines.map((line, i) => (
                    <div key={i} className={`flex items-center ${isPanel1 ? 'gap-0.5 text-[9px] md:text-[12px]' : 'gap-1.5 md:gap-4 text-[11px] md:text-[16px]'} text-gray-800 leading-none py-0.5 w-full whitespace-nowrap`}>
                        <span className={`font-bold text-gray-800 uppercase ${isPanel1 ? 'w-[20px] md:w-[26px]' : 'w-[30px] md:w-[38px]'} shrink-0 text-left`}>{line.sides}</span>
                        <span className={`font-bold text-gray-900 tracking-wider ${isPanel1 ? 'w-[32px] md:w-[40px]' : 'w-[44px] md:w-[54px]'} shrink-0 text-center`}>{line.number}</span>
                        <span className={`text-gray-400 text-center font-bold ${isPanel1 ? 'w-[32px] md:w-[42px] text-[8px] md:text-[10px]' : 'w-[45px] md:w-[60px] text-[10px] md:text-[12px]'} shrink-0`}>
                            {line.big}-{line.small}
                        </span>
                        <span className={`text-gray-400 uppercase font-bold ${isPanel1 ? 'w-[26px] md:w-[32px] text-[8px] md:text-[9px]' : 'w-[35px] md:w-[45px] text-[10px] md:text-[11px]'} shrink-0 text-center truncate`}>{line.type}</span>
                        
                        <div className={`${isPanel1 ? 'w-[18px] md:w-[22px]' : 'w-[24px] md:w-[28px]'} shrink-0 flex justify-center`}>
                            {line.pos && (
                                <div className={`${isPanel1 ? 'w-4 h-4 md:w-5 md:h-5 text-[9px] md:text-[11px]' : 'w-6 h-6 md:w-8 md:h-8 text-[11px] md:text-[15px]'} rounded-full border border-gray-900 flex items-center justify-center bg-white shadow-sm`}>
                                    <span className="font-black text-gray-900 leading-none">
                                        {line.pos}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className={`flex items-center justify-end pr-1 ${isPanel1 ? 'w-[90px] md:w-[120px] shrink-0' : 'flex-1 min-w-[60px] md:min-w-[100px]'}`}>
                            <span className="text-gray-300 px-1 font-light">-</span>
                            <span className={`text-red-600 font-black text-right truncate tracking-tighter ${isPanel1 ? 'text-sm md:text-lg' : 'text-base md:text-2xl'}`}>
                                {(() => {
                                    const rawVal = parseFloat(line.win.replace(/,/g, ''));
                                    return rawVal > 0 ? rawVal.toLocaleString(undefined, {minimumFractionDigits: 2}) : '';
                                })()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  };

  const LedgerColumnView = ({ data, footerLabel = "收", columnType }: { data: ReturnType<typeof calculateColumn>, footerLabel?: string, columnType: LedgerColumn }) => {
      if (data.processed.length === 0) return <div className="flex-1 min-h-[50px]" />;
      const isMain = footerLabel === '欠' || columnType === 'main';
      const hasCalculableRecords = data.processed.some(r => r.isVisible && r.operation !== 'none' && !r.isCalculationExcluded);
      const isNegative = data.finalBalance < 0;
      
      let displayLabel = footerLabel;
      if (isNegative && (footerLabel === '收' || footerLabel === '欠')) {
          displayLabel = columnType === 'main' ? '补' : '';
      }
      
      return (
      <div className="flex flex-col w-full px-1">
          <div className="flex flex-col space-y-0.5 w-full">
                {data.processed.map((r, index) => {
                    const isWinning = r.typeLabel === '中';
                    const hideLabel = isWinning && columnType === 'col1';
                    const showDescription = !(isWinning && columnType === 'main');
                    const showAmountColumn = !(isWinning && columnType === 'col1');
                    
                    let amountColorClass = 'text-gray-600';
                    const clientCode = client?.code?.toUpperCase();

                    if (r.isCalculationExcluded) {
                        if (clientCode === 'C19') {
                            amountColorClass = 'text-gray-900 font-bold'; // C19 = Always Black
                        } else if (clientCode === 'Z21') {
                            // Z21 = 1st record Gray, rest Black
                            amountColorClass = index === 0 ? 'text-gray-400' : 'text-gray-900 font-bold';
                        } else {
                            amountColorClass = 'text-gray-400'; // Default gray for excluded
                        }
                    } else if (r.operation === 'none') {
                        amountColorClass = 'text-gray-400';
                    } else if (r.operation === 'add') {
                        amountColorClass = 'text-green-700';
                    } else if (r.operation === 'subtract') {
                        amountColorClass = isMain ? 'text-red-700' : 'text-gray-900';
                    }

                    return (
                    <div key={r.id} className={`group flex items-start py-1 relative gap-1 md:gap-2 w-full ${!r.isVisible ? 'opacity-30 grayscale no-print' : ''}`}>
                        <div className="no-print opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 absolute -left-10 md:-left-12 top-0.5 z-40 bg-white shadow-sm rounded border border-gray-100 p-1">
                            <button onClick={() => startEditing(r)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Pencil size={12} /></button>
                            <button onClick={() => requestDeleteRecord(r.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
                        </div>

                        <div className="flex w-full items-start relative z-10 min-h-[24px]">
                            <div className={`${hideLabel ? 'w-0 overflow-hidden' : 'w-[20px] md:w-[32px]'} text-sm md:text-xl font-bold uppercase tracking-wide text-gray-600 shrink-0 text-center leading-tight pt-0.5`}>
                                {hideLabel ? '' : r.typeLabel}
                            </div>
                            <div className="flex-1 px-1 md:px-2 min-w-0 overflow-visible">
                                {showDescription ? (
                                    isWinning 
                                        ? renderWinningContent(r.description, columnType) 
                                        : renderFormattedDescription(r.description)
                                ) : null}
                            </div>
                            
                            {showAmountColumn ? (
                                <div className={`text-base md:text-2xl font-mono font-bold shrink-0 w-[110px] md:w-[160px] text-right leading-none pl-2 pt-0.5 ${amountColorClass}`}>
                                    {r.isCalculationExcluded ? r.amount.toLocaleString(undefined, {minimumFractionDigits: 2}) : 
                                     r.operation === 'none' ? r.amount.toLocaleString(undefined, {minimumFractionDigits: 2}) : 
                                     Math.abs(r.netChange).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                </div>
                            ) : (
                                <div className="shrink-0 w-0" />
                            )}
                        </div>
                    </div>
                )})}
          </div>

          {hasCalculableRecords && (
            <div className="mt-3 pt-1.5 flex flex-col items-end w-full border-t-2 border-gray-900">
                <div className="flex items-center gap-1 md:gap-4 justify-end w-full">
                    {displayLabel && <span className="text-sm md:text-xl font-bold text-gray-900 uppercase">{displayLabel}</span>}
                    <span className={`text-lg md:text-2xl font-mono font-bold min-w-[110px] md:min-w-[160px] text-right ${data.finalBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {data.finalBalance < 0 
                            ? (columnType === 'col1' 
                                ? Math.abs(data.finalBalance).toLocaleString(undefined, {minimumFractionDigits: 2}) 
                                : `(${Math.abs(data.finalBalance).toLocaleString(undefined, {minimumFractionDigits: 2})})`)
                            : data.finalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                </div>
            </div>
          )}
      </div>
  )};

  if (!client) return <div className="p-8 text-center text-gray-500">Loading client...</div>;

  return (
    <div className="bg-gray-100 min-h-screen pb-20">
      <div className="no-print bg-white sticky top-0 z-40 shadow-md">
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
          <div className="flex items-center space-x-4">
             <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-1">
                 <button onClick={handlePrevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-1 hover:bg-white rounded disabled:opacity-30"><ChevronLeft size={16}/></button>
                 <span className="px-2 text-xs font-bold w-20 text-center">{MONTH_NAMES[currentMonth].slice(0,3)} {currentYear}</span>
                 <button onClick={handleNextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-1 hover:bg-white rounded disabled:opacity-30"><ChevronRight size={16}/></button>
             </div>
             <div className="flex space-x-2">
                 <button onClick={openNewTab} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 shadow-sm hidden md:block" title="Open in New Tab"><ExternalLink size={18} /></button>
                 <button onClick={handleDownloadImage} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 shadow-sm hidden md:block" title="Download as Image"><ImageDown size={18} /></button>
                 <button onClick={handlePrint} className="bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-900 shadow-sm"><Printer size={18} /></button>
             </div>
          </div>
        </div>
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-start md:justify-center space-x-2 overflow-x-auto no-scrollbar">
             {sortedWeekKeys.map(wk => {
                const days = weeksData[Number(wk)];
                const rangeStr = getWeekRangeString(null, null, days);
                return (
                    <button key={wk} onClick={() => handleWeekSelect(Number(wk))} className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-colors whitespace-nowrap flex-shrink-0 ${selectedWeekNum === Number(wk) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                        {rangeStr}
                    </button>
                );
             })}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start relative">
            
            <aside className="hidden lg:flex flex-col gap-6 no-print sticky top-24 z-30 w-36 shrink-0 h-[calc(100vh-120px)] overflow-y-auto pr-2 no-scrollbar">
                
                <div className="space-y-2">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-1 mb-2">View Panels</div>
                    <button onClick={() => setActiveColumn('col1')} className={`w-full px-2 py-1.5 text-[10px] font-bold rounded-lg text-left transition-all border ${activeColumn === 'col1' ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'}`}>Panel 1</button>
                    <button onClick={() => setActiveColumn('col2')} className={`w-full px-2 py-1.5 text-[10px] font-bold rounded-lg text-left transition-all border ${activeColumn === 'col2' ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'}`}>Panel 2</button>
                    <button onClick={() => setActiveColumn('main')} className={`w-full px-2 py-1.5 text-[10px] font-bold rounded-lg text-left transition-all border ${activeColumn === 'main' ? 'bg-blue-600 text-white border-blue-600 shadow-md transform scale-105' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:text-gray-700'}`}>Main Ledger</button>
                </div>

                <div className="space-y-2">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-200 pb-1 mb-2">Categories</div>
                    <button 
                        onClick={handleQuickEntry}
                        className="w-full flex items-center px-2 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-all text-indigo-700 text-[10px] font-bold shadow-sm"
                    >
                        <Zap size={12} className="mr-1.5" /> Quick Entry
                    </button>
                    
                    <div className="grid grid-cols-1 gap-1 mt-2">
                        {categories.filter(c => c.label !== '').map((cat, index) => (
                            <div key={cat.id} className="relative group">
                                <button 
                                    onClick={() => handleCategorySelect(cat)}
                                    className={`w-full flex items-center justify-between px-2 py-1.5 border rounded-lg transition-all shadow-sm active:scale-95 ${cat.color} text-[10px] font-bold ${cat.operation === 'add' ? 'border-green-100' : cat.operation === 'subtract' ? 'border-red-100' : 'border-gray-100'}`}
                                >
                                    <span className="truncate pr-1">{cat.label}</span>
                                    {cat.operation === 'add' ? <Plus size={8} /> : cat.operation === 'subtract' ? <Minus size={8} /> : <Hash size={8} />}
                                </button>
                                <button onClick={(e) => requestDeleteCategory(e, cat.id)} className="absolute -top-1 -right-1 text-gray-400 hover:text-red-600 bg-white rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"><X size={8} /></button>
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={() => setIsAddCatModalOpen(true)}
                        className="w-full flex items-center justify-center py-1.5 bg-white border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all text-gray-500 text-[9px] font-bold uppercase mt-2"
                    >
                        <Plus size={10} className="mr-1" /> New
                    </button>
                </div>
            </aside>

            <div className="flex-1 w-full min-w-0">
                
                <div className="no-print mb-6 flex flex-col items-center space-y-4">
                    <div className="bg-white rounded-xl p-1 shadow-md border border-gray-200 flex w-full md:w-auto overflow-x-auto">
                        <button onClick={() => setActiveColumn('col1')} className={`flex-1 md:flex-none px-6 py-2.5 text-xs md:text-sm font-black rounded-lg transition-all whitespace-nowrap ${activeColumn === 'col1' ? 'bg-blue-600 text-white shadow-md transform scale-105' : 'text-gray-500 hover:bg-gray-50'}`}>Panel 1</button>
                        <button onClick={() => setActiveColumn('col2')} className={`flex-1 md:flex-none px-6 py-2.5 text-xs md:text-sm font-black rounded-lg transition-all whitespace-nowrap ${activeColumn === 'col2' ? 'bg-blue-600 text-white shadow-md transform scale-105' : 'text-gray-500 hover:bg-gray-50'}`}>Panel 2</button>
                        <button onClick={() => setActiveColumn('main')} className={`flex-1 md:flex-none px-6 py-2.5 text-xs md:text-sm font-black rounded-lg transition-all whitespace-nowrap ${activeColumn === 'main' ? 'bg-blue-600 text-white shadow-md transform scale-105' : 'text-gray-500 hover:bg-gray-50'}`}>Main Ledger</button>
                    </div>

                    {activeColumn === 'col1' && col1Ledger.processed.length > 0 && (
                        <button 
                            onClick={handleClearPanel1}
                            className="flex items-center px-6 py-2 bg-red-50 text-red-600 border-2 border-red-200 rounded-full text-xs font-black uppercase hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-lg active:scale-95 animate-in slide-in-from-top-2"
                        >
                            <Trash2 size={14} className="mr-2" /> Clear All Panel 1 Entries
                        </button>
                    )}
                </div>

                {activeCategory && (
                <div className="no-print mb-6 bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden animate-in slide-in-from-top-4 duration-300 ring-4 ring-blue-50/50">
                    <div className={`p-3 flex items-center justify-between ${activeCategory.label === '' ? 'bg-indigo-50 border-b border-indigo-100' : activeCategory.color}`}>
                        <div className="flex items-center space-x-2">
                            <h3 className="font-bold flex items-center text-sm text-gray-900">
                                {activeCategory.label || "Quick Entry Mode"}
                                {activeCategory.label !== '' && <span className="ml-2 text-[10px] font-normal opacity-75 border px-1.5 rounded-md border-current">{activeCategory.operation === 'add' ? '+' : activeCategory.operation === 'subtract' ? '-' : 'Ø'}</span>}
                            </h3>
                            <span className="text-[10px] opacity-50 px-2 py-0.5 bg-black/5 rounded-full">{activeColumn === 'main' ? 'Main' : activeColumn === 'col1' ? 'P1' : 'P2'}</span>
                        </div>
                        <button onClick={() => setActiveCategory(null)} className="p-1 hover:bg-black/10 rounded-full"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeCategory.label === '' && (
                            <div className="md:col-span-2">
                                <div className="flex space-x-2 mb-2">
                                    <button type="button" onClick={() => setCurrentOperation('add')} className={`flex-1 py-1.5 rounded-lg font-bold text-xs ${currentOperation === 'add' ? 'bg-green-100 text-green-800 ring-2 ring-green-500' : 'bg-gray-100 text-gray-500'}`}>(+) Add</button>
                                    <button type="button" onClick={() => setCurrentOperation('subtract')} className={`flex-1 py-1.5 rounded-lg font-bold text-xs ${currentOperation === 'subtract' ? 'bg-red-100 text-red-800 ring-2 ring-red-500' : 'bg-gray-100 text-gray-500'}`}>(-) Deduct</button>
                                    <button type="button" onClick={() => setCurrentOperation('none')} className={`flex-1 py-1.5 rounded-lg font-bold text-xs ${currentOperation === 'none' ? 'bg-gray-200 text-gray-800 ring-2 ring-gray-500' : 'bg-gray-100 text-gray-500'}`}>(Ø) Note</button>
                                </div>
                            </div>
                        )}
                        <div className="md:col-span-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Transaction Amount</label>
                            <input ref={amountInputRef} autoFocus type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-3 text-2xl font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-inner" placeholder="0.00"/>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block">Note / Ref</label>
                            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"/>
                        </div>
                        <div className="flex items-end">
                            <button type="submit" className={`w-full py-3 rounded-xl text-white font-black text-sm shadow-lg active:scale-95 transition-all ${activeCategory.label === '' ? (activeColumn === 'col1' ? 'bg-gray-700' : currentOperation === 'add' ? 'bg-green-600' : currentOperation === 'subtract' ? 'bg-red-600' : 'bg-gray-700') : (activeCategory.operation === 'add' ? 'bg-green-600' : activeCategory.operation === 'subtract' ? 'bg-red-600' : 'bg-gray-700')}`}>{activeCategory.label === '' ? 'Add & Continue' : `Confirm ${activeCategory.label}`}</button>
                        </div>
                    </form>
                </div>
                )}

                <div className="lg:hidden mb-6 no-print">
                    {!activeCategory && (
                        <div className="grid grid-cols-3 gap-2">
                             <button onClick={handleQuickEntry} className="flex items-center justify-center p-2 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-xs font-bold"><Zap size={14} className="mr-1" /> Quick</button>
                             {categories.slice(0, 5).filter(c => c.label !== '').map(cat => (
                                 <button key={cat.id} onClick={() => handleCategorySelect(cat)} className={`px-3 py-2 border rounded-xl text-[10px] font-bold truncate ${cat.color}`}>{cat.label}</button>
                             ))}
                        </div>
                    )}
                </div>

                <div id="printable-area" className="flex-1 w-full min-w-0">
                    <div className="bg-white border border-gray-200 shadow-sm min-h-[600px] relative text-lg font-serif">
                        <div style={{ height: `${verticalPadding.top}px` }} className="relative group w-full no-print-bg">
                            <div className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize z-20 opacity-0 group-hover:opacity-100 hover:bg-blue-200/50 transition-all flex items-center justify-center no-print" onMouseDown={(e) => startResizeVertical('top', e)}><div className="w-8 h-1 bg-blue-400 rounded-full"></div></div>
                        </div>
                        
                        <div className="px-4 md:px-8 pb-2 md:pb-4 flex justify-between items-end mb-2 md:mb-4">
                            <div>
                                <h2 className="text-2xl md:text-4xl font-bold text-gray-900 uppercase tracking-widest">{client.name}</h2>
                                {client.code && <p className="text-gray-600 mt-1 font-mono text-sm md:text-xl">{client.code}</p>}
                            </div>
                            <div className="md:hidden text-right">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Viewing</span>
                                <div className="text-sm font-bold text-blue-600 uppercase">{activeColumn === 'main' ? 'Main Ledger' : activeColumn === 'col1' ? 'Panel 1' : 'Panel 2'}</div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row w-full min-h-[400px] relative" ref={containerRef}>
                            <div className={`relative flex flex-col p-1 md:p-2 border-r border-transparent group ${activeColumn === 'col1' ? 'block w-full md:flex md:w-auto' : 'hidden md:flex'}`} style={{ width: window.innerWidth >= 1024 ? `${colWidths[0]}%` : undefined }}>
                                <LedgerColumnView data={col1Ledger} footerLabel="收" columnType="col1"/>
                                <div className="absolute top-0 right-0 bottom-0 w-4 cursor-col-resize z-20 flex justify-center translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity no-print hidden md:flex" onMouseDown={(e) => startResizeCol(0, e)}><div className="w-0.5 h-full bg-blue-400/50" /></div>
                            </div>
                            <div className={`relative flex flex-col p-1 md:p-2 border-r border-transparent group ${activeColumn === 'col2' ? 'block w-full md:flex md:w-auto' : 'hidden md:flex'}`} style={{ width: window.innerWidth >= 1024 ? `${colWidths[1]}%` : undefined }}>
                                <LedgerColumnView data={col2Ledger} footerLabel="收" columnType="col2"/>
                                <div className="absolute top-0 right-0 bottom-0 w-4 cursor-col-resize z-20 flex justify-center translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity no-print hidden md:flex" onMouseDown={(e) => startResizeCol(1, e)}><div className="w-0.5 h-full bg-blue-400/50" /></div>
                            </div>
                            <div className={`relative flex flex-col p-1 md:p-2 bg-gray-50/30 ${activeColumn === 'main' ? 'block w-full md:flex md:w-auto' : 'hidden md:flex'}`} style={{ width: window.innerWidth >= 1024 ? `${colWidths[2]}%` : undefined }}>
                                <LedgerColumnView data={mainLedger} footerLabel="欠" columnType="main"/>
                            </div>
                        </div>

                        <div style={{ height: `${verticalPadding.bottom}px` }} className="relative group w-full mt-auto no-print-bg">
                            <div className="absolute top-0 left-0 right-0 h-2 cursor-row-resize z-20 opacity-0 group-hover:opacity-100 hover:bg-blue-200/50 transition-all flex items-center justify-center no-print" onMouseDown={(e) => startResizeVertical('bottom', e)}><div className="w-8 h-1 bg-blue-400 rounded-full"></div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>

       {isAddCatModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print font-sans">
          <div className="bg-white rounded-xl shadow-xl w-full max-sm p-6">
            <h2 className="text-xl font-bold mb-4">Add Button Option</h2>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Button Name</label><input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} placeholder="e.g. Bonus" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Calculation Type</label><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setNewCatOp('add')} className={`py-2 px-1 rounded-lg border text-xs md:text-sm font-bold ${newCatOp === 'add' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-500'}`}>(+) Add</button><button type="button" onClick={() => setNewCatOp('subtract')} className={`py-2 px-1 rounded-lg border text-xs md:text-sm font-bold ${newCatOp === 'subtract' ? 'bg-red-50 border-red-500 text-red-700' : 'border-gray-200 text-gray-500'}`}>(-) Deduct</button><button type="button" onClick={() => setNewCatOp('none')} className={`py-2 px-1 rounded-lg border text-xs md:text-sm font-bold ${newCatOp === 'none' ? 'bg-gray-100 border-gray-500 text-gray-700' : 'border-gray-200 text-gray-500'}`}>Gray</button></div></div>
              <div className="flex justify-end space-x-3 mt-6"><button type="button" onClick={() => setIsAddCatModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create</button></div>
            </form>
          </div>
        </div>
      )}

      {confirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 no-print font-sans">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full mb-4 mx-auto ${confirmModal.type === 'PRINT_ERROR' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>{confirmModal.type === 'PRINT_ERROR' ? <Printer size={24} /> : <AlertTriangle size={24} />}</div>
                  <h3 className="text-xl font-bold text-center text-gray-900 mb-2">{confirmModal.title}</h3>
                  <p className="text-center text-gray-500 mb-6">{confirmModal.message}</p>
                  <div className="flex space-x-3"><button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Cancel</button>{confirmModal.type !== 'PRINT_ERROR' && <button onClick={handleConfirmAction} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Confirm</button>}</div>
              </div>
          </div>
      )}

      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print font-sans overflow-y-auto">
            <div className={`bg-white rounded-xl shadow-xl w-full p-6 my-8 mx-auto ${editingRecord.typeLabel === '中' ? 'max-w-4xl' : 'max-w-md'}`}>
                <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold">Edit Transaction</h2><button onClick={() => setEditingRecord(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button></div>
                <form onSubmit={handleUpdateRecord} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                             <label className="block text-sm font-medium text-gray-700 mb-1">Column</label>
                             <div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setEditingRecord({...editingRecord, column: 'col1'})} className={`py-1 px-2 text-xs rounded border ${editingRecord.column === 'col1' ? 'bg-blue-100 border-blue-500' : 'border-gray-200'}`}>Panel 1</button><button type="button" onClick={() => setEditingRecord({...editingRecord, column: 'col2'})} className={`py-1 px-2 text-xs rounded border ${editingRecord.column === 'col2' ? 'bg-blue-100 border-blue-500' : 'border-gray-200'}`}>Panel 2</button><button type="button" onClick={() => setEditingRecord({...editingRecord, column: 'main'})} className={`py-1 px-2 text-xs rounded border ${editingRecord.column === 'main' ? 'bg-blue-100 border-blue-500' : 'border-gray-200'}`}>Main</button></div>
                        </div>
                        <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><div className={`px-4 py-2 rounded-lg text-center font-bold text-sm ${editingRecord.operation === 'add' ? 'bg-green-100 text-green-800' : editingRecord.operation === 'subtract' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>{editingRecord.typeLabel}</div></div>
                        
                        <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label><input type="number" step="0.01" required value={editingRecord.amount} onChange={e => setEditingRecord({...editingRecord, amount: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
                        
                        {editingRecord.typeLabel === '中' ? (
                            <div className="md:col-span-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Structured Winner Info</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-400 font-bold">DATE:</span>
                                        <input type="text" value={editWinDate} onChange={e => setEditWinDate(e.target.value)} className="w-16 px-1.5 py-1 text-xs border rounded font-mono" placeholder="DD/MM" />
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {editWinLines.map((line, idx) => (
                                        <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 items-end bg-white p-2 rounded border border-gray-100 shadow-sm relative">
                                            <div className="flex-1 min-w-[60px]">
                                                <label className="block text-[9px] text-gray-400 font-bold uppercase">Sides</label>
                                                <input type="text" value={line.sides} onChange={e => {
                                                    const nl = [...editWinLines]; nl[idx].sides = e.target.value.toUpperCase(); setEditWinLines(nl);
                                                }} className="w-full px-2 py-1 text-xs border rounded uppercase font-mono" placeholder="MKT" />
                                            </div>
                                            <div className="flex-1 min-w-[70px]">
                                                <label className="block text-[9px] text-gray-400 font-bold uppercase">Number</label>
                                                <input type="text" value={line.number} onChange={e => {
                                                    const nl = [...editWinLines]; nl[idx].number = e.target.value; setEditWinLines(nl);
                                                }} className="w-full px-2 py-1 text-xs border rounded font-mono" placeholder="8888" />
                                            </div>
                                            <div className="w-12">
                                                <label className="block text-[9px] text-gray-400 font-bold uppercase text-center">Big</label>
                                                <input type="text" value={line.big} onChange={e => {
                                                    const nl = [...editWinLines]; nl[idx].big = e.target.value; setEditWinLines(nl);
                                                }} className="w-full px-1 py-1 text-xs border rounded text-center font-mono" />
                                            </div>
                                            <div className="w-12">
                                                <label className="block text-[9px] text-gray-400 font-bold uppercase text-center">Small</label>
                                                <input type="text" value={line.small} onChange={e => {
                                                    const nl = [...editWinLines]; nl[idx].small = e.target.value; setEditWinLines(nl);
                                                }} className="w-full px-1 py-1 text-xs border rounded text-center font-mono" />
                                            </div>
                                            <div className="w-20">
                                                <label className="block text-[9px] text-gray-400 font-bold uppercase text-right">Win Amt</label>
                                                <input type="text" value={line.win} onChange={e => {
                                                    const nl = [...editWinLines]; nl[idx].win = e.target.value; setEditWinLines(nl);
                                                }} className="w-full px-2 py-1 text-xs border rounded text-right font-bold text-red-600 font-mono" />
                                            </div>
                                            <div className="w-14">
                                                <label className="block text-[9px] text-gray-400 font-bold uppercase text-center">Type</label>
                                                <input type="text" value={line.type} onChange={e => {
                                                    const nl = [...editWinLines]; nl[idx].type = e.target.value; setEditWinLines(nl);
                                                }} className="w-full px-1 py-1 text-xs border rounded text-center font-mono" />
                                            </div>
                                            <div className="w-10">
                                                <label className="block text-[9px] text-gray-400 font-bold uppercase text-center">Pos</label>
                                                <input type="text" value={line.pos} onChange={e => {
                                                    const nl = [...editWinLines]; nl[idx].pos = e.target.value; setEditWinLines(nl);
                                                }} className="w-full px-1 py-1 text-xs border rounded text-center font-mono" />
                                            </div>
                                            <button type="button" onClick={() => setEditWinLines(editWinLines.filter((_, i) => i !== idx))} className="p-1.5 text-gray-400 hover:text-red-600 rounded bg-gray-50"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => setEditWinLines([...editWinLines, { sides: '', number: '', big: '0', small: '0', win: '0', type: 'ibox', pos: '头' }])} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:bg-white hover:border-gray-400 transition-all flex items-center justify-center text-xs font-bold uppercase"><Plus size={14} className="mr-2" /> Add Line</button>
                                </div>
                            </div>
                        ) : (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                                <input type="text" value={editingRecord.description} onChange={e => setEditingRecord({...editingRecord, description: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        )}

                        <div className="md:col-span-2"><label className="flex items-center space-x-2 mt-2"><input type="checkbox" checked={editingRecord.isVisible} onChange={e => setEditingRecord({...editingRecord, isVisible: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" /><span className="text-sm text-gray-700">Show on Statement</span></label></div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100"><button type="button" onClick={() => setEditingRecord(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"><Check size={18} className="mr-2" />Update</button></div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default ClientLedgerV1;
