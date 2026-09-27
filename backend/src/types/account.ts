export type AccountCurrency = 'USD' | 'EUR' | 'AMD';
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'FROZEN';

export interface Account {
  id: string;
  user_id: string;
  currency: AccountCurrency;
  balance: string;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

export interface TransactionRecord {
  id: string;
  user_id: string;
  source_account_id: string | null;
  destination_account_id: string | null;
  amount: string;
  currency: AccountCurrency;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
