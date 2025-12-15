
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

// Helper for sorting by system-defined order
const getRecordSortPriority = (record: LedgerRecord): number => {
    // Handle manual '上欠' with high priority as well
    if (record.id.startsWith('draw_') || record.typeLabel === '上欠') return 1;
    if (record.id.startsWith('sale_')) return 2; // 收
    if (record.id.startsWith('cred_')) return 3; // 来
    if (record.id.startsWith('adv_')) return 4;  // 支
    return 5; // Manual entries come last
};

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
            
            // DYNAMIC CALCULATION: Recalculate sum (B+S+A+C) from raw data.
            // This ensures that even if the DB 'amount' column is stale (old formula), 
            // the ledger displays the correct SUM.
            if (row.data) {
                const b = Number(row.data.b) || 0;
                const s = Number(row.data.s) || 0;
                const a = Number(row.data.a) || 0;
                const c = Number(row.data.c) || 0;
                const total = b + s + a + c; // FORCE SUM LOGIC
                
                baseRecord.amount = Math.abs(total);
                baseRecord.operation = total >= 0 ? 'add' : 'subtract';
            } else {
                baseRecord.operation = row.amount >= 0 ? 'add' : 'subtract';
            }
            
            baseRecord.column = 'main';
            break;
        
        case 'ADVANCE':
            // Cash Advance = 支 (Payout to client -> Increases Debt)
            baseRecord.typeLabel = '支';
            baseRecord.id = `adv_${row.id}`;
            baseRecord.operation = 'add';
            baseRecord.column = 'main'; // Advances in Main Ledger
            break;

        case 'CREDIT':
            // Cash Credit = 来 (Income from client -> Reduces Debt)
            baseRecord.typeLabel = '来';
            baseRecord.id = `cred_${row.id}`;
            baseRecord.operation = 'subtract';
            baseRecord.column = 'main'; // Credits in Main Ledger
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
        // Fetch ALL types for this client
        const { data } = await supabase
            .from('financial_journal')
            .select('*')
            .eq('client_id', clientId);
            
        if (data) {
            const records = data.map(mapJournalToLedgerRecord);

            // Apply custom multi-level sort
            records.sort((a, b) => {
                if (a.date < b.date) return -1;
                if (a.date > b.date) return 1;
                // Dates are same, sort by type priority
                return getRecordSortPriority(a) - getRecordSortPriority(b);
            });

            return records;
        }
    }
    return [];
};

export const getAllLedgerRecords = async (): Promise<LedgerRecord[]> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('*');
        if (data) {
            const records = data.map(mapJournalToLedgerRecord);

            // Apply custom multi-level sort
            records.sort((a, b) => {
                if (a.date < b.date) return -1;
                if (a.date > b.date) return 1;
                // Dates are same, sort by type priority
                return getRecordSortPriority(a) - getRecordSortPriority(b);
            });

            return records;
        }
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

// --- G. Winnings (Win Calculator Sync) ---

export const getWinningsByDate = async (date: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('client_id, amount, data')
            .eq('entry_date', date)
            .eq('entry_type', 'MANUAL'); 

        const map: Record<string, number> = {};
        
        data?.forEach((row: any) => {
            // Check if it is a winning record (label '中')
            if (row.data?.typeLabel === '中') {
                // Prevent double counting if both Col1 and Main records exist
                if (row.data?.column === 'main') return;

                const current = map[row.client_id] || 0;
                // Winnings are stored as negative amounts (subtract operation). We display positive magnitude.
                map[row.client_id] = current + Math.abs(row.amount);
            }
        });
        return map;
    }
    return {};
};

// Fetch winnings across a date range (for weekly summary)
export const getWinningsByDateRange = async (startDate: string, endDate: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase
            .from('financial_journal')
            .select('client_id, amount, data')
            .gte('entry_date', startDate)
            .lte('entry_date', endDate)
            .eq('entry_type', 'MANUAL');

        const map: Record<string, number> = {};
        
        data?.forEach((row: any) => {
            if (row.data?.typeLabel === '中') {
                // Prevent double counting if both Col1 and Main records exist
                if (row.data?.column === 'main') return;

                const current = map[row.client_id] || 0;
                map[row.client_id] = current + Math.abs(row.amount);
            }
        });
        return map;
    }
    return {};
};

// --- 4. Global Balance & Utils ---

