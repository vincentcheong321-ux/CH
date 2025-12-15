
import { Client, LedgerRecord, AssetRecord, TransactionCategory, SaleRecord, DrawBalance, CashAdvanceRecord } from '../types';

const CLIENTS_KEY = 'ledger_clients';
const CATEGORIES_KEY = 'ledger_categories';
const RECORDS_KEY = 'ledger_records';
const ASSETS_KEY = 'ledger_assets';

// Helper to generate local IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// --- 1. Categories (Synchronous - used directly in UI render) ---
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
    // Migration Logic: Ensure specific categories exist and have correct colors
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
    const dianIndex = categories.findIndex(c => c.label === '电');
    if (dianIndex === -1) {
        categories.push({ id: generateId(), label: '电', operation: 'add', color: 'bg-green-100 text-green-800' });
        updated = true;
    } else if (categories[dianIndex].operation !== 'add') {
        categories[dianIndex] = { ...categories[dianIndex], operation: 'add', color: 'bg-green-100 text-green-800' };
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

// --- 2. Clients (LocalStorage) ---

export const getClients = async (): Promise<Client[]> => {
  return JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
};

export const saveClient = async (client: Omit<Client, 'id' | 'createdAt'>): Promise<Client> => {
  const clients = JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
  const newClient = { ...client, id: generateId(), createdAt: new Date().toISOString() };
  localStorage.setItem(CLIENTS_KEY, JSON.stringify([...clients, newClient]));
  return newClient as Client;
};

export const deleteClient = async (id: string) => {
  const clients = JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]');
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(clients.filter((c:Client) => c.id !== id)));
};

export const seedInitialClients = async () => {};

export const seedData = () => {
    getCategories();
};

// --- 3. Unified Financial Journal Adapters ---

const getRecordSortPriority = (record: LedgerRecord): number => {
    if (record.id.startsWith('draw_') || record.typeLabel === '上欠') return 1;
    if (record.id.startsWith('sale_') || record.id === 'agg_sale_week' || record.typeLabel === '收') return 2;
    if (record.typeLabel === '电') return 3;
    if (record.typeLabel === '中') return 4;
    if (record.typeLabel === '来') return 5;
    if (record.typeLabel === '支' || record.typeLabel === '支钱') return 6;
    return 7;
};

const normalizeRecord = (r: any): LedgerRecord => {
  const record = { ...r, column: r.column || 'main' };
  if (record.operation && typeof record.typeLabel === 'string') {
      return record as LedgerRecord;
  }
  // Migration fallback
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

export const getAllLedgerRecords = async (): Promise<LedgerRecord[]> => {
    // 1. Get Manual Records
    const manualData = localStorage.getItem(RECORDS_KEY);
    const manualRecords: LedgerRecord[] = manualData ? JSON.parse(manualData).map(normalizeRecord) : [];

    // 2. Get Sales Records (Converted)
    const allClients = await getClients();
    let salesRecords: LedgerRecord[] = [];
    
    for (const client of allClients) {
        const sales = await getSaleRecords(client.id);
        const clientSales = sales.map(s => {
            const total = (s.b || 0) + (s.s || 0) + (s.a || 0) + (s.c || 0);
            return {
                id: `sale_${s.date}_${client.id}`,
                clientId: client.id,
                date: s.date,
                description: 'Sales Opening',
                typeLabel: '收',
                amount: total,
                operation: 'add' as const,
                column: 'main' as const,
                isVisible: true
            };
        });
        salesRecords = [...salesRecords, ...clientSales];
    }

    // 3. Get Cash Advance (Converted)
    const advData = JSON.parse(localStorage.getItem('ledger_cash_advance') || '{}');
    const advRecords: LedgerRecord[] = [];
    for (const date in advData) {
        for (const clientId in advData[date]) {
            const amount = advData[date][clientId];
            if (amount !== 0) {
                advRecords.push({
                    id: `adv_${date}_${clientId}`,
                    clientId,
                    date,
                    description: 'Cash Advance',
                    typeLabel: '支',
                    amount,
                    operation: 'add',
                    column: 'main',
                    isVisible: true
                });
            }
        }
    }

    // 4. Get Cash Credit (Converted)
    const credData = JSON.parse(localStorage.getItem('ledger_cash_credit') || '{}');
    const credRecords: LedgerRecord[] = [];
    for (const date in credData) {
        for (const clientId in credData[date]) {
            const amount = credData[date][clientId];
            if (amount !== 0) {
                credRecords.push({
                    id: `cred_${date}_${clientId}`,
                    clientId,
                    date,
                    description: 'Cash Credit',
                    typeLabel: '来',
                    amount,
                    operation: 'subtract', // Credit reduces balance
                    column: 'main',
                    isVisible: true
                });
            }
        }
    }

    // 5. Get Draw Reports (Converted - Special Case "上欠")
    const drawData = JSON.parse(localStorage.getItem('ledger_draw_balances') || '{}');
    const drawRecords: LedgerRecord[] = [];
    for (const date in drawData) {
        for (const clientId in drawData[date]) {
            const amount = drawData[date][clientId];
            if (amount !== 0) {
                drawRecords.push({
                    id: `draw_${date}_${clientId}`,
                    clientId,
                    date,
                    description: 'Previous Balance',
                    typeLabel: '上欠',
                    amount: Math.abs(amount), 
                    operation: amount >= 0 ? 'add' : 'subtract', 
                    column: 'main',
                    isVisible: true
                });
            }
        }
    }

    return [...manualRecords, ...salesRecords, ...advRecords, ...credRecords, ...drawRecords];
};

export const getLedgerRecords = async (clientId: string): Promise<LedgerRecord[]> => {
    const all = await getAllLedgerRecords();
    return all.filter(r => r.clientId === clientId).sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return getRecordSortPriority(a) - getRecordSortPriority(b);
    });
};

