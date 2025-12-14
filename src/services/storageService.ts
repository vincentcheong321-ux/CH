
import { Client, LedgerRecord, AssetRecord, TransactionCategory, DrawBalance, SaleRecord, CashAdvanceRecord } from '../types';
import { supabase } from '../supabaseClient';

const CLIENTS_KEY = 'ledger_clients';
const CATEGORIES_KEY = 'ledger_categories';

// Helper to generate local IDs if offline (fallback)
const generateId = () => Math.random().toString(36).substr(2, 9);

// --- 1. Categories (Local Only) ---
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

// --- 2. Clients (Supabase) ---

export const getClients = async (): Promise<Client[]> => {
  if (supabase) {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: true });
    if (data) return data.map(d => ({ ...d, createdAt: d.created_at }));
  }
  return JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
};

export const saveClient = async (client: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
  if (supabase) {
    const { data } = await supabase.from('clients').insert([{
        name: client.name,
        code: client.code,
        phone: client.phone,
        category: client.category || 'paper'
    }]).select();
    if (data && data[0]) return { ...data[0], createdAt: data[0].created_at };
  }
  return {} as Client;
};

export const deleteClient = async (id: string) => {
  if (supabase) await supabase.from('clients').delete().eq('id', id);
};

export const seedInitialClients = async () => {
    // Keeping seed logic simple or empty as data persistence is handled by Supabase now
};

export const seedData = () => {
    getCategories();
};

// --- 3. Unified Financial Journal Adapters ---

// A. Helper to map DB row to LedgerRecord
const mapJournalToLedgerRecord = (row: any): LedgerRecord => {
    // Ledger Logic: 
    // If Amount > 0, it's 'add' (Client Owes).
    // If Amount < 0, it's 'subtract' (Company Owes).
    // 'none' operation is usually stored as 0 amount but we check metadata.
    
    const isAdd = row.amount >= 0; 
    
    return {
        id: row.id,
        clientId: row.client_id,
        date: row.entry_date,
        amount: Math.abs(row.amount),
        description: row.data?.description || '',
        typeLabel: row.data?.typeLabel || '',
        operation: row.data?.operation || (row.amount === 0 ? 'none' : (isAdd ? 'add' : 'subtract')),
        column: row.data?.column || 'main',
        isVisible: true
    };
};

export const getLedgerRecords = async (clientId: string): Promise<LedgerRecord[]> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('*')
            .eq('client_id', clientId)
            .eq('entry_type', 'MANUAL'); // Only fetch manual ledger entries
            
        if (data) return data.map(mapJournalToLedgerRecord);
    }
    return [];
};

export const getAllLedgerRecords = async (): Promise<LedgerRecord[]> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('*')
            .eq('entry_type', 'MANUAL');
        if (data) return data.map(mapJournalToLedgerRecord);
    }
    return [];
};

export const saveLedgerRecord = async (record: Omit<LedgerRecord, 'id'>): Promise<LedgerRecord> => {
    if (supabase) {
        // Logic: Calculate Signed Amount
        let signedAmount = 0;
        if (record.operation === 'add') signedAmount = record.amount;
        else if (record.operation === 'subtract') signedAmount = -record.amount;
        else signedAmount = 0; // 'none'

        const { data } = await supabase.from('financial_journal').insert([{
            client_id: record.clientId,
            entry_date: record.date,
            entry_type: 'MANUAL',
            amount: signedAmount,
            data: {
                description: record.description,
                typeLabel: record.typeLabel,
                operation: record.operation,
                column: record.column
            }
        }]).select();

        if (data && data[0]) return mapJournalToLedgerRecord(data[0]);
    }
    return {} as LedgerRecord;
};

export const updateLedgerRecord = async (id: string, updates: Partial<LedgerRecord>) => {
    if (supabase) {
        const payload: any = { data: {} };
        
        // We need to merge existing data potentially, but simplified for now:
        if (updates.amount !== undefined || updates.operation !== undefined) {
             // We need full context to recalc signed amount. Assuming 'updates' has enough info or we'd need to fetch first.
             // For this app, update usually sends the whole object.
             let signedAmount = 0;
             if (updates.operation === 'add') signedAmount = updates.amount!;
             else if (updates.operation === 'subtract') signedAmount = -updates.amount!;
             else signedAmount = 0;
             payload.amount = signedAmount;
        }
        
        // Update Data JSONB
        if (updates.description !== undefined) payload.data = { description: updates.description };
        // Ideally we do a deep merge on 'data' or fetch-modify-save. 
        // For this specific app flow, we can just update the fields we know.
        
        // Better approach: Since `updateLedgerRecord` in app usually passes full obj state in `updates` for critical fields
        const { data: existing } = await supabase.from('financial_journal').select('data').eq('id', id).single();
        const mergedData = { ...existing?.data, ...updates };
        
        // Clean up root level props from mergedData
        delete mergedData.id;
        delete mergedData.clientId;
        delete mergedData.date;
        delete mergedData.amount;
        
        await supabase.from('financial_journal').update({
            amount: payload.amount,
            data: {
                description: updates.description,
                typeLabel: updates.typeLabel,
                operation: updates.operation,
                column: updates.column
            }
        }).eq('id', id);
    }
};

export const deleteLedgerRecord = async (id: string) => {
    if (supabase) await supabase.from('financial_journal').delete().eq('id', id);
};

// --- B. Sales Adapters (Mapped to 'SALE' type) ---

