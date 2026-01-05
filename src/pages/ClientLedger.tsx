import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Trash2, Plus, Minus, Pencil, X, Check, AlertTriangle, ExternalLink, GripHorizontal, Hash, Zap } from 'lucide-react';
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

type LedgerColumn = 'main' | 'col1' | 'col2';

// Helper to parse winning details from description string
// Format example: "25/02 KMT 8888 10 - 10 ibox 头 - 5000; ..."
const parseAllWinningDetails = (description: string) => {
    const dateMatch = description.match(/^(\d{1,2}\/\d{1,2})\s+(.*)/);
    let dateStr = '';
    let content = description;
    
    if (dateMatch) {
        dateStr = dateMatch[1];
        content = dateMatch[2];
    }

    const entries = content.split(';').map(s => s.trim()).filter(s => s);
    
    const parsedLines = entries.map(entry => {
        // Regex trying to match components: [SIDES] [NUMBER] [BIG]-[SMALL] [TYPE] [POS] - [WIN]
        // We look for the " - " divider for win amount at the end
        const winSplit = entry.lastIndexOf(' - ');
        if (winSplit === -1) return { raw: entry };

        const partDetails = entry.substring(0, winSplit);
        const winAmount = entry.substring(winSplit + 3);

        // Try to find the bet amounts "X - Y"
        const betSplitMatch = partDetails.match(/(\d+)\s*-\s*(\d+)/);
        
        let number = '';
        let sides = '';
        let big = '';
        let small = '';
        let type = '';
        let pos = '';

        if (betSplitMatch) {
            big = betSplitMatch[1];
            small = betSplitMatch[2];
            
            // Before bet: SIDES NUMBER
            const preBet = partDetails.substring(0, betSplitMatch.index).trim();
            // After bet: TYPE POS
            const postBet = partDetails.substring(betSplitMatch.index! + betSplitMatch[0].length).trim();

            const numberMatch = preBet.match(/(\d{3,4})$/);
            if (numberMatch) {
                number = numberMatch[1];
                sides = preBet.substring(0, preBet.length - number.length).trim();
            } else {
                number = preBet; // Fallback
            }

            // Post bet usually "ibox 头" or just "头"
            const postParts = postBet.split(/\s+/);
            if (postParts.length > 1) {
                pos = postParts[postParts.length - 1];
                type = postParts.slice(0, -1).join(' ');
            } else {
                pos = postParts[0];
            }
        } else {
            return { raw: entry };
        }

        return {
            sides,
            number,
            big,
            small,
            type,
            pos,
            win: winAmount
        };
    });

    return { dateStr, parsedLines };
};

