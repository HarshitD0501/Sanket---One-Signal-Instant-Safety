import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSOS } from '../context/SOSContext';
import useGeolocation from '../hooks/useGeolocation';
import useShake from '../hooks/useShake';
import SOSButton from '../components/SOSButton';
import api from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineMapPin, HiOutlineDevicePhoneMobile } from 'react-icons/hi2';

export default function Home() {
  const { user } = useAuth();
  const { activeSOS, triggerSOS, resolveSOS, sendLocationUpdate, shakeEnabled, setShakeEnabled } = useSOS();
  const { position, loading: geoLoading } = useGeolocation();
  const [contacts, setContacts] = useState([]);
  const [history, setHistory] = useState([]);
  const [triggering, setTriggering] = useState(false);
  const locationInterval = useRef(null);
  const navigate = useNavigate();

  // Fetch contacts and history
  useEffect(() => {
    api.get('/contacts').then((r) => setContacts(r.data.data)).catch(() => {});
    api.get('/sos/history').then((r) => setHistory(r.data.data.slice(0, 5))).catch(() => {});
  }, [activeSOS]);

  // Stream location during active SOS
  useEffect(() => {
    if (activeSOS) {
      locationInterval.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition((pos) => {
          sendLocationUpdate(pos.coords.latitude, pos.coords.longitude);
        });
      }, 5000);
    }
    return () => clearInterval(locationInterval.current);
  }, [activeSOS, sendLocationUpdate]);

  const handleTrigger = useCallback(async () => {
    if (!position.lat) return toast.error('Location not available. Please enable GPS.');
    if (contacts.length === 0) { toast.error('Add emergency contacts first!'); return navigate('/contacts'); }
    setTriggering(true);
    try {
      const data = await triggerSOS('tap', position.lat, position.lng);
      toast.success(`🚨 SOS triggered! ${data.contactsNotified} contacts notified.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to trigger SOS');
    } finally {
      setTriggering(false);
    }
  }, [position, contacts, triggerSOS, navigate]);

  const handleResolve = useCallback(async () => {
    try {
      await resolveSOS(activeSOS.sosId || activeSOS._id);
      toast.success('✅ Marked safe. All-clear sent to contacts.');
    } catch (err) {
      toast.error('Failed to resolve SOS');
    }
  }, [activeSOS, resolveSOS]);

  // Shake-to-SOS
  useShake(useCallback(() => {
    if (!activeSOS && position.lat && contacts.length > 0) {
      triggerSOS('shake', position.lat, position.lng).then((data) => {
        toast.success(`📳 Shake SOS! ${data.contactsNotified} contacts notified.`);
      }).catch(() => {});
    }
  }, [activeSOS, position, contacts, triggerSOS]), shakeEnabled);

  const formatTime = (d) => new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="page container">
      <div className="page-header" style={{ textAlign: 'center' }}>
        <div className="page-subtitle">Mission Control</div>
        <h1 className="page-title">SOS Dashboard</h1>
      </div>

      {/* Status */}
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <div className={`status-badge ${activeSOS ? 'danger' : 'safe'}`}>
          <span className="status-dot" />
          {activeSOS ? 'SOS ACTIVE' : 'ALL SYSTEMS SAFE'}
        </div>
      </div>

      {/* SOS Button */}
      <SOSButton
        onTrigger={handleTrigger}
        isActive={!!activeSOS}
        onResolve={handleResolve}
        disabled={triggering || geoLoading}
      />

      {/* Tracking Link */}
      {activeSOS?.trackingId && (
        <div className="glass animate-fade-up" style={{ padding: '1rem', textAlign: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Live Tracking Link
          </span>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.5rem', wordBreak: 'break-all' }}>
            {window.location.origin}/track/{activeSOS.trackingId}
          </div>
        </div>
      )}

      {/* Info Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        {/* Location */}
        <div className="glass" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <HiOutlineMapPin size={16} style={{ color: 'var(--accent)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Location</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            {position.lat ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'Acquiring...'}
          </div>
        </div>

        {/* Shake Toggle */}
        <div className="glass shake-toggle" onClick={() => setShakeEnabled(!shakeEnabled)} style={{ cursor: 'pointer' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <HiOutlineDevicePhoneMobile size={16} style={{ color: shakeEnabled ? 'var(--safe-green)' : 'var(--text-muted)' }} />
              <span className="shake-label">Shake SOS</span>
            </div>
            <span className="shake-sublabel">{shakeEnabled ? 'Active' : 'Disabled'}</span>
          </div>
          <div className={`toggle ${shakeEnabled ? 'on' : ''}`} style={{ marginLeft: 'auto' }}>
            <div className="toggle-knob" />
          </div>
        </div>
      </div>

      {/* Quick Contacts */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="page-subtitle" style={{ marginBottom: '0.75rem' }}>Emergency Contacts</div>
        {contacts.length === 0 ? (
          <div className="glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>No contacts added yet</p>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/contacts')}>Add Contacts</button>
          </div>
        ) : (
          <div className="quick-contacts">
            {contacts.map((c) => (
              <div key={c._id} className="quick-contact">
                <div className="quick-contact-avatar">{c.name.charAt(0).toUpperCase()}</div>
                <span className="quick-contact-name">{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent History */}
      {history.length > 0 && (
        <div>
          <div className="page-subtitle" style={{ marginBottom: '0.75rem' }}>Recent Alerts</div>
          <div className="history-list">
            {history.map((h) => (
              <div key={h._id} className="history-item glass">
                <div className={`history-icon ${h.status === 'active' ? 'active' : 'resolved'}`}>
                  {h.status === 'active' ? '🔴' : '✅'}
                </div>
                <div className="history-details">
                  <div className="history-type">{h.triggerType === 'shake' ? '📳 Shake SOS' : '🔴 Tap SOS'}</div>
                  <div className="history-time">{formatTime(h.createdAt)}</div>
                </div>
                <span className={`history-status ${h.status === 'active' ? 'text-red' : 'text-green'}`}>{h.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
