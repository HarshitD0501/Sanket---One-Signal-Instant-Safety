import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSOS } from '../context/SOSContext';
import useGeolocation from '../hooks/useGeolocation';
import useShake from '../hooks/useShake';
import SOSButton from '../components/app/SOSButton';
import api from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineMapPin, HiOutlineDevicePhoneMobile } from 'react-icons/hi2';
import type { EmergencyContact, SOSEvent } from '../types';

export default function Dashboard() {
  const { user } = useAuth();
  const { activeSOS, triggerSOS, resolveSOS, sendLocationUpdate, shakeEnabled, setShakeEnabled } = useSOS();
  const { position, loading: geoLoading } = useGeolocation();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [history, setHistory] = useState<SOSEvent[]>([]);
  const [triggering, setTriggering] = useState(false);
  const locationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();
  const hasUsableLocation = Number.isFinite(position.lat) && Number.isFinite(position.lng);

  useEffect(() => {
    api.get('/contacts').then((r) => setContacts(r.data.data)).catch(() => {});
    api.get('/sos/history').then((r) => setHistory(r.data.data.slice(0, 5))).catch(() => {});
  }, [activeSOS]);

  useEffect(() => {
    if (activeSOS) {
      locationInterval.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition((pos) => {
          sendLocationUpdate(pos.coords.latitude, pos.coords.longitude);
        });
      }, 5000);
    }
    return () => { if (locationInterval.current) clearInterval(locationInterval.current); };
  }, [activeSOS, sendLocationUpdate]);

  const handleTrigger = useCallback(async () => {
    if (triggering) return;
    if (!hasUsableLocation || geoLoading) return toast.error('Location not available. Please enable GPS.');

    setTriggering(true);
    const loadingToast = toast.loading('Triggering SOS...');

    try {
      const data = await triggerSOS('tap', position.lat, position.lng);
      toast.success(`SOS triggered! ${data.contactsNotified} contacts notified.`, { id: loadingToast });
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to trigger SOS';
      toast.error(message, { id: loadingToast });
      if (message.toLowerCase().includes('no emergency contacts')) {
        navigate('/app/contacts');
      }
    } finally {
      setTriggering(false);
    }
  }, [triggering, hasUsableLocation, geoLoading, triggerSOS, position.lat, position.lng, navigate]);

  const handleResolve = useCallback(async () => {
    try {
      await resolveSOS(activeSOS!.sosId || activeSOS!._id);
      toast.success('Marked safe. All-clear sent to contacts.');
    } catch {
      toast.error('Failed to resolve SOS');
    }
  }, [activeSOS, resolveSOS]);

  useShake(useCallback(() => {
    if (!activeSOS && !triggering && hasUsableLocation && !geoLoading) {
      setTriggering(true);
      const loadingToast = toast.loading('Triggering shake SOS...');

      triggerSOS('shake', position.lat, position.lng).then((data) => {
        toast.success(`Shake SOS triggered! ${data.contactsNotified} contacts notified.`, { id: loadingToast });
      }).catch((err: any) => {
        toast.error(err.response?.data?.message || 'Failed to trigger shake SOS', { id: loadingToast });
      }).finally(() => {
        setTriggering(false);
      });
    }
  }, [activeSOS, triggering, hasUsableLocation, geoLoading, triggerSOS, position.lat, position.lng]), shakeEnabled);

  const formatTime = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="dashboard">
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          Welcome back, <strong style={{ color: 'var(--text-primary)' }}>{user?.name}</strong>
        </p>
        <div className={`status-badge ${activeSOS || triggering ? 'danger' : 'safe'}`}>
          <span className="status-dot" />
          {triggering ? 'SOS TRIGGERING' : activeSOS ? 'SOS ACTIVE' : 'ALL SYSTEMS SAFE'}
        </div>
      </div>

      <SOSButton
        onTrigger={handleTrigger}
        isActive={!!activeSOS}
        isPending={triggering}
        onResolve={handleResolve}
        disabled={triggering}
      />

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

      <div className="info-grid">
        <div className="glass info-card">
          <div className="info-label">
            <HiOutlineMapPin size={14} style={{ color: 'var(--accent)' }} />
            Location
          </div>
          <div className="info-value">
            {hasUsableLocation ? `${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}` : 'Acquiring...'}
          </div>
        </div>
        <div className="glass info-card" onClick={() => setShakeEnabled(!shakeEnabled)} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="info-label">
                <HiOutlineDevicePhoneMobile size={14} style={{ color: shakeEnabled ? 'var(--safe)' : 'var(--text-muted)' }} />
                Shake SOS
              </div>
              <div className="info-value">{shakeEnabled ? 'Active' : 'Disabled'}</div>
            </div>
            <div className={`toggle ${shakeEnabled ? 'on' : ''}`}>
              <div className="toggle-knob" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <div className="page-subtitle" style={{ marginBottom: '0.75rem' }}>Emergency Contacts</div>
        {contacts.length === 0 ? (
          <div className="glass" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>No contacts added yet</p>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/app/contacts')}>Add Contacts</button>
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

      {history.length > 0 && (
        <div>
          <div className="page-subtitle" style={{ marginBottom: '0.75rem' }}>Recent Alerts</div>
          <div className="history-list">
            {history.map((h) => (
              <div key={h._id} className="history-item glass">
                <div className="history-type">{h.triggerType === 'shake' ? 'Shake' : 'Tap'}</div>
                <div className="history-time">{formatTime(h.createdAt)}</div>
                <span className={`history-status ${h.status === 'active' ? 'text-red' : 'text-green'}`}>{h.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
