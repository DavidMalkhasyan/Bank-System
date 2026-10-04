import { store } from '../store';
import { sessionStarted, signedOut } from '../store/authSlice';
import type { PageMeta, Session } from './types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string[]>;

  constructor(message: string, status: number, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type QueryValue = string | number | undefined | null;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Set false for endpoints that must not trigger a token refresh (login, register...). */
  auth?: boolean;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  meta?: PageMeta;
  message?: string;
  details?: { fieldErrors?: Record<string, string[]> } | null;
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_BASE_URL}${path}${search ? `?${search}` : ''}`;
}

async function send<T>(path: string, options: RequestOptions, accessToken: string | null): Promise<{ response: Response; payload: Envelope<T> }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  const payload = (await response.json().catch(() => ({}))) as Envelope<T>;
  return { response, payload };
}

// Several requests can fail with 401 at once; they all wait for one refresh.
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const refreshToken = store.getState().auth.refreshToken;
    if (!refreshToken) return false;
    try {
      const { response, payload } = await send<Session>('/auth/refresh', { method: 'POST', body: { refreshToken } }, null);
      if (!response.ok) return false;
      store.dispatch(sessionStarted(payload.data));
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<Envelope<T>> {
  const useAuth = options.auth !== false;
  let { response, payload } = await send<T>(path, options, useAuth ? store.getState().auth.accessToken : null);

  if (response.status === 401 && useAuth) {
    if (await refreshSession()) {
      ({ response, payload } = await send<T>(path, options, store.getState().auth.accessToken));
    } else {
      store.dispatch(signedOut());
    }
  }

  if (!response.ok) {
    throw new ApiError(payload.message ?? 'Something went wrong. Please try again.', response.status, payload.details?.fieldErrors ?? {});
  }
  return payload;
}

export const api = {
  get: async <T>(path: string, query?: Record<string, QueryValue>) => (await request<T>(path, { query })).data,
  getPage: async <T>(path: string, query?: Record<string, QueryValue>) => {
    const payload = await request<T[]>(path, { query });
    return { items: payload.data, meta: payload.meta! };
  },
  post: async <T>(path: string, body?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    (await request<T>(path, { ...options, method: 'POST', body: body ?? {} })).data,
  patch: async <T>(path: string, body: unknown) => (await request<T>(path, { method: 'PATCH', body })).data,
};

export const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong');
