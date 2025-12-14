
import { Client, LedgerRecord, AssetRecord, TransactionCategory, DrawBalance, SaleRecord, CashAdvanceRecord } from '../types';
import { supabase } from '../supabaseClient';

const CLIENTS_KEY = 'ledger_clients';
const RECORDS_KEY = 'ledger_records';
const ASSETS_KEY = 'ledger_assets';
const CATEGORIES_KEY = 'ledger_categories';
const DRAW_BALANCES_KEY = 'ledger_draw_balances';
const SALES_KEY = 'ledger_sales';
const CASH_ADVANCE_KEY = 'ledger_cash_advances';

const generateId = () => Math.random().toString(36).substr(2, 9);

// Initial Seed List (Paper Clients)
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

// Mobile Clients Seed Data - REORDERED
export const INITIAL_MOBILE_CLIENTS_DATA = [
  { name: 'z keong', code: 'g8sv8239' },
  { name: 'LAN', code: 'mrcc04' },
  { name: 'Kok', code: 'pt217' },
  { name: 'Fung', code: 'sk0922' },
  { name: 'manu', code: 'sk2839' },
  { name: 'ZHONG', code: 'sk3619' },
  { name: 'WAHZAI', code: 'sk3715' },
  { name: 'MOOI', code: 'sk3818' },
  { name: 'SINGER', code: 'sk3964' },
  { name: 'LIM', code: 'sk5611' },
  { name: 'BIN', code: 'sk8264' },
  { name: 'Voon', code: 'sk8385' },
  { name: 'YEE', code: 'sk8959' },
  { name: 'LIANG BHR', code: 'skc009' },
  { name: 'BOTON', code: 'skc15' },
  { name: 'vincent', code: 'vc9486' },
];

