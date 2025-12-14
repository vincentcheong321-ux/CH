
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
// Updated to handle ALL types and map them to requested labels
const mapJournalToLedgerRecord = (row: any): LedgerRecord => {
    const isAdd = row.amount >= 0; 
    let baseRecord: LedgerRecord = {
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

    // Override logic based on Entry Type to fulfill user request
    switch (row.entry_type) {
        case 'SALE':
            // Sales Opening = 收
            baseRecord.typeLabel = '收';
            baseRecord.id = `sale_${row.id}`; // Prefix to identify system records
            // If amount is positive (Client Lost/Owes), it's Add. If negative (Client Won), it's Subtract.
            baseRecord.operation = row.amount >= 0 ? 'add' : 'subtract';
            baseRecord.column = 'main';
            break;
        
        case 'ADVANCE':
            // Cash Advance = 支 (Payout to client -> Increases Debt)
            baseRecord.typeLabel = '支';
            baseRecord.id = `adv_${row.id}`;
            baseRecord.operation = 'add';
            baseRecord.column = 'col1'; // Advances often in Panel 1
            break;

        case 'CREDIT':
            // Cash Credit = 来 (Income from client -> Reduces Debt)
            baseRecord.typeLabel = '来';
            baseRecord.id = `cred_${row.id}`;
            baseRecord.operation = 'subtract';
            baseRecord.column = 'col1'; // Credits often in Panel 1
            break;

        case 'DRAW':
            // Draw Report = 上欠 (Balance Forward)
            baseRecord.typeLabel = '上欠';
            baseRecord.id = `draw_${row.id}`;
            baseRecord.operation = row.amount >= 0 ? 'add' : 'subtract'; 
            baseRecord.column = 'main';
            break;
            
        case 'MANUAL':
        default:
            // Keep existing manual data
            break;
    }

    return baseRecord;
};

export const getLedgerRecords = async (clientId: string): Promise<LedgerRecord[]> => {
    if (supabase) {
        // Fetch ALL types for this client (Removed entry_type filter)
        const { data } = await supabase
            .from('financial_journal')
            .select('*')
            .eq('client_id', clientId);
            
        if (data) return data.map(mapJournalToLedgerRecord);
    }
    return [];
};

export const getAllLedgerRecords = async (): Promise<LedgerRecord[]> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('*');
        if (data) return data.map(mapJournalToLedgerRecord);
    }
    return [];
};

export const saveLedgerRecord = async (record: Omit<LedgerRecord, 'id'>): Promise<LedgerRecord> => {
    if (supabase) {
        let signedAmount = 0;
        if (record.operation === 'add') signedAmount = record.amount;
        else if (record.operation === 'subtract') signedAmount = -record.amount;
        else signedAmount = 0;

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
        // Prevent updating system records via ledger
        if (id.startsWith('sale_') || id.startsWith('adv_') || id.startsWith('draw_') || id.startsWith('cred_')) {
            console.warn("System record update blocked in ledger view");
            return;
        }

        const payload: any = { data: {} };
        
        if (updates.amount !== undefined || updates.operation !== undefined) {
             let signedAmount = 0;
             if (updates.operation === 'add') signedAmount = updates.amount!;
             else if (updates.operation === 'subtract') signedAmount = -updates.amount!;
             else signedAmount = 0;
             payload.amount = signedAmount;
        }
        
        const { data: existing } = await supabase.from('financial_journal').select('data').eq('id', id).single();
        const mergedData = { ...existing?.data, ...updates };
        
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
    if (supabase) {
        // Prevent deleting system records via ledger
        if (id.startsWith('sale_') || id.startsWith('adv_') || id.startsWith('draw_') || id.startsWith('cred_')) {
             console.warn("System record delete blocked in ledger view");
             return;
        }
        await supabase.from('financial_journal').delete().eq('id', id);
    }
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
            c: row.data?.c || 0,
            mobileRaw: row.data?.mobileRaw,
            mobileRawData: row.data?.mobileRawData // Retrieve full array
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
            c: row.data?.c || 0,
            mobileRaw: row.data?.mobileRaw,
            mobileRawData: row.data?.mobileRawData
        }));
    }
    return [];
};

