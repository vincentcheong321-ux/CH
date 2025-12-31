import { Client, LedgerRecord, AssetRecord, TransactionCategory, DrawBalance, SaleRecord, CashAdvanceRecord } from '../types';
import { supabase } from '../supabaseClient';

const CLIENTS_KEY = 'ledger_clients';
const CATEGORIES_KEY = 'ledger_categories';

// Helper to generate local IDs if offline (fallback)
const generateId = () => Math.random().toString(36).substr(2, 9);

// --- Helper: Date Score Extraction (Year-Aware) ---
// Extracts DD/MM or DD.MM from text and returns a comparable number (YYYYMMDD)
const getNoteDateScore = (text: string, entryDateStr: string) => {
    // Regex for DD/MM or DD.MM
    const match = text.match(/(\d{1,2})[\/\.](\d{1,2})/); 
    if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        
        const entryDate = new Date(entryDateStr);
        let year = entryDate.getFullYear();
        const entryMonth = entryDate.getMonth() + 1; // 1-12

        // Cross-year logic:
        // If note month is high (e.g. 10, 11, 12) but entry month is low (e.g. 1, 2),
        // the note refers to the previous year.
        if (month >= 10 && entryMonth <= 3) {
            year -= 1;
        } 
        // If note month is low (e.g. 1, 2) but entry month is high (e.g. 11, 12),
        // the note refers to the following year.
        else if (month <= 3 && entryMonth >= 10) {
            year += 1;
        }

        // Return a comparable number: YYYYMMDD
        return year * 10000 + month * 100 + day;
    }
    return 0;
};

// Unified Sorter for Records
const sortLedgerRecords = (records: LedgerRecord[]) => {
    records.sort((a, b) => {
        // 1. Note Date Score (DD/MM in description/label) - Primary sorting for visual sequence
        const scoreA = getNoteDateScore(`${a.typeLabel} ${a.description}`, a.date);
        const scoreB = getNoteDateScore(`${b.typeLabel} ${b.description}`, b.date);
        
        if (scoreA !== 0 && scoreB !== 0) {
            return scoreA - scoreB;
        }
        
        // If one has a note date and other doesn't, put dated ones first
        if (scoreA !== 0) return -1;
        if (scoreB !== 0) return 1;

        // 2. Database/Entry Date (Secondary)
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        
        // 3. Priority Grouping (Tie breaker)
        const pA = getRecordSortPriority(a);
        const pB = getRecordSortPriority(b);
        return pA - pB;
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
    { id: '8', label: '电', operation: 'add', color: 'bg-green-100 text-green-800' },
  ];

  if (categories.length === 0) {
    categories = defaults;
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } else {
    let updated = false;
    if (!categories.find(c => c.label === '上欠')) { categories.push({ id: generateId(), label: '上欠', operation: 'add', color: 'bg-green-100 text-green-800' }); updated = true; }
    if (!categories.find(c => c.label === '%')) { categories.push({ id: generateId(), label: '%', operation: 'subtract', color: 'bg-red-100 text-red-800' }); updated = true; }
    if (!categories.find(c => c.label === '来')) { categories.push({ id: generateId(), label: '来', operation: 'subtract', color: 'bg-red-100 text-red-800' }); updated = true; }
    const dianIndex = categories.findIndex(c => c.label === '电');
    if (dianIndex === -1) { categories.push({ id: generateId(), label: '电', operation: 'add', color: 'bg-green-100 text-green-800' }); updated = true; } 
    categories = categories.map(c => {
        if (c.operation === 'add' && c.color.includes('bg-blue-100')) { updated = true; return { ...c, color: 'bg-green-100 text-green-800' }; }
        if (c.label === '出' && c.color.includes('bg-orange-100')) { updated = true; return { ...c, color: 'bg-red-100 text-red-800' }; }
        return c;
    });
    if (updated) localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
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

// --- 3. Unified Financial Journal ---

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

    switch (row.entry_type) {
        case 'SALE':
            baseRecord.typeLabel = '收';
            baseRecord.id = `sale_${row.id}`;
            if (row.data) {
                const b = Number(row.data.b) || 0;
                const s = Number(row.data.s) || 0;
                const a = Number(row.data.a) || 0;
                const c = Number(row.data.c) || 0;
                const rawTotal = b + s + a + c; 
                const finalTotal = (!row.data.mobileRaw && !row.data.mobileRawData) ? rawTotal * 0.86 : rawTotal;
                baseRecord.amount = Math.abs(finalTotal);
                baseRecord.operation = finalTotal >= 0 ? 'add' : 'subtract';
            }
            baseRecord.column = 'main';
            break;
        case 'ADVANCE':
            baseRecord.typeLabel = '支';
            baseRecord.id = `adv_${row.id}`;
            baseRecord.operation = 'add';
            baseRecord.column = 'main';
            break;
        case 'CREDIT':
            baseRecord.typeLabel = '来';
            baseRecord.id = `cred_${row.id}`;
            baseRecord.operation = 'subtract';
            baseRecord.column = 'main';
            break;
        case 'DRAW':
            baseRecord.typeLabel = '上欠';
            baseRecord.id = `draw_${row.id}`;
            baseRecord.operation = row.amount >= 0 ? 'add' : 'subtract'; 
            baseRecord.column = 'main';
            break;
    }
    return baseRecord;
};

export const getLedgerRecords = async (clientId: string): Promise<LedgerRecord[]> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('*').eq('client_id', clientId);
        if (data) {
            const records = data.map(mapJournalToLedgerRecord);
            return sortLedgerRecords(records);
        }
    }
    return [];
};

