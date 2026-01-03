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
        if (month >= 10 && entryMonth <= 3) {
            year -= 1;
        } 
        else if (month <= 3 && entryMonth >= 10) {
            year += 1;
        }

        return year * 10000 + month * 100 + day;
    }
    return 0;
};

// Unified Sorter for Records
const sortLedgerRecords = (records: LedgerRecord[]) => {
    records.sort((a, b) => {
        // 1. Note Date Score (DD/MM in description/label)
        const scoreA = getNoteDateScore(`${a.typeLabel} ${a.description}`, a.date);
        const scoreB = getNoteDateScore(`${b.typeLabel} ${b.description}`, b.date);
        
        if (scoreA !== 0 && scoreB !== 0) {
            if (scoreA !== scoreB) return scoreA - scoreB;
        } else if (scoreA !== 0) {
            return -1;
        } else if (scoreB !== 0) {
            return 1;
        }

        // 2. Database/Entry Date
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        
        // 3. Priority Grouping
        const pA = getRecordSortPriority(a);
        const pB = getRecordSortPriority(b);
        if (pA !== pB) return pA - pB;

        // 4. Sort Weight
        const swA = (a as any).sortWeight || 0;
        const swB = (b as any).sortWeight || 0;
        if (swA !== swB) return swA - swB;

        // 5. Creation Time Tie-breaker
        if (a.createdAt && b.createdAt) {
            return a.createdAt.localeCompare(b.createdAt);
        }

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

// --- 1. Categories (Local Only) ---
export const getCategories = (): TransactionCategory[] => {
  const data = localStorage.getItem(CATEGORIES_KEY);
  let categories: TransactionCategory[] = data ? JSON.parse(data) : [];

  const defaults: TransactionCategory[] = [
    { id: '1', label: '收', operation: 'add', color: 'bg-green-100 text-green-800' },      // Pos 0 (L)
    { id: '2', label: '中', operation: 'subtract', color: 'bg-red-100 text-red-800' },    // Pos 1 (R)
    { id: '4', label: '支钱', operation: 'add', color: 'bg-green-100 text-green-800' },   // Pos 2 (L)
    { id: '3', label: '出', operation: 'subtract', color: 'bg-red-100 text-red-800' },    // Pos 3 (R)
    { id: '5', label: '上欠', operation: 'add', color: 'bg-green-100 text-green-800' },   // Pos 4 (L)
    { id: '6', label: '%', operation: 'subtract', color: 'bg-red-100 text-red-800' },      // Pos 5 (R)
    { id: '8', label: '电', operation: 'add', color: 'bg-green-100 text-green-800' },      // Pos 6 (L)
    { id: '7', label: '来', operation: 'subtract', color: 'bg-red-100 text-red-800' },    // Pos 7 (R)
  ];

  if (categories.length === 0) {
    categories = defaults;
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } else {
    // Interleave sorting to ensure Addition on left, Deduction on right in 2-column grid
    const adds = categories.filter(c => c.operation === 'add' || c.operation === 'none');
    const subs = categories.filter(c => c.operation === 'subtract');
    
    // Sort additions by common labels first
    const preferredAddsOrder = ['收', '支钱', '上欠', '电', '红', '补', '欠'];
    adds.sort((a,b) => {
        const idxA = preferredAddsOrder.indexOf(a.label);
        const idxB = preferredAddsOrder.indexOf(b.label);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.label.localeCompare(b.label);
    });

    const preferredSubsOrder = ['中', '出', '%', '来', '收', '中'];
    subs.sort((a,b) => {
        const idxA = preferredSubsOrder.indexOf(a.label);
        const idxB = preferredAddsOrder.indexOf(b.label); 
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.label.localeCompare(b.label);
    });

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
        isVisible: true,
        createdAt: row.created_at,
        ...row.data
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

// Synchronous helper for ClientList display - now STRICTLY Main Ledger unless C06 (handled via manual check if needed, but here generic)
export const getClientBalance = (clientId: string): number => {
  // NOTE: This function reads from local storage 'ledger_records' key if used in legacy mode, 
  // but since we are shifting to Supabase, this might return 0 if 'ledger_records' is empty.
  // However, for completeness with the requested logic change:
  const data = localStorage.getItem('ledger_records');
  const allRecords: any[] = data ? JSON.parse(data) : [];
  const records = allRecords
    .filter(r => r.clientId === clientId)
    .map(r => ({ ...r, column: r.column || 'main' } as LedgerRecord));

  // OLD LOGIC REMOVED: No longer prioritizing Panel 1 (col1).
  
  // New Logic: Main Ledger Only
  const mainRecords = records.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
  return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
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
        let signedAmount = updates.operation === 'add' ? updates.amount! : (updates.operation === 'subtract' ? -updates.amount! : 0);
        await supabase.from('financial_journal').update({
            amount: signedAmount,
            data: { 
                description: updates.description, 
                typeLabel: updates.typeLabel, 
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

    const sortedCluster = sortLedgerRecords(mappedCluster);

    let rowsToCopy: LedgerRecord[] = [];
    if (clientCode.toUpperCase() === 'Z21') {
        // Z21: Exactly 4 latest records (adjusted from 5), first oldest is marked down
        rowsToCopy = sortedCluster.slice(-4).map((rec, idx) => 
            idx === 0 ? { ...rec, operation: 'none' as const } : rec
        );
    } else if (clientCode.toUpperCase() === 'C19') {
        // C19: Exactly 6 latest records (updated from 5)
        rowsToCopy = sortedCluster.slice(-6);
    } else { return 0; }

    const sum = rowsToCopy.reduce((acc, r) => acc + getNetAmount(r), 0);
    
    let weightIdx = 0;
    for (const r of rowsToCopy) {
        let signedAmount = r.operation === 'add' ? r.amount : (r.operation === 'subtract' ? -r.amount : r.amount);
        
        // Strict check by description + targetDate + column to prevent 'extra record' issue
        const { data: dupes } = await supabase.from('financial_journal').select('id')
            .eq('client_id', clientId)
            .eq('entry_date', targetDate)
            .contains('data', { description: r.description, column: 'col1', sortWeight: weightIdx }); 
        
        if (!dupes || dupes.length === 0) {
            await supabase.from('financial_journal').insert({
                client_id: clientId, entry_date: targetDate, entry_type: 'MANUAL', amount: signedAmount,
                data: { 
                    description: r.description, 
                    typeLabel: r.typeLabel, 
                    operation: r.operation, 
                    column: 'col1', 
                    isCarryForward: true,
                    sortWeight: weightIdx 
                }
            });

            // NEW CONDITION: For Z21, add the marked down oldest first record to Panel 2 as a '收' record
            if (clientCode.toUpperCase() === 'Z21' && weightIdx === 0) {
                 const { data: dupesP2 } = await supabase.from('financial_journal').select('id')
                    .eq('client_id', clientId)
                    .eq('entry_date', targetDate)
                    .contains('data', { description: r.description, column: 'col2' });
                 
                 if (!dupesP2 || dupesP2.length === 0) {
                     await supabase.from('financial_journal').insert({
                        client_id: clientId, entry_date: targetDate, entry_type: 'MANUAL', amount: r.amount,
                        data: { 
                            description: r.description, 
                            typeLabel: '收', 
                            operation: 'add', 
                            column: 'col2', 
                            isCarryForward: true,
                            sortWeight: 0 
                        }
                    });
                 }
            }
        }
        weightIdx++;
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

    const sortedForSnapshot = [...records].sort((a,b) => b.date.localeCompare(a.date));
    
    // STRICTLY find a snapshot that belongs to the MAIN ledger.
    // This prevents picking up a P1 '上欠' record and calculating incorrectly.
    const latestSnapshot = sortedForSnapshot.find(r => 
        (r.id.startsWith('draw_') || r.typeLabel === '上欠') && 
        (r.column === 'main' || !r.column)
    );
    
    let effectiveRecords = records;
    if (latestSnapshot) {
        effectiveRecords = records.filter(r => {
            if (r.id === latestSnapshot.id) return true; // Always include the snapshot
            if (r.date > latestSnapshot.date) return true; // Include later dates
            // Include records on SAME DAY as snapshot, as long as they are not OTHER snapshots
            if (r.date === latestSnapshot.date && !r.id.startsWith('draw_') && r.typeLabel !== '上欠') return true;
            return false;
        });
    }

    if (clientCode === 'C06') {
        const col2Records = effectiveRecords.filter(r => r.column === 'col2' && r.isVisible);
        if (col2Records.length > 0) return col2Records.reduce((acc, r) => acc + getNetAmount(r), 0);
    } 
    
    // Default: Main Ledger Only (Includes snapshot if it is in main)
    const mainRecords = effectiveRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
    return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
};

export const getClientBalancesPriorToDate = async (dateLimit: string, clients?: Client[]): Promise<Record<string, number>> => {
    if (supabase) {
        // UPDATED: Using LTE to include transactions on the cutoff date (e.g., Mobile '电' records)
        const { data } = await supabase.from('financial_journal').select('*').lte('entry_date', dateLimit).order('entry_date', { ascending: true });
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
            
            // STRICTLY find a snapshot that belongs to the MAIN ledger before the date limit.
            // Ignore any snapshots that might exist in 'col1' or 'col2' (unless they are relevant to C06, handled separately).
            const latestSnapshot = sortedForSnapshot.find(r => 
                (r.id.startsWith('draw_') || r.typeLabel === '上欠') && 
                (r.column === 'main' || !r.column) &&
                r.date < dateLimit
            );
            
            let effectiveRecords = records;
            if (latestSnapshot) {
                effectiveRecords = records.filter(r => {
                    if (r.id === latestSnapshot.id) return true; 
                    if (r.date > latestSnapshot.date) return true;
                    // Include same-day transactions relative to the snapshot we found
                    if (r.date === latestSnapshot.date && !r.id.startsWith('draw_') && r.typeLabel !== '上欠') return true;
                    return false;
                });
            }

            if (clientCode === 'C06') {
                const col2Records = effectiveRecords.filter(r => r.column === 'col2' && r.isVisible);
                balances[clientId] = col2Records.length > 0 ? col2Records.reduce((acc, r) => acc + getNetAmount(r), 0) : effectiveRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible).reduce((acc, r) => acc + getNetAmount(r), 0);
            } else {
                // Unified logic for all other clients: Use Final Total Balance of Main Ledger (ignore P1)
                const mainRecords = effectiveRecords.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
                balances[clientId] = mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
            }
        });
        return balances;
    }
    return {};
};

const HouseRulesFilter = (records: LedgerRecord[], column: string) => {
    return records.filter(r => r.column === column && r.isVisible);
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