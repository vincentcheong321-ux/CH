
import { Client, LedgerRecord, AssetRecord, TransactionCategory } from '../types';

const CLIENTS_KEY = 'ledger_clients';
const RECORDS_KEY = 'ledger_records';
const ASSETS_KEY = 'ledger_assets';
const CATEGORIES_KEY = 'ledger_categories';

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- Categories ---
export const getCategories = (): TransactionCategory[] => {
  const data = localStorage.getItem(CATEGORIES_KEY);
  let categories: TransactionCategory[] = data ? JSON.parse(data) : [];

  // Define Defaults
  const defaults: TransactionCategory[] = [
    { id: '1', label: '收', operation: 'add', color: 'bg-green-100 text-green-800' },
    { id: '2', label: '中', operation: 'subtract', color: 'bg-red-100 text-red-800' },
    { id: '3', label: '出', operation: 'subtract', color: 'bg-red-100 text-red-800' },
    { id: '4', label: '支钱', operation: 'add', color: 'bg-green-100 text-green-800' },
    { id: '5', label: '上欠', operation: 'add', color: 'bg-green-100 text-green-800' },
    { id: '6', label: '%', operation: 'subtract', color: 'bg-red-100 text-red-800' },
    { id: '7', label: '来', operation: 'subtract', color: 'bg-red-100 text-red-800' },
  ];

  // If no categories exist, save defaults.
  if (categories.length === 0) {
    categories = defaults;
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } else {
    // If categories exist, check if we need to migrate colors or add missing defaults
    let updated = false;
    
    // Check for '上欠'
    if (!categories.find(c => c.label === '上欠')) {
        categories.push({ id: generateId(), label: '上欠', operation: 'add', color: 'bg-green-100 text-green-800' });
        updated = true;
    }

    // Check for '%'
    if (!categories.find(c => c.label === '%')) {
        categories.push({ id: generateId(), label: '%', operation: 'subtract', color: 'bg-red-100 text-red-800' });
        updated = true;
    }

    // Check for '来'
    if (!categories.find(c => c.label === '来')) {
        categories.push({ id: generateId(), label: '来', operation: 'subtract', color: 'bg-red-100 text-red-800' });
        updated = true;
    }

    // Update colors for 'add' operations to green if they are blue
    categories = categories.map(c => {
        if (c.operation === 'add' && c.color.includes('bg-blue-100')) {
            updated = true;
            return { ...c, color: 'bg-green-100 text-green-800' };
        }
        // Update '出' to red if it is orange
        if (c.label === '出' && c.color.includes('bg-orange-100')) {
            updated = true;
            return { ...c, color: 'bg-red-100 text-red-800' };
        }
        return c;
    });

    if (updated) {
        localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    }
  }

  return categories;
};

export const saveCategory = (category: Omit<TransactionCategory, 'id'>): TransactionCategory => {
  const categories = getCategories();
  const newCat = { ...category, id: generateId() };
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify([...categories, newCat]));
  return newCat;
};

export const saveCategoriesOrder = (categories: TransactionCategory[]) => {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
};

export const deleteCategory = (id: string) => {
  const categories = getCategories();
  const filtered = categories.filter(c => c.id !== id);
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(filtered));
};

// --- Clients ---
export const getClients = (): Client[] => {
  const data = localStorage.getItem(CLIENTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveClient = (client: Omit<Client, 'id' | 'createdAt'>): Client => {
  const clients = getClients();
  const newClient: Client = {
    ...client,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(CLIENTS_KEY, JSON.stringify([...clients, newClient]));
  return newClient;
};

export const updateClient = (id: string, updates: Partial<Client>) => {
  const clients = getClients();
  const updatedClients = clients.map(c => c.id === id ? { ...c, ...updates } : c);
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(updatedClients));
};

export const deleteClient = (id: string) => {
  const clients = getClients();
  const filtered = clients.filter(c => c.id !== id);
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(filtered));
  // Optionally clean up records associated with this client
  const allRecords = getAllLedgerRecords();
  const keepRecords = allRecords.filter(r => r.clientId !== id);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(keepRecords));
};

// --- Ledger Records (Core) ---

