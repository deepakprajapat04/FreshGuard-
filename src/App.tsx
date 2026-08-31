/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import { PersonaRouteGuard } from './components/PersonaRouteGuard';
import { ThemeProvider } from './context/ThemeContext';
import { PersonaProvider } from './context/PersonaContext';
import { NotificationsProvider } from './context/NotificationsContext';
import TrackingHub from './pages/TrackingHub';
import HealthCheck from './pages/HealthCheck';
import Orders from './pages/Orders';
import Actions from './pages/Actions';
import Logistics from './pages/Logistics';
import QualityControl from './pages/QualityControl';
import Claims from './pages/Claims';
import Store from './pages/Store';
import BusinessRules from './pages/BusinessRules';
import FruitsRfq from './pages/FruitsRfq';

export default function App() {
  return (
    <ThemeProvider>
      <PersonaProvider>
        <NotificationsProvider>
          <BrowserRouter>
            <PersonaRouteGuard />
            <Layout>
              <Routes>
                <Route path="/" element={<HealthCheck />} />
                <Route path="/tracking" element={<TrackingHub />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/actions" element={<Actions />} />
                <Route path="/logistics" element={<Logistics />} />
                <Route path="/procurement" element={<Navigate to="/orders" replace />} />
                <Route path="/inbox" element={<Navigate to="/actions" replace />} />
                <Route path="/qc" element={<QualityControl />} />
                <Route path="/claims" element={<Claims />} />
                <Route path="/store" element={<Store />} />
                <Route path="/fruits-rfq" element={<FruitsRfq />} />
                <Route path="/business-rules" element={<BusinessRules />} />
              </Routes>
            </Layout>
          </BrowserRouter>
        </NotificationsProvider>
      </PersonaProvider>
    </ThemeProvider>
  );
}
