import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { io } from 'socket.io-client';
import axios from 'axios';

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2236' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050508' }] },
];

export default function TrackingPage() {
  const { trackingId } = useParams();
  const [data, setData] = useState(null);
  const [coords, setCoords] = useState([]);
  const [currentPos, setCurrentPos] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  // Fetch initial tracking data
  useEffect(() => {
    axios.get(`/api/tracking/${trackingId}`)
      .then((r) => {
        const d = r.data.data;
        setData(d);
        setCoords(d.coordinates || []);
        if (d.coordinates?.length > 0) {
          const last = d.coordinates[d.coordinates.length - 1];
          setCurrentPos({ lat: last.lat, lng: last.lng });
          setLastUpdated(last.timestamp);
        } else if (d.location) {
          setCurrentPos({ lat: d.location.lat, lng: d.location.lng });
        }
      })
      .catch(() => setError('Tracking link not found or expired.'));
  }, [trackingId]);

  // Socket.IO for live updates
  useEffect(() => {
    if (!data || data.status !== 'active') return;
    const socket = io(window.location.origin, { transports: ['websocket', 'polling'] });
    socket.emit('join-tracking', trackingId);

    socket.on('location-updated', (loc) => {
      setCurrentPos({ lat: loc.lat, lng: loc.lng });
      setCoords((prev) => [...prev, loc]);
      setLastUpdated(loc.timestamp);
    });

    socket.on('sos-ended', () => {
      setData((prev) => prev ? { ...prev, status: 'resolved' } : prev);
    });

    return () => socket.disconnect();
  }, [data?.status, trackingId]);

  const timeSince = (ts) => {
    if (!ts) return '';
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 10) return 'Just now';
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  };

  if (error) {
    return (
      <div className="auth-page">
        <div className="glass-elevated" style={{ padding: '3rem', textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '0.5rem' }}>Link Not Found</h2>
          <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!data || !isLoaded) return <div className="flex-center" style={{ minHeight: '100vh' }}><div className="loader" /></div>;

  const center = currentPos || { lat: 28.6139, lng: 77.2090 };
  const polyPath = coords.map((c) => ({ lat: c.lat, lng: c.lng }));

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="tracking-header glass" style={{ borderRadius: 0 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.25rem' }}>
            Sanket Live Tracking
          </div>
          <div className="tracking-user">{data.userName}</div>
          <div className="tracking-meta">
            Triggered: {new Date(data.triggeredAt).toLocaleString('en-IN')}
            {data.location?.address && ` • ${data.location.address}`}
          </div>
        </div>
        <div>
          {data.status === 'active' ? (
            <div className="tracking-live">
              <span className="tracking-live-dot" />
              LIVE {lastUpdated && `• ${timeSince(lastUpdated)}`}
            </div>
          ) : (
            <div className="status-badge safe"><span className="status-dot" /> RESOLVED</div>
          )}
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1 }}>
        <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }} center={center} zoom={16}
          options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: true }}>

          {currentPos && <Marker position={currentPos}
            icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: data.status === 'active' ? '#ff3b5c' : '#00d4aa', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 }} />}

          {polyPath.length > 1 && (
            <Polyline path={polyPath}
              options={{ strokeColor: '#ff3b5c', strokeOpacity: 0.7, strokeWeight: 3 }} />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