// --- Helper to map Supabase result to Client type ---
const mapSupabaseClient = (data: any): Client => {
  return {
    ...data,
    createdAt: data.created_at || data.createdAt || new Date().toISOString(),
    category: data.category || 'paper' // Default to paper if null
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
    console.warn('Supabase fetch error (using local):', error?.message);
  }
  
  // Fallback to LocalStorage
  const data = localStorage.getItem(CLIENTS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveClient = async (client: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
  const newClientPart = {
      ...client,
      createdAt: new Date().toISOString(),
      category: client.category || 'paper'
  };

  if (supabase) {
    const { data, error } = await supabase.from('clients').insert([
        { 
            name: client.name, 
            code: client.code, 
            phone: client.phone,
            category: client.category || 'paper'
        }
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
    // Only seed if empty
    if (clients.length === 0) {
        console.log("Seeding initial clients...");
        // Seed Paper
        for (const c of INITIAL_CLIENTS_DATA) {
            await saveClient({
                name: c.name,
                code: c.code,
                phone: '',
                category: 'paper'
            });
        }
        // Seed Mobile
        for (const c of INITIAL_MOBILE_CLIENTS_DATA) {
            await saveClient({
                name: c.name,
                code: c.code,
                phone: '',
                category: 'mobile'
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

// Internal Helper to get sales records synchronously from localStorage
const getLocalSaleRecords = (): SaleRecord[] => {
    const data = localStorage.getItem(SALES_KEY);
    return data ? JSON.parse(data) : [];
};

// Internal Helper to get cash advances synchronously from localStorage
const getLocalCashAdvanceRecords = (): CashAdvanceRecord[] => {
    const data = localStorage.getItem(CASH_ADVANCE_KEY);
    return data ? JSON.parse(data) : [];
};

export const getLedgerRecords = (clientId: string): LedgerRecord[] => {
  const data = localStorage.getItem(RECORDS_KEY);
  const allRecords: any[] = data ? JSON.parse(data) : [];
  const manualRecords = allRecords
    .filter(r => r.clientId === clientId)
    .map(normalizeRecord);

  // Merge Sales Records as Read-Only Ledger Entries
  const sales = getLocalSaleRecords().filter(s => s.clientId === clientId);
  const salesAsLedger: LedgerRecord[] = sales.map(s => {
      const total = (s.b || 0) + (s.s || 0) + (s.a || 0) + (s.c || 0);
      if (total === 0) return null;
      return {
          id: `sale_${s.clientId}_${s.date}`,
          clientId: s.clientId,
          date: s.date,
          description: 'Sales Opening',
          typeLabel: 'Sales', 
          amount: total,
          operation: 'add', // Green / Receive
          column: 'col1', // Panel 1
          isVisible: true,
      } as LedgerRecord;
  }).filter((r): r is LedgerRecord => r !== null);

  // Merge Cash Advance Records as Read-Only Ledger Entries
  const advances = getLocalCashAdvanceRecords().filter(a => a.clientId === clientId);
  const advancesAsLedger: LedgerRecord[] = advances.map(a => {
      if (!a.amount) return null;
      return {
          id: `adv_${a.clientId}_${a.date}`,
          clientId: a.clientId,
          date: a.date,
          description: 'Cash Advance',
          typeLabel: 'Cash Adv',
          amount: a.amount,
          operation: 'add', // Receivables (Green)
          column: 'col1', // Panel 1 (Grouped with Sales)
          isVisible: true
      } as LedgerRecord;
  }).filter((r): r is LedgerRecord => r !== null);

  return [...manualRecords, ...salesAsLedger, ...advancesAsLedger];
};

export const getAllLedgerRecords = (): LedgerRecord[] => {
  const data = localStorage.getItem(RECORDS_KEY);
  const allRecords: any[] = data ? JSON.parse(data) : [];
  const manualRecords = allRecords.map(normalizeRecord);

  // Merge all sales
  const sales = getLocalSaleRecords();
  const salesAsLedger: LedgerRecord[] = sales.map(s => {
      const total = (s.b || 0) + (s.s || 0) + (s.a || 0) + (s.c || 0);
      if (total === 0) return null;
      return {
          id: `sale_${s.clientId}_${s.date}`,
          clientId: s.clientId,
          date: s.date,
          description: 'Sales Opening',
          typeLabel: 'Sales',
          amount: total,
          operation: 'add',
          column: 'col1',
          isVisible: true
      } as LedgerRecord;
  }).filter((r): r is LedgerRecord => r !== null);

  // Merge all advances
  const advances = getLocalCashAdvanceRecords();
  const advancesAsLedger: LedgerRecord[] = advances.map(a => {
      if (!a.amount) return null;
      return {
          id: `adv_${a.clientId}_${a.date}`,
          clientId: a.clientId,
          date: a.date,
          description: 'Cash Advance',
          typeLabel: 'Cash Adv',
          amount: a.amount,
          operation: 'add',
          column: 'col1',
          isVisible: true
      } as LedgerRecord;
  }).filter((r): r is LedgerRecord => r !== null);

  return [...manualRecords, ...salesAsLedger, ...advancesAsLedger];
};

// Updated: Supports optional 'untilDate' (inclusive)
export const getClientBalance = (clientId: string, untilDate?: string): number => {
  let records = getLedgerRecords(clientId);
  
  // Filter by date if provided
  if (untilDate) {
      records = records.filter(r => r.date <= untilDate);
  }

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
    console.warn('Supabase fetch draw balances error (using local):', error?.message);
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

export const getAllDrawRecords = async (): Promise<{ date: string, balance: number }[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('draw_balances').select('date, balance');
    if (!error && data) {
      return data.map((row: any) => ({
        date: row.date,
        balance: Number(row.balance)
      }));
    }
  }
  const allData = JSON.parse(localStorage.getItem(DRAW_BALANCES_KEY) || '[]');
  return allData.map((row: any) => ({
    date: row.date,
    balance: Number(row.balance)
  }));
}

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

// --- Sale Records (New Feature) ---

export const getSaleRecords = async (clientId: string): Promise<SaleRecord[]> => {
  if (supabase) {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false });

    if (!error && data) {
      return data.map((r: any) => ({
          ...r,
          clientId: r.client_id,
          // Ensure numbers are numbers, not strings from DB
          b: Number(r.b),
          s: Number(r.s),
          a: Number(r.a),
          c: Number(r.c)
      }));
    }
    console.warn('Supabase fetch sales error (using local):', error?.message);
  }

  const data = localStorage.getItem(SALES_KEY);
  const allRecords: SaleRecord[] = data ? JSON.parse(data) : [];
  return allRecords
    .filter(r => r.clientId === clientId)
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// New: Bulk fetch for weekly view
export const getSalesForDates = async (dates: string[]): Promise<SaleRecord[]> => {
    if (dates.length === 0) return [];

    if (supabase) {
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .in('date', dates);
        
        if (!error && data) {
            return data.map((r: any) => ({
                id: r.id,
                clientId: r.client_id,
                date: r.date,
                b: Number(r.b),
                s: Number(r.s),
                a: Number(r.a),
                c: Number(r.c)
            }));
        }
        console.warn('Supabase fetch sales dates error (using local):', error?.message);
    }

    const data = localStorage.getItem(SALES_KEY);
    const allRecords: SaleRecord[] = data ? JSON.parse(data) : [];
    return allRecords.filter(r => dates.includes(r.date));
};

export const saveSaleRecord = async (record: Omit<SaleRecord, 'id'>): Promise<SaleRecord> => {
  const newRecordPart = { ...record };
  
  if (supabase) {
      // Upsert logic for Supabase (requires unique constraint on client_id + date)
      // If no unique constraint, manual check is needed, but let's assume one exists or simple insert
      const { data, error } = await supabase
        .from('sales')
        .upsert({
            client_id: record.clientId,
            date: record.date,
            b: record.b,
            s: record.s,
            a: record.a,
            c: record.c
        }, { onConflict: 'client_id,date' }) // Assumes composite key
        .select();

      if (!error && data && data[0]) {
          const r = data[0];
          return {
              id: r.id,
              clientId: r.client_id,
              date: r.date,
              b: Number(r.b),
              s: Number(r.s),
              a: Number(r.a),
              c: Number(r.c)
          };
      }
      console.error('Supabase save sales error:', error);
  }

  const data = localStorage.getItem(SALES_KEY);
  const allRecords: SaleRecord[] = data ? JSON.parse(data) : [];
  
  const existingIndex = allRecords.findIndex(r => r.clientId === record.clientId && r.date === record.date);
  
  let newRecord: SaleRecord;
  if (existingIndex >= 0) {
      newRecord = { ...allRecords[existingIndex], ...record };
      allRecords[existingIndex] = newRecord;
  } else {
      newRecord = { ...record, id: generateId() };
      allRecords.push(newRecord);
  }

  localStorage.setItem(SALES_KEY, JSON.stringify(allRecords));
  return newRecord;
};

export const deleteSaleRecord = async (id: string) => {
  if (supabase) {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (error) console.error('Supabase delete sales error:', error);
  }

  const data = localStorage.getItem(SALES_KEY);
  const allRecords: SaleRecord[] = data ? JSON.parse(data) : [];
  const filtered = allRecords.filter(r => r.id !== id);
  localStorage.setItem(SALES_KEY, JSON.stringify(filtered));
};

// --- Cash Advances (New Feature) ---

export const getCashAdvances = async (date: string): Promise<Record<string, number>> => {
  if (supabase) {
    const { data, error } = await supabase
      .from('cash_advances')
      .select('client_id, amount')
      .eq('date', date);
      
    if (!error && data) {
      const advances: Record<string, number> = {};
      data.forEach((row: any) => {
        advances[row.client_id] = Number(row.amount);
      });
      return advances;
    }
    console.warn('Supabase fetch cash advances error (using local):', error?.message);
  }

  const allData = JSON.parse(localStorage.getItem(CASH_ADVANCE_KEY) || '[]');
  const advances: Record<string, number> = {};
  allData.forEach((row: any) => {
    if (row.date === date) {
      advances[row.clientId] = Number(row.amount);
    }
  });
  return advances;
};

export const saveCashAdvance = async (date: string, clientId: string, amount: number) => {
  if (supabase) {
    const { error } = await supabase
      .from('cash_advances')
      .upsert({ date, client_id: clientId, amount }, { onConflict: 'client_id,date' });
      
    if (error) console.error('Supabase save cash advance error:', error);
  }

  const allData = JSON.parse(localStorage.getItem(CASH_ADVANCE_KEY) || '[]');
  const filtered = allData.filter((r: any) => !(r.date === date && r.clientId === clientId));
  filtered.push({ date, clientId, amount });
  localStorage.setItem(CASH_ADVANCE_KEY, JSON.stringify(filtered));
};

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
};
