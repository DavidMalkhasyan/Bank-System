import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Session, User } from '../lib/types';

const STORAGE_KEY = 'ledgerly_session';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
}

const emptyState: AuthState = { accessToken: null, refreshToken: null, user: null };

function loadSession(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState;
    const parsed = JSON.parse(raw) as AuthState;
    return parsed.accessToken && parsed.user ? parsed : emptyState;
  } catch {
    return emptyState;
  }
}

function persist(state: AuthState) {
  try {
    if (state.accessToken) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode); the session then lasts for this tab only.
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadSession,
  reducers: {
    sessionStarted: (_state, action: PayloadAction<Session>) => {
      const next = { accessToken: action.payload.accessToken, refreshToken: action.payload.refreshToken, user: action.payload.user };
      persist(next);
      return next;
    },
    userUpdated: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      persist({ ...state, user: action.payload });
    },
    signedOut: () => {
      persist(emptyState);
      return emptyState;
    },
  },
});

export const { sessionStarted, userUpdated, signedOut } = authSlice.actions;
export default authSlice.reducer;
