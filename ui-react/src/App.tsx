import { Route, Routes, Navigate } from 'react-router-dom';

import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Toaster } from './components/ui/toaster';
import { ModelSelectionProvider } from './contexts/ModelSelectionContext';
import { ModelsPage } from './pages/ModelsPage';
import { ConfigurePage } from './pages/ConfigurePage';
import { RegisterPage } from './pages/RegisterPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OAuth2CallbackPage } from './pages/OAuth2CallbackPage';

export function App() {
  return (
    <ErrorBoundary>
      <ModelSelectionProvider>
        {/* OAuth2 callback is outside AppShell — no nav chrome needed */}
        <Routes>
          <Route path="/oauth2/callback" element={<OAuth2CallbackPage />} />
          <Route
            path="*"
            element={
              <AppShell>
                <Routes>
                  <Route path="/" element={<Navigate to="/models" replace />} />
                  <Route path="/models" element={<ModelsPage />} />
                  <Route path="/configurations/:id" element={<ConfigurePage />} />
                  <Route path="/configure" element={<ConfigurePage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AppShell>
            }
          />
        </Routes>
        <Toaster />
      </ModelSelectionProvider>
    </ErrorBoundary>
  );
}
