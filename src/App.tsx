
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import ClientLedger from './pages/ClientLedger';
import ClientSales from './pages/ClientSales';
import DrawReport from './pages/DrawReport';
import Summary from './pages/Summary';
import CashFlow from './pages/CashFlow';
import Login from './pages/Login';
import { seedData } from './services/storageService';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    // Check session in localStorage (Mock)
    const auth = localStorage.getItem('ledger_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    // Initialize mock data
    seedData();
  }, []);

  const handleLogin = () => {
    localStorage.setItem('ledger_auth', 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('ledger_auth');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" /> : <Login onLogin={handleLogin} />
        } />
        
        <Route path="/" element={
          isAuthenticated ? (
            <Layout onLogout={handleLogout}>
              <Dashboard />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/clients" element={
          isAuthenticated ? (
            <Layout onLogout={handleLogout}>
              <ClientList />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/clients/:id" element={
          isAuthenticated ? (
            <Layout onLogout={handleLogout}>
              <ClientLedger />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/clients/:id/sales" element={
          isAuthenticated ? (
            <Layout onLogout={handleLogout}>
              <ClientSales />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/draw-report" element={
          isAuthenticated ? (
            <Layout onLogout={handleLogout}>
              <DrawReport />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/summary" element={
          isAuthenticated ? (
            <Layout onLogout={handleLogout}>
              <Summary />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="/cashflow" element={
          isAuthenticated ? (
            <Layout onLogout={handleLogout}>
              <CashFlow />
            </Layout>
          ) : <Navigate to="/login" />
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};

export default App;
