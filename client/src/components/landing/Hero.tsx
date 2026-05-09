import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import DarkVeil from './DarkVeil';
import Phone3D from './Phone3D';
import useScrollAnimation from '../../hooks/useScrollAnimation';

export default function Hero() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const textRef = useScrollAnimation({ animation: 'fade-up' });

  return (
    <section className="hero">
      <div className="hero-background" aria-hidden="true">
        <DarkVeil
          hueShift={-115}
          scanlineIntensity={0.8}
          speed={0.8}
          resolutionScale={1.5}
        />
      </div>
      <div className="hero-content">
        <div className="hero-text" ref={textRef}>
          <div className="hero-badge">Women's Safety Platform</div>
          <h1 className="hero-title">
            Your Safety,<br />
            <span className="highlight">One Tap Away</span>
          </h1>
          <p className="hero-subtitle">
            Instantly alert your trusted contacts via WhatsApp &amp; voice calls
            with live GPS tracking. Because every second counts when you need help.
          </p>
          <div className="hero-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => navigate(user ? '/app' : '/register')}
            >
              Get Started
            </button>
            {!user && (
              <button
                className="btn btn-outline btn-lg hero-signin-btn"
                onClick={() => navigate('/login')}
              >
                Sign In
              </button>
            )}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            ✦ Free forever &nbsp;·&nbsp; ✦ No downloads needed &nbsp;·&nbsp; ✦ Works on any device
          </p>
        </div>
        <div className="hero-visual">
          <Phone3D />
        </div>
      </div>
    </section>
  );
}

