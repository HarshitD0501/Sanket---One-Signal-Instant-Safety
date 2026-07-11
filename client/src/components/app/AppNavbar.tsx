import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import sanketMark from '../../assets/sanket-navbar-mark.svg';

export default function AppNavbar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="landing-nav app-landing-nav">
      <NavLink to="/" className="nav-logo" aria-label="Sanket home">
        <img src={sanketMark} alt="" aria-hidden="true" className="nav-logo-mark" />
        <span className="nav-logo-text">Sanket</span>
      </NavLink>

      <ul className="nav-links app-nav-menu">
        <li><NavLink to="/app" end>SOS</NavLink></li>
        <li><NavLink to="/app/map">Map</NavLink></li>
        <li><NavLink to="/app/contacts">Contacts</NavLink></li>
      </ul>

      <button className="btn btn-primary btn-sm nav-signin-btn" onClick={handleLogout}>
        Logout
      </button>
    </nav>
  );
}
