
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

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

  // Basic styling for older devices
  const containerStyle: React.CSSProperties = {
    fontFamily: 'Arial, sans-serif',
    padding: '40px 20px',
    textAlign: 'center',
    backgroundColor: '#f4f4f4',
    minHeight: '100vh'
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    border: '1px solid #cccccc',
    padding: '30px',
    maxWidth: '400px',
    margin: '0 auto',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
  };

  const buttonStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: '#ffffff',
    textDecoration: 'none',
    borderRadius: '4px',
    marginTop: '20px',
    fontWeight: 'bold'
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {status === 'loading' && (
          <div>
            <h1 style={{ fontSize: '24px', margin: '0 0 10px 0' }}>Verifying Link...</h1>
            <p style={{ color: '#666666' }}>Please wait while we check the link's validity.</p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <h1 style={{ fontSize: '24px', margin: '0 0 10px 0', color: '#28a745' }}>Redirecting...</h1>
            <p style={{ color: '#666666', marginBottom: '15px' }}>
              The link is valid. You will be redirected in <b>{countdown}</b> seconds.
            </p>
            <a href={targetUrl} style={buttonStyle}>
              Click here if not redirected
            </a>
          </div>
        )}

        {status === 'expired' && (
          <div>
            <h1 style={{ fontSize: '24px', margin: '0 0 10px 0', color: '#dc3545' }}>Link Expired</h1>
            <p style={{ color: '#666666' }}>
              Sorry, this link has expired and is no longer valid.
            </p>
          </div>
        )}

        {status === 'invalid' && (
          <div>
            <h1 style={{ fontSize: '24px', margin: '0 0 10px 0', color: '#dc3545' }}>Invalid Link</h1>
            <p style={{ color: '#666666' }}>
              The link you followed is invalid or broken.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Redirect;
