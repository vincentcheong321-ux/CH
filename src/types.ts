
export interface Client {
  id: string;
  code: string;
  name: string;
  phone?: string;
  note?: string;
  createdAt: string;
  // Extra info columns for the ledger view
  column1Notes?: string;
  column2Notes?: string;
}

export interface TransactionCategory {
  id: string;
  label: string;
  operation: 'add' | 'subtract' | 'none';
  color: string; // Tailwind class mostly
}

export interface LedgerRecord {
  id: string;
  clientId: string;
  date: string;
  description: string;
  
  // New Dynamic Structure
  typeLabel: string; // The label at the time of transaction (e.g., "收")
  amount: number;
  operation: 'add' | 'subtract' | 'none';
  
  // Which column does this record belong to?
  column?: 'main' | 'col1' | 'col2'; 
  
  isVisible: boolean; 

  // Legacy fields (optional, kept for type compatibility if needed during migration)
  shou?: number; 
  zhong?: number; 
  dianhua?: number; 
  zhiqian?: number; 
}

export interface AssetRecord {
  id: string;
  date: string;
  type: 'IN' | 'OUT';
  amount: number;
  category: string;
  description: string;
}

export interface User {
  username: string;
  isAuthenticated: boolean;
}

export type SortDirection = 'asc' | 'desc';