export const getAllLedgerRecords = async (): Promise<LedgerRecord[]> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('*');
        if (data) {
            const records = data.map(mapJournalToLedgerRecord);
            return sortLedgerRecords(records);
        }
    }
    return [];
};

export const saveLedgerRecord = async (record: Omit<LedgerRecord, 'id'>): Promise<LedgerRecord> => {
    if (supabase) {
        let signedAmount = record.operation === 'add' ? record.amount : (record.operation === 'subtract' ? -record.amount : 0);
        const { data } = await supabase.from('financial_journal').insert([{
            client_id: record.clientId,
            entry_date: record.date,
            entry_type: 'MANUAL',
            amount: signedAmount,
            data: { description: record.description, typeLabel: record.typeLabel, operation: record.operation, column: record.column }
        }]).select();
        if (data && data[0]) return mapJournalToLedgerRecord(data[0]);
    }
    return {} as LedgerRecord;
};

export const updateLedgerRecord = async (id: string, updates: Partial<LedgerRecord>) => {
    if (supabase) {
        if (id.startsWith('sale_') || id.startsWith('adv_') || id.startsWith('draw_') || id.startsWith('cred_')) return;
        let signedAmount = updates.operation === 'add' ? updates.amount! : (updates.operation === 'subtract' ? -updates.amount! : 0);
        await supabase.from('financial_journal').update({
            amount: signedAmount,
            data: { description: updates.description, typeLabel: updates.typeLabel, operation: updates.operation, column: updates.column }
        }).eq('id', id);
    }
};

export const deleteLedgerRecord = async (id: string) => {
    if (supabase) {
        if (id.startsWith('sale_') || id.startsWith('adv_') || id.startsWith('draw_') || id.startsWith('cred_')) return;
        await supabase.from('financial_journal').delete().eq('id', id);
    }
};

// --- Sales ---
export const getSaleRecords = async (clientId: string): Promise<SaleRecord[]> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('*').eq('client_id', clientId).eq('entry_type', 'SALE');
        if (data) return data.map((row: any) => ({
            id: row.id, clientId: row.client_id, date: row.entry_date,
            b: row.data?.b || 0, s: row.data?.s || 0, a: row.data?.a || 0, c: row.data?.c || 0,
            mobileRaw: row.data?.mobileRaw, mobileRawData: row.data?.mobileRawData
        }));
    }
    return [];
};

