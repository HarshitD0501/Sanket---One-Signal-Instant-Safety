import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import api from '../services/api';

interface Coord { lat: number; lng: number; timestamp?: string; }

const victimIcon = L.divIcon({
  className: '',
  html: '<span class="leaflet-pin pin-victim">●</span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Keep the map centred on the latest live position.
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng]); }, [map, lat, lng]);
  return null;
}

export default function TrackingPage() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [position, setPosition] = useState<Coord | null>(null);
  const [trail, setTrail] = useState<Coord[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<string>('active');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    if (!trackingId) return;

    api.get(`/tracking/${trackingId}`).then((res) => {
      const data = res.data.data;
      if (data?.userName) setUserName(data.userName);
      if (data?.status) {
        setStatus(data.status);
        if (data.status === 'resolved') {
          setStatusMessage('This emergency has been resolved. The user is safe.');
        } else if (data.status === 'false_alarm') {
          setStatusMessage('This emergency was marked as a false alarm.');
        }
      }
      if (data?.location) {
        setPosition({ lat: data.location.lat, lng: data.location.lng });
      }
      if (data?.coordinates && Array.isArray(data.coordinates)) {
        setTrail(data.coordinates);
      }
    }).catch(() => setError('Tracking link expired or invalid'));

    const socket = io(window.location.origin, { path: '/socket.io', transports: ['websocket', 'polling'] });
    socket.emit('join-tracking', trackingId);

    socket.on('location-updated', (data: Coord) => {
      setPosition({ lat: data.lat, lng: data.lng });
      setTrail((prev) => [...prev, data]);
      setLastUpdate(new Date().toLocaleTimeString());
    });

    socket.on('sos-ended', (data: { message?: string }) => {
      setStatus('resolved');
      setStatusMessage(data?.message || 'SOS has been resolved. The user is safe.');
    });

    socket.on('socket-error', (data: { message?: string }) => {
      if (data?.message?.includes('expired') || data?.message?.includes('not found')) {
        setError(data.message || 'Tracking link has expired.');
      }
    });

    return () => { socket.disconnect(); };
  }, [trackingId]);

  if (error) {
    return (
      <div className="tracking-page flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem', padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--accent)' }}>⚠️ {error}</h2>
        <p style={{ color: 'var(--text-muted)' }}>This tracking link may have expired or the emergency has ended.</p>
      </div>
    );
  }

  if (!position) {
    return <div className="tracking-page flex-center" style={{ minHeight: '100vh' }}><div className="loader" /></div>;
  }

  const isLive = status === 'active';

  return (
    <div className="tracking-page">
      <div className="tracking-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="nav-logo" style={{ marginBottom: '0.25rem' }}>
            🛡️ <span>Sanket</span> — {userName ? `${userName}'s Location` : 'Live Tracking'}
          </div>
          {lastUpdate && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last update: {lastUpdate}</span>}
        </div>
        {isLive ? (
          <div className="status-badge danger">
            <span className="status-dot" /> LIVE
          </div>
        ) : status === 'resolved' ? (
          <div className="status-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10B981', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
            <span className="status-dot" style={{ background: '#10B981' }} /> RESOLVED
          </div>
        ) : (
          <div className="status-badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', borderColor: 'rgba(245, 158, 11, 0.4)' }}>
            <span className="status-dot" style={{ background: '#F59E0B' }} /> FALSE ALARM
          </div>
        )}
      </div>

      {statusMessage && (
        <div style={{
          padding: '0.6rem 1rem',
          background: status === 'resolved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
          color: status === 'resolved' ? '#10B981' : '#F59E0B',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span>{status === 'resolved' ? '✅' : 'ℹ️'}</span>
          <span>{statusMessage}</span>
        </div>
      )}

      <div className="tracking-map">
        <MapContainer center={[position.lat, position.lng]} zoom={16} className="leaflet-canvas" zoomControl>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[position.lat, position.lng]} icon={victimIcon} />
          {trail.length > 1 && (
            <Polyline positions={trail.map((c) => [c.lat, c.lng])} pathOptions={{ color: isLive ? '#FF3B5C' : '#10B981', weight: 4, opacity: 0.75 }} />
          )}
          {isLive && <Recenter lat={position.lat} lng={position.lng} />}
        </MapContainer>
      </div>
    </div>
  );
}
