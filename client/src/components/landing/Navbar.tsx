import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import sanketMark from '../../assets/sanket-navbar-mark.svg';

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="landing-nav">
      <Link to="/" className="nav-logo" aria-label="Sanket home">
        <img src={sanketMark} alt="" aria-hidden="true" className="nav-logo-mark" />
        <span className="nav-logo-text">Sanket</span>
      </Link>
      <ul className="nav-links">
        <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a></li>
        <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a></li>
        <li><a href="#about" onClick={(e) => { e.preventDefault(); scrollTo('about'); }}>About</a></li>
      </ul>
      {user ? (
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/app')}>
          Dashboard →
        </button>
      ) : (
        <button className="btn btn-primary btn-sm nav-signin-btn" onClick={() => navigate('/login')}>
          Register / Login
        </button>
      )}
    </nav>
  );
}