export const getClientBalance = (clientId: string): number => {
    console.warn("Sync getClientBalance called - this is deprecated in V2. Use fetchClientTotalBalance instead.");
    return 0;
};

// UPDATED: Calculate Total Balance respecting checkpoints (Draw OR Manual '上欠') and Panel 1 logic
export const fetchClientTotalBalance = async (clientId: string): Promise<number> => {
    // 1. Fetch all records for the client
    const records = await getLedgerRecords(clientId);
    if (records.length === 0) return 0;

    // 2. Find the latest SNAPSHOT record to prevent double counting history
    // Sort descending by date to find latest
    records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Look for either a system Draw OR a manual '上欠' (Forward Balance)
    const latestSnapshot = records.find(r => r.id.startsWith('draw_') || r.typeLabel === '上欠');
    let effectiveRecords = records;

    if (latestSnapshot) {
        // If a Snapshot exists, we sum: The Snapshot Amount + All Transactions ON or AFTER the Snapshot Date.
        effectiveRecords = records.filter(r => {
            // Include the snapshot itself
            if (r.id === latestSnapshot.id) return true; 
            // Include records newer than the snapshot
            if (r.date > latestSnapshot.date) return true; 
            // Include records on the same day (unless it's another snapshot, to avoid dupes)
            if (r.date === latestSnapshot.date) {
                // If finding logic was sound, 'latestSnapshot' is the first one found in desc sort.
                // We shouldn't include other snapshots on same day if they exist (unlikely but safe to exclude).
                return r.id !== latestSnapshot.id && !(r.id.startsWith('draw_') || r.typeLabel === '上欠');
            }
            return false;
        });
    }

    // 3. Apply Column Logic (Panel 1 vs Main)
    // "If Panel 1 has visible data in the effective period, use that only. Otherwise fallback to Main Ledger."
    
    const col1Records = effectiveRecords.filter(r => r.column === 'col1' && r.isVisible);
    
    if (col1Records.length > 0) {
        return col1Records.reduce((acc, r) => acc + getNetAmount(r), 0);
    }
    
    // Fallback to Main (Sum of everything in effective set that is main or undefined)
    const mainRecords = effectiveRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
    return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
};

// UPDATED: Helper to calculate balance STRICTLY before a certain date, respecting Ledger Rules
export const getClientBalancesPriorToDate = async (dateLimit: string): Promise<Record<string, number>> => {
    if (supabase) {
        // 1. Fetch ALL records prior to the date limit
        const { data } = await supabase
            .from('financial_journal')
            .select('*')
            .lt('entry_date', dateLimit)
            .order('entry_date', { ascending: true }); // Important for sorting

        if (!data) return {};

        // 2. Group by Client
        const clientRecords: Record<string, LedgerRecord[]> = {};
        data.forEach(row => {
            const record = mapJournalToLedgerRecord(row);
            if (!clientRecords[record.clientId]) {
                clientRecords[record.clientId] = [];
            }
            clientRecords[record.clientId].push(record);
        });

        // 3. Calculate Balance per Client using Ledger Logic
        const balances: Record<string, number> = {};
        
        Object.keys(clientRecords).forEach(clientId => {
            const records = clientRecords[clientId];
            
            // --- Ledger Logic (Same as fetchClientTotalBalance) ---
            
            // A. Sort Descending
            records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // B. Find Snapshot (Draw or Manual '上欠')
            const latestSnapshot = records.find(r => r.id.startsWith('draw_') || r.typeLabel === '上欠');
            let effectiveRecords = records;

            if (latestSnapshot) {
                effectiveRecords = records.filter(r => {
                    if (r.id === latestSnapshot.id) return true; 
                    if (r.date > latestSnapshot.date) return true;
                    if (r.date === latestSnapshot.date) {
                        return r.id !== latestSnapshot.id && !(r.id.startsWith('draw_') || r.typeLabel === '上欠');
                    }
                    return false;
                });
            }

            // C. Panel 1 Priority Logic
            const col1Records = effectiveRecords.filter(r => r.column === 'col1' && r.isVisible);
            let total = 0;

            if (col1Records.length > 0) {
                total = col1Records.reduce((acc, r) => acc + getNetAmount(r), 0);
            } else {
                const mainRecords = effectiveRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
                total = mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
            }

            balances[clientId] = total;
        });

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
