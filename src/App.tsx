
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import ClientLedger from './pages/ClientLedger'; 
import DrawReport from './pages/DrawReport';
import CashAdvanceCredit from './pages/CashAdvanceCredit';
import Summary from './pages/Summary';
import CashFlow from './pages/CashFlow';
import SalesIndex from './pages/SalesIndex';
import ClientSales from './pages/ClientSales';
import MobileReport from './pages/MobileReport';
import WinCalculator from './pages/WinCalculator';
import LinkGenerator from './pages/LinkGenerator';
import Redirect from './pages/Redirect';
import Login from './pages/Login';
import { seedData } from './services/storageService';
import { GlobalStateProvider } from './context/GlobalStateContext';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    const auth = localStorage.getItem('ledger_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
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
    <GlobalStateProvider>
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

          <Route path="/sales" element={
            isAuthenticated ? (
              <Layout onLogout={handleLogout}>
                <SalesIndex />
              </Layout>
            ) : <Navigate to="/login" />
          } />

          <Route path="/sales/mobile-report" element={
            isAuthenticated ? (
              <Layout onLogout={handleLogout}>
                <MobileReport />
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

          <Route path="/cash-transaction" element={
            isAuthenticated ? (
              <Layout onLogout={handleLogout}>
                <CashAdvanceCredit />
              </Layout>
            ) : <Navigate to="/login" />
          } />

          <Route path="/calculator" element={
            isAuthenticated ? (
              <Layout onLogout={handleLogout}>
                <WinCalculator />
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

          <Route path="/link-generator" element={
            isAuthenticated ? (
              <Layout onLogout={handleLogout}>
                <LinkGenerator />
              </Layout>
            ) : <Navigate to="/login" />
          } />

          <Route path="/redirect" element={<Redirect />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </GlobalStateProvider>
  );
};

export default App;
