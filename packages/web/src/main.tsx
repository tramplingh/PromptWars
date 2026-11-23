import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './components/Toast';
import { ApiClientError } from './lib/api';
import { applyTheme, preferredTheme } from './lib/theme';
import '@fontsource-variable/inter/wght.css';
import './index.css';

// Apply the theme before the first paint so there is no light flash in dark mode.
applyTheme(preferredTheme());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Client errors (4xx) will not fix themselves; only retry transient failures.
      retry: (failureCount, error) =>
        !(error instanceof ApiClientError && error.status < 500) && failureCount < 2,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
