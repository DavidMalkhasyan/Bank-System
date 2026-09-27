import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
  created_at?: string;
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
}

const initialState: AuthState = {
  token: localStorage.getItem('banking_access_token'),
  refreshToken: localStorage.getItem('banking_refresh_token'),
  user: (() => {
    const raw = localStorage.getItem('banking_user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  })(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ token: string; refreshToken: string; user: AuthUser }>,
    ) => {
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;

      localStorage.setItem('banking_access_token', action.payload.token);
      localStorage.setItem('banking_refresh_token', action.payload.refreshToken);
      localStorage.setItem('banking_user', JSON.stringify(action.payload.user));
    },
    logout: (state) => {
      state.token = null;
      state.refreshToken = null;
      state.user = null;

      localStorage.removeItem('banking_access_token');
      localStorage.removeItem('banking_refresh_token');
      localStorage.removeItem('banking_user');
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
