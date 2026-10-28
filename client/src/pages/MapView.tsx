import { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FiNavigation, FiClock, FiCrosshair, FiX, FiStar } from 'react-icons/fi';
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
interface EnrichedPlace extends SafePlace {
  _key: string;
  dist: number;
}
interface RouteInfo {
  coords: [number, number][];
  distance: number;
  duration: number;
  placeId: string;
}

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const OSRM = 'https://router.project-osrm.org/route/v1/driving';

const placeKey = (p: SafePlace, i: number) => p.id || `${p.category}-${i}`;

const normalizeSafeZones = (data: unknown): SafePlace[] => {
  if (!Array.isArray(data)) return [];
  return data.flatMap((category): SafePlace[] => {
    const group = category as SafeZoneCategory;
    if (group.category !== 'police' && group.category !== 'hospital') return [];
    if (!Array.isArray(group.places)) return [];
    return group.places
      .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng))
      .map((place) => ({ ...place, category: group.category as 'police' | 'hospital', label: group.label }));
  });
};

// Haversine straight-line distance in meters.
const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const fmtDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
const fmtDuration = (s: number) => {
  const min = Math.round(s / 60);
  if (min < 1) return '<1 min';
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`;
};

const pin = (glyph: string, cls: string) =>
  L.divIcon({ className: '', html: `<span class="leaflet-pin ${cls}">${glyph}</span>`, iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -16] });

const userIcon = pin('●', 'pin-user');
const policeIcon = pin('🛡', 'pin-police');
const hospitalIcon = pin('✚', 'pin-hospital');

// Imperatively pans/fits the Leaflet map in response to data + selection.
function MapController({ center, places, route }: { center: { lat: number; lng: number }; places: EnrichedPlace[]; route: RouteInfo | null }) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = [[center.lat, center.lng], ...places.map((p) => [p.lat, p.lng] as [number, number])];
    if (pts.length > 1) map.fitBounds(pts, { padding: [48, 48] });
    else map.setView([center.lat, center.lng], 13);
  }, [map, center.lat, center.lng, places]);
  useEffect(() => {
    if (route && route.coords.length) map.fitBounds(route.coords, { padding: [64, 64] });
  }, [map, route]);
  return null;
}

export default function MapView() {
  const { position, loading: locationLoading, error: locationError } = useGeolocation();
  const [safePlaces, setSafePlaces] = useState<SafePlace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState('');

  const hasUserLocation = Boolean(
    position &&
    Number.isFinite(position.lat) &&
    Number.isFinite(position.lng) &&
    position.lat >= -90 &&
    position.lat <= 90 &&
    position.lng >= -180 &&
    position.lng <= 180
  );

  const center = useMemo(
    () => (hasUserLocation && position ? { lat: position.lat, lng: position.lng } : DEFAULT_CENTER),
    [hasUserLocation, position]
  );

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

  const enriched = useMemo<EnrichedPlace[]>(
    () =>
      safePlaces
        .map((p, i) => ({ ...p, _key: placeKey(p, i), dist: haversine(center, p) }))
        .sort((a, b) => a.dist - b.dist),
    [safePlaces, center]
  );
  const police = useMemo(() => enriched.filter((p) => p.category === 'police'), [enriched]);
  const hospitals = useMemo(() => enriched.filter((p) => p.category === 'hospital'), [enriched]);

  const buildRoute = useCallback(
    async (place: EnrichedPlace) => {
      setSelectedId(place._key);
      setRoute(null);
      setRouteError('');
      if (!hasUserLocation || !position) {
        setRouteError('Enable location access to get directions.');
        return;
      }
      setRouteLoading(true);
      try {
        const url = `${OSRM}/${center.lng},${center.lat};${place.lng},${place.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const json = await res.json();
        const r = json.routes?.[0];
        if (!r) throw new Error('no route');
        setRoute({
          coords: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]),
          distance: r.distance,
          duration: r.duration,
          placeId: place._key,
        });
      } catch {
        setRouteError('Could not fetch a route right now. Please try again.');
      } finally {
        setRouteLoading(false);
      }
    },
    [center, hasUserLocation, position]
  );

  const clearRoute = () => {
    setRoute(null);
    setSelectedId(null);
    setRouteError('');
  };

  const selectedPlace = enriched.find((p) => p._key === selectedId) || null;

  const renderPlace = (p: EnrichedPlace) => (
    <button
      key={p._key}
      className={`zone-card ${p.category}${p._key === selectedId ? ' is-active' : ''}`}
      onClick={() => buildRoute(p)}
    >
      <span className={`zone-ico ${p.category}`}>{p.category === 'police' ? '🛡' : '✚'}</span>
      <span className="zone-body">
        <span className="zone-name">{p.name}</span>
        <span className="zone-meta">
          <span>{fmtDistance(p.dist)} away</span>
          {p.rating ? (<span className="zone-rating"><FiStar /> {p.rating}</span>) : null}
          {p.isOpen === true && <span className="zone-open">Open</span>}
        </span>
        {(p.address || p.vicinity) && <span className="zone-addr">{p.address || p.vicinity}</span>}
      </span>
      <span className="zone-go"><FiNavigation /></span>
    </button>
  );

  return (
    <div className="map-page">
      <header className="map-head glass">
        <div className="map-head-titles">
          <span className="page-subtitle">Nearby Help</span>
          <h1 className="page-title">Safe Zones &amp; Routes</h1>
          <p className="map-head-sub">
            A live street map of the closest police stations and hospitals — tap any one for the fastest route from your location.
          </p>
        </div>
        <div className="map-head-stats">
          <div className="map-stat police"><span className="map-stat-num">{police.length}</span><span className="map-stat-label">Police</span></div>
          <div className="map-stat hospital"><span className="map-stat-num">{hospitals.length}</span><span className="map-stat-label">Hospitals</span></div>
          <button className="btn btn-outline btn-sm" onClick={fetchSafeZones} disabled={loadingPlaces}>
            <FiCrosshair /> {loadingPlaces ? 'Scanning…' : 'Rescan'}
          </button>
        </div>
      </header>

      <div className="map-layout">
        <aside className="map-sidebar glass">
          {!hasUserLocation && !locationLoading && (
            <div
              className="map-alert"
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#d97706',
                borderColor: 'rgba(245, 158, 11, 0.25)',
                marginBottom: '0.75rem',
                fontSize: '0.8rem',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid',
              }}
            >
              📍 {locationError || 'GPS location not available. Showing default region (Delhi).'}&nbsp;Enable location permissions to find places and routes near you.
            </div>
          )}

          {route || routeLoading || routeError ? (
            <div className={`route-banner${routeError ? ' is-error' : ''}`}>
              <div className="route-banner-top">
                <span className="route-banner-label"><FiNavigation /> Route</span>
                <button className="route-clear" onClick={clearRoute} aria-label="Clear route"><FiX /></button>
              </div>
              <div className="route-banner-name">{selectedPlace?.name}</div>
              {routeLoading && <div className="route-stats route-calc"><span className="loader loader-sm" /> Calculating route…</div>}
              {routeError && !routeLoading && <div className="route-err">{routeError}</div>}
              {route && !routeLoading && (
                <div className="route-stats">
                  <span className="route-stat"><FiNavigation /> {fmtDistance(route.distance)}</span>
                  <span className="route-stat"><FiClock /> {fmtDuration(route.duration)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="route-hint">Tap a place to draw the fastest route from your live location.</div>
          )}

          {placesError && <div className="map-alert">{placesError}</div>}

          <div className="zone-scroll">
            <section className="zone-section">
              <h2 className="zone-head"><span className="zone-head-dot police" /> Police Stations <span className="zone-count">{police.length}</span></h2>
              {police.length ? police.map(renderPlace) : <p className="zone-empty">No police stations found nearby.</p>}
            </section>
            <section className="zone-section">
              <h2 className="zone-head"><span className="zone-head-dot hospital" /> Hospitals <span className="zone-count">{hospitals.length}</span></h2>
              {hospitals.length ? hospitals.map(renderPlace) : <p className="zone-empty">No hospitals found nearby.</p>}
            </section>
          </div>
        </aside>

        <div className="map-canvas-shell">
          <MapContainer center={[center.lat, center.lng]} zoom={13} className="leaflet-canvas" zoomControl scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {hasUserLocation && position && (
              <Marker position={[position.lat, position.lng]} icon={userIcon}>
                <Popup><strong>You are here</strong></Popup>
              </Marker>
            )}
            {enriched.map((p) => (
              <Marker
                key={p._key}
                position={[p.lat, p.lng]}
                icon={p.category === 'police' ? policeIcon : hospitalIcon}
                eventHandlers={{ click: () => setSelectedId(p._key) }}
              >
                <Popup>
                  <div className="map-popup">
                    <strong>{p.name}</strong>
                    <span>{p.address || p.vicinity || p.label}</span>
                    <span className="map-popup-dist">{fmtDistance(p.dist)} away</span>
                    <button className="btn btn-primary btn-sm" onClick={() => buildRoute(p)}><FiNavigation /> Directions</button>
                  </div>
                </Popup>
              </Marker>
            ))}
            {route && <Polyline positions={route.coords} pathOptions={{ color: '#2e5bff', weight: 5, opacity: 0.85 }} />}
            <MapController center={center} places={enriched} route={route} />
          </MapContainer>
          {(loadingPlaces || locationLoading) && (
            <div className="map-loading-pill glass">{locationLoading ? 'Finding your location…' : 'Loading nearby help…'}</div>
          )}
        </div>

      </div>
    </div>
  );
}