const ClientLedger: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  
  // Input State
  const [activeCategory, setActiveCategory] = useState<TransactionCategory | null>(null);
  const [activeColumn, setActiveColumn] = useState<LedgerColumn>('main');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isVisible, setIsVisible] = useState(true);
  
  const [currentOperation, setCurrentOperation] = useState<'add'|'subtract'|'none'>('add');
  const amountInputRef = useRef<HTMLInputElement>(null);

  // New Category State
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatOp, setNewCatOp] = useState<'add'|'subtract'|'none'>('subtract');

  // Edit State
  const [editingRecord, setEditingRecord] = useState<LedgerRecord | null>(null);

  // Drag State
  const [draggedCatIndex, setDraggedCatIndex] = useState<number | null>(null);

  // Layout State
  const [colWidths, setColWidths] = useState<number[]>([33.33, 33.33, 33.34]);
  const [verticalPadding, setVerticalPadding] = useState<{top: number, bottom: number}>({ top: 40, bottom: 40 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{ type: 'col' | 'top' | 'bottom'; index?: number; startX?: number; startY?: number; startWidths?: number[]; startHeight?: number; containerWidth?: number } | null>(null);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; type: 'DELETE_RECORD' | 'DELETE_CATEGORY' | 'PRINT_ERROR'; targetId?: string; title: string; message: string; } | null>(null);

  useEffect(() => {
    if (id) {
        getClients().then(clients => {
            const found = clients.find(c => c.id === id);
            setClient(found || null);
        });
        getLedgerRecords(id).then(setRecords);
        setCategories(getCategories());
    }
  }, [id]);

  const refreshRecords = () => {
      if(id) getLedgerRecords(id).then(setRecords);
  }

  // --- Resize Handlers ---
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
        if (dragInfo.current.type === 'top') {
            setVerticalPadding(prev => ({ ...prev, top: Math.max(0, startHeight + diffY) }));
        } else {
             setVerticalPadding(prev => ({ ...prev, bottom: Math.max(0, startHeight - diffY) }));
        }
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
      if (activeColumn === 'col1') setCurrentOperation('none');
      else setCurrentOperation('add');
      setAmount('');
      setDescription('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !activeCategory || !amount) return;
    const val = parseFloat(amount);
    if (isNaN(val)) return;
    let op = activeCategory.label === '' ? currentOperation : activeCategory.operation;
    if (activeColumn === 'col1' && activeCategory.label === '') op = 'none';

    await saveLedgerRecord({
      clientId: id,
      date: new Date().toISOString().split('T')[0],
      description: description,
      typeLabel: activeCategory.label,
      amount: val,
      operation: op,
      column: activeColumn,
      isVisible: isVisible
    });
    
    refreshRecords();
    
    if (activeCategory.label.trim() === '') {
        setAmount('');
        setDescription('');
        setTimeout(() => amountInputRef.current?.focus(), 10);
    } else {
        setAmount('');
        setDescription('');
        setActiveCategory(null);
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
    setConfirmModal({ isOpen: true, type: 'DELETE_CATEGORY', targetId: catId, title: 'Delete Button', message: 'Delete this category button?' });
  };

  const requestDeleteRecord = (recordId: string) => {
    setConfirmModal({ isOpen: true, type: 'DELETE_RECORD', targetId: recordId, title: 'Delete Transaction', message: 'Permanently delete this record?' });
  };

  const handleConfirmAction = async () => {
      if (!confirmModal) return;
      if (confirmModal.type === 'DELETE_RECORD' && confirmModal.targetId) {
          await deleteLedgerRecord(confirmModal.targetId);
          refreshRecords();
      } else if (confirmModal.type === 'DELETE_CATEGORY' && confirmModal.targetId) {
          deleteCategory(confirmModal.targetId);
          setCategories(getCategories());
      }
      setConfirmModal(null);
  };

  const handlePrint = () => window.print();

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      await updateLedgerRecord(editingRecord.id, editingRecord);
      refreshRecords();
      setEditingRecord(null);
    }
  };

  const calculateColumn = (columnKey: LedgerColumn) => {
      const colRecords = records.filter(r => r.column === columnKey);
      const processed = colRecords.map(r => ({ ...r, netChange: getNetAmount(r) }));
      const visibleProcessed = processed.filter(r => r.isVisible);
      const finalBalance = visibleProcessed.reduce((acc, curr) => acc + curr.netChange, 0);
      return { processed, finalBalance };
  };

  const mainLedger = useMemo(() => calculateColumn('main'), [records]);
  const col1Ledger = useMemo(() => calculateColumn('col1'), [records]);
  const col2Ledger = useMemo(() => calculateColumn('col2'), [records]);

  const totalOwed = col1Ledger.processed.length > 0 ? col1Ledger.finalBalance : mainLedger.finalBalance;

  // The Winning Content Renderer
  const renderWinningContent = (description: string | undefined) => {
    const { dateStr, parsedLines } = parseAllWinningDetails(description || '');
    
    return (
        <div className="flex flex-col w-full min-w-0 pt-0.5 overflow-visible font-mono">
            {dateStr && (
                <div className="text-[10px] md:text-[11px] text-gray-400 select-none pb-0.5 pl-1 font-bold">
                    {dateStr}
                </div>
            )}
            
            <div className="flex flex-col w-full min-w-0 gap-1 overflow-visible">
                {parsedLines.map((line: any, i: number) => (
                    <div key={i} className="flex flex-col w-full bg-white/50 rounded-sm">
                        {line.raw ? (
                            <div className="text-[11px] text-gray-600 break-words">{line.raw}</div>
                        ) : (
                            <>
                                {line.sides && (
                                    <div className="text-[11px] font-extrabold text-gray-800 uppercase tracking-tight leading-none pl-1 mb-0.5">
                                        {line.sides}
                                    </div>
                                )}
                                <div className="flex items-center text-[13px] md:text-[15px] leading-none py-0.5 w-full whitespace-nowrap pl-1 min-w-max">
                                    <div className="font-black text-gray-900 tracking-tighter shrink-0 w-[34px] md:w-[44px]">
                                        {line.number}
                                    </div>
                                    <div className="text-gray-500 font-bold text-[10px] md:text-[12px] tracking-tighter shrink-0 w-[38px] md:w-[50px] text-center">
                                        {line.big}-{line.small}
                                    </div>
                                    <div className="text-gray-400 text-[10px] md:text-[11px] uppercase font-bold shrink-0 w-[32px] md:w-[42px] text-center">
                                        {line.type}
                                    </div>
                                    <div className="w-[20px] flex justify-center shrink-0">
                                        {line.pos && (
                                            <div className="w-4 h-4 rounded-full border border-gray-900 flex items-center justify-center bg-white shadow-sm">
                                                <span className="text-[9px] font-black text-gray-900 leading-none scale-90">
                                                    {line.pos}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-gray-300 font-light px-1 shrink-0">-</div>
                                    <div className="text-red-600 font-black text-lg md:text-xl tracking-tighter shrink-0 ml-1">
                                        {line.win}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
  };

  const LedgerColumnView = ({ data, footerLabel = "收" }: { data: ReturnType<typeof calculateColumn>, footerLabel?: string }) => {
      if (data.processed.length === 0) return <div className="flex-1 min-h-[50px]" />;
      
      const hasCalculableRecords = data.processed.some(r => r.isVisible && r.operation !== 'none');
      const isNegative = data.finalBalance < 0;
      let displayLabel = footerLabel;
      if (isNegative && (footerLabel === '收' || footerLabel === '欠')) displayLabel = '补';
      
      return (
      <div className="flex flex-col items-center">
          <div className="flex flex-col space-y-0.5 w-full items-end">
                {data.processed.map((r) => (
                <div key={r.id} className={`group flex justify-end items-center py-0.5 relative gap-1 md:gap-2 w-full ${!r.isVisible ? 'opacity-30 grayscale no-print' : ''}`}>
                    <div className="no-print opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 absolute -left-8 z-10">
                        <button onClick={() => setEditingRecord(r)} className="p-1 text-blue-600 bg-white shadow rounded"><Pencil size={12} /></button>
                        <button onClick={() => requestDeleteRecord(r.id)} className="p-1 text-red-600 bg-white shadow rounded"><Trash2 size={12} /></button>
                    </div>

                    <div className="text-sm md:text-xl font-bold uppercase tracking-wide text-gray-600 shrink-0">
                        {r.typeLabel}
                    </div>

                    {r.typeLabel === '中' ? (
                        <div className="flex-1 mr-2 min-w-0">
                            {renderWinningContent(r.description)}
                        </div>
                    ) : (
                        r.description && (
                            <div className="text-xs md:text-sm text-gray-600 font-medium mr-1 md:mr-2 max-w-[150px] truncate text-right flex-1">
                                {r.description}
                            </div>
                        )
                    )}

                    {r.typeLabel !== '中' && (
                        <div className={`text-base md:text-2xl font-mono font-bold w-20 md:w-36 text-right shrink-0 ${r.operation === 'add' ? 'text-green-700' : r.operation === 'subtract' ? 'text-red-700' : 'text-gray-600'}`}>
                            {r.operation === 'none' ? r.amount.toLocaleString(undefined, {minimumFractionDigits: 2}) : Math.abs(r.netChange).toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </div>
                    )}
                </div>
            ))}
          </div>
          {hasCalculableRecords && (
            <div className="mt-2 pt-1 flex flex-col items-end w-fit border-t-2 border-gray-900">
                <div className="flex items-center gap-1 md:gap-2 justify-end">
                    <span className="text-sm md:text-xl font-bold text-gray-900 uppercase">{displayLabel}</span>
                    <span className={`text-lg md:text-3xl font-mono font-bold w-24 md:w-40 text-right ${data.finalBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {data.finalBalance < 0 ? `(${Math.abs(data.finalBalance).toLocaleString(undefined, {minimumFractionDigits: 2})})` : data.finalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                </div>
            </div>
          )}
      </div>
  )};

  if (!client) return <div className="p-8">Loading...</div>;

  return (
    <div className="bg-gray-100 min-h-screen pb-20">
      <div className="no-print bg-white sticky top-0 z-20 shadow-md">
        <div className="flex items-center justify-between p-3 md:p-4 max-w-5xl mx-auto">
          <div className="flex items-center space-x-2 md:space-x-3">
            <Link to="/clients" className="p-2 hover:bg-gray-100 rounded-full text-gray-600"><ArrowLeft size={20} /></Link>
            <div><h1 className="text-base md:text-lg font-bold text-gray-900">{client.name}</h1><p className="text-[10px] md:text-xs text-gray-500 font-mono">{client.code}</p></div>
          </div>
          <div className="flex items-center space-x-2">
             <div className="text-right mr-2">
                <p className={`text-sm md:text-lg font-bold ${totalOwed >= 0 ? 'text-green-600' : 'text-red-600'}`}>${Math.abs(totalOwed).toLocaleString()}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase">{totalOwed >= 0 ? 'OWES' : 'CREDIT'}</p>
             </div>
             <button onClick={handlePrint} className="bg-gray-800 text-white px-3 py-2 rounded-lg"><Printer size={18} /></button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 md:px-8 py-4 md:py-6">
        <div className="no-print mb-6 space-y-4">
            <div className="flex justify-center gap-2">
                <button onClick={() => setActiveColumn('col1')} className={`px-4 py-2 rounded ${activeColumn === 'col1' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Panel 1</button>
                <button onClick={() => setActiveColumn('col2')} className={`px-4 py-2 rounded ${activeColumn === 'col2' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Panel 2</button>
                <button onClick={() => setActiveColumn('main')} className={`px-4 py-2 rounded ${activeColumn === 'main' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Main</button>
            </div>
            
            {!activeCategory ? (
            <div className="grid grid-cols-4 gap-2">
                {categories.filter(c => c.label !== '').map((cat) => (
                    <button key={cat.id} onClick={() => handleCategorySelect(cat)} className={`p-4 rounded border-2 font-bold ${cat.color}`}>{cat.label}</button>
                ))}
                <button onClick={handleQuickEntry} className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded text-indigo-700 font-bold">Quick Entry</button>
                <button onClick={() => setIsAddCatModalOpen(true)} className="p-4 border-2 border-dashed border-gray-300 rounded text-gray-500 font-bold">+ New</button>
            </div>
            ) : (
            <div className="bg-white p-4 rounded shadow border border-gray-200">
                <div className="flex justify-between mb-4">
                    <h3 className="font-bold">{activeCategory.label || "Quick Entry"}</h3>
                    <button onClick={() => setActiveCategory(null)}><X size={20}/></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {activeCategory.label === '' && (
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setCurrentOperation('add')} className={`flex-1 py-2 rounded ${currentOperation==='add' ? 'bg-green-100' : 'bg-gray-100'}`}>Add</button>
                            <button type="button" onClick={() => setCurrentOperation('subtract')} className={`flex-1 py-2 rounded ${currentOperation==='subtract' ? 'bg-red-100' : 'bg-gray-100'}`}>Sub</button>
                            <button type="button" onClick={() => setCurrentOperation('none')} className={`flex-1 py-2 rounded ${currentOperation==='none' ? 'bg-gray-200' : 'bg-gray-100'}`}>Note</button>
                        </div>
                    )}
                    <input ref={amountInputRef} type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full p-2 border rounded text-lg" placeholder="Amount" autoFocus />
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded" placeholder="Note" />
                    <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded font-bold">Confirm</button>
                </form>
            </div>
            )}
        </div>

        <div id="printable-area" className="bg-white shadow border border-gray-200 min-h-[600px] p-4 flex relative" ref={containerRef}>
             <div style={{height: verticalPadding.top}} className="w-full absolute top-0 left-0 no-print hover:bg-blue-50 cursor-row-resize" onMouseDown={(e) => startResizeVertical('top', e)}></div>
             
             <div style={{width: `${colWidths[0]}%`}} className="border-r p-2 relative group">
                 <LedgerColumnView data={col1Ledger} footerLabel="收" />
                 <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-200 no-print" onMouseDown={(e) => startResizeCol(0, e)}></div>
             </div>
             <div style={{width: `${colWidths[1]}%`}} className="border-r p-2 relative group">
                 <LedgerColumnView data={col2Ledger} footerLabel="收" />
                 <div className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-200 no-print" onMouseDown={(e) => startResizeCol(1, e)}></div>
             </div>
             <div style={{width: `${colWidths[2]}%`}} className="p-2 bg-gray-50/30">
                 <LedgerColumnView data={mainLedger} footerLabel="欠" />
             </div>

             <div style={{height: verticalPadding.bottom}} className="w-full absolute bottom-0 left-0 no-print hover:bg-blue-50 cursor-row-resize" onMouseDown={(e) => startResizeVertical('bottom', e)}></div>
        </div>
      </div>

      {isAddCatModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-xl w-80">
                <h3 className="font-bold mb-4">New Category</h3>
                <form onSubmit={handleAddCategory} className="space-y-4">
                    <input value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} className="w-full p-2 border rounded" placeholder="Label" />
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setNewCatOp('add')} className={`flex-1 py-2 border rounded ${newCatOp==='add'?'bg-green-100':''}`}>Add</button>
                        <button type="button" onClick={() => setNewCatOp('subtract')} className={`flex-1 py-2 border rounded ${newCatOp==='subtract'?'bg-red-100':''}`}>Sub</button>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setIsAddCatModalOpen(false)} className="px-4 py-2">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {editingRecord && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded shadow-xl w-96">
                  <h3 className="font-bold mb-4">Edit Record</h3>
                  <form onSubmit={handleUpdateRecord} className="space-y-4">
                      <input type="number" value={editingRecord.amount} onChange={e => setEditingRecord({...editingRecord, amount: parseFloat(e.target.value)})} className="w-full p-2 border rounded" />
                      <input value={editingRecord.description} onChange={e => setEditingRecord({...editingRecord, description: e.target.value})} className="w-full p-2 border rounded" />
                      <div className="flex gap-2">
                          <button type="button" onClick={() => setEditingRecord({...editingRecord, column: 'col1'})} className={`flex-1 border p-2 ${editingRecord.column==='col1'?'bg-blue-100':''}`}>P1</button>
                          <button type="button" onClick={() => setEditingRecord({...editingRecord, column: 'col2'})} className={`flex-1 border p-2 ${editingRecord.column==='col2'?'bg-blue-100':''}`}>P2</button>
                          <button type="button" onClick={() => setEditingRecord({...editingRecord, column: 'main'})} className={`flex-1 border p-2 ${editingRecord.column==='main'?'bg-blue-100':''}`}>Main</button>
                      </div>
                      <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingRecord(null)} className="px-4 py-2">Cancel</button>
                          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Update</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {confirmModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded shadow-xl w-80 text-center">
                  <h3 className="font-bold text-red-600 mb-2">{confirmModal.title}</h3>
                  <p className="mb-4 text-sm">{confirmModal.message}</p>
                  <div className="flex gap-2 justify-center">
                      <button onClick={() => setConfirmModal(null)} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
                      <button onClick={handleConfirmAction} className="px-4 py-2 bg-red-600 text-white rounded">Confirm</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ClientLedger;