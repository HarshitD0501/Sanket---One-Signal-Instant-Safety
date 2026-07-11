import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GoogleMap, InfoWindow, Marker, useJsApiLoader } from '@react-google-maps/api';
import useGeolocation from '../hooks/useGeolocation';
import api from '../services/api';

interface SafePlace {
  id?: string;
  name: string;
  address?: string;
  vicinity?: string;
  lat: number;
  lng: number;
  rating?: number | null;
  isOpen?: boolean | null;
  category: 'police' | 'hospital';
  label: string;
}

interface SafeZoneCategory {
  category: string;
  label: string;
  places: Omit<SafePlace, 'category' | 'label'>[];
}

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 };

const darkMapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#1f1f24' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#b5b5c0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1f1f24' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#40404a' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#292930' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#203229' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#34343c' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#232329' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a4140' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2e2e36' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111827' }] },
];

const normalizeSafeZones = (data: unknown): SafePlace[] => {
  if (!Array.isArray(data)) return [];

  return data.flatMap((category): SafePlace[] => {
    const group = category as SafeZoneCategory;
    if (group.category !== 'police' && group.category !== 'hospital') return [];
    if (!Array.isArray(group.places)) return [];

    return group.places
      .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
      .map((place) => ({
        ...place,
        category: group.category as 'police' | 'hospital',
        label: group.label,
      }));
  });
};

export default function MapView() {
  const { position, loading: locationLoading } = useGeolocation();
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([]);
  const [selected, setSelected] = useState<SafePlace | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState('');
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  });

  const hasUserLocation = Boolean(position.lat && position.lng);
  const center = useMemo(
    () => (hasUserLocation ? { lat: position.lat, lng: position.lng } : DEFAULT_CENTER),
    [hasUserLocation, position.lat, position.lng]
  );

  const markerIcon = useCallback((color: string, scale = 7): google.maps.Symbol => ({
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 0.95,
    strokeColor: '#f8fafc',
    strokeOpacity: 0.95,
    strokeWeight: 2,
    scale,
  }), []);

  const fetchSafeZones = useCallback(async () => {
    setLoadingPlaces(true);
    setPlacesError('');

    try {
      const res = await api.get(`/map/safe-zones/${center.lat}/${center.lng}?radius=10000`);
      setSafePlaces(normalizeSafeZones(res.data.data));
    } catch {
      setSafePlaces([]);
      setPlacesError('Unable to load nearby police stations and hospitals.');
    } finally {
      setLoadingPlaces(false);
    }
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (hasUserLocation) fetchSafeZones();
  }, [fetchSafeZones, hasUserLocation]);

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const bounds = new google.maps.LatLngBounds();
    if (hasUserLocation) bounds.extend(center);
    safePlaces.forEach((place) => bounds.extend({ lat: place.lat, lng: place.lng }));

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, 72);
    }
  }, [center, hasUserLocation, isLoaded, safePlaces]);

  const policeCount = safePlaces.filter((place) => place.category === 'police').length;
  const hospitalCount = safePlaces.filter((place) => place.category === 'hospital').length;

  if (loadError) {
    return (
      <div className="map-page">
        <div className="map-state glass">
          Map could not load. Check that the browser Google Maps API key is valid and enabled.
        </div>
      </div>
    );
  }

  return (
    <div className="map-page">
      <div className="map-toolbar glass">
        <div>
          <div className="page-subtitle">Nearby Help</div>
          <h1 className="page-title">Map</h1>
        </div>
        <div className="map-legend">
          <span><i className="map-dot map-dot-user" /> You</span>
          <span><i className="map-dot map-dot-police" /> Police {policeCount ? `(${policeCount})` : ''}</span>
          <span><i className="map-dot map-dot-hospital" /> Hospital {hospitalCount ? `(${hospitalCount})` : ''}</span>
        </div>
      </div>

      {placesError && <div className="map-alert glass">{placesError}</div>}

      <div className="map-canvas-shell">
        {!isLoaded ? (
          <div className="map-state"><div className="loader" /></div>
        ) : (
          <GoogleMap
            mapContainerClassName="google-map-canvas"
            center={center}
            zoom={hasUserLocation ? 14 : 11}
            onLoad={(map) => { mapRef.current = map; }}
            options={{
              styles: darkMapStyles,
              backgroundColor: '#1f1f24',
              clickableIcons: false,
              fullscreenControl: true,
              gestureHandling: 'greedy',
              mapTypeControl: false,
              scrollwheel: true,
              streetViewControl: false,
              zoomControl: true,
            }}
          >
            {hasUserLocation && (
              <Marker
                position={center}
                icon={markerIcon('#00D4AA', 8)}
                title="Your current location"
              />
            )}

            {safePlaces.map((place, index) => (
              <Marker
                key={place.id || `${place.category}-${index}`}
                position={{ lat: place.lat, lng: place.lng }}
                icon={markerIcon(place.category === 'police' ? '#4A90E2' : '#FF5A6D')}
                title={place.name}
                onClick={() => setSelected(place)}
              />
            ))}

            {selected && (
              <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
                <div className="map-info-window">
                  <strong>{selected.name}</strong>
                  <p>{selected.address || selected.vicinity || selected.label}</p>
                  {selected.rating && <p>Rating: {selected.rating}</p>}
                  {selected.isOpen !== null && selected.isOpen !== undefined && (
                    <p>{selected.isOpen ? 'Open now' : 'May be closed'}</p>
                  )}
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}

        {(loadingPlaces || locationLoading) && (
          <div className="map-loading-pill glass">
            {locationLoading ? 'Finding your location...' : 'Loading nearby help...'}
          </div>
        )}
      </div>
    </div>
  );
}
