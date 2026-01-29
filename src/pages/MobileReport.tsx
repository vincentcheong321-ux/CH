
import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Save, CheckCircle, AlertCircle, History, FileText, Loader2, Zap, Calendar } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getClients, saveSaleRecord, saveMobileReportHistory, getMobileReportHistory, saveLedgerRecord, getLedgerRecords, updateLedgerRecord, deleteLedgerRecord } from '../services/storageService';
import { Client, LedgerRecord } from '../types';
import { useGlobalState } from '../context/GlobalStateContext';

// Mapping: Mobile ID -> Paper Client Code (Case Insensitive)
const MOBILE_TO_PAPER_MAP: Record<string, string> = {
    'sk3619': 'c13',
    'sk3818': 'z19',
    'sk3964': 'z07',
    'sk8959': 'c17',
    'vc9486': '9486',
    'g8sv8239': 'z03',
    'mrcc04': 'c04',
    'pt217': 'pt217',
    'sk0922': 'z05',
    'sk2839': '2839',
    'sk3715': '伍',
    'sk5611': 'c09',
    'sk8264': 'c19',
    'sk8385': '8385',
    'skc009': 'c08',
    'skc15': 'c15'
};

const MobileReport: React.FC = () => {
  const navigate = useNavigate();
  const { currentDate, setCurrentDate } = useGlobalState();
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  
  // State for matching and saving
  const [clients, setClients] = useState<Client[]>([]);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');
  const [isSaving, setIsSaving] = useState(false);
  
  // Derived formatted date for input (YYYY-MM-DD)
  const reportDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

  useEffect(() => {
      loadClients();
      loadHistory();
  }, []);

  const loadClients = async () => {
      const list = await getClients();
      setClients(list);
  };

  const loadHistory = async () => {
      const hist = await getMobileReportHistory();
      setHistory(hist);
  };

  const handleParse = () => {
    if (!inputText.trim()) return;

    const rows = inputText.trim().split('\n');
    const data: any[] = [];

    for (let i = 0; i < rows.length; i++) {
        const line = rows[i].replace(/\r/g, ''); // Remove CR
        if (!line.trim()) continue;

        let parts: string[];
        
        // Detect Separator
        if (line.includes('\t')) {
            // STRICT TAB MODE: Preserve empty strings to maintain column alignment
            parts = line.split('\t').map(p => p.trim());
        } else {
            // Fallback for space separated (less reliable for empty cols)
            parts = line.split(/[\s]+/).map(p => p.trim()).filter(p => p !== '');
        }

        // Basic validation: Must have at least ID, Name and some data
        if (parts.length < 5) continue;

        // Find the start of numeric data
        const isNumberLike = (s: string) => /^-?[\d,]+\.?\d*$/.test(s) && s !== '';
        
        let firstStatIndex = -1;
        // Scan for pattern: Num, Num
        for (let j = 1; j < parts.length; j++) {
            if (isNumberLike(parts[j])) {
                // Heuristic: Name is between ID (0) and First Stat
                if (j > 1) {
                    firstStatIndex = j;
                    break;
                }
            }
        }

        if (firstStatIndex > 0) {
            const id = parts[0];
            // Name is everything between ID and First Stat
            // Filter out empty strings from name parts if any
            const nameParts = parts.slice(1, firstStatIndex).filter(p => p !== '');
            const name = nameParts.join(' ');
            
            // Values are everything from First Stat onwards
            const values = parts.slice(firstStatIndex);
            
            // Should have around 17 columns based on new requirement
            if (values.length >= 10) {
                data.push({ id, name, values });
            }
        }
    }
    setParsedData(data);
    setSaveStatus({ type: null, message: '' });
  };

  const handleClear = () => {
      setInputText('');
      setParsedData([]);
      setSaveStatus({ type: null, message: '' });
  };

  const handleSaveToSystem = async () => {
      if (parsedData.length === 0) return;
      if (!reportDate) {
          setSaveStatus({ type: 'error', message: 'Please select a date.' });
          return;
      }
      setIsSaving(true);

      const targetDate = reportDate; // Use selected date directly

      let matchedCount = 0;
      let skippedCount = 0;

      // Track processed paper clients to avoid duplicates within the same batch
      const processedPaperClientIds = new Set<string>();

      for (const row of parsedData) {
          // Skip the Total row from saving logic if it was parsed
          if (row.id === '总额') continue;

          // 1. Standard Mobile Client Matching
          const client = clients.find(c => c.code.toLowerCase() === row.id.toLowerCase());
          
          const values = row.values;
          
          // New Structure Indices:
          // 0: Member Bet
          // 1-5: Company (Total at 5)
          // 6-11: Shareholder (Total at 11)
          // 12-16: Agent (Total at 16)
          
          // Safe access
          const compTotal = values[5] || '0';
          const shareholderTotal = values[11] || '0';
          const agentTotal = values[16] || values[values.length - 1] || '0';

          const val = parseFloat(String(agentTotal).replace(/,/g, ''));

          const mobileRaw = {
              memberBet: values[0] || '0',
              companyTotal: compTotal,
              shareholderTotal: shareholderTotal,
              agentTotal: agentTotal
          };

          if (client) {
              if (!isNaN(val)) {
                  await saveSaleRecord({
                      clientId: client.id,
                      date: targetDate,
                      b: val, 
                      s: 0, a: 0, c: 0,
                      mobileRaw, 
                      mobileRawData: values // Save FULL raw data
                  });
                  matchedCount++;
              }
          } else {
              skippedCount++;
          }

          // 2. Special Paper Client "Dian" (电) Cross-Posting
          // Match by ID primarily
          let mappedPaperCode = MOBILE_TO_PAPER_MAP[row.id.toLowerCase()];
          
          if (mappedPaperCode) {
              const paperClient = clients.find(c => c.code.toLowerCase() === mappedPaperCode.toLowerCase());
              
              // Prevent duplicate processing for same paper client in this loop
              if (paperClient && !processedPaperClientIds.has(paperClient.id)) {
                  
                  const companyTotalRaw = values[5]; 
                  const companyAmount = parseFloat(String(companyTotalRaw).replace(/,/g, ''));

                  if (!isNaN(companyAmount) && companyAmount !== 0) {
                      // Mark as processed immediately
                      processedPaperClientIds.add(paperClient.id);

                      // Logic Updated: Company Total > 0 -> Subtract, Company Total < 0 -> Add
                      const operation = companyAmount >= 0 ? 'subtract' : 'add';
                      const amount = Math.abs(companyAmount);

                      // Check for existing records to PREVENT DUPLICATES
                      const existingRecords = await getLedgerRecords(paperClient.id);
                      const existingDianRecords = existingRecords.filter(r => 
                          r.date === targetDate && 
                          r.typeLabel === '电' &&
                          r.column === 'main'
                      );

                      if (existingDianRecords.length > 0) {
                          await updateLedgerRecord(existingDianRecords[0].id, {
                              amount: amount,
                              operation: operation
                          });
                          // Cleanup duplicates
                          if (existingDianRecords.length > 1) {
                              for(let i=1; i<existingDianRecords.length; i++) {
                                  await deleteLedgerRecord(existingDianRecords[i].id);
                              }
                          }
                      } else {
                          await saveLedgerRecord({
                              clientId: paperClient.id,
                              date: targetDate,
                              description: '', 
                              typeLabel: '电',
                              amount: amount,
                              operation: operation,
                              column: 'main',
                              isVisible: true
                          });
                      }
                  }
              }
          }
      }

      try {
        await saveMobileReportHistory(targetDate, parsedData);
        loadHistory(); 
      } catch (e) {
          console.error("Failed to save history", e);
      }

      setIsSaving(false);
      if (matchedCount > 0) {
          setSaveStatus({ type: 'success', message: `Saved data for ${targetDate}. Updated ${matchedCount} clients.` });
      } else {
          setSaveStatus({ type: 'error', message: `No matching clients found. Ensure Client Codes match.` });
      }
  };

  const handleRegenerateDian = async () => {
        if (parsedData.length === 0) return;
        if (!reportDate) {
            setSaveStatus({ type: 'error', message: 'Please select a date first.' });
            return;
        }
        setIsSaving(true);

        const targetDate = reportDate;
        let updateCount = 0;
        
        const processedPaperClientIds = new Set<string>();

        for (const row of parsedData) {
            if (row.id === '总额') continue;
            
            let mappedPaperCode = MOBILE_TO_PAPER_MAP[row.id.toLowerCase()];

            if (mappedPaperCode) {
                const paperClient = clients.find(c => c.code.toLowerCase() === mappedPaperCode.toLowerCase());
                
                // Deduplication Check
                if (paperClient && !processedPaperClientIds.has(paperClient.id)) {
                    
                    const companyTotalRaw = row.values[5];
                    const companyAmount = parseFloat(String(companyTotalRaw).replace(/,/g, ''));
                    
                    if (!isNaN(companyAmount) && companyAmount !== 0) {
                        
                        processedPaperClientIds.add(paperClient.id);

                        // Fetch existing records to dedupe/update
                        const existingRecords = await getLedgerRecords(paperClient.id);
                        
                        // Find ALL '电' records for this date
                        const existingDianRecords = existingRecords.filter(r => 
                            r.date === targetDate && 
                            r.typeLabel === '电' && 
                            r.column === 'main'
                        );

                        // Logic Updated: Company Total > 0 -> Subtract, Company Total < 0 -> Add
                        const operation = companyAmount >= 0 ? 'subtract' : 'add';
                        const amount = Math.abs(companyAmount);

                        if (existingDianRecords.length > 0) {
                            // Update the FIRST one found
                            await updateLedgerRecord(existingDianRecords[0].id, {
                                amount: amount,
                                operation: operation
                            });
                            
                            // AUTO-FIX: If multiple duplicates exist, delete the extras
                            if (existingDianRecords.length > 1) {
                                for (let i = 1; i < existingDianRecords.length; i++) {
                                    await deleteLedgerRecord(existingDianRecords[i].id);
                                }
                            }
                        } else {
                            // Create new if none exist
                            await saveLedgerRecord({
                                clientId: paperClient.id,
                                date: targetDate,
                                description: '',
                                typeLabel: '电',
                                amount: amount,
                                operation: operation,
                                column: 'main',
                                isVisible: true
                            });
                        }
                        updateCount++;
                    }
                }
            }
        }
        setIsSaving(false);
        setSaveStatus({ type: 'success', message: `Regenerated ${updateCount} '电' records for ${targetDate}.` });
  };

  const viewHistoryItem = (item: any) => {
      setParsedData(item.json_data);
      // Set date to the report date from history
      if (item.report_date) {
          const [y, m, d] = item.report_date.split('-').map(Number);
          setCurrentDate(new Date(y, m - 1, d));
      }
      setActiveTab('import');
      setSaveStatus({ type: 'success', message: 'Loaded historical data into view.' });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const [y, m, d] = e.target.value.split('-').map(Number);
      setCurrentDate(new Date(y, m - 1, d));
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-8">
        <div className="max-w-[1400px] mx-auto">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="flex items-center space-x-4">
                    <Link to="/sales" className="p-2 hover:bg-gray-200 rounded-full text-gray-600">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Mobile Report Importer</h1>
                        <p className="text-gray-500 text-sm">Structure: Member(1) + Comp(5) + Share(6) + Agent(5)</p>
                    </div>
                </div>
                
                <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                    <button 
                        onClick={() => setActiveTab('import')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'import' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Importer
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${activeTab === 'history' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        History ({history.length})
                    </button>
                </div>
            </div>

            {activeTab === 'import' && (
                <>
                    <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-200 mb-6">
                        <div className="flex items-center gap-2 flex-1 w-full">
                            <Calendar size={18} className="text-gray-400" />
                            <input 
                                type="date" 
                                value={reportDate} 
                                onChange={handleDateChange} 
                                className="font-bold text-gray-700 outline-none w-full cursor-pointer"
                            />
                        </div>
                        {saveStatus.message && (
                            <div className={`text-xs px-3 py-1 rounded-full font-bold flex items-center ${saveStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {saveStatus.type === 'success' ? <CheckCircle size={14} className="mr-1" /> : <AlertCircle size={14} className="mr-1" />}
                                {saveStatus.message}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
                        {/* Input Area */}
                        <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700 flex items-center"><FileText size={18} className="mr-2 text-blue-500" /> Paste Report Data</h3>
                                <div className="space-x-2">
                                    <button onClick={handleClear} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors">Clear</button>
                                    <button onClick={handleParse} disabled={!inputText} className="bg-blue-600 text-white text-xs px-4 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">Parse Data</button>
                                </div>
                            </div>
                            <textarea 
                                className="flex-1 w-full p-4 outline-none resize-none font-mono text-xs bg-gray-50/50 focus:bg-white transition-colors"
                                placeholder="Paste raw text from mobile report here..."
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                            />
                        </div>

                        {/* Preview Area */}
                        <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                <h3 className="font-bold text-gray-700 flex items-center"><Zap size={18} className="mr-2 text-yellow-500" /> Data Preview ({parsedData.length})</h3>
                                <div className="space-x-2 flex">
                                    <button 
                                        onClick={handleRegenerateDian} 
                                        disabled={parsedData.length === 0 || isSaving}
                                        className="bg-blue-100 text-blue-700 text-xs px-3 py-1.5 rounded-lg font-bold hover:bg-blue-200 transition-colors disabled:opacity-50 flex items-center"
                                    >
                                        <RefreshCw size={14} className={`mr-1 ${isSaving ? 'animate-spin' : ''}`} /> Update 电 Only
                                    </button>
                                    <button 
                                        onClick={handleSaveToSystem} 
                                        disabled={parsedData.length === 0 || isSaving}
                                        className="bg-green-600 text-white text-xs px-4 py-1.5 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                                    >
                                        {isSaving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                                        Save All
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-0 bg-white">
                                {parsedData.length > 0 ? (
                                    <table className="w-full text-xs text-left whitespace-nowrap">
                                        <thead className="bg-gray-100 text-gray-500 sticky top-0 font-bold">
                                            <tr>
                                                <th className="p-2 border-b">ID</th>
                                                <th className="p-2 border-b">Name</th>
                                                <th className="p-2 border-b text-right">Company Total</th>
                                                <th className="p-2 border-b text-right">Agent Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {parsedData.map((row, idx) => {
                                                const mappedCode = MOBILE_TO_PAPER_MAP[row.id.toLowerCase()];
                                                return (
                                                <tr key={idx} className={`hover:bg-gray-50 ${mappedCode ? 'bg-blue-50/50' : ''}`}>
                                                    <td className="p-2 font-mono text-gray-600">
                                                        {row.id} 
                                                        {mappedCode && <span className="ml-2 text-[9px] bg-blue-100 text-blue-700 px-1 rounded">→ {mappedCode.toUpperCase()}</span>}
                                                    </td>
                                                    <td className="p-2 font-bold text-gray-800">{row.name}</td>
                                                    <td className="p-2 text-right font-mono text-gray-500">{row.values[5]}</td>
                                                    <td className="p-2 text-right font-mono">
                                                        {row.values[16] || row.values[row.values.length-1]}
                                                    </td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                        <p>No data parsed yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'history' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="font-bold text-gray-700 flex items-center"><History size={18} className="mr-2 text-purple-500" /> Import History</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-500 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3">Date Imported</th>
                                    <th className="px-6 py-3">Report Date</th>
                                    <th className="px-6 py-3 text-center">Records</th>
                                    <th className="px-6 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-gray-500">{new Date(item.created_at).toLocaleString()}</td>
                                        <td className="px-6 py-4 font-bold text-gray-800">{item.report_date}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-md text-xs font-bold">{item.json_data?.length || 0}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => viewHistoryItem(item)}
                                                className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                                            >
                                                Load Data
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {history.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-400">No history found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default MobileReport;
