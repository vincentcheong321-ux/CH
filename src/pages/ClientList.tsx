
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, User, Trash2, AlertTriangle, CheckSquare, Square, Printer, ArrowLeft, ChevronLeft, ChevronRight, Hash, Phone } from 'lucide-react';
import { getClients, saveClient, deleteClient, getLedgerRecords, getNetAmount, fetchClientTotalBalance } from '../services/storageService';
import { Client, LedgerRecord } from '../types';
import { MONTH_NAMES, getWeeksForMonth, getWeekRangeString } from '../utils/reportUtils';

const ClientList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ code: '', name: '', phone: '' });
  
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

  // Calculate Week Dates
  const weeksData = useMemo<Record<number, Date[]>>(() => getWeeksForMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  
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
    
    // Check if today matches any week
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const foundWeek = Object.keys(weeks).find(w => {
        return weeks[parseInt(w)].some(d => {
            const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            return dStr === todayStr;
        });
    });

    if(foundWeek) setSelectedWeekNum(parseInt(foundWeek));
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const loadedClients = await getClients();
        // FILTER: Only Paper clients
        const paperClients = loadedClients.filter(c => (c.category || 'paper') === 'paper');
        setClients(paperClients);
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
    e.stopPropagation();
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

  // Grid Card Component
  const ClientCard: React.FC<{ client: Client }> = ({ client }) => {
    const isSelected = selectedClientIds.has(client.id);
    
    return (
        <div className="relative group">
            {/* Selection Checkbox (Absolute) */}
            <div 
                onClick={(e) => toggleSelectOne(e, client.id)} 
                className="absolute top-3 left-3 z-10 cursor-pointer text-gray-300 hover:text-blue-500 transition-colors"
            >
                {isSelected ? <CheckSquare size={22} className="text-blue-600 bg-white rounded" /> : <Square size={22} className="bg-white/50 rounded" />}
            </div>

            {/* Delete Button (Absolute) */}
            <button 
                onClick={(e) => requestDelete(e, client.id)}
                className="absolute top-3 right-3 z-10 p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                title="Delete Client"
            >
                <Trash2 size={18} />
            </button>

            <Link 
                to={`/clients/${client.id}`}
                state={{ year: currentYear, month: currentMonth, week: selectedWeekNum }}
                className={`
                    block h-full bg-white rounded-xl border-2 transition-all duration-200 p-5
                    flex flex-col items-center justify-center text-center space-y-3
                    ${isSelected 
                        ? 'border-blue-500 shadow-md ring-1 ring-blue-500 bg-blue-50/10' 
                        : 'border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 hover:-translate-y-1'
                    }
                `}
            >
                {/* Avatar */}
                <div className={`
                    w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-1 shadow-inner
                    ${isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}
                `}>
                    {client.name.substring(0, 1).toUpperCase()}
                </div>

                {/* Info */}
                <div className="w-full">
                    <h3 className="text-lg font-bold text-gray-900 truncate w-full px-2" title={client.name}>
                        {client.name}
                    </h3>
                    
                    <div className="flex items-center justify-center space-x-2 mt-2">
                        {client.code && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                <Hash size={10} className="mr-1 opacity-50" />
                                {client.code}
                            </span>
                        )}
                        {client.phone && (
                            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs text-gray-500 bg-gray-50 border border-gray-100">
                                <Phone size={10} className="mr-1 opacity-50" />
                                {client.phone}
                            </span>
                        )}
                    </div>
                </div>
            </Link>
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
  
  const BulkLedgerSheet: React.FC<{ client: Client }> = ({ client }) => {
      const [allRecords, setAllRecords] = useState<LedgerRecord[]>([]);
      const [isReady, setIsReady] = useState(false);
      
      const { selectedWeekStartDate, selectedWeekEndDate } = useMemo(() => {
          const days = weeksData[selectedWeekNum];
          if (!days || days.length === 0) return { selectedWeekStartDate: undefined, selectedWeekEndDate: undefined };
          const lastDay = days[days.length - 1];
          const endDateStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth()+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;
          const firstDay = days[0];
          const startDateStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth()+1).padStart(2,'0')}-${String(firstDay.getDate()).padStart(2,'0')}`;
          return { selectedWeekStartDate: startDateStr, selectedWeekEndDate: endDateStr };
      }, [weeksData, selectedWeekNum]);

      useEffect(() => {
          const fetchRecords = async () => {
              const all = await getLedgerRecords(client.id);
              setAllRecords(all);
              setIsReady(true);
          };
          fetchRecords();
      }, [client.id]);

      if (!isReady) return <div className="p-4 text-center">Loading {client.name}...</div>;

      const calculateColumn = (columnKey: 'main' | 'col1' | 'col2') => {
        const colRecords = allRecords.filter(r => 
            (!selectedWeekStartDate || r.date >= selectedWeekStartDate) && 
            (!selectedWeekEndDate || r.date <= selectedWeekEndDate) &&
            r.column === columnKey
        );

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
                        const isVirtual = (r as any).isVirtual;
                        
                        let textColor = 'text-gray-600';
                        if (r.operation === 'add') {
                            textColor = isNetNegative ? 'text-red-700' : 'text-green-700';
                        } else if (r.operation === 'subtract') {
                            textColor = 'text-red-700';
                        }

                        return (
                        <div key={r.id} className={`flex justify-end items-center py-0.5 relative gap-1 md:gap-2 ${!r.isVisible ? 'hidden' : ''} ${isVirtual ? 'bg-gray-50 border-b border-dashed border-gray-300 w-full mb-1 justify-end px-1' : ''}`}>
                            <div className={`text-xl font-bold uppercase tracking-wide ${isVirtual ? 'text-gray-400 italic' : 'text-gray-600'}`}>{r.typeLabel}</div>
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
                <div className="text-right">
                    <p className="text-sm text-gray-500 font-sans uppercase tracking-wider">{MONTH_NAMES[currentMonth]} {currentYear}</p>
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
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Client Accounts</h1>
          <p className="text-gray-500 mt-1">Manage paper ledger access.</p>
        </div>
        <div className="flex space-x-3 w-full sm:w-auto">
             {selectedClientIds.size > 0 && (
                <button 
                    onClick={() => setIsBulkPrintMode(true)}
                    className="flex-1 sm:flex-none bg-gray-800 hover:bg-gray-900 text-white px-4 py-2.5 rounded-xl flex items-center justify-center shadow-lg transition-all animate-in fade-in"
                >
                    <Printer size={20} className="mr-2" />
                    Print Selected ({selectedClientIds.size})
                </button>
             )}
            <button 
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl flex items-center justify-center shadow-lg hover:shadow-blue-200 transition-all font-semibold"
            >
            <Plus size={20} className="mr-2" />
            Add Client
            </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        {/* Header Controls */}
        <div className="p-4 border-b border-gray-100 flex flex-col xl:flex-row gap-4 items-center bg-gray-50/50">
            
            <div className="flex flex-col md:flex-row gap-4 w-full xl:w-auto items-center">
                {/* Date Navigation */}
                <div className="flex items-center bg-white rounded-xl p-1.5 border border-gray-200 shadow-sm w-full md:w-auto justify-between">
                    <button onClick={handlePrevMonth} disabled={currentYear === 2025 && currentMonth === 0} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronLeft size={18}/></button>
                    <div className="px-4 min-w-[120px] text-center">
                        <div className="text-sm font-bold text-gray-900">{MONTH_NAMES[currentMonth]} {currentYear}</div>
                    </div>
                    <button onClick={handleNextMonth} disabled={currentYear === 2026 && currentMonth === 11} className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-30"><ChevronRight size={18}/></button>
                </div>
                
                {/* Week Selector */}
                <div className="flex space-x-1 overflow-x-auto max-w-full pb-1 md:pb-0 scrollbar-hide">
                    {sortedWeekKeys.map(wk => {
                        const days = weeksData[wk];
                        const label = getWeekRangeString(null, null, days);
                        return (
                            <button
                                key={wk}
                                onClick={() => setSelectedWeekNum(wk)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap border flex flex-col items-center justify-center min-w-[110px]
                                    ${selectedWeekNum === wk 
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-white hover:border-blue-300'}
                                `}
                            >
                                <span className="uppercase tracking-wider text-[10px] opacity-80">Week {Object.keys(weeksData).indexOf(String(wk)) + 1}</span>
                                <span className="mt-0.5">{label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="w-px h-8 bg-gray-200 hidden xl:block mx-2"></div>

            <div className="flex flex-1 w-full gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                    type="text" 
                    placeholder="Search clients by name or code..."
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all hover:border-gray-300"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <button 
                    onClick={toggleSelectAll} 
                    className="px-4 py-2 text-gray-500 hover:text-gray-800 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 font-medium text-sm flex items-center transition-colors"
                >
                    {selectedClientIds.size > 0 && selectedClientIds.size === filteredClients.length 
                        ? <CheckSquare size={18} className="text-blue-600 mr-2" /> 
                        : <Square size={18} className="mr-2" />
                    }
                    Select All
                </button>
            </div>
        </div>

        {loading ? (
             <div className="p-12 text-center text-gray-500">Loading clients...</div>
        ) : (
            <div className="p-4 md:p-6 bg-gray-50/30 min-h-[400px]">
                {filteredClients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="bg-gray-100 p-4 rounded-full mb-4"><User size={32} className="text-gray-400" /></div>
                        <h3 className="text-lg font-bold text-gray-700">No clients found</h3>
                        <p className="text-gray-500">Try adjusting your search or add a new client.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredClients.map(c => <ClientCard key={c.id} client={c} />)}
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 transform transition-all scale-100">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Add New Paper Client</h2>
            <form onSubmit={handleAddClient} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Full Name</label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input required type="text" className="w-full pl-10 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="e.g. 张三" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Client Code</label>
                    <div className="relative">
                        <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" className="w-full pl-10 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={newClient.code} onChange={e => setNewClient({...newClient, code: e.target.value})} placeholder="e.g. C001" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Phone <span className="font-normal text-gray-400 text-xs">(Opt)</span></label>
                    <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} placeholder="Mobile" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-lg hover:shadow-blue-200 transition-all transform active:scale-95">Create Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform transition-all">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Client?</h3>
            <p className="text-gray-500 mb-6 leading-relaxed">This action cannot be undone. All ledger history for this client will be permanently removed.</p>
            <div className="flex space-x-3">
              <button onClick={() => setDeleteConfirm({ isOpen: false, clientId: null })} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg hover:shadow-red-200 transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientList;
