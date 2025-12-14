
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, User, ChevronRight, FileText } from 'lucide-react';
import { getClients } from '../services/storageService';
import { Client } from '../types';

const SalesIndex: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
        const loadedClients = await getClients();
        setClients(loadedClients);
    } catch (e) {
        console.error("Failed to load clients", e);
    } finally {
        setLoading(false);
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
          <h1 className="text-2xl font-bold text-gray-800">Sales Reports</h1>
          <p className="text-gray-500">Select a client to view or enter sales data.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden max-w-4xl">
        <div className="p-4 border-b border-gray-100 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search clients..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {loading ? (
             <div className="p-8 text-center text-gray-500">Loading clients...</div>
          ) : filteredClients.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No clients found.</div>
          ) : (
            filteredClients.map(client => (
              <Link 
                key={client.id}
                to={`/clients/${client.id}/sales`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex items-center space-x-4">
                  <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <FileText size={20} />
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
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-400 group-hover:text-indigo-600 font-medium">View Sheet</span>
                  <ChevronRight className="text-gray-300 group-hover:text-indigo-600 transition-colors" size={20} />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesIndex;
