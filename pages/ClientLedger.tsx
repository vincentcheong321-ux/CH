
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  
  // Local state to override operation for the "Quick Entry" (empty label) mode
  const [currentOperation, setCurrentOperation] = useState<'add'|'subtract'|'none'>('add');

  // Focus Management for Continuous Entry
  const amountInputRef = useRef<HTMLInputElement>(null);

  // New Category State
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatOp, setNewCatOp] = useState<'add'|'subtract'|'none'>('subtract');

  // Edit State
  const [editingRecord, setEditingRecord] = useState<LedgerRecord | null>(null);

  // Drag State
  const [draggedCatIndex, setDraggedCatIndex] = useState<number | null>(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'DELETE_RECORD' | 'DELETE_CATEGORY' | 'PRINT_ERROR';
    targetId?: string;
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (id) {
      const clients = getClients();
      const found = clients.find(c => c.id === id);
      setClient(found || null);
      loadRecords();
      setCategories(getCategories());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadRecords = () => {
    if (id) {
      const recs = getLedgerRecords(id);
      setRecords(recs);
    }
  };

  const handleCategorySelect = (cat: TransactionCategory) => {
    setActiveCategory(cat);
    // Initialize current operation from category default
    setCurrentOperation(cat.operation);
    setAmount('');
    setDescription(''); // Ensure note starts empty (removed auto-date)
  };

  const handleQuickEntry = () => {
      // Create a dummy category for Quick Entry
      const quickCat: TransactionCategory = {
          id: 'quick_entry',
          label: '',
          operation: 'add',
          color: 'bg-blue-600 text-white' // Highlight color for active state
      };
      setActiveCategory(quickCat);
      
      // Panel 1 Rule: Quick Entry defaults to 'none' (Note)
      if (activeColumn === 'col1') {
          setCurrentOperation('none');
      } else {
          setCurrentOperation('add'); // Default to add for others
      }
      
      setAmount('');
      setDescription(''); // Default empty for quick entry
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !activeCategory || !amount) return;

    const val = parseFloat(amount);
    if (isNaN(val)) return;

    // Determine Operation
    let op = activeCategory.label === '' ? currentOperation : activeCategory.operation;

    // FORCE RULE: Panel 1 Unnamed/Quick Entry MUST NOT calculate.
    if (activeColumn === 'col1' && activeCategory.label === '') {
        op = 'none';
    }

    const newRecord: Omit<LedgerRecord, 'id'> = {
      clientId: id,
      date: new Date().toISOString(),
      description: description,
      typeLabel: activeCategory.label, // Will be empty string for Quick Entry
      amount: val,
      operation: op,
      column: activeColumn,
      isVisible: isVisible
    };

    const saved = saveLedgerRecord(newRecord);
    // Optimistic Update
    setRecords(prev => [...prev, saved]);
    
    // Logic for Continuous Entry (Button without name)
    const isUnnamedButton = activeCategory.label.trim() === '';

    if (isUnnamedButton) {
        // Continuous Entry Mode
        setAmount('');
        setDescription(''); // Clear description for next entry
        
        // Refocus amount input for next entry immediately
        setTimeout(() => {
            if (amountInputRef.current) {
                amountInputRef.current.focus();
            }
        }, 10);
    } else {
        // Standard Mode
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

    saveCategory({
      label: newCatLabel,
      operation: newCatOp,
      color: colorClass
    });
    setCategories(getCategories());
    setIsAddCatModalOpen(false);
    setNewCatLabel('');
  };

  // --- Drag and Drop Handlers ---
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

  // --- Delete Handlers ---

  const requestDeleteCategory = (e: React.MouseEvent, catId: string) => {
    e.stopPropagation();
    setConfirmModal({
        isOpen: true,
        type: 'DELETE_CATEGORY',
        targetId: catId,
        title: 'Delete Button',
        message: 'Are you sure you want to remove this category button? This will not delete existing transactions.'
    });
  };

  const requestDeleteRecord = (recordId: string) => {
    setConfirmModal({
        isOpen: true,
        type: 'DELETE_RECORD',
        targetId: recordId,
        title: 'Delete Transaction',
        message: 'Are you sure you want to permanently delete this transaction record?'
    });
  };

  const handleConfirmAction = () => {
      if (!confirmModal) return;

      if (confirmModal.type === 'DELETE_RECORD' && confirmModal.targetId) {
          deleteLedgerRecord(confirmModal.targetId);
          setRecords(prev => prev.filter(r => r.id !== confirmModal.targetId));
      } else if (confirmModal.type === 'DELETE_CATEGORY' && confirmModal.targetId) {
          deleteCategory(confirmModal.targetId);
          setCategories(getCategories());
      }

      setConfirmModal(null);
  };

  // --- Print Handler ---

  const openNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  const handlePrint = () => {
    const isSandboxed = window.self !== window.top;
    if (isSandboxed) {
        setConfirmModal({
            isOpen: true,
            type: 'PRINT_ERROR',
            title: 'Print Restricted',
            message: 'Printing is restricted in this preview window. Please open the app in a new tab to print successfully.'
        });
        return;
    }
    try {
        window.print();
    } catch (error) {
        console.error("Print failed:", error);
        setConfirmModal({
            isOpen: true,
            type: 'PRINT_ERROR',
            title: 'Print Blocked',
            message: 'Printing was blocked. Please try opening the app in a new tab.'
        });
    }
  };

  // --- Edit Handlers ---

  const handleEditClick = (record: LedgerRecord) => {
    setEditingRecord(record);
  };

  const handleUpdateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      const updatedFields = {
        amount: editingRecord.amount,
        description: editingRecord.description,
        date: editingRecord.date,
        isVisible: editingRecord.isVisible,
        column: editingRecord.column
      };
      updateLedgerRecord(editingRecord.id, updatedFields);
      setRecords(prev => prev.map(r => r.id === editingRecord.id ? { ...r, ...updatedFields } : r));
      setEditingRecord(null);
    }
  };

  // Process records for each column
  const calculateColumn = (columnKey: LedgerColumn) => {
      const colRecords = records.filter(r => r.column === columnKey);
      const processed = colRecords.map(r => {
          const netChange = getNetAmount(r);
          return { ...r, netChange };
      });
      // Filter out invisible for total calculation
      const visibleProcessed = processed.filter(r => r.isVisible);
      const finalBalance = visibleProcessed.reduce((acc, curr) => acc + curr.netChange, 0);

      return { 
          processed, // Keep all for list
          finalBalance
      };
  };

  const mainLedger = useMemo(() => calculateColumn('main'), [records]);
  const col1Ledger = useMemo(() => calculateColumn('col1'), [records]);
  const col2Ledger = useMemo(() => calculateColumn('col2'), [records]);

  // Total Priority: If Panel 1 (col1) has data, use that total. Otherwise fallback to Main Ledger.
  const totalOwed = col1Ledger.processed.length > 0 
      ? col1Ledger.finalBalance 
      : mainLedger.finalBalance;

  // Helper Component for Rendering a Ledger Column
  const LedgerColumnView = ({ 
      data,
      footerLabel = "收"
  }: { 
      data: ReturnType<typeof calculateColumn>,
      footerLabel?: string
  }) => {
      // If empty, return just an empty spacer (no footer, no total)
      if (data.processed.length === 0) {
          return <div className="flex-1 min-h-[50px]" />;
      }

      // Check if we should show the footer.
      // If ALL visible records are 'none' (gray notes), DO NOT show the footer.
      // We show footer if at least one visible record is NOT 'none'.
      const hasCalculableRecords = data.processed.some(r => r.isVisible && r.operation !== 'none');

      // Dynamic Label Logic: If Total is negative and label is '收', change to '补'
      const isNegative = data.finalBalance < 0;
      const displayLabel = (footerLabel === '收' && isNegative) ? '补' : footerLabel;
      
      return (
      <div className="flex flex-col items-center">
          <div className="flex flex-col space-y-0.5 w-fit items-end">
                {data.processed.map((r) => (
                <div 
                    key={r.id} 
                    className={`
                        group flex justify-end items-center py-0.5 relative gap-1 md:gap-2
                        ${!r.isVisible ? 'opacity-30 grayscale no-print' : ''}
                    `}
                >
                    {/* Action buttons - Absolute Left */}
                    <div className="no-print opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1 absolute -left-16 z-10 bg-white shadow-sm rounded border border-gray-100 p-1">
                        <button onClick={() => handleEditClick(r)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Pencil size={12} /></button>
                        <button onClick={() => requestDeleteRecord(r.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 size={12} /></button>
                    </div>

                    <div className="text-sm md:text-xl font-bold uppercase tracking-wide text-gray-600">
                        {r.typeLabel}
                    </div>

                    {/* Description/Note displayed next to amount in LARGER font */}
                    {r.description && (
                        <div className="text-xs md:text-sm text-gray-600 font-medium mr-1 md:mr-2 max-w-[100px] md:max-w-[150px] truncate">
                            {r.description}
                        </div>
                    )}

                    {/* Amount Coloring: Green for Add, Red for Subtract, Dark Gray for None */}
                    <div className={`text-base md:text-2xl font-mono font-bold w-20 md:w-36 text-right 
                        ${r.operation === 'add' ? 'text-green-700' : 
                          r.operation === 'subtract' ? 'text-red-700' : 'text-gray-600'}`}>
                        {r.operation === 'none' 
                            ? r.amount.toLocaleString(undefined, {minimumFractionDigits: 2})
                            : r.netChange < 0 
                                ? `(${Math.abs(r.netChange).toLocaleString(undefined, {minimumFractionDigits: 2})})`
                                : r.netChange.toLocaleString(undefined, {minimumFractionDigits: 2})
                        }
                    </div>
                </div>
            ))}
          </div>

          {/* Column Footer Total with LINING restored and Strict Alignment */}
          {/* Only show if there are calculable records */}
          {hasCalculableRecords && (
            <div className="mt-2 pt-1 flex flex-col items-end w-fit border-t-2 border-gray-900">
                <div className="flex items-center gap-1 md:gap-2 justify-end">
                    <span className="text-sm md:text-xl font-bold text-gray-900 uppercase">{displayLabel}</span>
                    <span className={`text-lg md:text-3xl font-mono font-bold w-24 md:w-40 text-right ${data.finalBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {data.finalBalance < 0 
                            ? `(${Math.abs(data.finalBalance).toLocaleString(undefined, {minimumFractionDigits: 2})})` 
                            : data.finalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})
                        }
                    </span>
                </div>
            </div>
          )}
      </div>
  )};

  if (!client) return <div className="p-8">Loading client data...</div>;

  return (
    <div className="bg-gray-100 min-h-screen pb-20">
      {/* Header - Sticky on Mobile */}
      <div className="no-print bg-white sticky top-0 z-20 shadow-md">
        <div className="flex items-center justify-between p-3 md:p-4 max-w-5xl mx-auto">
          <div className="flex items-center space-x-2 md:space-x-3">
            <Link to="/clients" className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-base md:text-lg font-bold text-gray-900 leading-tight">
                {client.name}
              </h1>
              <p className="text-[10px] md:text-xs text-gray-500 font-mono">{client.code}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
             <div className="text-right mr-2">
                <p className={`text-sm md:text-lg font-bold leading-tight ${totalOwed >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                   ${Math.abs(totalOwed).toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{totalOwed >= 0 ? 'OWES' : 'CREDIT'}</p>
             </div>
             <div className="hidden md:flex space-x-2">
                 <button onClick={openNewTab} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 shadow-sm" title="Open in New Tab"><ExternalLink size={18} /></button>
                 <button onClick={handlePrint} className="bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-900 shadow-sm"><Printer size={18} /></button>
             </div>
             <button onClick={handlePrint} className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Printer size={20} /></button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-2 md:px-8 py-4 md:py-6">
        
        {/* Input & Panel Selection Area - No Print */}
        <div className="no-print mb-6 md:mb-8 space-y-4">
            
            {/* Panel Selector */}
            <div className="flex justify-center">
                <div className="bg-white rounded-lg p-1 shadow-sm border border-gray-200 flex w-full md:w-auto overflow-x-auto">
                    <button 
                        onClick={() => setActiveColumn('col1')}
                        className={`flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold rounded-md transition-all whitespace-nowrap ${activeColumn === 'col1' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Panel 1
                    </button>
                    <button 
                        onClick={() => setActiveColumn('col2')}
                        className={`flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold rounded-md transition-all whitespace-nowrap ${activeColumn === 'col2' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Panel 2
                    </button>
                    <button 
                        onClick={() => setActiveColumn('main')}
                        className={`flex-1 md:flex-none px-3 py-2 text-xs md:text-sm font-bold rounded-md transition-all whitespace-nowrap ${activeColumn === 'main' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                         Main Ledger
                    </button>
                </div>
            </div>

            {/* Category Grid */}
            {!activeCategory ? (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 md:gap-3">
                {/* 1. Standard Named Categories (Filter out empty labels) */}
                {categories.filter(c => c.label !== '').map((cat, index) => (
                <div 
                    key={cat.id} 
                    className="relative group touch-manipulation cursor-grab active:cursor-grabbing"
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={handleDrop}
                >
                    <button 
                        onClick={() => handleCategorySelect(cat)}
                        className={`w-full h-full flex flex-col items-center justify-center p-3 md:p-4 border-2 rounded-xl transition-all shadow-sm active:scale-95 ${cat.color} ${cat.operation === 'add' ? 'border-green-100 hover:border-green-300' : cat.operation === 'subtract' ? 'border-red-100 hover:border-red-300' : 'border-gray-100 hover:border-gray-300'}`}
                    >
                        <div className={`p-1.5 md:p-2 rounded-full mb-1 md:mb-2 bg-black bg-opacity-5`}>
                            {cat.operation === 'add' ? <Plus size={16} /> : 
                             cat.operation === 'subtract' ? <Minus size={16} /> :
                             <Hash size={16} />}
                        </div>
                        <span className="text-sm md:text-base font-bold text-center truncate w-full">
                            {cat.label}
                        </span>
                    </button>
                    <div className="absolute top-1 left-1 text-gray-400 opacity-50 hidden md:block"><GripHorizontal size={14} /></div>
                    <button 
                        onClick={(e) => requestDeleteCategory(e, cat.id)}
                        className="absolute -top-2 -right-2 text-gray-400 hover:text-red-600 bg-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X size={14} />
                    </button>
                </div>
                ))}
                
                {/* 2. Consolidated Quick Entry Button */}
                <button 
                    onClick={handleQuickEntry}
                    className="flex flex-col items-center justify-center p-3 md:p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl hover:bg-indigo-100 transition-all text-indigo-700 active:scale-95"
                >
                    <div className="p-1.5 md:p-2 rounded-full mb-1 md:mb-2 bg-indigo-200">
                        <Zap size={16} />
                    </div>
                    <span className="text-sm md:text-base font-bold text-center">
                        Quick Entry
                    </span>
                </button>

                {/* 3. New Category Button */}
                <button 
                onClick={() => setIsAddCatModalOpen(true)}
                className="flex flex-col items-center justify-center p-3 md:p-4 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all text-gray-500"
                >
                <Plus size={20} className="mb-1" />
                <span className="text-[10px] md:text-xs font-bold uppercase">New</span>
                </button>
            </div>
            ) : (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-fade-in ring-4 ring-blue-50/50">
                <div className={`p-3 flex items-center justify-between ${activeCategory.label === '' ? 'bg-indigo-50 border-b border-indigo-100' : activeCategory.color}`}>
                <div className="flex items-center space-x-2">
                    <h3 className="font-bold flex items-center text-sm md:text-base text-gray-900">
                        {activeCategory.label || "Quick Entry Mode"}
                        {activeCategory.label !== '' && (
                             <span className="ml-2 text-xs font-normal opacity-75 border px-1 rounded border-current">
                                {activeCategory.operation === 'add' ? '+' : 
                                 activeCategory.operation === 'subtract' ? '-' : 'Ø'}
                            </span>
                        )}
                    </h3>
                    <span className="text-[10px] md:text-xs opacity-50 px-2 py-0.5 bg-black/5 rounded-full">
                         {activeColumn === 'main' ? 'Main' : activeColumn === 'col1' ? 'P1' : 'P2'}
                    </span>
                    {activeCategory.label === '' && <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">Continuous</span>}
                </div>
                <button onClick={() => setActiveCategory(null)} className="p-1 hover:bg-black/10 rounded"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* If Quick Entry (no label) */}
                {activeCategory.label === '' && (
                    <div className="md:col-span-2">
                        {/* PANEL 1 RULE: Hide toggles, show info message */}
                        {activeColumn === 'col1' ? (
                            <div className="bg-gray-100 text-gray-600 p-2 rounded-lg text-center font-bold text-sm mb-2 border border-gray-200">
                                (Ø) Note Only Mode (No Calculation)
                            </div>
                        ) : (
                            <div className="flex space-x-2 mb-2">
                                <button type="button" onClick={() => setCurrentOperation('add')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${currentOperation === 'add' ? 'bg-green-100 text-green-800 ring-2 ring-green-500' : 'bg-gray-100 text-gray-500'}`}>
                                    (+) Add
                                </button>
                                <button type="button" onClick={() => setCurrentOperation('subtract')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${currentOperation === 'subtract' ? 'bg-red-100 text-red-800 ring-2 ring-red-500' : 'bg-gray-100 text-gray-500'}`}>
                                    (-) Deduct
                                </button>
                                <button type="button" onClick={() => setCurrentOperation('none')} className={`flex-1 py-2 rounded-lg font-bold text-sm ${currentOperation === 'none' ? 'bg-gray-200 text-gray-800 ring-2 ring-gray-500' : 'bg-gray-100 text-gray-500'}`}>
                                    (Ø) Note
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="md:col-span-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Amount</label>
                    <input 
                        ref={amountInputRef}
                        autoFocus 
                        type="number" step="0.01" required 
                        value={amount} 
                        onChange={e => setAmount(e.target.value)} 
                        className="w-full mt-1 p-3 text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="0.00"
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Note</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full mt-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"/>
                </div>
                <div className="flex items-end">
                    <button type="submit" className={`w-full py-3 rounded-lg text-white font-bold shadow-md active:scale-95 transition-transform 
                        ${activeCategory.label === '' 
                            ? (activeColumn === 'col1' ? 'bg-gray-600' : currentOperation === 'add' ? 'bg-green-600' : currentOperation === 'subtract' ? 'bg-red-600' : 'bg-gray-600')
                            : (activeCategory.operation === 'add' ? 'bg-green-600' : activeCategory.operation === 'subtract' ? 'bg-red-600' : 'bg-gray-600')
                        }`}>
                    {activeCategory.label === '' ? 'Add & Continue' : `Confirm ${activeCategory.label}`}
                    </button>
                </div>
                </form>
            </div>
            )}
        </div>

        {/* Paper Statement View - 3 Columns */}
        <div id="printable-area" className="relative max-w-5xl mx-auto">
            <div className="bg-white border border-gray-200 shadow-sm min-h-[600px] relative text-lg font-serif">
                
                {/* Header */}
                <div className="p-4 md:p-8 pb-2 md:pb-4 flex justify-between items-end mb-2 md:mb-4">
                    <div>
                        <h2 className="text-2xl md:text-4xl font-bold text-gray-900 uppercase tracking-widest">{client.name}</h2>
                        {client.code && <p className="text-gray-600 mt-1 font-mono text-sm md:text-xl">{client.code}</p>}
                    </div>
                    {/* Statement Date removed as requested */}
                </div>

                {/* 3-Column Layout */}
                <div className="grid grid-cols-3 gap-0 min-h-[400px]">
                    
                    {/* Column 1 - Independent Ledger */}
                    <div className="p-1 md:p-2 border-r border-transparent">
                        <LedgerColumnView 
                            data={col1Ledger}
                            footerLabel="收"
                        />
                    </div>

                    {/* Column 2 - Independent Ledger */}
                    <div className="p-1 md:p-2 border-r border-transparent">
                        <LedgerColumnView 
                            data={col2Ledger} 
                            footerLabel="收"
                        />
                    </div>

                    {/* Column 3 - Main Ledger */}
                    <div className="p-1 md:p-2 bg-gray-50/30">
                        <LedgerColumnView 
                            data={mainLedger} 
                            footerLabel="欠"
                        />
                    </div>
                </div>
            </div>
        </div>
      </div>

       {/* Add Category Modal */}
       {isAddCatModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print font-sans">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">Add Button Option</h2>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Button Name <span className="text-gray-400 font-normal">(Optional)</span></label>
                <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={newCatLabel} onChange={e => setNewCatLabel(e.target.value)} placeholder="e.g. Bonus" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calculation Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setNewCatOp('add')} className={`py-2 px-1 rounded-lg border text-xs md:text-sm font-bold ${newCatOp === 'add' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-500'}`}>(+) Add</button>
                  <button type="button" onClick={() => setNewCatOp('subtract')} className={`py-2 px-1 rounded-lg border text-xs md:text-sm font-bold ${newCatOp === 'subtract' ? 'bg-red-50 border-red-500 text-red-700' : 'border-gray-200 text-gray-500'}`}>(-) Deduct</button>
                  <button type="button" onClick={() => setNewCatOp('none')} className={`py-2 px-1 rounded-lg border text-xs md:text-sm font-bold ${newCatOp === 'none' ? 'bg-gray-100 border-gray-500 text-gray-700' : 'border-gray-200 text-gray-500'}`}>Gray (No Calc)</button>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setIsAddCatModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Create Button</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 no-print font-sans">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                  <div className={`flex items-center justify-center w-12 h-12 rounded-full mb-4 mx-auto ${confirmModal.type === 'PRINT_ERROR' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                      {confirmModal.type === 'PRINT_ERROR' ? <Printer size={24} /> : <AlertTriangle size={24} />}
                  </div>
                  <h3 className="text-xl font-bold text-center text-gray-900 mb-2">{confirmModal.title}</h3>
                  <p className="text-center text-gray-500 mb-6">{confirmModal.message}</p>
                  <div className="flex space-x-3">
                      <button onClick={() => setConfirmModal(null)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">{confirmModal.type === 'PRINT_ERROR' ? 'Close' : 'Cancel'}</button>
                      {confirmModal.type === 'PRINT_ERROR' && <button onClick={openNewTab} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center"><ExternalLink size={16} className="mr-2" />Open Tab</button>}
                      {confirmModal.type !== 'PRINT_ERROR' && <button onClick={handleConfirmAction} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Confirm</button>}
                  </div>
              </div>
          </div>
      )}

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print font-sans">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Edit Transaction</h2>
                    <button onClick={() => setEditingRecord(null)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>
                <form onSubmit={handleUpdateRecord} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                             <label className="block text-sm font-medium text-gray-700 mb-1">Column / Panel</label>
                             <div className="grid grid-cols-3 gap-2">
                                <button type="button" onClick={() => setEditingRecord({...editingRecord, column: 'col1'})} className={`py-1 px-2 text-xs rounded border ${editingRecord.column === 'col1' ? 'bg-blue-100 border-blue-500' : 'border-gray-200'}`}>Panel 1</button>
                                <button type="button" onClick={() => setEditingRecord({...editingRecord, column: 'col2'})} className={`py-1 px-2 text-xs rounded border ${editingRecord.column === 'col2' ? 'bg-blue-100 border-blue-500' : 'border-gray-200'}`}>Panel 2</button>
                                <button type="button" onClick={() => setEditingRecord({...editingRecord, column: 'main'})} className={`py-1 px-2 text-xs rounded border ${editingRecord.column === 'main' ? 'bg-blue-100 border-blue-500' : 'border-gray-200'}`}>Main</button>
                             </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                            <div className={`px-4 py-2 rounded-lg text-center font-bold text-sm ${editingRecord.operation === 'add' ? 'bg-green-100 text-green-800' : editingRecord.operation === 'subtract' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                {editingRecord.typeLabel} ({editingRecord.operation === 'add' ? '+' : editingRecord.operation === 'subtract' ? '-' : 'Ø'})
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                             <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">$</span>
                                <input type="number" step="0.01" required value={editingRecord.amount} onChange={e => setEditingRecord({...editingRecord, amount: parseFloat(e.target.value)})} className="w-full pl-7 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description/Note</label>
                            <input type="text" value={editingRecord.description} onChange={e => setEditingRecord({...editingRecord, description: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="col-span-2">
                             <label className="flex items-center space-x-2 mt-2">
                                <input type="checkbox" checked={editingRecord.isVisible} onChange={e => setEditingRecord({...editingRecord, isVisible: e.target.checked})} className="w-4 h-4 text-blue-600 rounded" />
                                <span className="text-sm text-gray-700">Show on Statement</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                        <button type="button" onClick={() => setEditingRecord(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"><Check size={18} className="mr-2" />Update Transaction</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default ClientLedger;
