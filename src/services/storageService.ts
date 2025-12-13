
import { Client, LedgerRecord, AssetRecord, TransactionCategory, DrawBalance } from '../types';
import { supabase } from '../supabaseClient';

const CLIENTS_KEY = 'ledger_clients';
const RECORDS_KEY = 'ledger_records';
const ASSETS_KEY = 'ledger_assets';
const CATEGORIES_KEY = 'ledger_categories';
const DRAW_BALANCES_KEY = 'ledger_draw_balances';

const generateId = () => Math.random().toString(36).substr(2, 9);

// Initial Seed List (Exported for UI fallback)
export const INITIAL_CLIENTS_DATA = [
  { name: '林', code: 'Z05' },
  { name: '国', code: 'PT217' },
  { name: 'LIM', code: 'C09' },
  { name: '林2', code: '8385' },
  { name: '京', code: 'C15' },
  { name: '香', code: 'Z15' },
  { name: '莲', code: 'C08' },
  { name: '仪', code: 'C17' },
  { name: '彬', code: 'C19' },
  { name: '妹', code: 'Z19' },
  { name: '中', code: 'C13' },
  { name: '顺', code: 'Z07' },
  { name: '龙', code: 'C06' },
  { name: '爱', code: 'Z20' },
  { name: '群', code: 'C03' },
  { name: '朱', code: 'Z03' },
  { name: '兰', code: 'C04' },
  { name: '印', code: '2839' },
  { name: '伍', code: '-' },
  { name: '张', code: '9486' },
];

// --- Helper to map Supabase result to Client type ---
const mapSupabaseClient = (data: any): Client => {
  return {
    ...data,
    createdAt: data.created_at || data.createdAt || new Date().toISOString()
  };
};

// --- Categories ---
export const getCategories = (): TransactionCategory[] => {
  const data = localStorage.getItem(CATEGORIES_KEY);
  let categories: TransactionCategory[] = data ? JSON.parse(data) : [];

  const defaults: TransactionCategory[] = [
    { id: '1', label: '收', operation: 'add', color: 'bg-green-100 text-green-800' },
    { id: '2', label: '中', operation: 'subtract', color: 'bg-red-100 text-red-800' },
    { id: '3', label: '出', operation: 'subtract', color: 'bg-red-100 text-red-800' },
    { id: '4', label: '支钱', operation: 'add', color: 'bg-green-100 text-green-800' },
    { id: '5', label: '上欠', operation: 'add', color: 'bg-green-100 text-green-800' },
    { id: '6', label: '%', operation: 'subtract', color: 'bg-red-100 text-red-800' },
    { id: '7', label: '来', operation: 'subtract', color: 'bg-red-100 text-red-800' },
  ];

  if (categories.length === 0) {
    categories = defaults;
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } else {
    let updated = false;
    if (!categories.find(c => c.label === '上欠')) {
        categories.push({ id: generateId(), label: '上欠', operation: 'add', color: 'bg-green-100 text-green-800' });
        updated = true;
    }
    if (!categories.find(c => c.label === '%')) {
        categories.push({ id: generateId(), label: '%', operation: 'subtract', color: 'bg-red-100 text-red-800' });
        updated = true;
    }
    if (!categories.find(c => c.label === '来')) {
        categories.push({ id: generateId(), label: '来', operation: 'subtract', color: 'bg-red-100 text-red-800' });
        updated = true;
    }
    categories = categories.map(c => {
        if (c.operation === 'add' && c.color.includes('bg-blue-100')) {
            updated = true;
            return { ...c, color: 'bg-green-100 text-green-800' };
        }
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

// --- Clients (Async) ---

export const getClients = async (): Promise<Client[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: true });
    if (!error && data) {
        return data.map(mapSupabaseClient);
    }
    console.error('Supabase fetch error:', error);
  }
  
  // Fallback to LocalStorage
  const data = localStorage.getItem(CLIENTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveClient = async (client: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
  const newClientPart = {
      ...client,
      createdAt: new Date().toISOString()
  };

  if (supabase) {
    const { data, error } = await supabase.from('clients').insert([
        { name: client.name, code: client.code, phone: client.phone }
    ]).select();
    
    if (!error && data && data[0]) {
        return mapSupabaseClient(data[0]);
    }
    console.error('Supabase save error:', error);
  }

  // LocalStorage Fallback
  const clients = JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
  const newClient: Client = {
    ...newClientPart,
    id: generateId(),
  };
  localStorage.setItem(CLIENTS_KEY, JSON.stringify([...clients, newClient]));
  return newClient;
};

export const deleteClient = async (id: string) => {
  if (supabase) {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) console.error('Supabase delete error:', error);
  }

  // Always sync local storage for consistency in hybrid mode
  const clients = JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
  const filtered = clients.filter((c: Client) => c.id !== id);
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(filtered));
  
  // Clean up ledger records (Local Only for now)
  const allRecords = getAllLedgerRecords();
  const keepRecords = allRecords.filter(r => r.clientId !== id);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(keepRecords));
};

