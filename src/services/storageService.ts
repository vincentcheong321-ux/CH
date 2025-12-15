
import { Client, LedgerRecord, AssetRecord, TransactionCategory, SaleRecord, DrawBalance, CashAdvanceRecord } from '../types';
import { supabase } from '../supabaseClient';

const CATEGORIES_KEY = 'ledger_categories';

// --- Mappers (DB snake_case <-> App camelCase) ---

const mapClientFromDB = (db: any): Client => ({
    id: db.id,
    code: db.code,
    name: db.name,
    phone: db.phone,
    note: db.note,
    createdAt: db.created_at,
    category: db.category || 'paper',
    column1Notes: db.column1_notes,
    column2Notes: db.column2_notes
});

const mapLedgerFromDB = (db: any): LedgerRecord => ({
    id: db.id,
    clientId: db.client_id,
    date: db.date,
    description: db.description || '',
    typeLabel: db.type_label || '',
    amount: db.amount,
    operation: db.operation,
    column: db.column_name || 'main',
    isVisible: db.is_visible
});

const mapSaleFromDB = (db: any): SaleRecord => ({
    id: db.id,
    clientId: db.client_id,
    date: db.date,
    b: db.b || 0,
    s: db.s || 0,
    a: db.a || 0,
    c: db.c || 0,
    mobileRaw: db.mobile_raw,
    mobileRawData: db.mobile_raw_data
});

// --- Categories (Local Storage - Config) ---
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
    { id: '8', label: '电', operation: 'add', color: 'bg-green-100 text-green-800' },
  ];

  if (categories.length === 0) {
    categories = defaults;
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } else {
    // Migration Logic
    let updated = false;
    if (!categories.find(c => c.label === '上欠')) { categories.push({ id: Math.random().toString(36).substr(2,9), label: '上欠', operation: 'add', color: 'bg-green-100 text-green-800' }); updated = true; }
    if (!categories.find(c => c.label === '电')) { categories.push({ id: Math.random().toString(36).substr(2,9), label: '电', operation: 'add', color: 'bg-green-100 text-green-800' }); updated = true; }
    
    categories = categories.map(c => {
        if (c.operation === 'add' && c.color.includes('bg-blue-100')) { updated = true; return { ...c, color: 'bg-green-100 text-green-800' }; }
        if (c.label === '出' && c.color.includes('bg-orange-100')) { updated = true; return { ...c, color: 'bg-red-100 text-red-800' }; }
        return c;
    });

    if (updated) localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }
  return categories;
};

export const saveCategory = (category: Omit<TransactionCategory, 'id'>) => {
  const categories = getCategories();
  const newCat = { ...category, id: Math.random().toString(36).substr(2, 9) };
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify([...categories, newCat]));
  return newCat;
};

export const saveCategoriesOrder = (categories: TransactionCategory[]) => {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
};

export const deleteCategory = (id: string) => {
  const categories = getCategories();
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories.filter(c => c.id !== id)));
};

// --- Clients (Supabase) ---

export const getClients = async (): Promise<Client[]> => {
  const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: true });
  if (error) { console.error('Error fetching clients:', error); return []; }
  return data.map(mapClientFromDB);
};

export const saveClient = async (client: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
  const { data, error } = await supabase.from('clients').insert([{
      name: client.name,
      code: client.code,
      phone: client.phone,
      category: client.category || 'paper'
  }]).select();
  
  if (error || !data) { console.error('Error saving client:', error); throw error; }
  return mapClientFromDB(data[0]);
};

export const deleteClient = async (id: string) => {
  await supabase.from('clients').delete().eq('id', id);
};

// --- Ledger Records (Supabase) ---

const getRecordSortPriority = (record: LedgerRecord): number => {
    if (record.id.startsWith('draw_') || record.typeLabel === '上欠') return 1;
    if (record.id.startsWith('sale_') || record.id === 'agg_sale_week' || record.typeLabel === '收') return 2;
    if (record.typeLabel === '电') return 3;
    if (record.typeLabel === '中') return 4;
    if (record.typeLabel === '来') return 5;
    if (record.typeLabel === '支' || record.typeLabel === '支钱') return 6;
    return 7;
};

export const getNetAmount = (r: LedgerRecord): number => {
  if (r.operation === 'none') return 0;
  return r.operation === 'add' ? r.amount : -r.amount;
};

