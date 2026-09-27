const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const api = {
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = localStorage.getItem('banking_access_token');
    const headers = new Headers(options.headers ?? {});

    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.message ?? 'Request failed');
    }

    return payload.data ?? payload;
  },
};
