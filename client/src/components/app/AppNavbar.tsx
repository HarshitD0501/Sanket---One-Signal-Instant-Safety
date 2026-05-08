import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AppNavbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="app-nav">
      <NavLink to="/" className="nav-logo" style={{ fontSize: '1.1rem' }}>
        🛡️ <span>Sanket</span>
      </NavLink>
      <div className="app-nav-links">
        <NavLink to="/app" end className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
          Dashboard
        </NavLink>
        <NavLink to="/app/map" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
          Map
        </NavLink>
        <NavLink to="/app/contacts" className={({ isActive }) => `app-nav-link ${isActive ? 'active' : ''}`}>
          Contacts
        </NavLink>
      </div>
      <div className="app-nav-right">
        <button className="btn btn-outline btn-sm" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