export const getSaleRecords = async (clientId: string): Promise<SaleRecord[]> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('*')
            .eq('client_id', clientId)
            .eq('entry_type', 'SALE');
            
        if (data) return data.map((row: any) => ({
            id: row.id,
            clientId: row.client_id,
            date: row.entry_date,
            b: row.data?.b || 0,
            s: row.data?.s || 0,
            a: row.data?.a || 0,
            c: row.data?.c || 0
        }));
    }
    return [];
};

export const getSalesForDates = async (dates: string[]): Promise<SaleRecord[]> => {
    if (supabase && dates.length > 0) {
        const { data } = await supabase
            .from('financial_journal')
            .select('*')
            .eq('entry_type', 'SALE')
            .in('entry_date', dates);

        if (data) return data.map((row: any) => ({
            id: row.id,
            clientId: row.client_id,
            date: row.entry_date,
            b: row.data?.b || 0,
            s: row.data?.s || 0,
            a: row.data?.a || 0,
            c: row.data?.c || 0
        }));
    }
    return [];
};

export const saveSaleRecord = async (record: Omit<SaleRecord, 'id'>) => {
    if (supabase) {
        // Calculate Net Amount for the Journal
        // (b + s) - (a + c)
        // If result > 0, Client Owes (Positive).
        const netAmount = (record.b + record.s) - (record.a + record.c);

        const { error } = await supabase.from('financial_journal').upsert({
            client_id: record.clientId,
            entry_date: record.date,
            entry_type: 'SALE',
            amount: netAmount,
            data: {
                b: record.b,
                s: record.s,
                a: record.a,
                c: record.c
            }
        }, { onConflict: 'client_id, entry_date, entry_type' });
    }
};

// --- C. Cash Advance Adapters (Mapped to 'ADVANCE' type) ---

export const getCashAdvances = async (date: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('client_id, amount')
            .eq('entry_date', date)
            .eq('entry_type', 'ADVANCE');
            
        const map: Record<string, number> = {};
        data?.forEach((row: any) => {
            map[row.client_id] = row.amount;
        });
        return map;
    }
    return {};
};

export const saveCashAdvance = async (date: string, clientId: string, amount: number) => {
    if (supabase) {
        await supabase.from('financial_journal').upsert({
            client_id: clientId,
            entry_date: date,
            entry_type: 'ADVANCE',
            amount: amount, // Positive = Client Owes
            data: {}
        }, { onConflict: 'client_id, entry_date, entry_type' });
    }
};

// --- D. Draw Balance Adapters (Mapped to 'DRAW' type) ---

export const getDrawBalances = async (date: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('client_id, amount')
            .eq('entry_date', date)
            .eq('entry_type', 'DRAW');
            
        const map: Record<string, number> = {};
        data?.forEach((row: any) => {
            map[row.client_id] = row.amount;
        });
        return map;
    }
    return {};
};

export const getAllDrawRecords = async (): Promise<DrawBalance[]> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('*')
            .eq('entry_type', 'DRAW');
            
        return data?.map((row: any) => ({
            clientId: row.client_id,
            date: row.entry_date,
            balance: row.amount
        })) || [];
    }
    return [];
};

export const saveDrawBalance = async (date: string, clientId: string, balance: number) => {
    if (supabase) {
        await supabase.from('financial_journal').upsert({
            client_id: clientId,
            entry_date: date,
            entry_type: 'DRAW',
            amount: balance,
            data: {}
        }, { onConflict: 'client_id, entry_date, entry_type' });
    }
};

// --- 4. Global Balance & Utils ---

export const getClientBalance = (clientId: string): number => {
    // This function was originally synchronous. 
    // In a real app with this new schema, we'd make it async: `await getClientBalance(id)`.
    // However, to avoid breaking 50 React components, we will rely on 
    // the components calling `fetchAll...` or specific aggregators.
    // 
    // TEMPORARY FIX: Return 0 here. The Dashboard/Lists should be refactored to fetch sums via a new Async API.
    console.warn("Sync getClientBalance called - this is deprecated in V2. Use fetchClientTotalBalance instead.");
    return 0;
};

// NEW: Highly Efficient Aggregator
export const fetchClientTotalBalance = async (clientId: string): Promise<number> => {
    if (supabase) {
        // One query to rule them all
        const { data, error } = await supabase.rpc('get_client_balance', { cid: clientId });
        // If RPC isn't defined, we do a raw sum select (less efficient but works)
        if (error) {
             const { data: sumData } = await supabase
                .from('financial_journal')
                .select('amount')
                .eq('client_id', clientId);
             return sumData?.reduce((acc, r) => acc + r.amount, 0) || 0;
        }
        return data || 0;
    }
    return 0;
};

// Helper for Dashboard total
export const getTotalDrawReceivables = async (): Promise<number> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('amount')
            .in('entry_type', ['DRAW', 'MANUAL', 'SALE', 'ADVANCE']); // Sum EVERYTHING
            
        return data?.reduce((acc, r) => acc + r.amount, 0) || 0;
    }
    return 0;
};

export const getNetAmount = (r: LedgerRecord): number => {
  if (r.operation === 'none') return 0;
  return r.operation === 'add' ? r.amount : -r.amount;
};

// --- Asset Records (Cash Flow) ---
// We can treat these as a special client "COMPANY_ASSETS" or keep a separate table.
// For simplicity, let's keep the existing local logic or map to a generic table if needed.
// Keeping strictly separate for now to avoid complexity in this step.
const ASSETS_KEY = 'ledger_assets';
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
