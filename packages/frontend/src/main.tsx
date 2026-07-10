import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Global design-system CSS must be imported before any feature/component
// CSS — Vite injects stylesheets in JS-evaluation order, not file position,
// so importing these first guarantees later, more-specific component
// stylesheets always win cascade ties against these base rules.
import './design-system/tokens.css';
import './design-system/components.css';
import { App } from './app/App';
import { AuthProvider } from './features/auth/AuthContext';
import { ToastProvider } from './design-system/Toast';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