export const getSalesForDates = async (dates: string[]): Promise<SaleRecord[]> => {
    if (supabase && dates.length > 0) {
        const { data } = await supabase.from('financial_journal').select('*').eq('entry_type', 'SALE').in('entry_date', dates);
        if (data) return data.map((row: any) => ({
            id: row.id, clientId: row.client_id, date: row.entry_date,
            b: row.data?.b || 0, s: row.data?.s || 0, a: row.data?.a || 0, c: row.data?.c || 0,
            mobileRaw: row.data?.mobileRaw, mobileRawData: row.data?.mobileRawData
        }));
    }
    return [];
};

export const saveSaleRecord = async (record: Omit<SaleRecord, 'id'>) => {
    if (supabase) {
        const netAmount = record.b + record.s + record.a + record.c;
        const { data: existing } = await supabase.from('financial_journal').select('id, data').eq('client_id', record.clientId).eq('entry_date', record.date).eq('entry_type', 'SALE').maybeSingle();
        if (existing) {
             const newData = { ...existing.data, b: record.b, s: record.s, a: record.a, c: record.c };
             if (record.mobileRaw !== undefined) newData.mobileRaw = record.mobileRaw;
             if (record.mobileRawData !== undefined) newData.mobileRawData = record.mobileRawData;
             await supabase.from('financial_journal').update({ amount: netAmount, data: newData }).eq('id', existing.id);
        } else {
             await supabase.from('financial_journal').insert({
                client_id: record.clientId, entry_date: record.date, entry_type: 'SALE', amount: netAmount,
                data: { b: record.b, s: record.s, a: record.a, c: record.c, mobileRaw: record.mobileRaw, mobileRawData: record.mobileRawData }
             });
        }
    }
};

// --- Cash Advance ---
export const getCashAdvances = async (date: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('client_id, amount').eq('entry_date', date).eq('entry_type', 'ADVANCE');
        const map: Record<string, number> = {};
        data?.forEach((row: any) => { map[row.client_id] = row.amount; });
        return map;
    }
    return {};
};

export const saveCashAdvance = async (date: string, clientId: string, amount: number) => {
    if (supabase) {
        const { data: existing } = await supabase.from('financial_journal').select('id').eq('client_id', clientId).eq('entry_date', date).eq('entry_type', 'ADVANCE').maybeSingle();
        if (existing) await supabase.from('financial_journal').update({ amount: amount }).eq('id', existing.id);
        else await supabase.from('financial_journal').insert({ client_id: clientId, entry_date: date, entry_type: 'ADVANCE', amount: amount, data: {} });
    }
};

// --- Cash Credit ---
export const getCashCredits = async (date: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('client_id, amount').eq('entry_date', date).eq('entry_type', 'CREDIT');
        const map: Record<string, number> = {};
        data?.forEach((row: any) => { map[row.client_id] = row.amount; });
        return map;
    }
    return {};
};

export const saveCashCredit = async (date: string, clientId: string, amount: number) => {
    if (supabase) {
        const { data: existing } = await supabase.from('financial_journal').select('id').eq('client_id', clientId).eq('entry_date', date).eq('entry_type', 'CREDIT').maybeSingle();
        if (existing) await supabase.from('financial_journal').update({ amount: amount }).eq('id', existing.id);
        else await supabase.from('financial_journal').insert({ client_id: clientId, entry_date: date, entry_type: 'CREDIT', amount: amount, data: {} });
    }
};

// --- Draw Balance ---
export const getDrawBalances = async (date: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('client_id, amount').eq('entry_date', date).eq('entry_type', 'DRAW');
        const map: Record<string, number> = {};
        data?.forEach((row: any) => { map[row.client_id] = row.amount; });
        return map;
    }
    return {};
};

export const getAllDrawRecords = async (): Promise<DrawBalance[]> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('*').eq('entry_type', 'DRAW');
        return data?.map((row: any) => ({ clientId: row.client_id, date: row.entry_date, balance: row.amount })) || [];
    }
    return [];
};

export const saveDrawBalance = async (date: string, clientId: string, balance: number) => {
    if (supabase) {
        const { data: existing } = await supabase.from('financial_journal').select('id').eq('client_id', clientId).eq('entry_date', date).eq('entry_type', 'DRAW').maybeSingle();
        if (existing) await supabase.from('financial_journal').update({ amount: balance }).eq('id', existing.id);
        else await supabase.from('financial_journal').insert({ client_id: clientId, entry_date: date, entry_type: 'DRAW', amount: balance, data: {} });
    }
};

