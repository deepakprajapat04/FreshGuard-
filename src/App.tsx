/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router';
import { Layout } from './components/Layout';
import { PersonaProvider } from './context/PersonaContext';
import { ThemeProvider } from './context/ThemeContext';
import Dashboard from './pages/Dashboard';
import Procurement from './pages/Procurement';
import Logistics from './pages/Logistics';
import QualityControl from './pages/QualityControl';
import Claims from './pages/Claims';
import Reports from './pages/Reports';
import Store from './pages/Store';

export default function App() {
  return (
    <ThemeProvider>
      <PersonaProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/procurement" element={<Procurement />} />
              <Route path="/logistics" element={<Logistics />} />
              <Route path="/qc" element={<QualityControl />} />
              <Route path="/claims" element={<Claims />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/store" element={<Store />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </PersonaProvider>
    </ThemeProvider>
  );
}
