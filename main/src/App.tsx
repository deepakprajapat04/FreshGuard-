/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import { ReactNode } from 'react';
import { Layout } from './components/Layout';
import { PersonaProvider } from './context/PersonaContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import VerifyEmail from './pages/VerifyEmail';
import Dashboard from './pages/Dashboard';
import Procurement from './pages/Procurement';
import Logistics from './pages/Logistics';
import QualityControl from './pages/QualityControl';
import Claims from './pages/Claims';
import Reports from './pages/Reports';
import Store from './pages/Store';

// Guards the application: unauthenticated users are sent to the auth page.
function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PersonaProvider>
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/verify-email" element={<VerifyEmail />} />

              {/* Protected application routes */}
              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/procurement" element={<RequireAuth><Procurement /></RequireAuth>} />
              <Route path="/logistics" element={<RequireAuth><Logistics /></RequireAuth>} />
              <Route path="/qc" element={<RequireAuth><QualityControl /></RequireAuth>} />
              <Route path="/claims" element={<RequireAuth><Claims /></RequireAuth>} />
              <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
              <Route path="/store" element={<RequireAuth><Store /></RequireAuth>} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </PersonaProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
