import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Eye, EyeOff, Trash2, Plus, Minus, Settings, Pencil, X, Check } from 'lucide-react';
import { 
  getClients, 
  getLedgerRecords, 
  saveLedgerRecord, 
  deleteLedgerRecord, 
  updateLedgerRecord,
  getCategories,
  saveCategory,
  deleteCategory,
  getNetAmount
} from '../services/storageService';
import { Client, LedgerRecord, TransactionCategory } from '../types';

const ClientLedger: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [records, setRecords] = useState<LedgerRecord[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  
  // Input State
  const [activeCategory, setActiveCategory] = useState<TransactionCategory | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isVisible, setIsVisible] = useState(true);

  // New Category State
  const [isAddCatModalOpen, setIsAddCatModalOpen] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatOp, setNewCatOp] = useState<'add'|'subtract'>('subtract');

  // Edit State
  const [editingRecord, setEditingRecord] = useState<LedgerRecord | null>(null);

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
    setAmount('');
    // Default description to today's date if empty
    if (!description) {
        const today = new Date();
        setDescription(`${today.getMonth() + 1}/${today.getDate()}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !activeCategory || !amount) return;

    const val = parseFloat(amount);
    if (isNaN(val)) return;

    const newRecord: Omit<LedgerRecord, 'id'> = {
      clientId: id,
      date: new Date().toISOString(),
      description: description,
      typeLabel: activeCategory.label,
      amount: val,
      operation: activeCategory.operation,
      isVisible: isVisible
    };

    saveLedgerRecord(newRecord);
    setAmount('');
    setDescription('');
    setActiveCategory(null);
    loadRecords();
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCatLabel) {
      saveCategory({
        label: newCatLabel,
        operation: newCatOp,
        color: newCatOp === 'add' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
      });
      setCategories(getCategories());
      setIsAddCatModalOpen(false);
      setNewCatLabel('');
    }
  };

  const handleDeleteCategory = (e: React.MouseEvent, catId: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this category button?')) {
        deleteCategory(catId);
        setCategories(getCategories());
    }
  };

  const toggleVisibility = (recordId: string, currentStatus: boolean) => {
    updateLedgerRecord(recordId, { isVisible: !currentStatus });
    loadRecords();
  };

  const handleDelete = (recordId: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      deleteLedgerRecord(recordId);
      // Force reload slightly delayed to ensure local storage commit if needed, though usually sync
      setTimeout(() => loadRecords(), 50);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEditClick = (record: LedgerRecord) => {
    setEditingRecord(record);
  };

  const handleUpdateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      updateLedgerRecord(editingRecord.id, {
        amount: editingRecord.amount,
        description: editingRecord.description,
        date: editingRecord.date,
        isVisible: editingRecord.isVisible
      });
      setEditingRecord(null);
      loadRecords();
    }
  };

  // Process records for display (Chronological + Running Balance)
  const processedRecords = useMemo(() => {
    let runningBalance = 0;
    
    // Sort records by date just in case (optional, depending on requirements)
    // const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return records.map(r => {
      const netChange = getNetAmount(r);
      
      if (r.isVisible) {
        runningBalance += netChange;
      }

      return {
        ...r,
        netChange,
        runningBalance
      };
    });
  }, [records]);

  const finalBalance = processedRecords.length > 0 
    ? processedRecords[processedRecords.length - 1].runningBalance 
    : 0;

  if (!client) return <div className="p-8">Loading client data...</div>;

  return (
    <div className="bg-white min-h-screen pb-20">
      {/* Header - No Print */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between mb-6 p-4 border-b bg-white sticky top-0 z-10 shadow-sm">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <Link to="/clients" className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center">
              {client.name}
              <span className="ml-3 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-md border border-gray-200">
                {client.code}
              </span>
            </h1>
          </div>
        </div>
        <div className="flex items-center space-x-4">
           <div className="text-right mr-4 hidden md:block">
              <p className="text-xs text-gray-500 uppercase font-bold">Current Owed</p>
              <p className={`text-xl font-bold ${finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                 ${Math.abs(finalBalance).toLocaleString()}
                 <span className="text-xs font-normal text-gray-400 ml-1">{finalBalance >= 0 ? '(Dr)' : '(Cr)'}</span>
              </p>
           </div>
           <button 
            type="button"
            onClick={handlePrint}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg flex items-center hover:bg-gray-900 transition-colors shadow-sm"
          >
            <Printer size={18} className="mr-2" />
            Print
          </button>
        </div>
      </div>

      {/* Input Selection Area - No Print */}
      <div className="no-print px-4 lg:px-8 mb-8">
        {!activeCategory ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="relative group">
                  <button 
                    onClick={() => handleCategorySelect(cat)}
                    className={`w-full flex flex-col items-center justify-center p-6 border-2 rounded-xl transition-all hover:shadow-md ${cat.operation === 'add' ? 'bg-green-50 border-green-100 hover:border-green-300' : 'bg-red-50 border-red-100 hover:border-red-300'}`}
                  >
                    <div className={`p-3 rounded-full mb-3 group-hover:scale-110 transition-transform ${cat.color}`}>
                      {cat.operation === 'add' ? <Plus size={24} /> : <Minus size={24} />}
                    </div>
                    <span className={`text-lg font-bold ${cat.operation === 'add' ? 'text-green-900' : 'text-red-900'}`}>{cat.label}</span>
                  </button>
                  {/* Allow deleting custom categories (ids > 5 assuming seed data) or just all */}
                  <button 
                    onClick={(e) => handleDeleteCategory(e, cat.id)}
                    className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    title="Remove Category"
                  >
                    <X size={16} />
                  </button>
              </div>
            ))}
            
            <button 
              onClick={() => setIsAddCatModalOpen(true)}
              className="flex flex-col items-center justify-center p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-100 hover:border-gray-400 transition-all text-gray-500 hover:text-gray-700"
            >
              <Plus size={24} className="mb-2" />
              <span className="text-sm font-medium">Add Option</span>
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden max-w-2xl mx-auto animate-fade-in">
            <div className={`p-4 flex items-center justify-between ${activeCategory.color}`}>
              <h3 className="text-lg font-bold flex items-center">
                {activeCategory.label} 
                <span className="mx-2 opacity-50">|</span> 
                {activeCategory.operation === 'add' ? 'Add Balance' : 'Deduction'}
              </h3>
              <button onClick={() => setActiveCategory(null)} className="text-sm font-semibold hover:underline opacity-70">
                Cancel
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input 
                    autoFocus
                    type="number" step="0.01"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition-shadow"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description / Date</label>
                <input 
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="Note"
                />
              </div>

              <div className="md:col-span-1 flex items-end">
                <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg w-full cursor-pointer hover:bg-gray-50">
                  <input 
                    type="checkbox"
                    checked={isVisible}
                    onChange={e => setIsVisible(e.target.checked)}
                    className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Show on Statement</span>
                </label>
              </div>

              <div className="md:col-span-2 pt-2">
                <button 
                  type="submit"
                  className={`w-full py-3 rounded-lg text-white font-bold text-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 ${activeCategory.operation === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  Confirm Entry
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Statement View */}
      <div id="printable-area" className="px-4 lg:px-8 max-w-5xl mx-auto">
        {/* Print Header */}
        <div className="hidden print-only mb-8">
            <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
                <div>
                    <h1 className="text-4xl font-extrabold text-black tracking-tight">{client.name}</h1>
                    <p className="text-xl font-mono text-gray-600 mt-1">{client.code}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-500">Statement Date</p>
                    <p className="font-bold">{new Date().toLocaleDateString()}</p>
                </div>
            </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase font-semibold text-gray-500">
                <th className="px-6 py-4 w-24">Date</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 w-32">Type</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-right">Balance</th>
                <th className="px-6 py-4 text-center w-28 no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedRecords.map((r, idx) => {
                const printRowClass = r.isVisible ? '' : 'no-print';
                const opacityClass = r.isVisible ? '' : 'opacity-40 bg-gray-50';

                return (
                  <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${opacityClass} ${printRowClass}`}>
                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {r.description}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${r.operation === 'add' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {r.typeLabel}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-mono font-medium ${r.netChange >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {r.netChange >= 0 ? '+' : ''}{r.netChange.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-gray-900">
                        {r.isVisible ? r.runningBalance.toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 text-center no-print">
                      <div className="flex items-center justify-center space-x-2">
                        <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleEditClick(r); }}
                            className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                            title="Edit"
                        >
                            <Pencil size={18} />
                        </button>
                        <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); toggleVisibility(r.id, r.isVisible); }}
                            title={r.isVisible ? "Hide from statement" : "Show on statement"}
                            className={`${r.isVisible ? 'text-gray-400 hover:text-blue-600' : 'text-red-500'} p-1`}
                        >
                            {r.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                        <button 
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleDelete(r.id); }}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            title="Delete"
                        >
                            <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {processedRecords.length === 0 && (
                <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                        No transactions recorded. Use the buttons above to add entries.
                    </td>
                </tr>
              )}
            </tbody>
            {/* Footer Summary */}
            <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                    <td colSpan={4} className="px-6 py-4 text-right font-bold text-gray-600">
                        TOTAL OWED
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-xl font-bold text-gray-900">
                        ${finalBalance.toLocaleString()}
                    </td>
                    <td className="no-print"></td>
                </tr>
            </tfoot>
          </table>
        </div>

        {/* Print Signature Footer */}
        <div className="hidden print-only mt-12 grid grid-cols-2 gap-16">
            <div>
                <div className="h-20 border-b border-black mb-2"></div>
                <p className="text-center font-bold">Client Signature</p>
            </div>
            <div>
                <div className="h-20 border-b border-black mb-2"></div>
                <p className="text-center font-bold">Company Authorized</p>
            </div>
        </div>
      </div>

       {/* Add Category Modal */}
       {isAddCatModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold mb-4">Add Button Option</h2>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Button Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newCatLabel}
                  onChange={e => setNewCatLabel(e.target.value)}
                  placeholder="e.g. Bonus"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calculation Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCatOp('add')}
                    className={`py-2 px-3 rounded-lg border text-sm font-bold ${newCatOp === 'add' ? 'bg-green-50 border-green-500 text-green-700' : 'border-gray-200 text-gray-500'}`}
                  >
                    (+) Add Balance
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCatOp('subtract')}
                    className={`py-2 px-3 rounded-lg border text-sm font-bold ${newCatOp === 'subtract' ? 'bg-red-50 border-red-500 text-red-700' : 'border-gray-200 text-gray-500'}`}
                  >
                    (-) Deduct
                  </button>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsAddCatModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Button
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 no-print">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">Edit Transaction</h2>
                    <button onClick={() => setEditingRecord(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>
                
                <form onSubmit={handleUpdateRecord} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type</label>
                            <div className={`px-4 py-2 rounded-lg text-center font-bold text-sm ${editingRecord.operation === 'add' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {editingRecord.typeLabel} ({editingRecord.operation === 'add' ? '+' : '-'})
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                             <div className="relative">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">$</span>
                                <input 
                                    type="number" step="0.01" required
                                    value={editingRecord.amount}
                                    onChange={e => setEditingRecord({...editingRecord, amount: parseFloat(e.target.value)})}
                                    className="w-full pl-7 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                            <input 
                                type="text"
                                value={editingRecord.description}
                                onChange={e => setEditingRecord({...editingRecord, description: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="col-span-2">
                             <label className="flex items-center space-x-2 mt-2">
                                <input 
                                    type="checkbox"
                                    checked={editingRecord.isVisible}
                                    onChange={e => setEditingRecord({...editingRecord, isVisible: e.target.checked})}
                                    className="w-4 h-4 text-blue-600 rounded"
                                />
                                <span className="text-sm text-gray-700">Show on Statement</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-100">
                        <button 
                            type="button"
                            onClick={() => setEditingRecord(null)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                        >
                            <Check size={18} className="mr-2" />
                            Update Transaction
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default ClientLedger;