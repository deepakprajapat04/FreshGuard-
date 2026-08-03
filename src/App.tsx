/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import { Layout } from './components/Layout';
import { ThemeProvider } from './context/ThemeContext';
import { PersonaProvider } from './context/PersonaContext';
import { NotificationsProvider } from './context/NotificationsContext';
import Dashboard from './pages/Dashboard';
import Procurement from './pages/Procurement';
import Logistics from './pages/Logistics';
import QualityControl from './pages/QualityControl';
import Claims from './pages/Claims';
import Reports from './pages/Reports';
import Store from './pages/Store';
import BusinessRules from './pages/BusinessRules';
import Inbox from './pages/Inbox';

export default function App() {
  return (
    <ThemeProvider>
      <PersonaProvider>
        <NotificationsProvider>
          <BrowserRouter>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/procurement" element={<Procurement />} />
                <Route path="/logistics" element={<Logistics />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/qc" element={<QualityControl />} />
                <Route path="/claims" element={<Claims />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/store" element={<Store />} />
                <Route path="/business-rules" element={<BusinessRules />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </NotificationsProvider>
      </PersonaProvider>
    </ThemeProvider>
  );
}
