import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { io } from 'socket.io-client';
import api from '../services/api';

interface Coord { lat: number; lng: number; timestamp?: string; }

const mapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b80' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] },
];

export default function TrackingPage() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [position, setPosition] = useState<Coord | null>(null);
  const [trail, setTrail] = useState<Coord[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [error, setError] = useState('');

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  useEffect(() => {
    if (!trackingId) return;

    api.get(`/tracking/${trackingId}`).then((res) => {
      const data = res.data.data;
      if (data?.location) {
        setPosition({ lat: data.location.lat, lng: data.location.lng });
      }
      if (data?.coordinates) {
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

    return () => { socket.disconnect(); };
  }, [trackingId]);

  if (error) {
    return (
      <div className="tracking-page flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ color: 'var(--accent)' }}>⚠️ {error}</h2>
        <p style={{ color: 'var(--text-muted)' }}>This SOS may have been resolved.</p>
      </div>
    );
  }

  if (!isLoaded || !position) {
    return <div className="tracking-page flex-center" style={{ minHeight: '100vh' }}><div className="loader" /></div>;
  }

  return (
    <div className="tracking-page">
      <div className="tracking-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="nav-logo" style={{ marginBottom: '0.25rem' }}>🛡️ <span>Sanket</span> — Live Tracking</div>
          {lastUpdate && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last update: {lastUpdate}</span>}
        </div>
        <div className="status-badge danger">
          <span className="status-dot" /> LIVE
        </div>
      </div>
      <div className="tracking-map">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{ lat: position.lat, lng: position.lng }}
          zoom={16}
          options={{ styles: mapStyles, disableDefaultUI: true, zoomControl: true }}
        >
          <Marker position={{ lat: position.lat, lng: position.lng }} label="🔴" />
          {trail.length > 1 && (
            <Polyline
              path={trail.map((c) => ({ lat: c.lat, lng: c.lng }))}
              options={{ strokeColor: '#FF3B5C', strokeWeight: 3, strokeOpacity: 0.7 }}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}
