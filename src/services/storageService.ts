import { Client, LedgerRecord, AssetRecord, TransactionCategory, DrawBalance, SaleRecord, CashAdvanceRecord } from '../types';
import { supabase } from '../supabaseClient';

const CLIENTS_KEY = 'ledger_clients';
const CATEGORIES_KEY = 'ledger_categories';
const ASSETS_KEY = 'ledger_assets';

// Helper to generate local IDs if offline (fallback)
const generateId = () => Math.random().toString(36).substr(2, 9);

// --- Helper: Date Score Extraction (Year-Aware) ---
const getNoteDateScore = (text: string, entryDateStr: string) => {
    const match = text.match(/(\d{1,2})[\/\.](\d{1,2})/); 
    if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const entryDate = new Date(entryDateStr);
        let year = entryDate.getFullYear();
        const entryMonth = entryDate.getMonth() + 1;
        if (month >= 10 && entryMonth <= 3) year -= 1;
        else if (month <= 3 && entryMonth >= 10) year += 1;
        return year * 10000 + month * 100 + day;
    }
    return 0;
};

const getRecordSortPriority = (record: LedgerRecord): number => {
    if (record.id.startsWith('draw_') || record.typeLabel === '上欠') return 1;
    if (record.id.startsWith('sale_') || record.id === 'agg_sale_week' || record.typeLabel === '收') return 2;
    if (record.typeLabel === '电') return 3;
    if (record.typeLabel === '中') return 4;
    if (record.id.startsWith('cred_') || record.typeLabel === '来') return 5;
    if (record.id.startsWith('adv_') || record.typeLabel === '支' || record.typeLabel === '支钱') return 6;
    return 7;
};

// Unified Sorter for Records
const sortLedgerRecords = (records: LedgerRecord[]) => {
    records.sort((a, b) => {
        const scoreA = getNoteDateScore(`${a.typeLabel} ${a.description}`, a.date);
        const scoreB = getNoteDateScore(`${b.typeLabel} ${b.description}`, b.date);
        if (scoreA !== 0 && scoreB !== 0) {
            if (scoreA !== scoreB) return scoreA - scoreB;
        } else if (scoreA !== 0) return -1;
        else if (scoreB !== 0) return 1;

        if (a.date !== b.date) return a.date.localeCompare(b.date);
        
        const pA = getRecordSortPriority(a);
        const pB = getRecordSortPriority(b);
        if (pA !== pB) return pA - pB;

        const swA = (a as any).sortWeight || 0;
        const swB = (b as any).sortWeight || 0;
        if (swA !== swB) return swA - swB;

        if (a.createdAt && b.createdAt) return a.createdAt.localeCompare(b.createdAt);
        return 0;
    });
    return records;
};

