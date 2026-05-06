import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import useGeolocation from '../hooks/useGeolocation';
import api from '../services/api';
import { HiOutlineBuildingOffice2 } from 'react-icons/hi2';

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1a2236' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#050508' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const MARKER_COLORS = { police: '#ff3b5c', hospital: '#3b82f6', fire_station: '#f59e0b' };
const MARKER_LABELS = { police: '🚔', hospital: '🏥', fire_station: '🚒' };

const containerStyle = { width: '100%', height: '100%' };

export default function MapView() {
  const { position } = useGeolocation();
  const [safeZones, setSafeZones] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [activeFilters, setActiveFilters] = useState(['police', 'hospital', 'fire_station']);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  useEffect(() => {
    if (!position.lat) return;
    api.get(`/map/safe-zones/${position.lat}/${position.lng}`)
      .then((r) => setSafeZones(r.data.data))
      .catch(() => {});
  }, [position.lat, position.lng]);

  const toggleFilter = (cat) => {
    setActiveFilters((prev) =>
      prev.includes(cat) ? prev.filter((f) => f !== cat) : [...prev, cat]
    );
  };

  const allPlaces = safeZones
    .filter((z) => activeFilters.includes(z.category))
    .flatMap((z) => z.places.map((p) => ({ ...p, category: z.category, icon: z.icon })));

  const center = position.lat ? { lat: position.lat, lng: position.lng } : { lat: 28.6139, lng: 77.2090 };

  if (!isLoaded) return <div className="page container"><div className="loader" /></div>;

  return (
    <div className="page container">
      <div className="page-header">
        <div className="page-subtitle">Safe Zone Radar</div>
        <h1 className="page-title">Nearby Safety</h1>
      </div>

      <div style={{ position: 'relative' }}>
        {/* Filter Chips */}
        <div className="map-overlay">
          {safeZones.map((z) => (
            <button key={z.category}
              className={`map-chip glass ${activeFilters.includes(z.category) ? 'active' : ''}`}
              onClick={() => toggleFilter(z.category)}>
              {z.icon} {z.label} ({z.places.length})
            </button>
          ))}
        </div>

        <div className="map-container">
          <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={14}
            options={{ styles: MAP_STYLES, disableDefaultUI: true, zoomControl: true }}>

            {/* User marker */}
            {position.lat && <Marker position={{ lat: position.lat, lng: position.lng }}
              icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#7c5cfc', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }} />}

            {/* Safe zone markers */}
            {allPlaces.map((p) => (
              <Marker key={p.id} position={{ lat: p.lat, lng: p.lng }}
                icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: MARKER_COLORS[p.category], fillOpacity: 0.9, strokeColor: '#fff', strokeWeight: 1 }}
                onClick={() => setSelectedPlace(p)} />
            ))}

            {selectedPlace && (
              <InfoWindow position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }} onCloseClick={() => setSelectedPlace(null)}>
                <div className="safe-zone-info" style={{ color: '#000' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{selectedPlace.icon} {selectedPlace.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 8 }}>{selectedPlace.address}</div>
                  {selectedPlace.rating && <div style={{ fontSize: '0.75rem' }}>⭐ {selectedPlace.rating}</div>}
                  <a href={`https://maps.google.com/maps?daddr=${selectedPlace.lat},${selectedPlace.lng}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-block', marginTop: 8, padding: '4px 12px', background: '#7c5cfc', color: '#fff', borderRadius: 6, fontSize: '0.75rem', textDecoration: 'none' }}>
                    Get Directions
                  </a>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </div>
    </div>
  );
}
