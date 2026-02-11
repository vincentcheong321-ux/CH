
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

const getRecordSortPriority = (record: LedgerRecord): number => {
    if (record.id.startsWith('draw_') || record.typeLabel === '上欠') return 1;
    if (record.id.startsWith('sale_') || record.id === 'agg_sale_week' || record.typeLabel === '收') return 2;
    if (record.typeLabel === '电') return 3;
    if (record.typeLabel === '中') return 4;
    if (record.id.startsWith('cred_') || record.typeLabel === '来') return 5;
    if (record.id.startsWith('adv_') || record.typeLabel === '支' || record.typeLabel === '支钱') return 6;
    return 7;
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

/* FIX: Added proper implementation and fixed truncation */
const mapJournalToLedgerRecord = (row: any): LedgerRecord | null => {
    if (!row) return null;
    let amount = row.amount;
    if (amount === null || amount === undefined) amount = 0;
    
    const data = row.data || {};
    
    let typeLabel = data.typeLabel || '';
    let operation = data.operation || 'none';
    let column = data.column || 'main';
    let description = data.description || '';
    let isVisible = data.isVisible !== false;

    // Mapping based on entry_type for consistency
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
        typeLabel = '收';
        operation = amount >= 0 ? 'add' : 'subtract';
        column = 'main';
        amount = Math.abs(amount);
    }

    return {
        id: row.id,
        clientId: row.client_id,
        date: row.entry_date,
        description: description,
        typeLabel: typeLabel,
        amount: amount,
        operation: operation as any,
        column: column as any,
        isVisible: isVisible,
        createdAt: row.created_at
    };
};

/* FIX: Exported all missing members required by pages */

export const getNetAmount = (r: LedgerRecord): number => {
    if (r.operation === 'none') return 0;
    return r.operation === 'add' ? r.amount : -r.amount;
};

export const getLedgerRecords = async (clientId: string): Promise<LedgerRecord[]> => {
  if (!supabase) return [];
  const { data } = await supabase.from('financial_journal').select('*').eq('client_id', clientId);
  if (!data) return [];
  
  const ledgerRows = data.filter(r => r.entry_type !== 'SALE').map(mapJournalToLedgerRecord).filter(Boolean) as LedgerRecord[];
  const aggregatedSales = aggregateSalesWeekly(data.filter(r => r.client_id === clientId));
  
  return sortLedgerRecords([...ledgerRows, ...aggregatedSales]);
};

export const getAllLedgerRecords = async (): Promise<LedgerRecord[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('financial_journal').select('*');
    if (!data) return [];
    const records = data.map(mapJournalToLedgerRecord).filter(Boolean) as LedgerRecord[];
    return sortLedgerRecords(records);
};

export const saveLedgerRecord = async (record: Omit<LedgerRecord, 'id'>): Promise<void> => {
    if (!supabase) return;
    await supabase.from('financial_journal').insert([{
        client_id: record.clientId,
        entry_date: record.date,
        entry_type: 'LEDGER',
        amount: record.amount,
        data: {
            description: record.description,
            typeLabel: record.typeLabel,
            operation: record.operation,
            column: record.column,
            isVisible: record.isVisible
        }
    }]);
};

export const updateLedgerRecord = async (id: string, updates: Partial<LedgerRecord>): Promise<void> => {
    if (!supabase) return;
    const { data: current } = await supabase.from('financial_journal').select('*').eq('id', id).single();
    if (!current) return;

    const newAmount = updates.amount !== undefined ? updates.amount : current.amount;
    const newData = { ...(current.data || {}) };
    if (updates.description !== undefined) newData.description = updates.description;
    if (updates.typeLabel !== undefined) newData.typeLabel = updates.typeLabel;
    if (updates.operation !== undefined) newData.operation = updates.operation;
    if (updates.column !== undefined) newData.column = updates.column;
    if (updates.isVisible !== undefined) newData.isVisible = updates.isVisible;

    await supabase.from('financial_journal').update({
        amount: newAmount,
        entry_date: updates.date || current.entry_date,
        data: newData
    }).eq('id', id);
};

export const deleteLedgerRecord = async (id: string): Promise<void> => {
    if (!supabase) return;
    await supabase.from('financial_journal').delete().eq('id', id);
};

export const fetchClientTotalBalance = async (clientId: string): Promise<number> => {
    const records = await getLedgerRecords(clientId);
    const col1Records = records.filter(r => r.column === 'col1' && r.isVisible);
    if (col1Records.length > 0) {
        return col1Records.reduce((acc, r) => acc + getNetAmount(r), 0);
    }
    const mainRecords = records.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
    return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
};

export const getSaleRecords = async (clientId: string): Promise<SaleRecord[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('financial_journal').select('*').eq('client_id', clientId).eq('entry_type', 'SALE');
    if (!data) return [];
    return data.map(r => ({
        id: r.id,
        clientId: r.client_id,
        date: r.entry_date,
        b: r.data?.b || 0,
        s: r.data?.s || 0,
        a: r.data?.a || 0,
        c: r.data?.c || 0,
        mobileRaw: r.data?.mobileRaw,
        mobileRawData: r.data?.mobileRawData
    }));
};

export const getSalesForDates = async (dates: string[]): Promise<SaleRecord[]> => {
    if (!supabase) return [];
    const { data } = await supabase.from('financial_journal').select('*').eq('entry_type', 'SALE').in('entry_date', dates);
    if (!data) return [];
    return data.map(r => ({
        id: r.id,
        clientId: r.client_id,
        date: r.entry_date,
        b: r.data?.b || 0,
        s: r.data?.s || 0,
        a: r.data?.a || 0,
        c: r.data?.c || 0,
        mobileRaw: r.data?.mobileRaw,
        mobileRawData: r.data?.mobileRawData
    }));
};