export const saveSaleRecord = async (record: Omit<SaleRecord, 'id'>) => {
    if (supabase) {
        // CHANGED: Summing everything instead of difference (User Request: "both sum up total")
        const netAmount = record.b + record.s + record.a + record.c;
        
        const { data: existing } = await supabase.from('financial_journal')
            .select('id, data')
            .eq('client_id', record.clientId)
            .eq('entry_date', record.date)
            .eq('entry_type', 'SALE')
            .maybeSingle();

        if (existing) {
             const newData = { 
                 ...existing.data, // Preserve existing data 
                 b: record.b, s: record.s, a: record.a, c: record.c 
             };
             // Only update mobileRaw if provided
             if (record.mobileRaw !== undefined) {
                 newData.mobileRaw = record.mobileRaw;
             }
             // Update full raw data array if provided
             if (record.mobileRawData !== undefined) {
                 newData.mobileRawData = record.mobileRawData;
             }

             await supabase.from('financial_journal').update({
                amount: netAmount,
                data: newData
             }).eq('id', existing.id);
        } else {
             await supabase.from('financial_journal').insert({
                client_id: record.clientId,
                entry_date: record.date,
                entry_type: 'SALE',
                amount: netAmount,
                data: { 
                    b: record.b, s: record.s, a: record.a, c: record.c,
                    mobileRaw: record.mobileRaw,
                    mobileRawData: record.mobileRawData
                }
             });
        }
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
        const { data: existing } = await supabase.from('financial_journal')
            .select('id')
            .eq('client_id', clientId)
            .eq('entry_date', date)
            .eq('entry_type', 'ADVANCE')
            .maybeSingle();

        if (existing) {
             await supabase.from('financial_journal').update({
                amount: amount
             }).eq('id', existing.id);
        } else {
             await supabase.from('financial_journal').insert({
                client_id: clientId,
                entry_date: date,
                entry_type: 'ADVANCE',
                amount: amount,
                data: {}
             });
        }
    }
};

// --- F. Cash Credit Adapters (Mapped to 'CREDIT' type) ---

export const getCashCredits = async (date: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('client_id, amount')
            .eq('entry_date', date)
            .eq('entry_type', 'CREDIT');
            
        const map: Record<string, number> = {};
        data?.forEach((row: any) => {
            map[row.client_id] = row.amount;
        });
        return map;
    }
    return {};
};

export const saveCashCredit = async (date: string, clientId: string, amount: number) => {
    if (supabase) {
        const { data: existing } = await supabase.from('financial_journal')
            .select('id')
            .eq('client_id', clientId)
            .eq('entry_date', date)
            .eq('entry_type', 'CREDIT')
            .maybeSingle();

        if (existing) {
             await supabase.from('financial_journal').update({
                amount: amount
             }).eq('id', existing.id);
        } else {
             await supabase.from('financial_journal').insert({
                client_id: clientId,
                entry_date: date,
                entry_type: 'CREDIT',
                amount: amount,
                data: {}
             });
        }
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
        const { data: existing } = await supabase.from('financial_journal')
            .select('id')
            .eq('client_id', clientId)
            .eq('entry_date', date)
            .eq('entry_type', 'DRAW')
            .maybeSingle();

        if (existing) {
             await supabase.from('financial_journal').update({
                amount: balance
             }).eq('id', existing.id);
        } else {
             await supabase.from('financial_journal').insert({
                client_id: clientId,
                entry_date: date,
                entry_type: 'DRAW',
                amount: balance,
                data: {}
             });
        }
    }
};

// --- E. Mobile Report History ---

export const saveMobileReportHistory = async (date: string, rawData: any[]) => {
    if (supabase) {
        await supabase.from('mobile_report_history').insert([{
            report_date: date,
            json_data: rawData
        }]);
    }
};

export const getMobileReportHistory = async () => {
    if (supabase) {
        const { data } = await supabase
            .from('mobile_report_history')
            .select('*')
            .order('created_at', { ascending: false });
        return data || [];
    }
    return [];
};

// --- 4. Global Balance & Utils ---

export const getClientBalance = (clientId: string): number => {
    console.warn("Sync getClientBalance called - this is deprecated in V2. Use fetchClientTotalBalance instead.");
    return 0;
};

export const fetchClientTotalBalance = async (clientId: string): Promise<number> => {
    if (supabase) {
        const { data, error } = await supabase.rpc('get_client_balance', { cid: clientId });
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

// NEW: Helper to calculate balance STRICTLY before a certain date
export const getClientBalancesPriorToDate = async (dateLimit: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('client_id, amount')
            .lt('entry_date', dateLimit);

        const balances: Record<string, number> = {};
        if (data) {
            data.forEach((row: any) => {
                const cid = row.client_id;
                balances[cid] = (balances[cid] || 0) + row.amount;
            });
        }
        return balances;
    }
    return {};
};

export const getTotalDrawReceivables = async (): Promise<number> => {
    if (supabase) {
        // Logic updated: fetches all financial impact on the company from all types
        const { data } = await supabase
            .from('financial_journal')
            .select('amount');
            
        return data?.reduce((acc, r) => acc + r.amount, 0) || 0;
    }
    return 0;
};

export const getNetAmount = (r: LedgerRecord): number => {
  if (r.operation === 'none') return 0;
  return r.operation === 'add' ? r.amount : -r.amount;
};

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
