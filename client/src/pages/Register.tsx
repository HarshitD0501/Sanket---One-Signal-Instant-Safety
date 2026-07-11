import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DarkVeil from '../components/landing/DarkVeil';
import sanketMark from '../assets/sanket-navbar-mark.svg';
import { rememberAccount } from '../utils/savedAccounts';
import toast from 'react-hot-toast';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await register(name, email, phone, password);
      rememberAccount(user.email || email, user.name || name);
      toast.success('Account created! Welcome to Sanket.');
      navigate('/app');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-page--v2">
      <div className="auth-visual">
        <div className="auth-visual-bg" aria-hidden="true">
          <DarkVeil hueShift={-115} scanlineIntensity={0.6} speed={0.6} warpAmount={0.6} resolutionScale={1.4} />
        </div>
        <div className="auth-brand">
          <Link to="/" className="nav-logo auth-logo-lockup" aria-label="Sanket home">
            <img src={sanketMark} alt="" aria-hidden="true" className="nav-logo-mark" />
            <span className="nav-logo-text">Sanket</span>
          </Link>
          <p className="auth-subtitle">One Signal · Instant Safety</p>
        </div>
      </div>

      <div className="auth-form-side">
        <form className="auth-form auth-card" onSubmit={handleSubmit}>
          <h2>Create Account</h2>
          <p className="subtitle">Set up your emergency safety profile</p>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input className="form-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" autoComplete="tel" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" required />
          </div>
          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? <span className="btn-spinner" aria-hidden="true" /> : 'Get Started →'}
          </button>
          <p className="auth-link">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
