import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './lib/auth';
import AppLayout from './components/AppLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import SalesPage from './pages/SalesPage';
import ProductsPage from './pages/ProductsPage';
import CustomersPage from './pages/CustomersPage';
import RoomsPage from './pages/RoomsPage';
import ReservationsPage from './pages/ReservationsPage';
import PetsPage from './pages/PetsPage';
import AppointmentsPage from './pages/AppointmentsPage';
import VetBookingPage from './pages/VetBookingPage';
import PublicBookingPage from './pages/PublicBookingPage';
import BatchesPage from './pages/BatchesPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 20_000,
    },
  },
});

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function BootScreen() {
  return (
    <div className="boot-screen">
      <img src="/brand/sivep-tech-01-monograma-brote.svg" alt="SIVEP Tech" />
      <span>Preparando el sistema…</span>
    </div>
  );
}

function ProtectedApp() {
  const { ready, isAuthenticated } = useAuth();
  if (!ready) return <BootScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

function GuestOnly({ children }) {
  const { ready, isAuthenticated } = useAuth();
  if (!ready) return <BootScreen />;
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route
          path="/registro"
          element={
            <GuestOnly>
              <RegisterPage />
            </GuestOnly>
          }
        />
        <Route path="/reservar/:token" element={<PublicBookingPage />} />
        <Route path="/app" element={<ProtectedApp />}>
          <Route index element={<DashboardPage />} />
          <Route path="ventas" element={<SalesPage />} />
          <Route path="productos" element={<ProductsPage />} />
          <Route path="clientes" element={<CustomersPage />} />
          <Route path="habitaciones" element={<RoomsPage />} />
          <Route path="reservas" element={<ReservationsPage />} />
          <Route path="mascotas" element={<PetsPage />} />
          <Route path="agenda" element={<AppointmentsPage />} />
          <Route path="reservas-vet" element={<VetBookingPage />} />
          <Route path="lotes" element={<BatchesPage />} />
          <Route path="usuarios" element={<UsersPage />} />
          <Route path="ajustes" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </QueryClientProvider>
  );
}
