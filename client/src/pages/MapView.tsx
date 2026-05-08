import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import useGeolocation from '../hooks/useGeolocation';
import api from '../services/api';

interface SafeZone {
  name: string;
  lat: number;
  lng: number;
  type: string;
  vicinity?: string;
}

const mapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b80' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2a3e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

export default function MapView() {
  const { position } = useGeolocation();
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [selected, setSelected] = useState<SafeZone | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  const fetchSafeZones = useCallback(async () => {
    if (!position.lat) return;
    try {
      const res = await api.get(`/map/safe-zones/${position.lat}/${position.lng}`);
      setSafeZones(res.data.data || []);
    } catch { /* ignore */ }
  }, [position.lat, position.lng]);

  useEffect(() => { fetchSafeZones(); }, [fetchSafeZones]);

  if (!isLoaded) return <div className="flex-center" style={{ height: '100vh' }}><div className="loader" /></div>;

  return (
    <div className="map-page">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={position.lat ? { lat: position.lat, lng: position.lng } : { lat: 28.6139, lng: 77.2090 }}
        zoom={14}
        options={{ styles: mapStyles, disableDefaultUI: true, zoomControl: true }}
      >
        {position.lat && <Marker position={{ lat: position.lat, lng: position.lng }} label="📍" />}
        {safeZones.map((zone, i) => (
          <Marker
            key={i}
            position={{ lat: zone.lat, lng: zone.lng }}
            label={zone.type === 'police' ? '🚔' : '🏥'}
            onClick={() => setSelected(zone)}
          />
        ))}
        {selected && (
          <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
            <div style={{ color: '#000', padding: '0.25rem' }}>
              <strong>{selected.name}</strong>
              <p style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>{selected.vicinity}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}
