import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/shared/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MapView from './pages/MapView';
import Contacts from './pages/Contacts';
import TrackingPage from './pages/TrackingPage';
import AppNavbar from './components/app/AppNavbar';
import { AUTH_DETACHED } from './config/authMode';

function AppLayout() {
  return (
    <div className="app-shell">
      <AppNavbar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={AUTH_DETACHED || user ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/register" element={AUTH_DETACHED || user ? <Navigate to="/app" replace /> : <Register />} />
      <Route path="/track/:trackingId" element={<TrackingPage />} />

      {/* Protected app routes */}
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="map" element={<MapView />} />
        <Route path="contacts" element={<Contacts />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