export const getClientBalance = async (clientId: string): Promise<number> => {
    const records = await getLedgerRecords(clientId);
    
    // Priority Rule: If Panel 1 (col1) has visible records, return its balance.
    const col1Records = records.filter(r => r.column === 'col1' && r.isVisible);
    if (col1Records.length > 0) {
        return col1Records.reduce((acc, r) => acc + getNetAmount(r), 0);
    }
    
    // Fallback: Main Ledger
    const mainRecords = records.filter(r => (r.column === 'main' || !r.column) && r.isVisible);
    return mainRecords.reduce((acc, r) => acc + getNetAmount(r), 0);
};

export const saveLedgerRecord = async (record: Omit<LedgerRecord, 'id'>): Promise<LedgerRecord> => {
  const data = localStorage.getItem(RECORDS_KEY);
  const allRecords: LedgerRecord[] = data ? JSON.parse(data) : [];
  const newRecord: LedgerRecord = { ...record, id: generateId() };
  localStorage.setItem(RECORDS_KEY, JSON.stringify([...allRecords, newRecord]));
  return newRecord;
};

export const deleteLedgerRecord = async (id: string) => {
  const data = localStorage.getItem(RECORDS_KEY);
  const allRecords: LedgerRecord[] = data ? JSON.parse(data) : [];
  const filtered = allRecords.filter(r => r.id !== id);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(filtered));
};

export const updateLedgerRecord = async (id: string, updates: Partial<LedgerRecord>) => {
  const data = localStorage.getItem(RECORDS_KEY);
  const allRecords: LedgerRecord[] = data ? JSON.parse(data) : [];
  const updated = allRecords.map(r => r.id === id ? { ...r, ...updates } : r);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(updated));
}

// --- SALES (LocalStorage) ---
export const getSaleRecords = async (clientId: string): Promise<SaleRecord[]> => {
    const data = localStorage.getItem('ledger_sales_' + clientId);
    return data ? JSON.parse(data) : [];
}
export const getSalesForDates = async (dates: string[]): Promise<SaleRecord[]> => {
    const clients = await getClients();
    let allSales: SaleRecord[] = [];
    for(const c of clients) {
        const sales = JSON.parse(localStorage.getItem('ledger_sales_' + c.id) || '[]');
        allSales = [...allSales, ...sales];
    }
    return allSales.filter(s => dates.includes(s.date));
}
export const saveSaleRecord = async (record: any) => {
    const key = 'ledger_sales_' + record.clientId;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const idx = existing.findIndex((r: any) => r.date === record.date);
    if(idx >= 0) existing[idx] = { ...existing[idx], ...record };
    else existing.push({ ...record, id: generateId() });
    localStorage.setItem(key, JSON.stringify(existing));
}

// --- CASH ADVANCE ---
export const getCashAdvances = async (date: string) => {
    const data = JSON.parse(localStorage.getItem('ledger_cash_advance') || '{}');
    return data[date] || {};
}
export const saveCashAdvance = async (date: string, clientId: string, amount: number) => {
    const data = JSON.parse(localStorage.getItem('ledger_cash_advance') || '{}');
    if(!data[date]) data[date] = {};
    data[date][clientId] = amount;
    localStorage.setItem('ledger_cash_advance', JSON.stringify(data));
}