// --- Weekly Aggregation Helper (Timezone Safe) ---
const getSundayOfDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay(); // 0=Sun, 1=Mon...
    const diff = day === 0 ? 0 : 7 - day;
    date.setDate(date.getDate() + diff);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const da = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${da}`;
};

const aggregateSalesWeekly = (rows: any[]): LedgerRecord[] => {
    const saleRows = rows.filter(r => r.entry_type === 'SALE');
    const uniqueSales: Record<string, any> = {};
    saleRows.forEach(row => {
        const key = `${row.client_id}_${row.entry_date}`;
        if (!uniqueSales[key] || (row.created_at && uniqueSales[key].created_at && row.created_at > uniqueSales[key].created_at)) {
            uniqueSales[key] = row;
        } else if (!uniqueSales[key] && !row.created_at) {
             uniqueSales[key] = row;
        }
    });

    const grouped: Record<string, { amount: number, dates: string[], clientId: string }> = {};

    Object.values(uniqueSales).forEach(row => {
        const sun = getSundayOfDate(row.entry_date);
        const key = `${row.client_id}_${sun}`;
        const rawTotal = (Number(row.data?.b) || 0) + (Number(row.data?.s) || 0) + (Number(row.data?.a) || 0) + (Number(row.data?.c) || 0);
        const finalTotal = (!row.data?.mobileRaw && !row.data?.mobileRawData) ? rawTotal * 0.86 : rawTotal;
        if (!grouped[key]) {
            grouped[key] = { amount: 0, dates: [], clientId: row.client_id };
        }
        grouped[key].amount += finalTotal;
        grouped[key].dates.push(row.entry_date);
    });

    return Object.entries(grouped)
        .filter(([_, data]) => Math.abs(data.amount) > 0.001)
        .map(([key, data]) => ({
            id: `agg_sale_week_${key}`,
            clientId: data.clientId,
            date: key.split('_')[1],
            amount: Math.abs(data.amount),
            description: '', 
            typeLabel: '收',
            operation: data.amount >= 0 ? 'add' : 'subtract',
            column: 'main',
            isVisible: true,
            createdAt: key.split('_')[1] + 'T23:59:59Z'
        }));
};

export const getCategories = (): TransactionCategory[] => {
  const data = localStorage.getItem(CATEGORIES_KEY);
  let categories: TransactionCategory[] = data ? JSON.parse(data) : [];
  const defaults: TransactionCategory[] = [
    { id: '1', label: '收', operation: 'add', color: 'bg-green-100 text-green-800' },
    { id: '2', label: '中', operation: 'subtract', color: 'bg-red-100 text-red-800' },
    { id: '4', label: '支钱', operation: 'add', color: 'bg-green-100 text-green-800' },
    { id: '3', label: '出', operation: 'subtract', color: 'bg-red-100 text-red-800' },
    { id: '5', label: '上欠', operation: 'add', color: 'bg-green-100 text-green-800' },
    { id: '6', label: '%', operation: 'subtract', color: 'bg-red-100 text-red-800' },
    { id: '8', label: '电', operation: 'add', color: 'bg-green-100 text-green-800' },
    { id: '7', label: '来', operation: 'subtract', color: 'bg-red-100 text-red-800' },
  ];

  if (categories.length === 0) {
    categories = defaults;
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } else {
    const adds = categories.filter(c => c.operation === 'add' || c.operation === 'none');
    const subs = categories.filter(c => c.operation === 'subtract');
    const interleaved: TransactionCategory[] = [];
    const maxLen = Math.max(adds.length, subs.length);
    for (let i = 0; i < maxLen; i++) {
        if (adds[i]) interleaved.push(adds[i]);
        if (subs[i]) interleaved.push(subs[i]);
    }
    categories = interleaved;
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
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories.filter(c => c.id !== id)));
};

export const getClients = async (): Promise<Client[]> => {
  if (supabase) {
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: true });
    if (data) return data.map(d => ({ ...d, createdAt: d.created_at }));
  }
  return [];
};

export const saveClient = async (client: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
  if (supabase) {
    const { data } = await supabase.from('clients').insert([{
        name: client.name, code: client.code, phone: client.phone, category: client.category || 'paper'
    }]).select();
    if (data && data[0]) return { ...data[0], createdAt: data[0].created_at };
  }
  return {} as Client;
};

export const deleteClient = async (id: string) => {
  if (supabase) await supabase.from('clients').delete().eq('id', id);
};

export const getNetAmount = (r: LedgerRecord): number => {
    if (r.operation === 'none') return 0;
    return r.operation === 'add' ? r.amount : -r.amount;
};

const mapJournalToLedgerRecord = (row: any): LedgerRecord | null => {
    if (!row) return null;
    let amount = row.amount;
    if (amount === null || amount === undefined) amount = 0;
    
    const data = row.data || {};
    let typeLabel = data.typeLabel || '';
    let operation = data.operation || (amount >= 0 ? 'add' : 'subtract');
    let column = data.column || 'main';
    let description = data.description || '';
    let isVisible = data.isVisible !== false;

    if (row.entry_type === 'DRAW') {
        typeLabel = '上欠';
        operation = 'add';
        column = 'main';
    } else if (row.entry_type === 'ADVANCE') {
        typeLabel = '支钱';
        operation = 'add';
        column = 'main';
    } else if (row.entry_type === 'CREDIT') {
        typeLabel = '来';
        operation = 'subtract';
        column = 'main';
    } else if (row.entry_type === 'SALE') {
        return null; // Handle sales separately via aggregation
    }

    return {
        id: row.id,
        clientId: row.client_id,
        date: row.entry_date,
        description: description,
        typeLabel: typeLabel,
        amount: Math.abs(amount),
        operation: operation as any,
        column: column as any,
        isVisible: isVisible,
        createdAt: row.created_at
    };
};

export const getLedgerRecords = async (clientId: string): Promise<LedgerRecord[]> => {
  if (!supabase) return [];
  const { data } = await supabase.from('financial_journal').select('*').eq('client_id', clientId);
  if (!data) return [];
  
  const ledgerRows = data.map(mapJournalToLedgerRecord).filter(Boolean) as LedgerRecord[];
  const aggregatedSales = aggregateSalesWeekly(data.filter(r => r.client_id === clientId));
  
  return sortLedgerRecords([...ledgerRows, ...aggregatedSales]);
};

export const getAllLedgerRecords = async (): Promise<LedgerRecord[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('financial_journal').select('*');
    if (!data) return [];
    const ledgerRows = data.map(mapJournalToLedgerRecord).filter(Boolean) as LedgerRecord[];
    const aggregatedSales = aggregateSalesWeekly(data);
    return sortLedgerRecords([...ledgerRows, ...aggregatedSales]);
};

// --- CORE BALANCE CALCULATION LOGIC ---

const calculateBalanceForRecords = (records: LedgerRecord[], clientCode: string, mainOnly = false): number => {
    if (records.length === 0) return 0;
    const codeUpper = clientCode.toUpperCase();
    
    // Sort reverse to find latest snapshot
    const sorted = [...records].sort((a,b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    
    // Finds the latest opening balance (Draw / 上欠) for MAIN LEDGER
    const latestSnapshot = sorted.find(r => (r.id.startsWith('draw_') || r.typeLabel === '上欠') && (r.column === 'main' || !r.column));
    
    let periodRecords = records;
    if (latestSnapshot) {
        periodRecords = records.filter(r => {
            if (r.id === latestSnapshot.id) return true;
            if (r.date > latestSnapshot.date) return true;
            if (r.date === latestSnapshot.date) {
                // IMPORTANT FIX:
                // Draw/Snapshots are generated based on data STRICTLY BEFORE the date.
                // Therefore, they represent the balance at 00:00 of that day.
                // ALL transactions on the same day must be included (added) to the snapshot.
                // We only exclude other Draw records on the same day (duplicates/stale).
                if (!r.id.startsWith('draw_') && r.typeLabel !== '上欠') {
                    return true;
                }
                // Exclude other snapshot records on the same day
                return false;
            }
            return false;
        });
    }

    if (mainOnly) {
        const mainRecords = periodRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
        return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
    }

    // SPECIAL RULE: C06 uses Panel 2
    if (codeUpper === 'C06') {
        const col2Records = periodRecords.filter(r => r.column === 'col2' && r.isVisible);
        return col2Records.reduce((acc, r) => acc + getNetAmount(r), 0);
    }

    // DEFAULT: Check Panel 1 first
    const col1Records = periodRecords.filter(r => r.column === 'col1' && r.isVisible);
    if (col1Records.length > 0) {
        return col1Records.reduce((acc, r) => acc + getNetAmount(r), 0);
    }

    // FALLBACK: Main Ledger
    const mainRecords = periodRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
    return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
};

export const fetchClientTotalBalance = async (clientId: string): Promise<number> => {
    const records = await getLedgerRecords(clientId);
    const clients = await getClients();
    const client = clients.find(c => c.id === clientId);
    return calculateBalanceForRecords(records, (client?.code || '').toUpperCase());
};

export const getClientBalancesPriorToDate = async (dateLimit: string, clients: Client[]): Promise<Record<string, { amount: number, isPanel1: boolean }>> => {
    const results: Record<string, { amount: number, isPanel1: boolean }> = {};
    if (!supabase) return results;

    const { data } = await supabase.from('financial_journal').select('*').lt('entry_date', dateLimit);
    if (!data) return results;

    const aggregatedSales = aggregateSalesWeekly(data);
    const individualRecords = data.map(mapJournalToLedgerRecord).filter(Boolean) as LedgerRecord[];
    const allRecords = [...individualRecords, ...aggregatedSales];

    for (const client of clients) {
        const clientRecs = allRecords.filter(r => r.clientId === client.id);
        const col1Records = clientRecs.filter(r => r.column === 'col1' && r.isVisible);
        // REVISE: We want the effective running balance carried forward, so we use priority rules (mainOnly=false).
        const amount = calculateBalanceForRecords(clientRecs, (client.code || '').toUpperCase(), false);
        results[client.id] = { amount, isPanel1: col1Records.length > 0 };
    }
    return results;
};

export const generateSpecialCarryForward = async (clientId: string, clientCode: string, targetDate: string): Promise<void> => {
    if (!supabase) return;
    const records = await getLedgerRecords(clientId);
    const col1Prior = records.filter(r => r.column === 'col1' && r.date < targetDate && r.isVisible);
    const sorted = sortLedgerRecords([...col1Prior]);
    
    let toCopy: LedgerRecord[] = [];
    if (clientCode === 'Z21') toCopy = sorted.slice(-4);
    else if (clientCode === 'C19') toCopy = sorted.slice(-5);
    
    await supabase.from('financial_journal').delete().eq('client_id', clientId).eq('entry_date', targetDate).eq('data->>column', 'col1');

    for (const r of toCopy) {
        await saveLedgerRecord({
            clientId, date: targetDate, description: r.description, typeLabel: r.typeLabel, 
            amount: r.amount, operation: r.operation, column: 'col1', isVisible: true
        });
    }
};

export const saveLedgerRecord = async (record: Omit<LedgerRecord, 'id'>): Promise<void> => {
    if (!supabase) return;
    let signedAmount = record.operation === 'subtract' ? -record.amount : record.amount;
    await supabase.from('financial_journal').insert([{
        client_id: record.clientId, entry_date: record.date, entry_type: 'LEDGER', amount: signedAmount,
        data: { description: record.description, typeLabel: record.typeLabel, operation: record.operation, column: record.column, isVisible: record.isVisible }
    }]);
};

export const updateLedgerRecord = async (id: string, updates: Partial<LedgerRecord>): Promise<void> => {
    if (!supabase) return;
    const { data: current } = await supabase.from('financial_journal').select('*').eq('id', id).maybeSingle();
    if (!current) return;

    const operation = updates.operation || current.data?.operation || 'add';
    const amount = updates.amount !== undefined ? updates.amount : Math.abs(current.amount);
    const signedAmount = operation === 'subtract' ? -amount : amount;

    const newData = { ...(current.data || {}) };
    if (updates.description !== undefined) newData.description = updates.description;
    if (updates.typeLabel !== undefined) newData.typeLabel = updates.typeLabel;
    if (updates.operation !== undefined) newData.operation = updates.operation;
    if (updates.column !== undefined) newData.column = updates.column;
    if (updates.isVisible !== undefined) newData.isVisible = updates.isVisible;

    await supabase.from('financial_journal').update({ amount: signedAmount, entry_date: updates.date || current.entry_date, data: newData }).eq('id', id);
};

export const deleteLedgerRecord = async (id: string): Promise<void> => {
    if (!supabase) return;
    await supabase.from('financial_journal').delete().eq('id', id);
};

export const getSaleRecords = async (clientId: string): Promise<SaleRecord[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('financial_journal').select('*').eq('client_id', clientId).eq('entry_type', 'SALE');
    if (!data) return [];
    return data.map(r => ({
        id: r.id, clientId: r.client_id, date: r.entry_date, b: r.data?.b || 0, s: r.data?.s || 0, a: r.data?.a || 0, c: r.data?.c || 0,
        mobileRaw: r.data?.mobileRaw, mobileRawData: r.data?.mobileRawData
    }));
};

export const getSalesForDates = async (dates: string[]): Promise<SaleRecord[]> => {
    if (!supabase || dates.length === 0) return [];
    const { data } = await supabase.from('financial_journal').select('*').eq('entry_type', 'SALE').in('entry_date', dates);
    if (!data) return [];
    return data.map(r => ({
        id: r.id, clientId: r.client_id, date: r.entry_date, b: r.data?.b || 0, s: r.data?.s || 0, a: r.data?.a || 0, c: r.data?.c || 0,
        mobileRaw: r.data?.mobileRaw, mobileRawData: r.data?.mobileRawData
    }));
};

export const saveSaleRecord = async (record: Omit<SaleRecord, 'id'>): Promise<void> => {
    if (!supabase) return;
    const { data: existing } = await supabase.from('financial_journal').select('id').eq('client_id', record.clientId).eq('entry_date', record.date).eq('entry_type', 'SALE').maybeSingle();
    const netAmount = (record.b || 0) + (record.s || 0) + (record.a || 0) + (record.c || 0);
    const payload = { client_id: record.clientId, entry_date: record.date, entry_type: 'SALE', amount: netAmount, data: { b: record.b, s: record.s, a: record.a, c: record.c, mobileRaw: record.mobileRaw, mobileRawData: record.mobileRawData } };
    if (existing) await supabase.from('financial_journal').update(payload).eq('id', existing.id);
    else await supabase.from('financial_journal').insert([payload]);
};

export const getDrawBalances = async (date: string): Promise<Record<string, number>> => {
    if (!supabase) return {};
    const { data } = await supabase.from('financial_journal').select('*').eq('entry_date', date).eq('entry_type', 'DRAW');
    const result: Record<string, number> = {};
    data?.forEach(r => result[r.client_id] = r.amount);
    return result;
};

export const saveDrawBalance = async (date: string, clientId: string, amount: number): Promise<void> => {
    if (!supabase) return;
    const { data: existing } = await supabase.from('financial_journal').select('id').eq('client_id', clientId).eq('entry_date', date).eq('entry_type', 'DRAW').maybeSingle();
    if (existing) await supabase.from('financial_journal').update({ amount }).eq('id', existing.id);
    else await supabase.from('financial_journal').insert([{ client_id: clientId, entry_date: date, entry_type: 'DRAW', amount, data: { operation: 'add', typeLabel: '上欠', column: 'main' } }]);
};

export const getCashAdvances = async (date: string): Promise<Record<string, number>> => {
    if (!supabase) return {};
    const { data } = await supabase.from('financial_journal').select('*').eq('entry_date', date).eq('entry_type', 'ADVANCE');
    const result: Record<string, number> = {};
    data?.forEach(r => result[r.client_id] = r.amount);
    return result;
};

export const saveCashAdvance = async (date: string, clientId: string, amount: number): Promise<void> => {
    if (!supabase) return;
    const { data: existing } = await supabase.from('financial_journal').select('id').eq('client_id', clientId).eq('entry_date', date).eq('entry_type', 'ADVANCE').maybeSingle();
    if (existing) {
        if (amount === 0) await supabase.from('financial_journal').delete().eq('id', existing.id);
        else await supabase.from('financial_journal').update({ amount }).eq('id', existing.id);
    } else if (amount !== 0) {
        await supabase.from('financial_journal').insert([{ client_id: clientId, entry_date: date, entry_type: 'ADVANCE', amount, data: { operation: 'add', typeLabel: '支钱', column: 'main' } }]);
    }
};

export const getCashCredits = async (date: string): Promise<Record<string, number>> => {
    if (!supabase) return {};
    const { data } = await supabase.from('financial_journal').select('*').eq('entry_date', date).eq('entry_type', 'CREDIT');
    const result: Record<string, number> = {};
    data?.forEach(r => result[r.client_id] = r.amount);
    return result;
};

export const saveCashCredit = async (date: string, clientId: string, amount: number): Promise<void> => {
    if (!supabase) return;
    const { data: existing } = await supabase.from('financial_journal').select('id').eq('client_id', clientId).eq('entry_date', date).eq('entry_type', 'CREDIT').maybeSingle();
    if (existing) {
        if (amount === 0) await supabase.from('financial_journal').delete().eq('id', existing.id);
        else await supabase.from('financial_journal').update({ amount }).eq('id', existing.id);
    } else if (amount !== 0) {
        await supabase.from('financial_journal').insert([{ client_id: clientId, entry_date: date, entry_type: 'CREDIT', amount, data: { operation: 'subtract', typeLabel: '来', column: 'main' } }]);
    }
};

export const saveMobileReportHistory = async (date: string, json_data: any): Promise<void> => {
    if (!supabase) return;
    await supabase.from('report_history').insert([{ report_date: date, json_data }]);
};

export const getMobileReportHistory = async (): Promise<any[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('report_history').select('*').order('created_at', { ascending: false });
    return data || [];
};

export const getWinningsByDateRange = async (start: string, end: string): Promise<Record<string, number>> => {
    if (!supabase) return {};
    const { data } = await supabase.from('financial_journal').select('*').eq('entry_type', 'LEDGER').eq('data->>typeLabel', '中').gte('entry_date', start).lte('entry_date', end);
    const result: Record<string, number> = {};
    data?.forEach(r => { result[r.client_id] = (result[r.client_id] || 0) + Math.abs(r.amount); });
    return result;
};

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

export const seedData = () => { getCategories(); };
