
import React, { useState } from 'react';
import { Copy, Check, Clock, Link as LinkIcon } from 'lucide-react';

const TARGET_URL = 'https://github.com/Archmage83/tvapk/raw/refs/heads/master/%E9%87%91%E8%B0%83KTV.apk';

const LinkGenerator: React.FC = () => {
  const [expiryMinutes, setExpiryMinutes] = useState<number>(60);
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const generateLink = () => {
    const now = Date.now();
    const expiresAt = now + expiryMinutes * 60 * 1000;
    
    const data = {
      url: TARGET_URL,
      expires: expiresAt
    };
    
    const token = btoa(JSON.stringify(data));
    const baseUrl = window.location.origin + window.location.pathname;
    const fullLink = `${baseUrl}#/redirect?t=${token}`;
    
    setGeneratedLink(fullLink);
    setCopied(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 bg-white rounded-2xl shadow-sm border border-black/5 mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-50 rounded-xl">
          <LinkIcon className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Link Generator</h1>
          <p className="text-xs text-gray-500">Generate temporary download links</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-2 uppercase tracking-wider">
            <Clock className="w-3 h-3" />
            Expiry (minutes)
          </label>
          <input
            type="number"
            value={expiryMinutes}
            onChange={(e) => setExpiryMinutes(parseInt(e.target.value) || 0)}
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
            placeholder="Minutes..."
          />
        </div>

        <button
          onClick={generateLink}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md active:scale-[0.98]"
        >
          Generate Link
        </button>

        {generatedLink && (
          <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Generated Link
            </label>
            <div className="flex flex-col gap-2">
              <textarea
                readOnly
                value={generatedLink}
                rows={3}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-mono text-slate-600 resize-none"
              />
              <button
                onClick={copyToClipboard}
                className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all ${
                  copied ? 'bg-green-500 text-white' : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Target APK:</h3>
        <code className="block p-2 bg-gray-50 rounded-lg text-[10px] break-all text-gray-400 font-mono">
          {TARGET_URL}
        </code>
      </div>
    </div>
  );
};

export default LinkGenerator;
