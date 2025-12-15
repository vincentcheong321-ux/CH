
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  ArrowRightLeft, 
  LogOut, 
  Menu, 
  X,
  PieChart,
  Calendar,
  FileText,
  Banknote,
  CreditCard,
  Calculator
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/clients', label: 'Client Accounts', icon: Users },
    { path: '/sales', label: 'Sales Opening', icon: FileText, chineseChar: '收' },
    { path: '/cash-advance', label: 'Cash Advance', icon: Banknote, chineseChar: '支' },
    { path: '/cash-credit', label: 'Cash Credit', icon: CreditCard, chineseChar: '来' },
    { path: '/draw-report', label: 'Draw Reports', icon: Calendar, chineseChar: '欠' },
    { path: '/calculator', label: 'Win Calculator', icon: Calculator, chineseChar: '中' },
    { path: '/cashflow', label: 'Company Cash Flow', icon: ArrowRightLeft },
    { path: '/summary', label: 'Total Balance Summary', icon: PieChart },
  ];

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex print:bg-white print:h-auto print:overflow-visible">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden no-print"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        no-print
      `}>
        <div className="h-16 flex items-center justify-between px-6 bg-slate-800">
          <span className="text-xl font-bold tracking-wider">CH</span>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="mt-6 px-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`
                  flex items-center px-4 py-3 rounded-lg transition-colors group
                  ${isActive 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' 
                    : 'text-gray-400 hover:bg-slate-800 hover:text-white'}
                `}
              >
                {item.chineseChar ? (
                   <div className={`
                        mr-3 flex items-center justify-center w-5 h-5 
                        font-bold leading-none transition-colors
                        ${item.chineseChar.length > 1 ? 'text-[11px]' : 'text-lg'}
                        ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}
                   `}>
                       {item.chineseChar}
                   </div>
                ) : (
                   <Icon size={20} className="mr-3" />
                )}
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 mt-8 text-red-400 hover:bg-slate-800 hover:text-red-300 rounded-lg transition-colors"
          >
            <LogOut size={20} className="mr-3" />
            <span className="font-medium">Sign Out</span>
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden print:overflow-visible print:h-auto">
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 lg:px-8 no-print">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <Menu size={24} />
          </button>
          
          <div className="flex items-center space-x-4 ml-auto">
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold text-gray-800">Administrator</span>
              <span className="text-xs text-gray-500">Company Admin</span>
            </div>
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              A
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8 print:overflow-visible print:p-0 print:h-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