// Helper to normalize legacy records
const normalizeRecord = (r: any): LedgerRecord => {
  // Ensure column exists, default to 'main'
  const record = { ...r, column: r.column || 'main' };

  // Check if it's a valid new structure (operation exists, typeLabel exists even if empty string)
  if (record.operation && typeof record.typeLabel === 'string') {
      return record as LedgerRecord;
  }

  // Migration logic for old data (pre-dynamic types)
  if ((r.shou || 0) > 0) return { ...record, typeLabel: '收', amount: r.shou, operation: 'add' };
  if ((r.zhiqian || 0) > 0) return { ...record, typeLabel: '支钱', amount: r.zhiqian, operation: 'add' };
  if ((r.zhong || 0) > 0) return { ...record, typeLabel: '中', amount: r.zhong, operation: 'subtract' };
  if ((r.dianhua || 0) > 0) return { ...record, typeLabel: '出', amount: r.dianhua, operation: 'subtract' }; 

  // Fallback to entry with 0 amount
  return { ...record, typeLabel: 'Entry', amount: 0, operation: 'add' };
};

export const getNetAmount = (r: LedgerRecord): number => {
  const normalized = normalizeRecord(r);
  if (normalized.operation === 'none') return 0; // Exclude from calculation
  return normalized.operation === 'add' ? normalized.amount : -normalized.amount;
};

export const getLedgerRecords = (clientId: string): LedgerRecord[] => {
  const data = localStorage.getItem(RECORDS_KEY);
  const allRecords: any[] = data ? JSON.parse(data) : [];
  return allRecords
    .filter(r => r.clientId === clientId)
    .map(normalizeRecord);
};

export const getAllLedgerRecords = (): LedgerRecord[] => {
  const data = localStorage.getItem(RECORDS_KEY);
  const allRecords: any[] = data ? JSON.parse(data) : [];
  return allRecords.map(normalizeRecord);
};

export const getClientBalance = (clientId: string): number => {
  const records = getLedgerRecords(clientId);
  
  // Logic: Check Panel 1 (col1) first
  // "If Panel 1 has data, use that only, do not sum up all panel data"
  const col1Records = records.filter(r => r.column === 'col1' && r.isVisible);
  
  // Check if Panel 1 has any 'visible' records. If so, its total is the client balance.
  if (col1Records.length > 0) {
    return col1Records.reduce((acc, r) => acc + getNetAmount(r), 0);
  }
  
  // Fallback to Main Ledger (main)
  const mainRecords = records.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
  return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
};

export const saveLedgerRecord = (record: Omit<LedgerRecord, 'id'>): LedgerRecord => {
  const data = localStorage.getItem(RECORDS_KEY);
  const allRecords: LedgerRecord[] = data ? JSON.parse(data) : [];
  const newRecord: LedgerRecord = { ...record, id: generateId() };
  localStorage.setItem(RECORDS_KEY, JSON.stringify([...allRecords, newRecord]));
  return newRecord;
};

export const deleteLedgerRecord = (id: string) => {
  const data = localStorage.getItem(RECORDS_KEY);
  const allRecords: LedgerRecord[] = data ? JSON.parse(data) : [];
  const filtered = allRecords.filter(r => r.id !== id);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(filtered));
};

export const updateLedgerRecord = (id: string, updates: Partial<LedgerRecord>) => {
  const data = localStorage.getItem(RECORDS_KEY);
  const allRecords: LedgerRecord[] = data ? JSON.parse(data) : [];
  const updated = allRecords.map(r => r.id === id ? { ...r, ...updates } : r);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(updated));
}

// --- Company Assets ---
export const getAssetRecords = (): AssetRecord[] => {
  const data = localStorage.getItem(ASSETS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveAssetRecord = (record: Omit<AssetRecord, 'id'>): AssetRecord => {
  const data = localStorage.getItem(ASSETS_KEY);
  const allRecords: AssetRecord[] = data ? JSON.parse(data) : [];
  const newRecord: AssetRecord = { ...record, id: generateId() };
  localStorage.setItem(ASSETS_KEY, JSON.stringify([...allRecords, newRecord]));
  return newRecord;
};

export const seedData = () => {
  // Always ensure categories are initialized
  getCategories();
  
  // Removed default client creation to start empty
};