import { useState, useRef, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiMail, FiLock, FiEye, FiEyeOff, FiX, FiArrowRight } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import DarkVeil from '../components/landing/DarkVeil';
import sanketMark from '../assets/sanket-navbar-mark.svg';
import {
  getSavedAccounts,
  rememberAccount,
  forgetAccount,
  initials,
  type SavedAccount,
} from '../utils/savedAccounts';
import toast from 'react-hot-toast';

export default function Login() {
  const devLoginEmail = import.meta.env.DEV ? import.meta.env.VITE_DEV_LOGIN_EMAIL || '' : '';
  const devLoginPassword = import.meta.env.DEV ? import.meta.env.VITE_DEV_LOGIN_PASSWORD || '' : '';
  const hasDevCredentials = Boolean(devLoginEmail && devLoginPassword);

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => getSavedAccounts());
  // Don't pre-fill from a saved account — the "Continue as" chips are the fill
  // mechanism, so leaving this empty makes every chip click visibly populate it.
  const [email, setEmail] = useState(devLoginEmail || '');
  const [password, setPassword] = useState(devLoginPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const fillDevCredentials = () => {
    setEmail(devLoginEmail);
    setPassword(devLoginPassword);
  };

  const pickAccount = (account: SavedAccount) => {
    setEmail(account.email);
    setPassword('');
    // Clear feedback + drop the user straight into typing their password.
    toast(`Enter password for ${account.name}`, { icon: '👤', id: 'pick-account' });
    requestAnimationFrame(() => passwordRef.current?.focus());
  };

  const removeAccount = (e: React.MouseEvent, account: SavedAccount) => {
    e.stopPropagation();
    const next = forgetAccount(account.email);
    setSavedAccounts(next);
    if (email === account.email) setEmail(next[0]?.email || '');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(email, password);
      rememberAccount(user.email || email, user.name);
      setSavedAccounts(getSavedAccounts());
      toast.success(`Welcome back, ${user.name?.split(' ')[0] || 'friend'}!`);
      navigate('/app');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-page--v2">
      {/* Visual / brand side */}
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

      {/* Form side */}
      <div className="auth-form-side">
        <form className="auth-form auth-card" onSubmit={handleSubmit}>
          <h2>Welcome Back</h2>
          <p className="subtitle">Sign in to access your safety dashboard</p>

          {savedAccounts.length > 0 && (
            <div className="saved-accounts">
              <span className="saved-accounts-label">Continue as</span>
              <div className="saved-accounts-list">
                {savedAccounts.map((account) => (
                  <button
                    type="button"
                    key={account.email}
                    className={`account-chip${email === account.email ? ' account-chip--active' : ''}`}
                    onClick={() => pickAccount(account)}
                    title={account.email}
                  >
                    <span className="account-avatar">{initials(account.name || account.email)}</span>
                    <span className="account-meta">
                      <span className="account-name">{account.name}</span>
                      <span className="account-email">{account.email}</span>
                    </span>
                    <span
                      className="account-remove"
                      onClick={(e) => removeAccount(e, account)}
                      aria-label={`Forget ${account.email}`}
                    >
                      <FiX />
                    </span>
                  </button>
                ))}
              </div>
              <div className="saved-divider"><span>or sign in below</span></div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="input-wrap">
              <FiMail className="input-icon" />
              <input
                className="form-input form-input--icon"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                list="saved-emails"
                placeholder="you@example.com"
                autoComplete="username"
                required
              />
            </div>
            {savedAccounts.length > 0 && (
              <datalist id="saved-emails">
                {savedAccounts.map((a) => (
                  <option key={a.email} value={a.email} />
                ))}
              </datalist>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-wrap">
              <FiLock className="input-icon" />
              <input
                ref={passwordRef}
                className="form-input form-input--icon"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? (
              <span className="btn-spinner" aria-hidden="true" />
            ) : (
              <>Sign In <FiArrowRight /></>
            )}
          </button>

          {hasDevCredentials && (
            <button
              className="btn btn-secondary"
              type="button"
              onClick={fillDevCredentials}
              disabled={loading}
              style={{ width: '100%', marginTop: '0.75rem' }}
            >
              Use Dev Login
            </button>
          )}

          <p className="auth-link">
            Don't have an account? <Link to="/register">Register</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