// --- CASH CREDIT ---
export const getCashCredits = async (date: string) => {
    const data = JSON.parse(localStorage.getItem('ledger_cash_credit') || '{}');
    return data[date] || {};
}
export const saveCashCredit = async (date: string, clientId: string, amount: number) => {
    const data = JSON.parse(localStorage.getItem('ledger_cash_credit') || '{}');
    if(!data[date]) data[date] = {};
    data[date][clientId] = amount;
    localStorage.setItem('ledger_cash_credit', JSON.stringify(data));
}

// --- DRAW REPORT ---
export const getDrawBalances = async (date: string) => {
    const data = JSON.parse(localStorage.getItem('ledger_draw_balances') || '{}');
    return data[date] || {};
}
export const saveDrawBalance = async (date: string, clientId: string, amount: number) => {
    const data = JSON.parse(localStorage.getItem('ledger_draw_balances') || '{}');
    if(!data[date]) data[date] = {};
    data[date][clientId] = amount;
    localStorage.setItem('ledger_draw_balances', JSON.stringify(data));
}
export const getAllDrawRecords = async (): Promise<DrawBalance[]> => {
    const data = JSON.parse(localStorage.getItem('ledger_draw_balances') || '{}');
    const records: DrawBalance[] = [];
    for(const date in data) {
        for(const clientId in data[date]) {
            records.push({ date, clientId, balance: data[date][clientId] });
        }
    }
    return records;
}
export const getClientBalancesPriorToDate = async (date: string): Promise<Record<string, number>> => {
    const allDraws = await getAllDrawRecords();
    const result: Record<string, number> = {};
    const clients = await getClients();
    
    clients.forEach(c => {
        // Find latest draw before this date
        const clientDraws = allDraws.filter(d => d.clientId === c.id && d.date < date);
        if (clientDraws.length > 0) {
            // Sort desc date
            clientDraws.sort((a,b) => b.date.localeCompare(a.date));
            result[c.id] = clientDraws[0].balance;
        } else {
            result[c.id] = 0;
        }
    });
    return result;
}
export const getTotalDrawReceivables = async () => {
    // Sum of latest draw for each client
    const allDraws = await getAllDrawRecords();
    const latestMap: Record<string, number> = {};
    allDraws.forEach(d => {
        // Simple overwrite: if we process chronologically or sort, we get latest.
        // Or check date.
        // Let's assume we want the ABSOLUTE latest regardless of date for "Current" snapshot
        if (!latestMap[d.clientId]) {
             latestMap[d.clientId] = d.balance;
        } else {
             // We need to compare dates to be sure, but loop order isn't guaranteed.
             // Better to group by client and find max date.
        }
    });
    
    // Better impl:
    const clients = await getClients();
    let total = 0;
    for(const c of clients) {
        const cDraws = allDraws.filter(d => d.clientId === c.id);
        if(cDraws.length > 0) {
            cDraws.sort((a,b) => b.date.localeCompare(a.date));
            total += cDraws[0].balance;
        }
    }
    return total;
}

// --- MOBILE REPORT ---
export const saveMobileReportHistory = async (date: string, json: any) => {
    const hist = JSON.parse(localStorage.getItem('mobile_report_history') || '[]');
    hist.unshift({ id: generateId(), report_date: date, created_at: new Date().toISOString(), json_data: json });
    localStorage.setItem('mobile_report_history', JSON.stringify(hist));
}
export const getMobileReportHistory = async () => {
    return JSON.parse(localStorage.getItem('mobile_report_history') || '[]');
}

// --- WINNINGS (Calculated from Main Ledger) ---
export const getWinningsByDateRange = async (startDate: string, endDate: string): Promise<Record<string, number>> => {
    // 1. Fetch ALL records (from LocalStorage via getAllLedgerRecords)
    const allRecords = await getAllLedgerRecords(); 
    
    const winnings: Record<string, number> = {};
    
    allRecords.forEach(r => {
        // Filter criteria:
        // - Within Date Range
        // - Type is '中' (Winning)
        // - Column is 'main' (User requirement: reflect in main ledger)
        if (r.date >= startDate && r.date <= endDate && r.typeLabel === '中' && r.column === 'main') {
            const current = winnings[r.clientId] || 0;
            // Winnings are stored as 'subtract' operation (red), but we want the positive magnitude sum for the report list
            winnings[r.clientId] = current + r.amount;
        }
    });
    
    return winnings;
};

// --- ASSETS ---
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

export const fetchClientTotalBalance = async (clientId: string) => {
    return getClientBalance(clientId);
}
