
import React, { useState } from 'react';
import { ArrowLeft, RefreshCw, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

const MobileReport: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // The fixed header string provided in the prompt
  // 登陆帐号 名字 会员总投注 会员总数 tgmts 公司 营业额 佣金 赔出 补费用 总额 营业额 佣金 赔出 赢彩 补费用 总额 营业额 佣金 赔出 抽费用 总额
  const EXPECTED_HEADERS = [
    "登陆帐号", "名字", "会员总投注", "会员总数", "tgmts", "公司 营业额", "公司 佣金", "公司 赔出", "公司 补费用", "公司 总额", 
    "股东 营业额", "股东 佣金", "股东 赔出", "股东 赢彩", "股东 补费用", "股东 总额", 
    "总代理 营业额", "总代理 佣金", "总代理 赔出", "总代理 抽费用", "总代理 总额"
  ];
  // Note: The prompt's header has duplicate names (营业额, 佣金). I've added prefixes based on typical report structures (Company, Shareholder/Agent, etc.) to make unique keys if needed, 
  // but for display I will just use the order. 
  // Actually, let's just use indices.

  const handleParse = () => {
    if (!inputText.trim()) return;

    const rows = inputText.trim().split('\n');
    const data: any[] = [];

    // Skip the first row if it matches header keywords roughly, otherwise assume data starts immediately if no header found
    let startIndex = 0;
    if (rows[0].includes('登陆帐号')) {
        startIndex = 1;
    }

    for (let i = startIndex; i < rows.length; i++) {
        const line = rows[i].trim();
        if (!line) continue;

        // Split by tab or multiple spaces
        const parts = line.split(/[\t\s]+/);
        
        // Logic to extract ID and Name first.
        // ID is usually parts[0] (alphanumeric)
        // Name might be multiple parts (e.g. "z keong").
        // Then numbers start.
        
        // Heuristic: Find first part that looks like a number with decimal or strictly numeric (and is after index 1)
        // Actually, looking at data: "2,377.20"
        
        const isNumberLike = (s: string) => /^-?[\d,]+\.\d{2}$/.test(s) || /^-?[\d,]+$/.test(s);
        
        let firstNumIndex = -1;
        for (let j = 1; j < parts.length; j++) {
            if (isNumberLike(parts[j])) {
                firstNumIndex = j;
                break;
            }
        }

        if (firstNumIndex > -1) {
            const id = parts[0];
            const name = parts.slice(1, firstNumIndex).join(' ');
            const numbers = parts.slice(firstNumIndex);
            
            data.push({
                id,
                name,
                values: numbers
            });
        }
    }
    setParsedData(data);
  };

  const handleClear = () => {
      setInputText('');
      setParsedData([]);
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <Link to="/sales" className="p-2 hover:bg-gray-200 rounded-full text-gray-600">
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Mobile Report Importer</h1>
                        <p className="text-gray-500">Parse and view external mobile lists.</p>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <button onClick={handleClear} className="px-4 py-2 text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Clear</button>
                    <button onClick={handleParse} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center font-bold">
                        <RefreshCw size={18} className="mr-2" /> Parse Data
                    </button>
                </div>
            </div>

            {parsedData.length === 0 ? (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Paste Report Data Here</label>
                    <textarea 
                        className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        placeholder="Paste the full excel/text content here..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                    />
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-center text-xs md:text-sm whitespace-nowrap">
                            <thead className="bg-purple-50 text-purple-900 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 text-left sticky left-0 bg-purple-50 z-10 border-r border-purple-100">Client Info</th>
                                    <th className="px-2 py-3 bg-purple-100/50">Total Bet</th>
                                    <th className="px-2 py-3 bg-purple-100/50">Total Mem</th>
                                    <th className="px-2 py-3 bg-purple-100/50">TGMTS</th>
                                    
                                    {/* Group 1: Company */}
                                    <th className="px-2 py-3 border-l border-purple-200">Co. Turnover</th>
                                    <th className="px-2 py-3">Co. Comm</th>
                                    <th className="px-2 py-3">Co. Payout</th>
                                    <th className="px-2 py-3">Co. Fees</th>
                                    <th className="px-2 py-3 font-extrabold bg-purple-100">Co. Total</th>

                                    {/* Group 2 */}
                                    <th className="px-2 py-3 border-l border-purple-200">Ag. Turnover</th>
                                    <th className="px-2 py-3">Ag. Comm</th>
                                    <th className="px-2 py-3">Ag. Payout</th>
                                    <th className="px-2 py-3">Ag. Win</th>
                                    <th className="px-2 py-3">Ag. Fees</th>
                                    <th className="px-2 py-3 font-extrabold bg-purple-100">Ag. Total</th>

                                    {/* Group 3 */}
                                    <th className="px-2 py-3 border-l border-purple-200">Ma. Turnover</th>
                                    <th className="px-2 py-3">Ma. Comm</th>
                                    <th className="px-2 py-3">Ma. Payout</th>
                                    <th className="px-2 py-3">Ma. Fees</th>
                                    <th className="px-2 py-3 font-extrabold bg-purple-100">Ma. Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-mono">
                                {parsedData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 text-left sticky left-0 bg-white hover:bg-gray-50 border-r border-gray-100 z-10">
                                            <div className="font-bold text-gray-900">{row.name}</div>
                                            <div className="text-xs text-gray-500">{row.id}</div>
                                        </td>
                                        {/* Basic Stats */}
                                        <td className="px-2 py-2">{row.values[0]}</td>
                                        <td className="px-2 py-2 text-gray-400">{row.values[1]}</td>
                                        <td className="px-2 py-2">{row.values[2]}</td>

                                        {/* Co Group */}
                                        <td className="px-2 py-2 border-l border-gray-100">{row.values[3]}</td>
                                        <td className="px-2 py-2">{row.values[4]}</td>
                                        <td className="px-2 py-2">{row.values[5]}</td>
                                        <td className="px-2 py-2">{row.values[6]}</td>
                                        <td className={`px-2 py-2 font-bold bg-gray-50 ${parseFloat(row.values[7]?.replace(/,/g,'')) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{row.values[7]}</td>

                                        {/* Ag Group */}
                                        <td className="px-2 py-2 border-l border-gray-100">{row.values[8]}</td>
                                        <td className="px-2 py-2">{row.values[9]}</td>
                                        <td className="px-2 py-2">{row.values[10]}</td>
                                        <td className="px-2 py-2">{row.values[11]}</td>
                                        <td className="px-2 py-2">{row.values[12]}</td>
                                        <td className={`px-2 py-2 font-bold bg-gray-50 ${parseFloat(row.values[13]?.replace(/,/g,'')) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{row.values[13]}</td>

                                        {/* Ma Group */}
                                        <td className="px-2 py-2 border-l border-gray-100">{row.values[14]}</td>
                                        <td className="px-2 py-2">{row.values[15]}</td>
                                        <td className="px-2 py-2">{row.values[16]}</td>
                                        <td className="px-2 py-2">{row.values[17]}</td>
                                        <td className={`px-2 py-2 font-bold bg-gray-50 ${parseFloat(row.values[18]?.replace(/,/g,'')) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{row.values[18]}</td>
                                    </tr>
                                ))}
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