export const seedInitialClients = async () => {
    const clients = await getClients();
    if (clients.length === 0) {
        console.log("Seeding initial clients...");
        for (const c of INITIAL_CLIENTS_DATA) {
            await saveClient({
                name: c.name,
                code: c.code,
                phone: ''
            });
        }
        return true;
    }
    return false;
};

// --- Ledger Records (Sync Local for now) ---

const normalizeRecord = (r: any): LedgerRecord => {
  const record = { ...r, column: r.column || 'main' };
  if (record.operation && typeof record.typeLabel === 'string') {
      return record as LedgerRecord;
  }
  if ((r.shou || 0) > 0) return { ...record, typeLabel: '收', amount: r.shou, operation: 'add' };
  if ((r.zhiqian || 0) > 0) return { ...record, typeLabel: '支钱', amount: r.zhiqian, operation: 'add' };
  if ((r.zhong || 0) > 0) return { ...record, typeLabel: '中', amount: r.zhong, operation: 'subtract' };
  if ((r.dianhua || 0) > 0) return { ...record, typeLabel: '出', amount: r.dianhua, operation: 'subtract' }; 
  return { ...record, typeLabel: 'Entry', amount: 0, operation: 'add' };
};

export const getNetAmount = (r: LedgerRecord): number => {
  const normalized = normalizeRecord(r);
  if (normalized.operation === 'none') return 0;
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
  const col1Records = records.filter(r => r.column === 'col1' && r.isVisible);
  
  if (col1Records.length > 0) {
    return col1Records.reduce((acc, r) => acc + getNetAmount(r), 0);
  }
  
  const mainRecords = records.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
  return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
};

// --- Draw Balances (New Feature) ---

export const getDrawBalances = async (date: string): Promise<Record<string, number>> => {
  if (supabase) {
    const { data, error } = await supabase
      .from('draw_balances')
      .select('client_id, balance')
      .eq('date', date);
      
    if (!error && data) {
      const balances: Record<string, number> = {};
      data.forEach((row: any) => {
        balances[row.client_id] = Number(row.balance);
      });
      return balances;
    }
    console.error('Supabase fetch draw balances error:', error);
  }

  // Fallback to LocalStorage
  const allData = JSON.parse(localStorage.getItem(DRAW_BALANCES_KEY) || '[]');
  const balances: Record<string, number> = {};
  allData.forEach((row: any) => {
    if (row.date === date) {
      balances[row.clientId] = Number(row.balance);
    }
  });
  return balances;
};

export const getTotalDrawReceivables = async (): Promise<number> => {
  if (supabase) {
    const { data, error } = await supabase.from('draw_balances').select('balance');
    if (!error && data) {
      return data.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);
    }
  }
  // Local
  const allData = JSON.parse(localStorage.getItem(DRAW_BALANCES_KEY) || '[]');
  return allData.reduce((acc: number, curr: any) => acc + (Number(curr.balance) || 0), 0);
};

export const saveDrawBalance = async (date: string, clientId: string, balance: number) => {
  if (supabase) {
    const { error } = await supabase
      .from('draw_balances')
      .upsert({ date, client_id: clientId, balance }, { onConflict: 'date, client_id' });
      
    if (error) console.error('Supabase save draw balance error:', error);
  }

  // Always update LocalStorage for fallback/cache
  const allData = JSON.parse(localStorage.getItem(DRAW_BALANCES_KEY) || '[]');
  // Remove existing entry for this date/client
  const filtered = allData.filter((r: any) => !(r.date === date && r.clientId === clientId));
  // Add new
  filtered.push({ date, clientId, balance });
  localStorage.setItem(DRAW_BALANCES_KEY, JSON.stringify(filtered));
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

export const seedData = async () => {
  getCategories();
  await seedInitialClients(); // Ensure we have data
};