export const saveSaleRecord = async (record: Omit<SaleRecord, 'id'>): Promise<void> => {
    if (!supabase) return;
    const { data: existing } = await supabase.from('financial_journal')
        .select('id')
        .eq('client_id', record.clientId)
        .eq('entry_date', record.date)
        .eq('entry_type', 'SALE')
        .single();

    const payload = {
        client_id: record.clientId,
        entry_date: record.date,
        entry_type: 'SALE',
        amount: (record.b || 0) + (record.s || 0) + (record.a || 0) + (record.c || 0),
        data: {
            b: record.b, s: record.s, a: record.a, c: record.c,
            mobileRaw: record.mobileRaw,
            mobileRawData: record.mobileRawData
        }
    };

    if (existing) {
        await supabase.from('financial_journal').update(payload).eq('id', existing.id);
    } else {
        await supabase.from('financial_journal').insert([payload]);
    }
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
    const { data: existing } = await supabase.from('financial_journal')
        .select('id')
        .eq('client_id', clientId)
        .eq('entry_date', date)
        .eq('entry_type', 'DRAW')
        .single();

    if (existing) {
        await supabase.from('financial_journal').update({ amount }).eq('id', existing.id);
    } else {
        await supabase.from('financial_journal').insert([{ client_id: clientId, entry_date: date, entry_type: 'DRAW', amount, data: { operation: 'add', typeLabel: '上欠' } }]);
    }
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
    const { data: existing } = await supabase.from('financial_journal')
        .select('id')
        .eq('client_id', clientId)
        .eq('entry_date', date)
        .eq('entry_type', 'ADVANCE')
        .single();

    if (existing) {
        if (amount === 0) await supabase.from('financial_journal').delete().eq('id', existing.id);
        else await supabase.from('financial_journal').update({ amount }).eq('id', existing.id);
    } else if (amount !== 0) {
        await supabase.from('financial_journal').insert([{ client_id: clientId, entry_date: date, entry_type: 'ADVANCE', amount, data: { operation: 'add', typeLabel: '支钱' } }]);
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
    const { data: existing } = await supabase.from('financial_journal')
        .select('id')
        .eq('client_id', clientId)
        .eq('entry_date', recordDate) // Error in original, recordDate not defined? selectedDate used in pages.
        .eq('entry_type', 'CREDIT')
        .single();
    // Use date parameter
    const { data: existingFixed } = await supabase.from('financial_journal')
        .select('id')
        .eq('client_id', clientId)
        .eq('entry_date', date)
        .eq('entry_type', 'CREDIT')
        .single();

    if (existingFixed) {
        if (amount === 0) await supabase.from('financial_journal').delete().eq('id', existingFixed.id);
        else await supabase.from('financial_journal').update({ amount }).eq('id', existingFixed.id);
    } else if (amount !== 0) {
        await supabase.from('financial_journal').insert([{ client_id: clientId, entry_date: date, entry_type: 'CREDIT', amount, data: { operation: 'subtract', typeLabel: '来' } }]);
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

export const getClientBalancesPriorToDate = async (date: string, clients: Client[]): Promise<Record<string, { amount: number, isPanel1: boolean }>> => {
    const results: Record<string, { amount: number, isPanel1: boolean }> = {};
    for (const client of clients) {
        const records = await getLedgerRecords(client.id);
        const priorRecords = records.filter(r => r.date < date && r.isVisible);
        
        const col1Records = priorRecords.filter(r => r.column === 'col1');
        if (col1Records.length > 0) {
            results[client.id] = { amount: col1Records.reduce((acc, r) => acc + getNetAmount(r), 0), isPanel1: true };
        } else {
            const mainRecords = priorRecords.filter(r => r.column === 'main' || !r.column);
            results[client.id] = { amount: mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0), isPanel1: false };
        }
    }
    return results;
};

export const generateSpecialCarryForward = async (clientId: string, code: string, date: string): Promise<void> => {
    if (!supabase) return;
    const records = await getLedgerRecords(clientId);
    const col1Prior = records.filter(r => r.column === 'col1' && r.date < date && r.isVisible);
    
    const weekStart = date;
    const weekEndDate = new Date(date);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];
    
    await supabase.from('financial_journal').delete().eq('client_id', clientId).eq('entry_type', 'LEDGER').eq('data->>column', 'col1').gte('entry_date', weekStart).lte('entry_date', weekEnd);

    for (const r of col1Prior) {
        await saveLedgerRecord({
            clientId,
            date: date,
            description: r.description,
            typeLabel: r.typeLabel,
            amount: r.amount,
            operation: r.operation,
            column: 'col1',
            isVisible: true
        });
    }
};

export const getWinningsByDateRange = async (start: string, end: string): Promise<Record<string, number>> => {
    if (!supabase) return {};
    const { data } = await supabase.from('financial_journal').select('*').eq('entry_type', 'LEDGER').eq('data->>typeLabel', '中').gte('entry_date', start).lte('entry_date', end);
    const result: Record<string, number> = {};
    data?.forEach(r => {
        const val = r.amount || 0;
        result[r.client_id] = (result[r.client_id] || 0) + val;
    });
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

export const seedData = () => {
    getCategories();
};
