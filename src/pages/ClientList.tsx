
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, User, ChevronRight, Trash2, AlertTriangle } from 'lucide-react';
import { getClients, saveClient, getClientBalance, deleteClient } from '../services/storageService';
import { Client } from '../types';

const ClientList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ code: '', name: '', phone: '' });
  const [balances, setBalances] = useState<Record<string, number>>({});
  
  // Delete Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, clientId: string | null}>({
    isOpen: false,
    clientId: null
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const loadedClients = getClients();
    setClients(loadedClients);

    const bal: Record<string, number> = {};
    loadedClients.forEach(c => {
      bal[c.id] = getClientBalance(c.id);
    });
    setBalances(bal);
  };

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClient.name) {
      saveClient({
        ...newClient,
        code: newClient.code || '' // Ensure empty string if undefined
      });
      setNewClient({ code: '', name: '', phone: '' });
      setIsModalOpen(false);
      loadData();
    }
  };

  const requestDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); // Prevent navigation
    setDeleteConfirm({ isOpen: true, clientId: id });
  };

  const confirmDelete = () => {
    if (deleteConfirm.clientId) {
      deleteClient(deleteConfirm.clientId);
      loadData();
      setDeleteConfirm({ isOpen: false, clientId: null });
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
              <div 
                key={client.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group relative"
              >
                <Link 
                  to={`/clients/${client.id}`}
                  className="flex-1 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                      <User size={20} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-gray-900">{client.name}</h3>
                        {client.code && (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-mono">
                            {client.code}
                          </span>
                        )}
                      </div>
                      {client.phone && <p className="text-sm text-gray-500">{client.phone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 mr-10">
                     <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase">Current Balance</p>
                      <p className={`font-bold ${balances[client.id] >= 0 ? 'text-blue-600' : 'text-green-600'}`}>
                         {balances[client.id] >= 0 ? 'Owes' : 'Credit'}: ${Math.abs(balances[client.id] || 0).toLocaleString()}
                      </p>
                    </div>
                    <ChevronRight className="text-gray-300 group-hover:text-blue-500 transition-colors" size={20} />
                  </div>
                </Link>
                
                {/* Delete Button */}
                <button 
                  onClick={(e) => requestDelete(e, client.id)}
                  className="absolute right-4 p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                  title="Delete Client"
                >
                  <Trash2 size={18} />
                </button>
              </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Code <span className="text-gray-400 font-normal">(Optional)</span></label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={newClient.code}
                  onChange={e => setNewClient({...newClient, code: e.target.value})}
                  placeholder="e.g. C001"
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-center w-12 h-12 rounded-full mb-4 mx-auto bg-red-100 text-red-600">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-xl font-bold text-center text-gray-900 mb-2">Delete Client?</h3>
            <p className="text-center text-gray-500 mb-6">
              This action cannot be undone. All data associated with this client will be permanently removed.
            </p>
            
            <div className="flex space-x-3">
              <button 
                onClick={() => setDeleteConfirm({ isOpen: false, clientId: null })}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientList;