import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useScrollAnimation from '../../hooks/useScrollAnimation';

export default function CTA() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const ref = useScrollAnimation({ animation: 'fade-up' });

  return (
    <section className="cta-section" id="about" ref={ref}>
      <h2 className="cta-title">Don't Wait for an Emergency.<br />Be Prepared.</h2>
      <p className="cta-subtitle">
        Join thousands of women who feel safer knowing help is always one tap away.
      </p>
      <button
        className="btn btn-primary btn-lg"
        onClick={() => navigate(user ? '/app' : '/register')}
      >
        Get Started Free
      </button>
      <footer className="footer" style={{ marginTop: '4rem' }}>
        <p>
          🛡️ Sanket — Women Safety SOS Platform &nbsp;·&nbsp; Built with ❤️ for safety
        </p>
      </footer>
    </section>
  );
}
