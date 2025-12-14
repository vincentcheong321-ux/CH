
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, User, ChevronRight, Trash2, AlertTriangle, CheckSquare, Square, Printer, ArrowLeft, RefreshCw, ChevronLeft } from 'lucide-react';
import { getClients, saveClient, getClientBalance, deleteClient, getLedgerRecords, getNetAmount, seedInitialClients } from '../services/storageService';
import { Client, LedgerRecord } from '../types';
import { MONTH_NAMES, getWeeksForMonth, getWeekRangeString } from '../utils/reportUtils';

const ClientList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ code: '', name: '', phone: '' });
  const [balances, setBalances] = useState<Record<string, number>>({});
  
  // Selection & Bulk Print State
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [isBulkPrintMode, setIsBulkPrintMode] = useState(false);
  
  // Date/Week State
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);

  // Delete Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, clientId: string | null}>({
    isOpen: false,
    clientId: null
  });

  // Calculate Week End Date
  const weeksData = useMemo(() => getWeeksForMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  
  const selectedWeekEndDate = useMemo(() => {
      const days = weeksData[selectedWeekNum];
      if (!days || days.length === 0) return undefined;
      const lastDay = days[days.length - 1];
      const dateObj = new Date(currentYear, currentMonth, lastDay);
      // Format YYYY-MM-DD
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
  }, [weeksData, selectedWeekNum, currentYear, currentMonth]);

  useEffect(() => {
    // Initialize date defaults
    const now = new Date();
    let y = now.getFullYear();
    if(y < 2025) y = 2025;
    if(y > 2026) y = 2026;
    setCurrentYear(y);
    const m = now.getMonth();
    setCurrentMonth(m);
    
    const weeks = getWeeksForMonth(y, m);
    const todayNum = now.getDate();
    const foundWeek = Object.keys(weeks).find(w => weeks[parseInt(w)].includes(todayNum));
    if(foundWeek) setSelectedWeekNum(parseInt(foundWeek));
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedWeekEndDate]);

  const loadData = async () => {
    setLoading(true);
    try {
        const loadedClients = await getClients();
        // FILTER: Only Paper clients
        const paperClients = loadedClients.filter(c => (c.category || 'paper') === 'paper');
        setClients(paperClients);

        // Fetch balances logic here is tricky with mixed Sync/Async.
        // For now, we will skip pre-fetching expensive balances or update it later.
        // Or we iterate and fetch (slow).
        // Optimization: Let individual rows load balance or fetch bulk?
        // Given current architecture, let's just fetch clients. Balance display might need separate handling or removal if too slow.
        // For now, setting balances to 0 or skipping to avoid heavy async loop on main thread.
        // If critical, implement getBalancesForClients(ids) in backend.
        setBalances({}); 
    } catch (e) {
        console.error("Failed to load clients", e);
    } finally {
        setLoading(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newClient.name) {
      await saveClient({
        ...newClient,
        code: newClient.code || '',
        category: 'paper' // Enforce paper creation here
      });
      setNewClient({ code: '', name: '', phone: '' });
      setIsModalOpen(false);
      loadData();
    }
  };

  const requestDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); 
    setDeleteConfirm({ isOpen: true, clientId: id });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.clientId) {
      await deleteClient(deleteConfirm.clientId);
      setDeleteConfirm({ isOpen: false, clientId: null });
      const newSelection = new Set(selectedClientIds);
      newSelection.delete(deleteConfirm.clientId);
      setSelectedClientIds(newSelection);
      loadData();
    }
  };

  const toggleSelectAll = () => {
      if (selectedClientIds.size === filteredClients.length && filteredClients.length > 0) {
          setSelectedClientIds(new Set());
      } else {
          setSelectedClientIds(new Set(filteredClients.map(c => c.id)));
      }
  };

  const toggleSelectOne = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      const newSet = new Set(selectedClientIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedClientIds(newSet);
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Layout Calculation ---
  const midPoint = Math.ceil(filteredClients.length / 2);
  const leftClients = filteredClients.slice(0, midPoint);
  const rightClients = filteredClients.slice(midPoint);

  const renderClientRow = (client: Client) => {
    const isSelected = selectedClientIds.has(client.id);
    
    return (
        <div 
            key={client.id}
            className={`flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group relative ${isSelected ? 'bg-blue-50/50' : ''}`}
        >
            <button 
                onClick={(e) => toggleSelectOne(e, client.id)} 
                className="p-2 mr-2 text-gray-400 hover:text-gray-600 z-10"
            >
                {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
            </button>

            <Link 
            to={`/clients/${client.id}`}
            className="flex-1 flex items-center justify-between min-w-0" 
            >
            <div className="flex items-center space-x-3 min-w-0">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                <User size={20} />
                </div>
                <div className="min-w-0">
                <div className="flex items-center space-x-2">
                    <h3 className="font-semibold text-gray-900 truncate">{client.name}</h3>
                    {client.code && (
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-mono flex-shrink-0">
                        {client.code}
                    </span>
                    )}
                </div>
                {client.phone && <p className="text-sm text-gray-500 truncate">{client.phone}</p>}
                </div>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4 mr-8 flex-shrink-0">
                <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colors" size={20} />
            </div>
            </Link>
            
            <button 
            onClick={(e) => requestDelete(e, client.id)}
            className="absolute right-2 p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Delete Client"
            >
            <Trash2 size={18} />
            </button>
        </div>
    );
  };

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

  // --- Bulk Print Logic ---
  const handlePrint = () => window.print();
  
  const BulkLedgerSheet = ({ client }: { client: Client }) => {
      const [records, setRecords] = useState<LedgerRecord[]>([]);
      const [isReady, setIsReady] = useState(false);

      useEffect(() => {
          const fetchRecords = async () => {
              const all = await getLedgerRecords(client.id);
              const filtered = all.filter(r => !selectedWeekEndDate || r.date <= selectedWeekEndDate);
              setRecords(filtered);
              setIsReady(true);
          };
          fetchRecords();
      }, [client.id]);

      if (!isReady) return <div className="p-4 text-center">Loading {client.name}...</div>;

      const calculateColumn = (columnKey: 'main' | 'col1' | 'col2') => {
        const colRecords = records.filter(r => r.column === columnKey);
        const processed = colRecords.map(r => ({ ...r, netChange: getNetAmount(r) }));
        const visibleProcessed = processed.filter(r => r.isVisible);
        const finalBalance = visibleProcessed.reduce((acc, curr) => acc + curr.netChange, 0);
        return { processed, finalBalance };
      };
      const col1Ledger = calculateColumn('col1');
      const col2Ledger = calculateColumn('col2');
      const mainLedger = calculateColumn('main');

      const LedgerColumnView = ({ data, footerLabel = "收" }: { data: ReturnType<typeof calculateColumn>, footerLabel?: string }) => {
        if (data.processed.length === 0) return <div className="flex-1 min-h-[50px]" />;
        const hasCalculableRecords = data.processed.some(r => r.isVisible && r.operation !== 'none');
        const isNegative = data.finalBalance < 0;
        let displayLabel = footerLabel;
        if (isNegative && (footerLabel === '收' || footerLabel === '欠')) displayLabel = '补';
        return (
            <div className="flex flex-col items-center">
                <div className="flex flex-col space-y-0.5 w-fit items-end">
                    {data.processed.map((r) => {
                        const isNetNegative = r.operation !== 'none' && r.netChange < 0;
                        const valStr = Math.abs(r.operation === 'none' ? r.amount : r.netChange).toLocaleString(undefined, {minimumFractionDigits: 2});
                        const displayVal = isNetNegative ? `(${valStr})` : valStr;
                        
                        let textColor = 'text-gray-600';
                        if (r.operation === 'add') {
                            textColor = isNetNegative ? 'text-red-700' : 'text-green-700';
                        } else if (r.operation === 'subtract') {
                            textColor = 'text-red-700';
                        }

                        return (
                        <div key={r.id} className={`flex justify-end items-center py-0.5 relative gap-1 md:gap-2 ${!r.isVisible ? 'hidden' : ''}`}>
                            <div className="text-xl font-bold uppercase tracking-wide text-gray-600">{r.typeLabel}</div>
                            {r.description && <div className="text-sm text-gray-600 font-medium mr-2 max-w-[150px] truncate">{r.description}</div>}
                            <div className={`text-2xl font-mono font-bold w-36 text-right ${textColor}`}>
                                {displayVal}
                            </div>
                        </div>
                    )})}
                </div>
                {hasCalculableRecords && (
                    <div className="mt-2 pt-1 flex flex-col items-end w-fit border-t-2 border-gray-900">
                        <div className="flex items-center gap-2 justify-end">
                            <span className="text-xl font-bold text-gray-900 uppercase">{displayLabel}</span>
                            <span className={`text-3xl font-mono font-bold w-40 text-right ${data.finalBalance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                                {data.finalBalance < 0 ? `(${Math.abs(data.finalBalance).toLocaleString(undefined, {minimumFractionDigits: 2})})` : data.finalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        );
      };

      return (
        <div className="bg-white border border-gray-200 shadow-sm min-h-[600px] relative text-lg font-serif mb-8 page-break">
            <div style={{height: '40px'}} /> 
            <div className="px-8 pb-4 flex justify-between items-end mb-4">
                <div>
                    <h2 className="text-4xl font-bold text-gray-900 uppercase tracking-widest">{client.name}</h2>
                    {client.code && <p className="text-gray-600 mt-1 font-mono text-xl">{client.code}</p>}
                </div>
            </div>
            <div className="flex w-full min-h-[400px]">
                 <div style={{ width: '33.33%' }} className="flex flex-col p-2 border-r border-transparent"><LedgerColumnView data={col1Ledger} footerLabel="收" /></div>
                 <div style={{ width: '33.33%' }} className="flex flex-col p-2 border-r border-transparent"><LedgerColumnView data={col2Ledger} footerLabel="收" /></div>
                 <div style={{ width: '33.34%' }} className="flex flex-col p-2 bg-gray-50/30"><LedgerColumnView data={mainLedger} footerLabel="欠" /></div>
            </div>
            <div style={{height: '40px'}} /> 
        </div>
      );
  };

  if (isBulkPrintMode) {
      const clientsToPrint = clients.filter(c => selectedClientIds.has(c.id));
      return (
          <div className="min-h-screen bg-gray-100">
              <style>{`@media print { .page-break { page-break-after: always; margin-bottom: 0; } body { background-color: white; } }`}</style>
              <div className="bg-white shadow-md p-4 sticky top-0 z-50 flex justify-between items-center no-print">
                  <div className="flex items-center space-x-4">
                      <button onClick={() => setIsBulkPrintMode(false)} className="flex items-center text-gray-600 hover:text-gray-900">
                          <ArrowLeft className="mr-2" /> Back
                      </button>
                      <h1 className="text-xl font-bold">Print Preview ({clientsToPrint.length})</h1>
                      <span className="text-sm bg-gray-100 px-2 py-1 rounded">Week {Object.keys(weeksData).indexOf(String(selectedWeekNum)) + 1} Balance</span>
                  </div>
                  <button onClick={handlePrint} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center hover:bg-blue-700">
                      <Printer className="mr-2" /> Print All
                  </button>
              </div>
              <div id="printable-area" className="max-w-5xl mx-auto p-8 print:p-0 print:w-full">
                  {clientsToPrint.map(client => (
                      <BulkLedgerSheet key={client.id} client={client} />
                  ))}
              </div>
          </div>
      );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Client Accounts</h1>
          <p className="text-gray-500">Manage paper ledger access and balances.</p>
        </div>
        <div className="flex space-x-3">
             {selectedClientIds.size > 0 && (
                <button 
                    onClick={() => setIsBulkPrintMode(true)}
                    className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors animate-in fade-in"
                >
                    <Printer size={20} className="mr-2" />
                    Print Selected ({selectedClientIds.size})
                </button>
             )}
            <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors"
            >
            <Plus size={20} className="mr-2" />
            New Client
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header Controls: Date & Search */}
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center bg-gray-50/50">
            {/* Date Navigation */}
            <div className="flex items-center bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                <button onClick={handlePrevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronLeft size={16}/></button>
                <div className="px-3 min-w-[100px] text-center">
                    <div className="text-xs font-bold text-gray-800">{MONTH_NAMES[currentMonth]} {currentYear}</div>
                </div>
                <button onClick={handleNextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"><ChevronRight size={16}/></button>
            </div>
            
            <div className="flex space-x-1 overflow-x-auto max-w-full md:max-w-none pb-1 md:pb-0">
                {sortedWeekKeys.map(wk => {
                    const days = weeksData[wk];
                    const label = getWeekRangeString(currentYear, currentMonth, days);
                    return (
                        <button
                            key={wk}
                            onClick={() => setSelectedWeekNum(wk)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors whitespace-nowrap border flex flex-col items-center justify-center min-w-[100px]
                                ${selectedWeekNum === wk ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            <span className="uppercase tracking-wider text-[10px] opacity-75">Week {Object.keys(weeksData).indexOf(String(wk)) + 1}</span>
                            <span>{label}</span>
                        </button>
                    );
                })}
            </div>

            <div className="relative flex-1 w-full md:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input 
                type="text" 
                placeholder="Search clients..."
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Select All */}
            <button onClick={toggleSelectAll} className="p-2 text-gray-400 hover:text-gray-600 hidden md:block" title="Select All">
                {selectedClientIds.size > 0 && selectedClientIds.size === filteredClients.length ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
            </button>
        </div>

        {loading ? (
             <div className="p-8 text-center text-gray-500">Loading clients...</div>
        ) : (
            <>
                {filteredClients.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No paper clients found.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0">
                        <div className="flex flex-col divide-y divide-gray-100">
                            {leftClients.map(renderClientRow)}
                        </div>
                        <div className="flex flex-col divide-y divide-gray-100 border-t md:border-t-0 border-gray-100 pt-4 md:pt-0">
                            {rightClients.map(renderClientRow)}
                        </div>
                    </div>
                )}
            </>
        )}
      </div>

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Add New Paper Client</h2>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input required type="text" className="w-full px-3 py-2 border rounded-lg" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="e.g. 张" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Code <span className="text-gray-400 font-normal">(Optional)</span></label>
                <input type="text" className="w-full px-3 py-2 border rounded-lg" value={newClient.code} onChange={e => setNewClient({...newClient, code: e.target.value})} placeholder="e.g. C001" />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Delete Client?</h3>
            <p className="text-center text-gray-500 mb-6">This action cannot be undone.</p>
            <div className="flex space-x-3">
              <button onClick={() => setDeleteConfirm({ isOpen: false, clientId: null })} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientList;
