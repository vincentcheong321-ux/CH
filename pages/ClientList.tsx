import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, User, ChevronRight } from 'lucide-react';
import { getClients, saveClient, getAllLedgerRecords, getNetAmount } from '../services/storageService';
import { Client } from '../types';

const ClientList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ code: '', name: '', phone: '' });
  const [balances, setBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const loadedClients = getClients();
    setClients(loadedClients);

    const records = getAllLedgerRecords();
    const bal: Record<string, number> = {};
    
    loadedClients.forEach(c => {
      const clientRecords = records.filter(r => r.clientId === c.id);
      const total = clientRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
      bal[c.id] = total;
    });
    setBalances(bal);
  };

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClient.code && newClient.name) {
      saveClient(newClient);
      setNewClient({ code: '', name: '', phone: '' });
      setIsModalOpen(false);
      loadData();
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Client Accounts</h1>
          <p className="text-gray-500">Manage client ledger access.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center shadow-sm transition-colors"
        >
          <Plus size={20} className="mr-2" />
          New Client
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search by name or code..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredClients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No clients found.</div>
          ) : (
            filteredClients.map(client => (
              <Link 
                key={client.id}
                to={`/clients/${client.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900">{client.name}</h3>
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-mono">
                        {client.code}
                      </span>
                    </div>
                    {client.phone && <p className="text-sm text-gray-500">{client.phone}</p>}
                  </div>
                </div>
                <div className="flex items-center space-x-6">
                   <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase">Current Balance</p>
                    <p className={`font-bold ${balances[client.id] >= 0 ? 'text-blue-600' : 'text-green-600'}`}>
                       {balances[client.id] >= 0 ? 'Owes' : 'Credit'}: ${Math.abs(balances[client.id] || 0).toLocaleString()}
                    </p>
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colors" size={20} />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Add Client Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Add New Client</h2>
            <form onSubmit={handleAddClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Code</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newClient.code}
                  onChange={e => setNewClient({...newClient, code: e.target.value})}
                  placeholder="e.g. C001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  required
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newClient.name}
                  onChange={e => setNewClient({...newClient, name: e.target.value})}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newClient.phone}
                  onChange={e => setNewClient({...newClient, phone: e.target.value})}
                />
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientList;