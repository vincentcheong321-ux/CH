
import { Client, LedgerRecord, AssetRecord, TransactionCategory, DrawBalance, SaleRecord, CashAdvanceRecord } from '../types';
import { supabase } from '../supabaseClient';

const CLIENTS_KEY = 'ledger_clients';
const CATEGORIES_KEY = 'ledger_categories';

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

// --- 1. Categories ---
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

// --- 2. Clients ---
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

// --- 3. Ledger Records ---

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
        isVisible: true,
        createdAt: row.created_at,
        ...row.data
    };

    switch (row.entry_type) {
        case 'SALE':
            baseRecord.typeLabel = '收';
            baseRecord.id = `sale_${row.id}`;
            if (row.data) {
                const rawTotal = (Number(row.data.b) || 0) + (Number(row.data.s) || 0) + (Number(row.data.a) || 0) + (Number(row.data.c) || 0); 
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
            data: { 
                description: record.description, 
                typeLabel: record.typeLabel, 
                operation: record.operation, 
                column: record.column,
                sortWeight: (record as any).sortWeight || 0
            }
        }]).select();
        if (data && data[0]) return mapJournalToLedgerRecord(data[0]);
    }
    return {} as LedgerRecord;
};

export const updateLedgerRecord = async (id: string, updates: Partial<LedgerRecord>) => {
    if (supabase) {
        if (id.startsWith('sale_') || id.startsWith('adv_') || id.startsWith('draw_') || id.startsWith('cred_')) return;
        const { data: existing } = await supabase.from('financial_journal').select('data').eq('id', id).maybeSingle();
        const existingData = existing?.data || {};
        let signedAmount = updates.operation === 'add' ? updates.amount! : (updates.operation === 'subtract' ? -updates.amount! : 0);
        await supabase.from('financial_journal').update({
            amount: signedAmount,
            data: { 
                ...existingData,
                description: updates.description, 
                typeLabel: updates.typeLabel || existingData.typeLabel, 
                operation: updates.operation, 
                column: updates.column,
                sortWeight: (updates as any).sortWeight || 0
            }
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
        const netAmount = (record.b || 0) + (record.s || 0) + (record.a || 0) + (record.c || 0);
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

// --- Cash Transactions ---
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
        if (existing) await supabase.from('financial_journal').update({ amount }).eq('id', existing.id);
        else await supabase.from('financial_journal').insert({ client_id: clientId, entry_date: date, entry_type: 'ADVANCE', amount, data: {} });
    }
};

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
        if (existing) await supabase.from('financial_journal').update({ amount }).eq('id', existing.id);
        else await supabase.from('financial_journal').insert({ client_id: clientId, entry_date: date, entry_type: 'CREDIT', amount, data: {} });
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

export const saveDrawBalance = async (date: string, clientId: string, balance: number) => {
    if (supabase) {
        const { data: existing } = await supabase.from('financial_journal').select('id').eq('client_id', clientId).eq('entry_date', date).eq('entry_type', 'DRAW').maybeSingle();
        if (existing) await supabase.from('financial_journal').update({ amount: balance }).eq('id', existing.id);
        else await supabase.from('financial_journal').insert({ client_id: clientId, entry_date: date, entry_type: 'DRAW', amount: balance, data: {} });
    }
};

// --- CORE BALANCE CALCULATION LOGIC ---

/**
 * Calculates the total balance for a client as of a specific time.
 * @param excludeWins If true, ignores '中' records from Panel 1 (useful for carry-forward logic)
 */
const calculateBalanceForRecords = (records: LedgerRecord[], clientCode: string, excludeWins = false): number => {
    if (records.length === 0) return 0;
    
    const codeUpper = clientCode.toUpperCase();

    // Sort descending by date and creation time to find the latest snapshot
    const sorted = [...records].sort((a,b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    
    // 1. Identify the starting snapshot (the last DRAW record in Main)
    const latestSnapshot = sorted.find(r => 
        (r.id.startsWith('draw_') || r.typeLabel === '上欠') && (r.column === 'main' || !r.column)
    );

    // 2. Filter records to only those in the "current cycle" (from snapshot onwards)
    let periodRecords = records;
    if (latestSnapshot) {
        periodRecords = records.filter(r => {
            if (r.id === latestSnapshot.id) return true;
            if (r.date > latestSnapshot.date) return true;
            // Records on same day but created after the snapshot
            if (r.date === latestSnapshot.date && r.createdAt && latestSnapshot.createdAt && r.createdAt > latestSnapshot.createdAt) return true;
            return false;
        });
    }

    // 3. PRIORITY LOGIC (Matches UI Header)
    
    // Rule: C19 ignores Panel 1 for its "Total Balance" header/summary (Main Ledger starts fresh at 0)
    // C19 special carry-forward rows in Panel 1 are display-only and shouldn't affect the net balance tally.
    if (codeUpper === 'C19') {
        const mainRecords = periodRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
        return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
    }

    // Rule: Check Panel 1
    const col1Records = periodRecords.filter(r => r.column === 'col1' && r.isVisible);
    
    // CHECK: Does Panel 1 have "Real" transactions (Non-Wins)?
    // If Panel 1 has ONLY wins, we treat it as "Display Only" for wins, and rely on Main Ledger for the actual balance 
    // (since wins are double-posted to Main Ledger).
    // If Panel 1 has other stuff (like manual entries, sales), we assume Panel 1 is the Master Ledger.
    const col1HasNonWins = col1Records.some(r => r.typeLabel !== '中');

    if (col1HasNonWins) {
        // Panel 1 is Master.
        // User says "if happen to have 中 in panel 1, please do not bring that amount to 上欠".
        // This implies for Carry Forward (when excludeWins is true), we exclude the win amount from the sum.
        // If excludeWins is false (live view), we include everything in Panel 1.
        const recsToSum = excludeWins ? col1Records.filter(r => r.typeLabel !== '中') : col1Records;
        return recsToSum.reduce((acc, r) => acc + getNetAmount(r), 0);
    }

    // Rule: C06 uses Col2
    if (codeUpper === 'C06') {
        const col2Records = periodRecords.filter(r => r.column === 'col2' && r.isVisible);
        if (col2Records.length > 0) return col2Records.reduce((acc, r) => acc + getNetAmount(r), 0);
    }

    // Default: Main Ledger
    // If Panel 1 was empty OR only had Wins, we fall here.
    const mainRecords = periodRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
    return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
};

export const fetchClientTotalBalance = async (clientId: string): Promise<number> => {
    const records = await getLedgerRecords(clientId);
    const clients = await getClients();
    const client = clients.find(c => c.id === clientId);
    // Real-time fetching uses full calculation (include wins)
    return calculateBalanceForRecords(records, (client?.code || '').toUpperCase(), false);
};

export const getClientBalancesPriorToDate = async (dateLimit: string, clients?: Client[]): Promise<Record<string, number>> => {
    if (!supabase) return {};
    // Get ALL records before the start of the week
    const { data } = await supabase.from('financial_journal').select('*').lt('entry_date', dateLimit).order('entry_date', { ascending: true });
    if (!data) return {};

    const allRecords = data.map(mapJournalToLedgerRecord);
    const balances: Record<string, number> = {};

    clients?.forEach(client => {
        const clientRecs = allRecords.filter(r => r.clientId === client.id);
        // Generation fetching EXCLUDES wins from Panel 1 per requirement
        balances[client.id] = calculateBalanceForRecords(clientRecs, (client.code || '').toUpperCase(), true);
    });

    return balances;
};

// --- SPECIAL CARRY FORWARD LOGIC ---
export const generateSpecialCarryForward = async (clientId: string, clientCode: string, targetDate: string): Promise<number> => {
    if (!supabase) return 0;
    
    // Lookback constraint (safety net)
    const lookbackDate = new Date(targetDate);
    lookbackDate.setDate(lookbackDate.getDate() - 90);
    const lookbackStr = lookbackDate.toISOString().split('T')[0];

    // 1. Find the latest "Checkpoint" (Carry Forward) date within the lookback period
    // This prevents fetching duplicates from older periods that were already carried forward.
    const { data: snapshotCheck } = await supabase.from('financial_journal')
       .select('entry_date')
       .eq('client_id', clientId)
       .lt('entry_date', targetDate)
       .gte('entry_date', lookbackStr)
       .contains('data', { column: 'col1', isCarryForward: true })
       .order('entry_date', { ascending: false })
       .limit(1);

    let queryStartDate = lookbackStr;
    if (snapshotCheck && snapshotCheck.length > 0) {
        queryStartDate = snapshotCheck[0].entry_date;
    }

    // 2. Fetch records from the Checkpoint onwards
    const { data: recentRecords } = await supabase.from('financial_journal')
        .select('*')
        .eq('client_id', clientId)
        .lt('entry_date', targetDate)
        .gte('entry_date', queryStartDate);

    if (!recentRecords || recentRecords.length === 0) return 0;

    const col1Records = recentRecords.filter(r => r.data?.column === 'col1').map(mapJournalToLedgerRecord);
    if (col1Records.length === 0) return 0;

    // 3. Sort and Pick Latest 5
    // sortLedgerRecords sorts by Date ASC (Oldest -> Newest)
    const sorted = sortLedgerRecords(col1Records);
    
    let rowsToCopy: LedgerRecord[] = [];
    const code = clientCode.toUpperCase();

    if (code === 'Z21') {
        rowsToCopy = sorted.slice(-4).map((r, i) => i === 0 ? { ...r, operation: 'none' as const } : r);
    } else if (code === 'C19') {
        // C19: Latest 5
        rowsToCopy = sorted.slice(-5);
    } else {
        return 0;
    }

    // 4. Insert New Records
    const sum = rowsToCopy.reduce((acc, r) => acc + getNetAmount(r), 0);
    let weightIdx = 0;
    for (const r of rowsToCopy) {
        let signedAmount = r.operation === 'add' ? r.amount : (r.operation === 'subtract' ? -r.amount : r.amount);
        
        // Idempotency check: Don't insert if already exists for THIS target date
        const { data: dupes } = await supabase.from('financial_journal')
            .select('id')
            .eq('client_id', clientId)
            .eq('entry_date', targetDate)
            .contains('data', { description: r.description, column: 'col1', sortWeight: weightIdx }); 
            
        if (!dupes || dupes.length === 0) {
            await supabase.from('financial_journal').insert({
                client_id: clientId, entry_date: targetDate, entry_type: 'MANUAL', amount: signedAmount,
                data: { description: r.description, typeLabel: r.typeLabel, operation: r.operation, column: 'col1', isCarryForward: true, sortWeight: weightIdx }
            });
            
            // Z21 Panel 2 logic preservation
            if (code === 'Z21' && weightIdx === 0) {
                 const { data: dupesP2 } = await supabase.from('financial_journal').select('id').eq('client_id', clientId).eq('entry_date', targetDate).contains('data', { description: r.description, column: 'col2' });
                 if (!dupesP2 || dupesP2.length === 0) {
                     await supabase.from('financial_journal').insert({
                        client_id: clientId, entry_date: targetDate, entry_type: 'MANUAL', amount: r.amount,
                        data: { description: r.description, typeLabel: '收', operation: 'add', column: 'col2', isCarryForward: true, sortWeight: 0 }
                    });
                 }
            }
        }
        weightIdx++;
    }
    return sum;
};

// --- Other Services ---
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
export const getWinningsByDateRange = async (startDate: string, endDate: string): Promise<Record<string, number>> => {
    if (supabase) {
        const { data } = await supabase.from('financial_journal').select('client_id, amount, data').gte('entry_date', startDate).lte('entry_date', endDate).eq('entry_type', 'MANUAL');
        const map: Record<string, number> = {};
        data?.forEach((row: any) => {
            if (row.data?.typeLabel === '中' && row.data?.column === 'main') map[row.client_id] = (map[row.client_id] || 0) + Math.abs(row.amount);
        });
        return map;
    }
    return {};
};
export const getNetAmount = (r: LedgerRecord): number => {
  if (r.operation === 'none') return 0;
  return r.operation === 'add' ? r.amount : -r.amount;
};
const ASSETS_KEY = 'ledger_assets';
export const getAssetRecords = (): AssetRecord[] => JSON.parse(localStorage.getItem(ASSETS_KEY) || '[]');
export const saveAssetRecord = (record: Omit<AssetRecord, 'id'>): AssetRecord => {
  const all = getAssetRecords();
  const newRecord = { ...record, id: generateId() };
  localStorage.setItem(ASSETS_KEY, JSON.stringify([...all, newRecord]));
  return newRecord;
};
export const seedData = () => { getCategories(); };
