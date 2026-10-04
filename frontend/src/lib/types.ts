export type Role = 'CUSTOMER' | 'ADMIN';
export type Currency = 'USD' | 'EUR' | 'AMD';
export type AccountType = 'CHECKING' | 'SAVINGS';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
export type Direction = 'CREDIT' | 'DEBIT' | 'INTERNAL';

export const CURRENCIES: Currency[] = ['USD', 'EUR', 'AMD'];

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
}

export interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Account {
  id: string;
  accountNumber: string;
  name: string;
  type: AccountType;
  currency: Currency;
  balance: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface Party {
  accountId: string | null;
  accountNumber: string;
  accountName: string | null;
  ownerName: string | null;
  isOwn: boolean;
}

export interface Transaction {
  id: string;
  reference: string;
  type: TransactionType;
  status: string;
  amount: string;
  currency: Currency;
  description: string | null;
  direction: Direction;
  source: Party | null;
  destination: Party | null;
  createdAt: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paged<T> {
  items: T[];
  meta: PageMeta;
}

export interface Cashflow {
  currency: Currency;
  days: { date: string; income: string; expense: string; balance: string }[];
  totals: { income: string; expense: string; net: string };
}

export interface RecipientPreview {
  accountNumber: string;
  currency: Currency;
  ownerName: string;
  isOwn: boolean;
  canReceive: boolean;
}

export interface MoneyMovementResult {
  account: Account;
  transaction: Transaction;
}

export interface TransferResult {
  sourceAccount: Account;
  transaction: Transaction;
}

export interface AdminStats {
  users: number;
  newUsers30d: number;
  accounts: number;
  activeAccounts: number;
  frozenAccounts: number;
  transactions: number;
  transactions24h: number;
  depositsByCurrency: { currency: Currency; total: string; accounts: number }[];
  activity: { date: string; deposits: number; withdrawals: number; transfers: number }[];
}

export interface AdminUser extends User {
  accountsCount: number;
  lastLoginAt: string | null;
}

export interface AdminAccount extends Account {
  owner: { id: string; email: string; fullName: string };
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; email: string | null; fullName: string | null } | null;
}
