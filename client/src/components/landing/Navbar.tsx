import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
      <Link to="/" className="nav-logo">
        🛡️ <span>Sanket</span>
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
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/login')}>
          Sign In →
        </button>
      )}
    </nav>
  );
}
