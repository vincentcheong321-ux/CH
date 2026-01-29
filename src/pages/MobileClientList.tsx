
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Smartphone, Trash2, AlertTriangle, Hash, Phone, Loader2 } from 'lucide-react';
import { getClients, saveClient, deleteClient, fetchClientTotalBalance } from '../services/storageService';
import { Client } from '../types';

const MobileClientList: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newClient, setNewClient] = useState({ code: '', name: '', phone: '' });
  
  // Delete Modal State
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, clientId: string | null}>({
    isOpen: false,
    clientId: null
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const loadedClients = await getClients();
        // FILTER: Only Mobile clients
        const mobileClients = loadedClients.filter(c => c.category === 'mobile');
        setClients(mobileClients);

        // Fetch balances for each client
        const balMap: Record<string, number> = {};
        for (const client of mobileClients) {
            const bal = await fetchClientTotalBalance(client.id);
            balMap[client.id] = bal;
        }
        setBalances(balMap);
    } catch (e) {
        console.error("Failed to load clients", e);
    } finally {
        setLoading(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newClient.name) {
      await saveClient({
        ...newClient,
        code: newClient.code || '',
        category: 'mobile' // Enforce mobile creation here
      });
      setNewClient({ code: '', name: '', phone: '' });
      setIsModalOpen(false);
      loadData();
    }
  };

  const requestDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); 
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, clientId: id });
  };

  const confirmDelete = async () => {
    if (deleteConfirm.clientId) {
      await deleteClient(deleteConfirm.clientId);
      setDeleteConfirm({ isOpen: false, clientId: null });
      loadData();
    }
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Mobile Grid Card Component
  const MobileClientCard: React.FC<{ client: Client }> = ({ client }) => {
    const balance = balances[client.id] || 0;
    
    return (
        <div className="relative group">
            {/* Delete Button (Absolute) */}
            <button 
                onClick={(e) => requestDelete(e, client.id)}
                className="absolute top-3 right-3 z-10 p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
                title="Delete Client"
            >
                <Trash2 size={18} />
            </button>

            <Link 
                to={`/clients/${client.id}`}
                className={`
                    block h-full bg-white rounded-xl border-2 transition-all duration-200 p-5
                    flex flex-col items-center justify-center text-center space-y-3
                    border-gray-100 shadow-sm hover:shadow-md hover:border-purple-200 hover:-translate-y-1
                `}
            >
                {/* Avatar */}
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold mb-1 shadow-inner bg-purple-100 text-purple-700">
                    {client.name.substring(0, 1).toUpperCase()}
                </div>

                {/* Info */}
                <div className="w-full">
                    <h3 className="text-lg font-bold text-gray-900 truncate w-full px-2" title={client.name}>
                        {client.name}
                    </h3>
                    
                    <div className="flex items-center justify-center space-x-2 mt-1">
                        {client.code && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100">
                                <Hash size={10} className="mr-1 opacity-50" />
                                {client.code}
                            </span>
                        )}
                        {client.phone && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] text-gray-500 bg-gray-50 border border-gray-100">
                                <Phone size={10} className="mr-1 opacity-50" />
                                {client.phone}
                            </span>
                        )}
                    </div>
                </div>

                {/* Balance Badge */}
                <div className="w-full pt-2 border-t border-gray-50">
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Balance</div>
                    <div className={`text-sm font-mono font-bold ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        ${Math.abs(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                </div>
            </Link>
        </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <Smartphone className="mr-3 text-purple-600" />
            Mobile Accounts
          </h1>
          <p className="text-gray-500 mt-1">Manage accounts associated with mobile digital reports.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl flex items-center justify-center shadow-lg hover:shadow-purple-200 transition-all font-semibold"
        >
          <Plus size={20} className="mr-2" />
          Add Mobile Client
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
        {/* Search Header */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search mobile clients..."
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>

        {loading ? (
             <div className="p-24 flex flex-col items-center justify-center text-gray-400">
                <Loader2 size={40} className="animate-spin mb-4 text-purple-500" />
                <p className="font-bold">Syncing Mobile Accounts...</p>
             </div>
        ) : (
            <div className="p-4 md:p-6 bg-gray-50/30 min-h-[400px]">
                {filteredClients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                        <div className="bg-gray-100 p-4 rounded-full mb-4 text-gray-400"><Smartphone size={32} /></div>
                        <h3 className="text-lg font-bold text-gray-700">No mobile accounts found</h3>
                        <p className="text-gray-500">Accounts with 'Mobile' category will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {filteredClients.map(c => <MobileClientCard key={c.id} client={c} />)}
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 transform transition-all">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
                <Smartphone className="mr-2 text-purple-600" />
                New Mobile Account
            </h2>
            <form onSubmit={handleAddClient} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Full Name</label>
                <input required type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="e.g. SINGER" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">System ID (Code)</label>
                    <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all" value={newClient.code} onChange={e => setNewClient({...newClient, code: e.target.value})} placeholder="e.g. sk3964" />
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Phone (Opt)</label>
                    <input type="text" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} placeholder="Mobile" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-8 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl font-medium">Cancel</button>
                <button type="submit" className="px-6 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-bold shadow-lg transform active:scale-95 transition-all">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center transform transition-all">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="text-red-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Remove Mobile Account?</h3>
            <p className="text-gray-500 mb-6 leading-relaxed">This will delete all sales history and digital records linked to this account.</p>
            <div className="flex space-x-3">
              <button onClick={() => setDeleteConfirm({ isOpen: false, clientId: null })} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg transition-all">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileClientList;
