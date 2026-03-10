
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
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-sm border border-black/5 mt-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-indigo-50 rounded-xl">
          <LinkIcon className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Expiring Link Generator</h1>
          <p className="text-sm text-gray-500">Generate a temporary redirect link for the APK</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Expiration Time (minutes)
          </label>
          <input
            type="number"
            value={expiryMinutes}
            onChange={(e) => setExpiryMinutes(parseInt(e.target.value) || 0)}
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            placeholder="Enter minutes..."
          />
          <p className="mt-2 text-xs text-gray-400">
            The link will be valid for {expiryMinutes} minutes from the moment of generation.
          </p>
        </div>

        <button
          onClick={generateLink}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Generate Link
        </button>

        {generatedLink && (
          <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Generated Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={generatedLink}
                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-mono text-gray-600"
              />
              <button
                onClick={copyToClipboard}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  copied ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 pt-6 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Target URL:</h3>
        <code className="block p-3 bg-gray-50 rounded-lg text-xs break-all text-gray-500 font-mono">
          {TARGET_URL}
        </code>
      </div>
    </div>
  );
};

export default LinkGenerator;