// Helper: Fetch external data (Sales, Cash, etc) and convert to Virtual Ledger Records
const fetchVirtualRecords = async (clientId: string): Promise<LedgerRecord[]> => {
    const virtualRecords: LedgerRecord[] = [];

    // 1. Sales
    const { data: sales } = await supabase.from('sales_records').select('*').eq('client_id', clientId);
    if (sales) {
        sales.forEach(s => {
            const r = mapSaleFromDB(s);
            const total = (r.b || 0) + (r.s || 0) + (r.a || 0) + (r.c || 0);
            if (total !== 0) {
                virtualRecords.push({
                    id: `sale_${r.date}_${r.id}`,
                    clientId: r.clientId,
                    date: r.date,
                    description: 'Sales Opening',
                    typeLabel: '收',
                    amount: total,
                    operation: 'add',
                    column: 'main',
                    isVisible: true
                });
            }
        });
    }

    // 2. Cash Advances
    const { data: advances } = await supabase.from('cash_advances').select('*').eq('client_id', clientId);
    if (advances) {
        advances.forEach(a => {
            if (a.amount !== 0) {
                virtualRecords.push({
                    id: `adv_${a.date}_${a.id}`,
                    clientId: a.client_id,
                    date: a.date,
                    description: 'Cash Advance',
                    typeLabel: '支',
                    amount: a.amount,
                    operation: 'add',
                    column: 'main',
                    isVisible: true
                });
            }
        });
    }

    // 3. Cash Credits
    const { data: credits } = await supabase.from('cash_credits').select('*').eq('client_id', clientId);
    if (credits) {
        credits.forEach(c => {
            if (c.amount !== 0) {
                virtualRecords.push({
                    id: `cred_${c.date}_${c.id}`,
                    clientId: c.client_id,
                    date: c.date,
                    description: 'Cash Credit',
                    typeLabel: '来',
                    amount: c.amount,
                    operation: 'subtract',
                    column: 'main',
                    isVisible: true
                });
            }
        });
    }

    // 4. Draw Balances (Mapped to '上欠')
    const { data: draws } = await supabase.from('draw_balances').select('*').eq('client_id', clientId);
    if (draws) {
        draws.forEach(d => {
            if (d.balance !== 0) {
                virtualRecords.push({
                    id: `draw_${d.date}_${d.id}`,
                    clientId: d.client_id,
                    date: d.date,
                    description: 'Previous Balance',
                    typeLabel: '上欠',
                    amount: Math.abs(d.balance),
                    operation: d.balance >= 0 ? 'add' : 'subtract',
                    column: 'main',
                    isVisible: true
                });
            }
        });
    }

    return virtualRecords;
};

export const getLedgerRecords = async (clientId: string): Promise<LedgerRecord[]> => {
    // 1. Fetch Manual Records
    const { data: manualData } = await supabase.from('ledger_records').select('*').eq('client_id', clientId);
    const manualRecords = (manualData || []).map(mapLedgerFromDB);

    // 2. Fetch Virtual Records
    const virtualRecords = await fetchVirtualRecords(clientId);

    const all = [...manualRecords, ...virtualRecords];
    
    // Sort
    return all.sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return getRecordSortPriority(a) - getRecordSortPriority(b);
    });
};

export const getAllLedgerRecords = async (): Promise<LedgerRecord[]> => {
    const { data } = await supabase.from('ledger_records').select('*');
    return (data || []).map(mapLedgerFromDB);
}

export const saveLedgerRecord = async (record: Omit<LedgerRecord, 'id'>): Promise<LedgerRecord> => {
  const { data, error } = await supabase.from('ledger_records').insert([{
      client_id: record.clientId,
      date: record.date,
      description: record.description,
      type_label: record.typeLabel,
      amount: record.amount,
      operation: record.operation,
      column_name: record.column,
      is_visible: record.isVisible
  }]).select();

  if (error || !data) { console.error("Save Ledger Error", error); throw error; }
  return mapLedgerFromDB(data[0]);
};

export const updateLedgerRecord = async (id: string, updates: Partial<LedgerRecord>) => {
  const payload: any = {};
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.column !== undefined) payload.column_name = updates.column;
  if (updates.isVisible !== undefined) payload.is_visible = updates.isVisible;
  if (updates.operation !== undefined) payload.operation = updates.operation;
  
  await supabase.from('ledger_records').update(payload).eq('id', id);
};

export const deleteLedgerRecord = async (id: string) => {
  await supabase.from('ledger_records').delete().eq('id', id);
};

// --- Sales (Supabase) ---
export const getSaleRecords = async (clientId: string): Promise<SaleRecord[]> => {
    const { data } = await supabase.from('sales_records').select('*').eq('client_id', clientId);
    return (data || []).map(mapSaleFromDB);
};

export const getSalesForDates = async (dates: string[]): Promise<SaleRecord[]> => {
    // Supabase 'in' filter
    const { data } = await supabase.from('sales_records').select('*').in('date', dates);
    return (data || []).map(mapSaleFromDB);
};

export const saveSaleRecord = async (record: any) => {
    // Check if exists
    const { data: existing } = await supabase.from('sales_records')
        .select('id')
        .eq('client_id', record.clientId)
        .eq('date', record.date)
        .single();

    const payload = {
        client_id: record.clientId,
        date: record.date,
        b: record.b, s: record.s, a: record.a, c: record.c,
        mobile_raw: record.mobileRaw,
        mobile_raw_data: record.mobileRawData
    };

    if (existing) {
        await supabase.from('sales_records').update(payload).eq('id', existing.id);
    } else {
        await supabase.from('sales_records').insert([payload]);
    }
};

// --- Cash Advance ---
export const getCashAdvances = async (date: string) => {
    const { data } = await supabase.from('cash_advances').select('*').eq('date', date);
    const result: Record<string, number> = {};
    data?.forEach((d: any) => { result[d.client_id] = d.amount; });
    return result;
};