// --- SPECIAL CARRY FORWARD LOGIC (Z21 & C19) ---
export const generateSpecialCarryForward = async (clientId: string, clientCode: string, targetDate: string): Promise<number> => {
    if (!supabase) return 0;
    const lookbackDate = new Date(targetDate);
    lookbackDate.setDate(lookbackDate.getDate() - 90);
    const lookbackStr = lookbackDate.toISOString().split('T')[0];

    const { data: recentRecords } = await supabase.from('financial_journal').select('*').eq('client_id', clientId).lt('entry_date', targetDate).gte('entry_date', lookbackStr);
    if (!recentRecords || recentRecords.length === 0) return 0;

    const col1Records = recentRecords.filter(r => r.data?.column === 'col1');
    if (col1Records.length === 0) return 0;

    col1Records.sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
    const latestDate = new Date(col1Records[0].entry_date);
    const clusterStart = new Date(latestDate);
    clusterStart.setDate(clusterStart.getDate() - 7);
    
    const mappedCluster = col1Records.filter(r => {
        const d = new Date(r.entry_date);
        return d >= clusterStart && d <= latestDate;
    }).map(mapJournalToLedgerRecord);

    // ASCENDING Chronological note-sort
    const sortedCluster = sortLedgerRecords(mappedCluster);

    let rowsToCopy: LedgerRecord[] = [];
    if (clientCode.toUpperCase() === 'Z21') {
        // Z21 Special Logic: Bring 5 records, first (oldest) is gray (operation: none)
        rowsToCopy = sortedCluster.slice(-5).map((rec, idx) => 
            idx === 0 ? { ...rec, operation: 'none' as const } : rec
        );
    } else if (clientCode.toUpperCase() === 'C19') {
        // C19 Logic: Bring 5 records
        rowsToCopy = sortedCluster.slice(-5);
    } else { return 0; }

    const sum = rowsToCopy.reduce((acc, r) => acc + getNetAmount(r), 0);
    for (const r of rowsToCopy) {
        let signedAmount = r.operation === 'add' ? r.amount : (r.operation === 'subtract' ? -r.amount : 0);
        const { data: dupes } = await supabase.from('financial_journal').select('id').eq('client_id', clientId).eq('entry_date', targetDate).eq('amount', signedAmount).contains('data', { description: r.description, column: 'col1' }); 
        if (!dupes || dupes.length === 0) {
            await supabase.from('financial_journal').insert({
                client_id: clientId, entry_date: targetDate, entry_type: 'MANUAL', amount: signedAmount,
                data: { description: r.description, typeLabel: r.typeLabel, operation: r.operation, column: 'col1', isCarryForward: true }
            });
        }
    }
    return sum;
};

// --- Mobile Report ---
export const saveMobileReportHistory = async (date: string, rawData: any[]) => {
    if (supabase) await supabase.from('mobile_report_history').insert([{ report_date: date, json_data: rawData }]);
};

export const getMobileReportHistory = async () => {
    if (supabase) {
        const { data } = await supabase.from('mobile_report_history').select('*').order('created_at', { ascending: false });
        return data || [];
    }
    return [];
};

// --- Winnings ---
export const getWinningsByDate = async (date: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('client_id, amount, data').eq('entry_date', date).eq('entry_type', 'MANUAL');
        const map: Record<string, number> = {};
        data?.forEach((row: any) => {
            if (row.data?.typeLabel === '中' && row.data?.column === 'main') {
                map[row.client_id] = (map[row.client_id] || 0) + Math.abs(row.amount);
            }
        });
        return map;
    }
    return {};
};

export const getWinningsByDateRange = async (startDate: string, endDate: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('client_id, amount, data').gte('entry_date', startDate).lte('entry_date', endDate).eq('entry_type', 'MANUAL');
        const map: Record<string, number> = {};
        data?.forEach((row: any) => {
            if (row.data?.typeLabel === '中' && row.data?.column === 'main') {
                map[row.client_id] = (map[row.client_id] || 0) + Math.abs(row.amount);
            }
        });
        return map;
    }
    return {};
};

