export type UserRole = 'CUSTOMER' | 'ADMIN';
export type Currency = 'USD' | 'EUR' | 'AMD';
export type AccountType = 'CHECKING' | 'SAVINGS';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export const CURRENCIES: readonly Currency[] = ['USD', 'EUR', 'AMD'];
export const ACCOUNT_TYPES: readonly AccountType[] = ['CHECKING', 'SAVINGS'];
export const TRANSACTION_TYPES: readonly TransactionType[] = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'];

/** The identity carried in the access token. */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export interface AccountRow {
  id: string;
  user_id: string;
  account_number: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: string;
  status: AccountStatus;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  source_account_id: string | null;
  destination_account_id: string | null;
  amount: string;
  currency: Currency;
  type: TransactionType;
  status: TransactionStatus;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
