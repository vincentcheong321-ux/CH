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
    { id: '3', label: '出', operation: 'subtract', color: 'bg-orange-100 text-orange-800' },
    { id: '4', label: '支钱', operation: 'add', color: 'bg-green-100 text-green-800' },
    { id: '5', label: '上欠', operation: 'add', color: 'bg-green-100 text-green-800' },
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

    // Update colors for 'add' operations to green if they are blue
    categories = categories.map(c => {
        if (c.operation === 'add' && c.color.includes('bg-blue-100')) {
            updated = true;
            return { ...c, color: 'bg-green-100 text-green-800' };
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

// --- Ledger Records (Core) ---

// Helper to normalize legacy records (shou/zhong...) to new format (typeLabel/amount/operation)
const normalizeRecord = (r: any): LedgerRecord => {
  if (r.typeLabel && r.operation) return r as LedgerRecord;

  // Migration logic for old data
  if ((r.shou || 0) > 0) return { ...r, typeLabel: '收', amount: r.shou, operation: 'add' };
  if ((r.zhiqian || 0) > 0) return { ...r, typeLabel: '支钱', amount: r.zhiqian, operation: 'add' };
  if ((r.zhong || 0) > 0) return { ...r, typeLabel: '中', amount: r.zhong, operation: 'subtract' };
  if ((r.dianhua || 0) > 0) return { ...r, typeLabel: '出', amount: r.dianhua, operation: 'subtract' }; 

  // Fallback for empty zero records
  return { ...r, typeLabel: 'Entry', amount: 0, operation: 'add' };
};

export const getNetAmount = (r: LedgerRecord): number => {
  const normalized = normalizeRecord(r);
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

  if (!localStorage.getItem(CLIENTS_KEY)) {
    const clients = [
      { id: '1', code: 'C001', name: 'Alpha Traders', createdAt: new Date().toISOString() },
      { id: '2', code: 'C002', name: 'Beta Logistics', createdAt: new Date().toISOString() },
    ];
    localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
  }
};