// --- Global Balance ---
export const fetchClientTotalBalance = async (clientId: string): Promise<number> => {
    const records = await getLedgerRecords(clientId);
    if (records.length === 0) return 0;
    const clients = await getClients();
    const client = clients.find(c => c.id === clientId);
    const clientCode = client?.code?.toUpperCase() || '';

    // Snapshot search (Descending)
    const sortedForSnapshot = [...records].sort((a,b) => b.date.localeCompare(a.date));
    const latestSnapshot = sortedForSnapshot.find(r => r.id.startsWith('draw_') || r.typeLabel === '上欠');
    
    let effectiveRecords = records;
    if (latestSnapshot) {
        effectiveRecords = records.filter(r => {
            if (r.id === latestSnapshot.id) return true; 
            if (r.date > latestSnapshot.date) return true; 
            // PREVENT DOUBLING: If same date as snapshot, ONLY keep if it's the snapshot itself.
            // This assumes snapshot represents the final balance for its specific date.
            return false;
        });
    }

    if (clientCode === 'C06') {
        const col2Records = effectiveRecords.filter(r => r.column === 'col2' && r.isVisible);
        if (col2Records.length > 0) return col2Records.reduce((acc, r) => acc + getNetAmount(r), 0);
    } else {
        const col1Records = effectiveRecords.filter(r => r.column === 'col1' && r.isVisible);
        if (col1Records.length > 0) return col1Records.reduce((acc, r) => acc + getNetAmount(r), 0);
    }
    
    const mainRecords = effectiveRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
    return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
};

export const getClientBalancesPriorToDate = async (dateLimit: string, clients?: Client[]): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('*').lt('entry_date', dateLimit).order('entry_date', { ascending: true });
        if (!data) return {};

        const clientRecords: Record<string, LedgerRecord[]> = {};
        data.forEach(row => {
            const record = mapJournalToLedgerRecord(row);
            if (!clientRecords[record.clientId]) clientRecords[record.clientId] = [];
            clientRecords[record.clientId].push(record);
        });

        const balances: Record<string, number> = {};
        Object.keys(clientRecords).forEach(clientId => {
            const records = clientRecords[clientId];
            const client = clients?.find(c => c.id === clientId);
            const clientCode = client?.code?.toUpperCase() || '';
            const sortedForSnapshot = [...records].sort((a,b) => b.date.localeCompare(a.date));
            const latestSnapshot = sortedForSnapshot.find(r => r.id.startsWith('draw_') || r.typeLabel === '上欠');
            
            let effectiveRecords = records;
            if (latestSnapshot) {
                effectiveRecords = records.filter(r => {
                    if (r.id === latestSnapshot.id) return true; 
                    if (r.date > latestSnapshot.date) return true;
                    return false;
                });
            }

            if (clientCode === 'C06') {
                const col2Records = effectiveRecords.filter(r => r.column === 'col2' && r.isVisible);
                balances[clientId] = col2Records.length > 0 ? col2Records.reduce((acc, r) => acc + getNetAmount(r), 0) : effectiveRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible).reduce((acc, r) => acc + getNetAmount(r), 0);
            } else if (clientCode === 'C13' || clientCode === 'Z21' || clientCode === 'C19') {
                const col1Records = effectiveRecords.filter(r => r.column === 'col1' && r.isVisible);
                balances[clientId] = col1Records.length > 0 ? col1Records.reduce((acc, r) => acc + getNetAmount(r), 0) : effectiveRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible).reduce((acc, r) => acc + getNetAmount(r), 0);
            } else {
                balances[clientId] = effectiveRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible).reduce((acc, r) => acc + getNetAmount(r), 0);
            }
        });
        return balances;
    }
    return {};
};

export const getTotalDrawReceivables = async (): Promise<number> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('amount');
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
export const seedInitialClients = async () => {};
export const seedData = () => { getCategories(); };