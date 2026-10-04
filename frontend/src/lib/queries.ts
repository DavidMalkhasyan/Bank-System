import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { store } from '../store';
import { sessionStarted, signedOut, userUpdated } from '../store/authSlice';
import { api } from './api';
import type {
  Account,
  AccountStatus,
  AccountType,
  AdminAccount,
  AdminStats,
  AdminUser,
  AuditLog,
  Cashflow,
  Currency,
  MoneyMovementResult,
  RecipientPreview,
  Role,
  Session,
  Transaction,
  TransactionType,
  TransferResult,
  User,
} from './types';

export const queryKeys = {
  accounts: ['accounts'] as const,
  account: (id: string) => ['accounts', id] as const,
  transactions: (filter: object) => ['transactions', filter] as const,
  cashflow: (currency: string, days: number) => ['cashflow', currency, days] as const,
  admin: ['admin'] as const,
};

/* ---------- Session ---------- */

export async function login(email: string, password: string) {
  const session = await api.post<Session>('/auth/login', { email, password }, { auth: false });
  store.dispatch(sessionStarted(session));
  return session;
}

export async function register(input: { fullName: string; email: string; password: string }) {
  const session = await api.post<Session>('/auth/register', input, { auth: false });
  store.dispatch(sessionStarted(session));
  return session;
}

export async function logout() {
  const refreshToken = store.getState().auth.refreshToken;
  store.dispatch(signedOut());
  if (refreshToken) {
    await api.post('/auth/logout', { refreshToken }, { auth: false }).catch(() => undefined);
  }
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (fullName: string) => api.patch<User>('/auth/me', { fullName }),
    onSuccess: (user) => store.dispatch(userUpdated(user)),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) => api.post<Session>('/auth/change-password', input),
    onSuccess: (session) => store.dispatch(sessionStarted(session)),
  });
}

/* ---------- Accounts & transactions ---------- */

export const useAccounts = () =>
  useQuery({ queryKey: queryKeys.accounts, queryFn: () => api.get<Account[]>('/accounts') });

export const useAccount = (id: string) =>
  useQuery({ queryKey: queryKeys.account(id), queryFn: () => api.get<Account>(`/accounts/${id}`) });

export interface TransactionFilter {
  page?: number;
  pageSize?: number;
  type?: TransactionType;
  accountId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export const fetchTransactions = (filter: TransactionFilter) =>
  api.getPage<Transaction>('/transactions', { ...filter });

export const useTransactions = (filter: TransactionFilter) =>
  useQuery({
    queryKey: queryKeys.transactions(filter),
    queryFn: () => fetchTransactions(filter),
    placeholderData: keepPreviousData,
  });

export const useCashflow = (currency: Currency | undefined, days = 30) =>
  useQuery({
    queryKey: queryKeys.cashflow(currency ?? 'USD', days),
    queryFn: () => api.get<Cashflow>('/transactions/cashflow', { currency, days }),
    enabled: Boolean(currency),
  });

export const lookupAccount = (accountNumber: string) =>
  api.get<RecipientPreview>('/accounts/lookup', { number: accountNumber });

/** After any money movement, balances, history and charts are all stale. */
function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['cashflow'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin }),
    ]);
}

export function useMoneyMovement(kind: 'deposit' | 'withdraw') {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ accountId, amount, description }: { accountId: string; amount: string; description?: string }) =>
      api.post<MoneyMovementResult>(`/accounts/${accountId}/${kind}`, { amount, description: description || undefined }),
    onSuccess: invalidate,
  });
}

export function useTransfer() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (input: {
      sourceAccountId: string;
      destinationAccountId?: string;
      destinationAccountNumber?: string;
      amount: string;
      description?: string;
    }) => api.post<TransferResult>('/transfers', input),
    onSuccess: invalidate,
  });
}

export function useCreateAccount() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (input: { currency: Currency; type: AccountType; name?: string }) => api.post<Account>('/accounts', input),
    onSuccess: invalidate,
  });
}

export function useRenameAccount() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.patch<Account>(`/accounts/${id}`, { name }),
    onSuccess: invalidate,
  });
}

export function useCloseAccount() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: (id: string) => api.post<Account>(`/accounts/${id}/close`),
    onSuccess: invalidate,
  });
}

/* ---------- Admin ---------- */

export const useAdminStats = () =>
  useQuery({ queryKey: [...queryKeys.admin, 'stats'], queryFn: () => api.get<AdminStats>('/admin/stats') });

export const useAdminUsers = (params: { page: number; search?: string }) =>
  useQuery({
    queryKey: [...queryKeys.admin, 'users', params],
    queryFn: () => api.getPage<AdminUser>('/admin/users', { ...params, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

export const useAdminAccounts = (params: { page: number; search?: string; status?: AccountStatus }) =>
  useQuery({
    queryKey: [...queryKeys.admin, 'accounts', params],
    queryFn: () => api.getPage<AdminAccount>('/admin/accounts', { ...params, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

export const useAdminTransactions = (params: { page: number; search?: string; type?: TransactionType }) =>
  useQuery({
    queryKey: [...queryKeys.admin, 'transactions', params],
    queryFn: () => api.getPage<Transaction>('/admin/transactions', { ...params, pageSize: 15 }),
    placeholderData: keepPreviousData,
  });

export const useAuditLogs = (params: { page: number; action?: string }) =>
  useQuery({
    queryKey: [...queryKeys.admin, 'audit', params],
    queryFn: () => api.getPage<AuditLog>('/admin/audit-logs', { ...params, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });

export const useAuditActions = () =>
  useQuery({ queryKey: [...queryKeys.admin, 'audit-actions'], queryFn: () => api.get<string[]>('/admin/audit-logs/actions') });

export function useSetAccountStatus() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: 'ACTIVE' | 'FROZEN'; reason?: string }) =>
      api.patch<Account>(`/admin/accounts/${id}/status`, { status, reason: reason || undefined }),
    onSuccess: invalidate,
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api.patch<User>(`/admin/users/${id}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin }),
  });
}
