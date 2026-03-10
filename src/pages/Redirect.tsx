
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

const Redirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'expired' | 'invalid' | 'success'>('loading');
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(3);

  useEffect(() => {
    const token = searchParams.get('t');
    if (!token) {
      setStatus('invalid');
      return;
    }

    try {
      const decoded = JSON.parse(atob(token));
      const { url, expires } = decoded;

      if (!url || !expires) {
        setStatus('invalid');
        return;
      }

      if (Date.now() > expires) {
        setStatus('expired');
        return;
      }

      setTargetUrl(url);
      setStatus('success');

      // Start countdown for redirect
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            window.location.href = url;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    } catch (e) {
      setStatus('invalid');
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 border border-black/5">
        <div className="flex flex-col items-center text-center">
          {status === 'loading' && (
            <>
              <div className="p-4 bg-indigo-50 rounded-full mb-6">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying Link...</h1>
              <p className="text-gray-500">Please wait while we check the link's validity.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="p-4 bg-green-50 rounded-full mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Redirecting...</h1>
              <p className="text-gray-500 mb-6">
                The link is valid. You will be redirected in <span className="font-bold text-indigo-600">{countdown}</span> seconds.
              </p>
              <a
                href={targetUrl}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Click here if not redirected
              </a>
            </>
          )}

          {status === 'expired' && (
            <>
              <div className="p-4 bg-orange-50 rounded-full mb-6">
                <Clock className="w-10 h-10 text-orange-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
              <p className="text-gray-500 mb-2">
                Sorry, this link has expired and is no longer valid.
              </p>
            </>
          )}

          {status === 'invalid' && (
            <>
              <div className="p-4 bg-red-50 rounded-full mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Link</h1>
              <p className="text-gray-500 mb-2">
                The link you followed is invalid or broken.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Redirect;
