import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import MapView from './pages/MapView';
import Contacts from './pages/Contacts';
import TrackingPage from './pages/TrackingPage';
import Login from './pages/Login';
import Register from './pages/Register';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex-center page"><div className="loader" /></div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      {user && <Navbar />}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/track/:trackingId" element={<TrackingPage />} />
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute><MapView /></ProtectedRoute>} />
        <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
