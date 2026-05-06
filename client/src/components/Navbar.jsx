import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSOS } from '../context/SOSContext';
import { HiOutlineShieldCheck, HiOutlineMap, HiOutlineUsers } from 'react-icons/hi2';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { activeSOS } = useSOS();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <nav className="navbar">
      <div className="container">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <span className="navbar-logo">Sanket</span>
            <span className="navbar-tagline">One Signal. Instant Safety.</span>
          </div>

          <div className="navbar-links">
            <NavLink to="/" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
              <HiOutlineShieldCheck size={18} /> <span>SOS</span>
            </NavLink>
            <NavLink to="/map" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
              <HiOutlineMap size={18} /> <span>Map</span>
            </NavLink>
            <NavLink to="/contacts" className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`}>
              <HiOutlineUsers size={18} /> <span>Contacts</span>
            </NavLink>
          </div>

          <div className="navbar-user">
            <div className={`navbar-status ${activeSOS ? 'active' : 'safe'}`} title={activeSOS ? 'SOS Active' : 'Safe'} />
            <button className="btn-logout" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </div>
    </nav>
  );
}
