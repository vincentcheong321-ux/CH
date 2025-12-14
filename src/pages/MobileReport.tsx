
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getClients, saveSaleRecord, saveMobileReportHistory } from '../services/storageService';
import { Client } from '../types';
import { getWeeksForMonth, MONTH_NAMES } from '../utils/reportUtils';

const MobileReport: React.FC = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  
  // State for matching and saving
  const [clients, setClients] = useState<Client[]>([]);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  
  // Date Selection State for Saving
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);

  useEffect(() => {
      loadClients();
      
      // Initialize week to current week
      const now = new Date();
      let y = now.getFullYear();
      if(y < 2025) y = 2025;
      if(y > 2026) y = 2026;
      setSelectedYear(y);
      setSelectedMonth(now.getMonth());
      
      const weeks = getWeeksForMonth(y, now.getMonth());
      const todayNum = now.getDate();
      const foundWeek = Object.keys(weeks).find(w => weeks[parseInt(w)].includes(todayNum));
      if (foundWeek) setSelectedWeekNum(parseInt(foundWeek));
  }, []);

  const loadClients = async () => {
      const list = await getClients();
      setClients(list);
  };

  const handleParse = () => {
    if (!inputText.trim()) return;

    const rows = inputText.trim().split('\n');
    const data: any[] = [];

    // Heuristic to skip header rows if they exist
    let startIndex = 0;
    if (rows[0].includes('登陆帐号')) startIndex = 1;
    // Some exports might have 2 header rows
    if (rows[1] && (rows[1].includes('营业额') || rows[1].includes('Total'))) startIndex = 2; 

    for (let i = startIndex; i < rows.length; i++) {
        const line = rows[i].trim();
        if (!line) continue;

        const parts = line.split(/[\t\s]+/);
        
        // Basic validation: needs at least enough columns to be a valid row
        // Expected ~20 columns
        if (parts.length < 5) continue;

        // Extract ID and Name
        // ID is usually parts[0]
        // Name might be parts[1] (single word) or parts[1]...parts[N] (multi word)
        // We look for the first numeric-like value after index 1 to identify where stats start
        
        const isNumberLike = (s: string) => /^-?[\d,]+\.?\d*$/.test(s);
        
        let firstStatIndex = -1;
        // Start checking from index 1
        for (let j = 1; j < parts.length; j++) {
            // Check if this part AND the next part look like numbers (to avoid false positives on names with numbers)
            if (isNumberLike(parts[j]) && (j+1 >= parts.length || isNumberLike(parts[j+1]))) {
                firstStatIndex = j;
                break;
            }
        }

        if (firstStatIndex > -1) {
            const id = parts[0];
            const name = parts.slice(1, firstStatIndex).join(' ');
            const values = parts.slice(firstStatIndex);
            
            // Map to expected structure (pad if missing, though unlikely if valid row)
            data.push({
                id,
                name,
                values
            });
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

  // --- Save Logic ---
  const handleSaveToSystem = async () => {
      if (parsedData.length === 0) return;

      // 1. Determine Target Date (Last day of the selected week)
      const weeks = getWeeksForMonth(selectedYear, selectedMonth);
      const days = weeks[selectedWeekNum];
      if (!days || days.length === 0) {
          setSaveStatus({ type: 'error', message: 'Invalid week selection.' });
          return;
      }
      const lastDay = days[days.length - 1];
      // Format YYYY-MM-DD
      const mStr = String(selectedMonth + 1).padStart(2, '0');
      const dStr = String(lastDay).padStart(2, '0');
      const targetDate = `${selectedYear}-${mStr}-${dStr}`;

      // 2. Iterate and Save Client Records
      let matchedCount = 0;
      let skippedCount = 0;

      for (const row of parsedData) {
          // Find client by CODE (case-insensitive)
          const client = clients.find(c => c.code.toLowerCase() === row.id.toLowerCase());
          
          if (client) {
              const lastValStr = row.values[row.values.length - 1];
              // Remove commas
              const val = parseFloat(lastValStr.replace(/,/g, ''));

              if (!isNaN(val)) {
                  await saveSaleRecord({
                      clientId: client.id,
                      date: targetDate,
                      b: val, 
                      s: 0, a: 0, c: 0
                  });
                  matchedCount++;
              }
          } else {
              skippedCount++;
          }
      }

      // 3. Save Raw Historical Record (New Requirement)
      try {
        await saveMobileReportHistory(targetDate, parsedData);
      } catch (e) {
          console.error("Failed to save history", e);
      }

      if (matchedCount > 0) {
          setSaveStatus({ type: 'success', message: `Updated ${matchedCount} clients & saved history for ${targetDate}.` });
      } else {
          setSaveStatus({ type: 'error', message: `No matching clients found. Ensure Client Codes match.` });
      }
  };

  const weeksForMonth = useMemo(() => getWeeksForMonth(selectedYear, selectedMonth), [selectedYear, selectedMonth]);

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-8">
        <div className="max-w-[1400px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="flex items-center space-x-4">
                    <Link to="/sales" className="p-2 hover:bg-gray-200 rounded-full text-gray-600">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Mobile Report Importer</h1>
                        <p className="text-gray-500 text-sm">Import and sync external report data.</p>
                    </div>
                </div>
                
                {/* Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                    {/* Date Pickers */}
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
                    <button onClick={handleParse} className="px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center">
                        <RefreshCw size={16} className="mr-2" /> Parse
                    </button>
                    {parsedData.length > 0 && (
                        <button onClick={handleSaveToSystem} className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center shadow-md animate-in fade-in">
                            <Save size={16} className="mr-2" /> Save to System
                        </button>
                    )}
                </div>
            </div>

            {/* Status Message */}
            {saveStatus.message && (
                <div className={`mb-6 p-4 rounded-lg flex items-center ${saveStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {saveStatus.type === 'success' ? <CheckCircle className="mr-2" /> : <AlertCircle className="mr-2" />}
                    {saveStatus.message}
                </div>
            )}

            {parsedData.length === 0 ? (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center">
                    <div className="mb-4">
                        <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto text-purple-600 mb-4">
                            <Save size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">Paste Report Data</h3>
                        <p className="text-gray-500 text-sm max-w-md mx-auto mt-2">
                            Copy the full table content from your external report (including headers or just data) and paste it below. 
                            The system will automatically extract totals.
                        </p>
                    </div>
                    <textarea 
                        className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none bg-gray-50"
                        placeholder="Paste excel/text content here..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-center text-xs whitespace-nowrap">
                            <thead className="bg-gray-100 text-gray-700 font-bold">
                                <tr>
                                    {/* Fixed Table Headers matching prompt exactly */}
                                    <th className="px-4 py-3 text-left sticky left-0 bg-gray-100 z-10 border-r border-gray-200">登陆帐号 / 名字</th>
                                    <th className="px-2 py-3 bg-gray-50">会员总投注</th>
                                    <th className="px-2 py-3 bg-gray-50">会员总数</th>
                                    <th className="px-2 py-3 bg-gray-50">tgmts</th>
                                    
                                    {/* Company */}
                                    <th className="px-2 py-3 border-l border-gray-200">公司 营业额</th>
                                    <th className="px-2 py-3">公司 佣金</th>
                                    <th className="px-2 py-3">公司 赔出</th>
                                    <th className="px-2 py-3">公司 补费用</th>
                                    <th className="px-2 py-3 font-extrabold bg-blue-50 text-blue-800">公司 总额</th>

                                    {/* Shareholder */}
                                    <th className="px-2 py-3 border-l border-gray-200">股东 营业额</th>
                                    <th className="px-2 py-3">股东 佣金</th>
                                    <th className="px-2 py-3">股东 赔出</th>
                                    <th className="px-2 py-3">股东 赢彩</th>
                                    <th className="px-2 py-3">股东 补费用</th>
                                    <th className="px-2 py-3 font-extrabold bg-blue-50 text-blue-800">股东 总额</th>

                                    {/* General Agent */}
                                    <th className="px-2 py-3 border-l border-gray-200">总代理 营业额</th>
                                    <th className="px-2 py-3">总代理 佣金</th>
                                    <th className="px-2 py-3">总代理 赔出</th>
                                    <th className="px-2 py-3">总代理 抽费用</th>
                                    <th className="px-2 py-3 font-extrabold bg-green-100 text-green-900 border-l-2 border-green-200">总代理 总额</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-mono">
                                {parsedData.map((row, idx) => {
                                    // Highlight match status
                                    const isMatched = clients.some(c => c.code.toLowerCase() === row.id.toLowerCase());
                                    
                                    return (
                                    <tr key={idx} className={`hover:bg-gray-50 ${!isMatched ? 'opacity-50 bg-red-50/30' : ''}`}>
                                        <td className="px-4 py-2 text-left sticky left-0 bg-white hover:bg-gray-50 border-r border-gray-100 z-10">
                                            <div className="font-bold text-gray-900">{row.name}</div>
                                            <div className="flex items-center">
                                                <span className="text-[10px] text-gray-500 mr-2">{row.id}</span>
                                                {!isMatched && <span className="text-[9px] text-red-500 font-bold px-1 border border-red-200 rounded">No Match</span>}
                                            </div>
                                        </td>
                                        
                                        {/* Render Values: Ensure we map correctly even if parsed columns differ slightly, assume order */}
                                        {/* Basic 3 */}
                                        <td className="px-2 py-2">{row.values[0]}</td>
                                        <td className="px-2 py-2 text-gray-400">{row.values[1]}</td>
                                        <td className="px-2 py-2">{row.values[2]}</td>

                                        {/* Company 5 */}
                                        <td className="px-2 py-2 border-l border-gray-100">{row.values[3]}</td>
                                        <td className="px-2 py-2">{row.values[4]}</td>
                                        <td className="px-2 py-2">{row.values[5]}</td>
                                        <td className="px-2 py-2">{row.values[6]}</td>
                                        <td className="px-2 py-2 font-bold bg-blue-50/30">{row.values[7]}</td>

                                        {/* Shareholder 6 */}
                                        <td className="px-2 py-2 border-l border-gray-100">{row.values[8]}</td>
                                        <td className="px-2 py-2">{row.values[9]}</td>
                                        <td className="px-2 py-2">{row.values[10]}</td>
                                        <td className="px-2 py-2">{row.values[11]}</td>
                                        <td className="px-2 py-2">{row.values[12]}</td>
                                        <td className="px-2 py-2 font-bold bg-blue-50/30">{row.values[13]}</td>

                                        {/* Agent 5 (Last one is total) */}
                                        <td className="px-2 py-2 border-l border-gray-100">{row.values[14]}</td>
                                        <td className="px-2 py-2">{row.values[15]}</td>
                                        <td className="px-2 py-2">{row.values[16]}</td>
                                        <td className="px-2 py-2">{row.values[17]}</td>
                                        <td className={`px-2 py-2 font-extrabold bg-green-50 border-l-2 border-green-100 ${parseFloat(row.values[row.values.length-1]?.replace(/,/g,'')) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                                            {/* Always take the last value as the Final Total */}
                                            {row.values[row.values.length - 1]}
                                        </td>
                                    </tr>
                                )})}
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
