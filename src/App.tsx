import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from './components/layout/AppLayout';
import { AuthGate } from './components/auth/AuthGate';
import { GitHubInstallCallbackPage } from './components/github/GitHubInstallCallbackPage';
import { isInstallCallbackUrl } from './services/githubInstall';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      {isInstallCallbackUrl() ? (
        <GitHubInstallCallbackPage />
      ) : (
        <AuthGate>
          <AppLayout />
        </AuthGate>
      )}
    </QueryClientProvider>
  );
};

export default App;