export const saveCashAdvance = async (date: string, clientId: string, amount: number) => {
    const { data: existing } = await supabase.from('cash_advances').select('id').eq('client_id', clientId).eq('date', date).single();
    if (existing) {
        await supabase.from('cash_advances').update({ amount }).eq('id', existing.id);
    } else {
        await supabase.from('cash_advances').insert([{ client_id: clientId, date, amount }]);
    }
};

// --- Cash Credit ---
export const getCashCredits = async (date: string) => {
    const { data } = await supabase.from('cash_credits').select('*').eq('date', date);
    const result: Record<string, number> = {};
    data?.forEach((d: any) => { result[d.client_id] = d.amount; });
    return result;
};

export const saveCashCredit = async (date: string, clientId: string, amount: number) => {
    const { data: existing } = await supabase.from('cash_credits').select('id').eq('client_id', clientId).eq('date', date).single();
    if (existing) {
        await supabase.from('cash_credits').update({ amount }).eq('id', existing.id);
    } else {
        await supabase.from('cash_credits').insert([{ client_id: clientId, date, amount }]);
    }
};

// --- Draw Report ---
export const getDrawBalances = async (date: string) => {
    const { data } = await supabase.from('draw_balances').select('*').eq('date', date);
    const result: Record<string, number> = {};
    data?.forEach((d: any) => { result[d.client_id] = d.balance; });
    return result;
};

export const saveDrawBalance = async (date: string, clientId: string, balance: number) => {
    const { data: existing } = await supabase.from('draw_balances').select('id').eq('client_id', clientId).eq('date', date).single();
    if (existing) {
        await supabase.from('draw_balances').update({ balance }).eq('id', existing.id);
    } else {
        await supabase.from('draw_balances').insert([{ client_id: clientId, date, balance }]);
    }
};

export const getAllDrawRecords = async (): Promise<DrawBalance[]> => {
    const { data } = await supabase.from('draw_balances').select('*');
    return (data || []).map((d: any) => ({ clientId: d.client_id, date: d.date, balance: d.balance }));
};

export const getClientBalancesPriorToDate = async (date: string): Promise<Record<string, number>> => {
    // This is complex in Supabase. For now, fetch all draw balances and compute locally or rely on most recent.
    // Simplifying: Fetch all draw records, filter locally for < date, find max date per client.
    const { data } = await supabase.from('draw_balances').select('*').lt('date', date);
    
    const latestBalances: Record<string, { date: string, balance: number }> = {};
    data?.forEach((d: any) => {
        if (!latestBalances[d.client_id] || d.date > latestBalances[d.client_id].date) {
            latestBalances[d.client_id] = { date: d.date, balance: d.balance };
        }
    });

    const result: Record<string, number> = {};
    for (const cid in latestBalances) {
        result[cid] = latestBalances[cid].balance;
    }
    return result;
};

export const getTotalDrawReceivables = async () => {
    // Mock logic: sum of latest draw for all clients
    const { data } = await supabase.from('draw_balances').select('*');
    if(!data) return 0;
    // ... filtering logic similar to above if needed ...
    return 0; 
};

// --- Mobile Report ---
export const saveMobileReportHistory = async (date: string, json: any) => {
    await supabase.from('mobile_report_history').insert([{ report_date: date, json_data: json }]);
};

export const getMobileReportHistory = async () => {
    const { data } = await supabase.from('mobile_report_history').select('*').order('created_at', { ascending: false });
    return data || [];
};

// --- Winnings ---
export const getWinningsByDateRange = async (startDate: string, endDate: string): Promise<Record<string, number>> => {
    // Query Supabase for Winnings
    const { data } = await supabase
        .from('ledger_records')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('type_label', '中')
        .eq('column_name', 'main'); // Filter by Main Ledger column

    const winnings: Record<string, number> = {};
    data?.forEach((d: any) => {
        const current = winnings[d.client_id] || 0;
        winnings[d.client_id] = current + d.amount;
    });
    return winnings;
};

// --- Assets ---
export const getAssetRecords = (): AssetRecord[] => {
    // LocalStorage for now as assets table wasn't explicitly requested/migrated in context
    const data = localStorage.getItem('ledger_assets');
    return data ? JSON.parse(data) : [];
};

export const saveAssetRecord = (record: Omit<AssetRecord, 'id'>) => {
    const data = getAssetRecords();
    const newRec = { ...record, id: Math.random().toString(36).substr(2,9) };
    localStorage.setItem('ledger_assets', JSON.stringify([newRec, ...data]));
};

export const getClientBalance = async (clientId: string): Promise<number> => {
    const records = await getLedgerRecords(clientId);
    // Priority: Panel 1
    const col1 = records.filter(r => r.column === 'col1' && r.isVisible);
    if (col1.length > 0) return col1.reduce((acc, r) => acc + getNetAmount(r), 0);
    
    const main = records.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
    return main.reduce((acc, r) => acc + getNetAmount(r), 0);
};

export const fetchClientTotalBalance = async (clientId: string) => {
    return getClientBalance(clientId);
};

export const seedData = () => { getCategories(); };
