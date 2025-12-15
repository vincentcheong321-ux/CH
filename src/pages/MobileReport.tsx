
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Save, CheckCircle, AlertCircle, History, FileText, Loader2, Image as ImageIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getClients, saveSaleRecord, saveMobileReportHistory, getMobileReportHistory, saveLedgerRecord } from '../services/storageService';
import { Client } from '../types';
import { getWeeksForMonth, MONTH_NAMES } from '../utils/reportUtils';

// Mapping: Mobile Code -> Paper Code (Case Insensitive)
const MOBILE_TO_PAPER_MAP: Record<string, string> = {
    'sk3964': 'z07',  // SINGER -> 顺
    'sk3818': 'z19',  // MOOI -> 妹
    'sk3619': 'c13',  // ZHONG -> 中
    'sk8959': 'c17',  // YEE -> 仪
    'vc9486': '9486'  // vincent -> 张
};

const MobileReport: React.FC = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  
  // State for matchin and saving
  const [clients, setClients] = useState<Client[]>([]);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');
  const [isSaving, setIsSaving] = useState(false);
  
  // Date Selection State for Saving
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);

  useEffect(() => {
      loadClients();
      loadHistory();
      
      const now = new Date();
      let y = now.getFullYear();
      if(y < 2025) y = 2025;
      if(y > 2026) y = 2026;
      setSelectedYear(y);
      setSelectedMonth(now.getMonth());
      
      const weeks = getWeeksForMonth(y, now.getMonth());
      const todayStr = `${y}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const foundWeek = Object.keys(weeks).find(w => {
          return weeks[parseInt(w)].some(d => {
              const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              return dStr === todayStr;
          });
      });
      if (foundWeek) setSelectedWeekNum(parseInt(foundWeek));
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
      setIsSaving(true);

      const weeks = getWeeksForMonth(selectedYear, selectedMonth);
      const days = weeks[selectedWeekNum]; 
      if (!days || days.length === 0) {
          setSaveStatus({ type: 'error', message: 'Invalid week selection.' });
          setIsSaving(false);
          return;
      }
      const lastDay = days[days.length - 1];
      const mStr = String(lastDay.getMonth() + 1).padStart(2, '0');
      const dStr = String(lastDay.getDate()).padStart(2, '0');
      const targetDate = `${lastDay.getFullYear()}-${mStr}-${dStr}`;

      let matchedCount = 0;
      let skippedCount = 0;

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
          // Check if this mobile row ID maps to a known Paper Client
          const mappedPaperCode = MOBILE_TO_PAPER_MAP[row.id.toLowerCase()];
          
          if (mappedPaperCode) {
              // Find the corresponding Paper Client
              const paperClient = clients.find(c => c.code.toLowerCase() === mappedPaperCode.toLowerCase());
              
              if (paperClient) {
                  // "record down 公司 总额 of the member" (Company Total is at Index 5)
                  const companyTotalRaw = values[5]; 
                  const companyAmount = parseFloat(String(companyTotalRaw).replace(/,/g, ''));

                  if (!isNaN(companyAmount) && companyAmount !== 0) {
                      // Logic: 
                      // If Company Total > 0 (Company Won), user usually owes.
                      // If Company Total < 0 (Company Lost), user is credited.
                      // Label: "电"
                      // Operation: "deduction" context in prompt usually implies Subtract visually or logically?
                      // We will store it such that:
                      // If Amount > 0 -> Add (Increases Balance)
                      // If Amount < 0 -> Subtract (Decreases Balance)
                      // But the prompt says "shows '电' deduction". 
                      // In storageService, '电' is set to `subtract` operation by default (Red).
                      // However, we want the math to be correct.
                      // If Company Won (+), Client Balance Increases.
                      // If Company Lost (-), Client Balance Decreases.
                      
                      await saveLedgerRecord({
                          clientId: paperClient.id,
                          date: targetDate,
                          description: '', // Empty description
                          typeLabel: '电',
                          amount: Math.abs(companyAmount),
                          // If positive, it adds to debt. If negative, it reduces debt.
                          operation: companyAmount >= 0 ? 'add' : 'subtract',
                          column: 'main',
                          isVisible: true
                      });
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
          setSaveStatus({ type: 'success', message: `Updated ${matchedCount} clients & saved history for ${targetDate}.` });
      } else {
          setSaveStatus({ type: 'error', message: `No matching clients found. Ensure Client Codes match.` });
      }
  };

  const weeksForMonth = useMemo(() => getWeeksForMonth(selectedYear, selectedMonth), [selectedYear, selectedMonth]);

  const viewHistoryItem = (data: any) => {
      setParsedData(data);
      setActiveTab('import');
      setSaveStatus({ type: 'success', message: 'Loaded historical data into view.' });
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
                    <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-6">
                        <div className="flex items-center space-x-2 border-r border-gray-200 pr-3">
                            <select 
                                value={selectedMonth} 
                                onChange={(e) => { setSelectedMonth(Number(e.target.value)); setSelectedWeekNum(1); }}
                                className="bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2"
                            >
                                {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                            </select>
                            <select 
                                value={selectedWeekNum} 
                                onChange={(e) => setSelectedWeekNum(Number(e.target.value))}
                                className="bg-gray-50 border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2"
                            >
                                {Object.keys(weeksForMonth).map(w => (
                                    <option key={w} value={w}>Week {Object.keys(weeksForMonth).indexOf(w) + 1}</option>
                                ))}
                            </select>
                        </div>

                        <button onClick={handleClear} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">
                            Clear
                        </button>
                        
                        <button onClick={handleParse} className="px-4 py-2 text-sm font-bold text-white bg-gray-600 hover:bg-gray-700 rounded-lg flex items-center">
                            <RefreshCw size={16} className="mr-2" /> Text Parse
                        </button>

                        {parsedData.length > 0 && (
                            <button 
                                onClick={handleSaveToSystem} 
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg flex items-center shadow-md animate-in fade-in ml-auto"
                            >
                                {isSaving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                                {isSaving ? 'Saving...' : 'Save to System'}
                            </button>
                        )}
                    </div>

                    {saveStatus.message && (
                        <div className={`mb-6 p-4 rounded-lg flex items-center ${saveStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                            {saveStatus.type === 'success' ? <CheckCircle className="mr-2" /> : <AlertCircle className="mr-2" />}
                            {saveStatus.message}
                        </div>
                    )}

                    {parsedData.length === 0 ? (
                        <div className="grid grid-cols-1">
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                                <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide">Paste Report Text</h3>
                                <p className="text-xs text-gray-400 mb-4">Copy the table from your spreadsheet or report and paste it here.</p>
                                <textarea 
                                    className="flex-1 w-full p-4 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none bg-gray-50 resize-none whitespace-pre"
                                    placeholder="Paste excel content here..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    style={{ minHeight: '300px' }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-center text-xs whitespace-nowrap">
                                    <thead className="bg-gray-100 text-gray-700 font-bold">
                                        <tr>
                                            <th className="px-4 py-3 text-left sticky left-0 bg-gray-100 z-10 border-r border-gray-200">登陆帐号 / 名字</th>
                                            {/* Member (1 col) */}
                                            <th className="px-2 py-3 bg-gray-50 border-r border-gray-200">会员总投注</th>
                                            
                                            {/* Company (5 cols) */}
                                            <th className="px-2 py-3">公司 营业额</th>
                                            <th className="px-2 py-3">公司 佣金</th>
                                            <th className="px-2 py-3">公司 赔出</th>
                                            <th className="px-2 py-3">公司 补费用</th>
                                            <th className="px-2 py-3 font-extrabold bg-blue-50 text-blue-800 border-r border-gray-200">公司 总额</th>
                                            
                                            {/* Shareholder (6 cols) */}
                                            <th className="px-2 py-3">股东 营业额</th>
                                            <th className="px-2 py-3">股东 佣金</th>
                                            <th className="px-2 py-3">股东 赔出</th>
                                            <th className="px-2 py-3 text-orange-600 bg-orange-50/20">股东 赢彩</th>
                                            <th className="px-2 py-3">股东 补费用</th>
                                            <th className="px-2 py-3 font-extrabold bg-indigo-50 text-indigo-800 border-r border-gray-200">股东 总额</th>
                                            
                                            {/* Agent (5 cols) */}
                                            <th className="px-2 py-3">总代理 营业额</th>
                                            <th className="px-2 py-3">总代理 佣金</th>
                                            <th className="px-2 py-3">总代理 赔出</th>
                                            <th className="px-2 py-3">总代理 抽费用</th>
                                            <th className="px-2 py-3 font-extrabold bg-green-100 text-green-900 border-l border-green-200">总代理 总额</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 font-mono">
                                        {parsedData.map((row, idx) => {
                                            const isTotalRow = row.id === '总额';
                                            const isMatched = clients.some(c => c.code.toLowerCase() === row.id.toLowerCase());
                                            const mappedPaper = MOBILE_TO_PAPER_MAP[row.id.toLowerCase()];
                                            const v = row.values;
                                            
                                            return (
                                            <tr key={idx} className={`hover:bg-gray-50 ${isTotalRow ? 'bg-gray-100 font-bold border-t-2 border-gray-300' : (!isMatched ? 'opacity-50 bg-red-50/30' : '')}`}>
                                                <td className={`px-4 py-2 text-left sticky left-0 z-10 border-r border-gray-100 ${isTotalRow ? 'bg-gray-100' : 'bg-white'}`}>
                                                    <div className="font-bold text-gray-900">{row.id}</div>
                                                    <div className="text-[10px] text-gray-500 mr-2">{row.name}</div>
                                                    {!isMatched && !isTotalRow && <span className="text-[9px] text-red-500 font-bold px-1 border border-red-200 rounded">No Match</span>}
                                                    {mappedPaper && <span className="text-[9px] text-blue-500 font-bold px-1 border border-blue-200 rounded ml-1">→ {mappedPaper.toUpperCase()}</span>}
                                                </td>
                                                {/* Member */}
                                                <td className="px-2 py-2 border-r border-gray-100">{v[0]}</td>
                                                
                                                {/* Company */}
                                                <td className="px-2 py-2">{v[1]}</td>
                                                <td className="px-2 py-2">{v[2]}</td>
                                                <td className="px-2 py-2">{v[3]}</td>
                                                <td className="px-2 py-2">{v[4]}</td>
                                                <td className={`px-2 py-2 ${isTotalRow ? 'bg-blue-100' : 'bg-blue-50'} text-blue-800 border-r border-blue-100`}>{v[5]}</td>
                                                
                                                {/* Shareholder */}
                                                <td className="px-2 py-2">{v[6]}</td>
                                                <td className="px-2 py-2">{v[7]}</td>
                                                <td className="px-2 py-2">{v[8]}</td>
                                                <td className="px-2 py-2 text-orange-600">{v[9]}</td>
                                                <td className="px-2 py-2">{v[10]}</td>
                                                <td className={`px-2 py-2 ${isTotalRow ? 'bg-indigo-100' : 'bg-indigo-50'} text-indigo-800 border-r border-indigo-100`}>{v[11]}</td>
                                                
                                                {/* Agent */}
                                                <td className="px-2 py-2">{v[12]}</td>
                                                <td className="px-2 py-2">{v[13]}</td>
                                                <td className="px-2 py-2">{v[14]}</td>
                                                <td className="px-2 py-2">{v[15]}</td>
                                                <td className={`px-2 py-2 ${isTotalRow ? 'bg-green-200' : 'bg-green-100'} border-l border-green-200 ${parseFloat(String(v[16]).replace(/,/g,'')) >= 0 ? 'text-green-800' : 'text-red-700'}`}>{v[16]}</td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
            
            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {history.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">No import history found.</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {history.map((item) => (
                                <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className="bg-purple-50 p-3 rounded-lg text-purple-600">
                                            <History size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900">Import Report: {item.report_date}</p>
                                            <p className="text-xs text-gray-500">
                                                Imported on {new Date(item.created_at).toLocaleString()} • {item.json_data.length} records
                                            </p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => viewHistoryItem(item.json_data)}
                                        className="px-4 py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg flex items-center"
                                    >
                                        <FileText size={16} className="mr-2" /> View Details
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default MobileReport;
