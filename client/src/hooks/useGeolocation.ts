import { useState, useEffect } from 'react';

export interface Position {
  lat: number;
  lng: number;
  accuracy?: number;
}

export default function useGeolocation() {
  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setLoading(false);
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (
          Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          latitude >= -90 &&
          latitude <= 90 &&
          longitude >= -180 &&
          longitude <= 180
        ) {
          setPosition({ lat: latitude, lng: longitude, accuracy });
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        let msg = 'Failed to acquire location.';
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission denied. Please enable GPS access.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is unavailable.';
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location request timed out.';
        }
        setError(msg);
        setLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  return { position, loading, error };
}
