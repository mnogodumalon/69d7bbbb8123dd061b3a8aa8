import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import BestellrundePage from '@/pages/BestellrundePage';
import BestellungPage from '@/pages/BestellungPage';
import GerichtePage from '@/pages/GerichtePage';

const SammelbestellungPage = lazy(() => import('@/pages/intents/SammelbestellungPage'));

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ActionsProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<DashboardOverview />} />
              <Route path="bestellrunde" element={<BestellrundePage />} />
              <Route path="bestellung" element={<BestellungPage />} />
              <Route path="gerichte" element={<GerichtePage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="intents/sammelbestellung" element={<Suspense fallback={null}><SammelbestellungPage /></Suspense>} />
            </Route>
          </Routes>
        </ActionsProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
