import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { ThemeProvider } from './components/Theme';
import { ToastProvider } from './components/Toast';
import { ApiError } from './lib/api';
import { store } from './store';
import './styles/global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      // Client errors (401/403/404) will not fix themselves on retry.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
    },
  },
});

// Signing out (or an expired session) must not leave one user's data cached for the next.
let previousToken = store.getState().auth.accessToken;
store.subscribe(() => {
  const token = store.getState().auth.accessToken;
  if (previousToken && !token) queryClient.clear();
  previousToken = token;
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
);
