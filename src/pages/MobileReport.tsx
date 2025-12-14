
import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, RefreshCw, Save, CheckCircle, AlertCircle, History, FileText, Loader2, Image as ImageIcon, Upload } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getClients, saveSaleRecord, saveMobileReportHistory, getMobileReportHistory } from '../services/storageService';
import { Client } from '../types';
import { getWeeksForMonth, MONTH_NAMES } from '../utils/reportUtils';
import { GoogleGenAI } from "@google/genai";

const MobileReport: React.FC = () => {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  
  // State for matching and saving
  const [clients, setClients] = useState<Client[]>([]);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'import' | 'history'>('import');
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  // Date Selection State for Saving
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);

  useEffect(() => {
      loadClients();
      loadHistory();
      
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

  const loadHistory = async () => {
      const hist = await getMobileReportHistory();
      setHistory(hist);
  };

  const handleParse = () => {
    if (!inputText.trim()) return;

    const rows = inputText.trim().split('\n');
    const data: any[] = [];

    // Heuristic to skip header rows if they exist
    let startIndex = 0;
    if (rows[0].includes('登陆帐号')) startIndex = 1;
    if (rows[1] && (rows[1].includes('营业额') || rows[1].includes('Total'))) startIndex = 2; 

    for (let i = startIndex; i < rows.length; i++) {
        const line = rows[i].trim();
        if (!line) continue;

        const parts = line.split(/[\t\s]+/);
        if (parts.length < 5) continue;

        const isNumberLike = (s: string) => /^-?[\d,]+\.?\d*$/.test(s);
        let firstStatIndex = -1;
        for (let j = 1; j < parts.length; j++) {
            if (isNumberLike(parts[j]) && (j+1 >= parts.length || isNumberLike(parts[j+1]))) {
                firstStatIndex = j;
                break;
            }
        }

        if (firstStatIndex > -1) {
            const id = parts[0];
            const name = parts.slice(1, firstStatIndex).join(' ');
            const values = parts.slice(firstStatIndex);
            data.push({ id, name, values });
        }
    }
    setParsedData(data);
    setSaveStatus({ type: null, message: '' });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files || e.target.files.length === 0) return;
      
      const file = e.target.files[0];
      setIsProcessingImage(true);
      setSaveStatus({ type: null, message: '' });

      try {
          // Convert to Base64
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = async () => {
              const base64String = (reader.result as string).split(',')[1];
              
              const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
              const prompt = `
                Analyze this image of a financial report table.
                Extract all data rows into a strictly valid JSON array of objects.
                Each object must have:
                - "id": The client code found in the first column (e.g. "2839").
                - "name": The client name found in the first column (e.g. "印").
                - "values": An array of strings containing all the numerical values in the row, in exact order from left to right (Member stats, Company stats, Shareholder stats, Agent stats). Preserve commas and formatting.
                
                Exclude header rows. Return ONLY the JSON.
              `;

              const response = await ai.models.generateContent({
                  model: 'gemini-2.5-flash',
                  contents: {
                      parts: [
                          { inlineData: { mimeType: file.type, data: base64String } },
                          { text: prompt }
                      ]
                  }
              });

              let jsonText = response.text || '';
              // Clean up markdown code blocks if present
              jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
              
              try {
                  const jsonData = JSON.parse(jsonText);
                  if (Array.isArray(jsonData)) {
                      setParsedData(jsonData);
                      setSaveStatus({ type: 'success', message: `Successfully extracted ${jsonData.length} rows from image.` });
                  } else {
                      throw new Error("Response is not an array");
                  }
              } catch (parseError) {
                  console.error("JSON Parse Error:", parseError, jsonText);
                  setSaveStatus({ type: 'error', message: 'Failed to parse AI response. Please try again or use text paste.' });
              }
              setIsProcessingImage(false);
          };
      } catch (error) {
          console.error("AI Error:", error);
          setSaveStatus({ type: 'error', message: 'Image processing failed.' });
          setIsProcessingImage(false);
      }
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
      const mStr = String(selectedMonth + 1).padStart(2, '0');
      const dStr = String(lastDay).padStart(2, '0');
      const targetDate = `${selectedYear}-${mStr}-${dStr}`;

      let matchedCount = 0;
      let skippedCount = 0;

      for (const row of parsedData) {
          const client = clients.find(c => c.code.toLowerCase() === row.id.toLowerCase());
          
          if (client) {
              const lastValStr = row.values[row.values.length - 1];
              const val = parseFloat(String(lastValStr).replace(/,/g, ''));

              // Extract extra details (Keep legacy for now)
              const mobileRaw = {
                  memberBet: row.values[0] || '0',
                  companyTotal: row.values[7] || '0',
                  shareholderTotal: row.values[13] || '0',
                  agentTotal: row.values[row.values.length - 1] || '0'
              };

              if (!isNaN(val)) {
                  await saveSaleRecord({
                      clientId: client.id,
                      date: targetDate,
                      b: val, 
                      s: 0, a: 0, c: 0,
                      mobileRaw, // Save detailed legacy data
                      mobileRawData: row.values // Save FULL raw data array
                  });
                  matchedCount++;
              }
          } else {
              skippedCount++;
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
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="flex items-center space-x-4">
                    <Link to="/sales" className="p-2 hover:bg-gray-200 rounded-full text-gray-600">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Mobile Report Importer</h1>
                        <p className="text-gray-500 text-sm">Import via Copy-Paste or Image Analysis.</p>
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
                        
                        {/* Text Parse Button */}
                        <button onClick={handleParse} className="px-4 py-2 text-sm font-bold text-white bg-gray-600 hover:bg-gray-700 rounded-lg flex items-center">
                            <RefreshCw size={16} className="mr-2" /> Text Parse
                        </button>

                        {/* Image Upload Button */}
                        <label className={`px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center cursor-pointer transition-all ${isProcessingImage ? 'opacity-70 pointer-events-none' : ''}`}>
                            {isProcessingImage ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Upload size={16} className="mr-2" />}
                            {isProcessingImage ? 'Analyzing...' : 'Upload Image'}
                            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                        </label>

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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 mb-4">
                                    <ImageIcon size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-800">Upload Screenshot</h3>
                                <p className="text-gray-500 text-sm max-w-xs mx-auto mt-2 mb-4">
                                    Take a screenshot of the report table and upload it. AI will automatically extract the data for you.
                                </p>
                                <label className="px-6 py-3 bg-purple-100 text-purple-700 font-bold rounded-lg cursor-pointer hover:bg-purple-200 transition-colors">
                                    Choose Image
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                </label>
                            </div>

                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex flex-col">
                                <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-wide">Or Paste Text</h3>
                                <textarea 
                                    className="flex-1 w-full p-4 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none bg-gray-50 resize-none"
                                    placeholder="Paste excel/text content here..."
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    style={{ minHeight: '200px' }}
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
                                            <th className="px-2 py-3 bg-gray-50">会员总投注</th>
                                            <th className="px-2 py-3 bg-gray-50">会员总数</th>
                                            <th className="px-2 py-3 bg-gray-50">tgmts</th>
                                            <th className="px-2 py-3 border-l border-gray-200">公司 营业额</th>
                                            <th className="px-2 py-3">公司 佣金</th>
                                            <th className="px-2 py-3">公司 赔出</th>
                                            <th className="px-2 py-3">公司 补费用</th>
                                            <th className="px-2 py-3 font-extrabold bg-blue-50 text-blue-800">公司 总额</th>
                                            <th className="px-2 py-3 border-l border-gray-200">股东 营业额</th>
                                            <th className="px-2 py-3">股东 佣金</th>
                                            <th className="px-2 py-3">股东 赔出</th>
                                            <th className="px-2 py-3">股东 赢彩</th>
                                            <th className="px-2 py-3">股东 补费用</th>
                                            <th className="px-2 py-3 font-extrabold bg-blue-50 text-blue-800">股东 总额</th>
                                            <th className="px-2 py-3 border-l border-gray-200">总代理 营业额</th>
                                            <th className="px-2 py-3">总代理 佣金</th>
                                            <th className="px-2 py-3">总代理 赔出</th>
                                            <th className="px-2 py-3">总代理 抽费用</th>
                                            <th className="px-2 py-3 font-extrabold bg-green-100 text-green-900 border-l-2 border-green-200">总代理 总额</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 font-mono">
                                        {parsedData.map((row, idx) => {
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
                                                {row.values.map((v: any, i: number) => (
                                                    <td key={i} className={`px-2 py-2 ${i===7||i===13?'font-bold bg-blue-50/30':''} ${i===3||i===8||i===14?'border-l border-gray-100':''} ${i===row.values.length-1 ? (parseFloat(String(v).replace(/,/g,'')) >= 0 ? 'text-green-700 bg-green-50 font-extrabold border-l-2 border-green-100' : 'text-red-600 bg-green-50 font-extrabold border-l-2 border-green-100') : ''}`}>
                                                        {v}
                                                    </td>
                                                ))}
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

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
