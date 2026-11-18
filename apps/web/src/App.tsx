import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { DevicesPage } from './pages/devices/DevicesPage';
import { DeviceRegisterPage } from './pages/devices/DeviceRegisterPage';
import { CasesPage } from './pages/cases/CasesPage';
import { NewCasePage } from './pages/cases/NewCasePage';
import { CaseDetailPage } from './pages/cases/CaseDetailPage';
import { CustomerAuthorizationPage } from './pages/public/CustomerAuthorizationPage';
import { VerifyCertificatePage } from './pages/public/VerifyCertificatePage';
import { LoginPage } from './pages/auth/LoginPage';
import { SignUpPage } from './pages/auth/SignUpPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public customer-facing & verification portals */}
          <Route path="/authorize/:token" element={<CustomerAuthorizationPage />} />
          <Route path="/verify" element={<VerifyCertificatePage />} />
          <Route path="/verify/:certificateNumber" element={<VerifyCertificatePage />} />

          {/* Auth routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />

          {/* Technician & Shop Management Workbench */}
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="devices/register" element={<DeviceRegisterPage />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="cases/new" element={<NewCasePage />} />
            <Route path="cases/:id" element={<CaseDetailPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
