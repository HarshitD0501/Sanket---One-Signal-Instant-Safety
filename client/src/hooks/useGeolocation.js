import { useState, useEffect, useCallback } from 'react';

export default function useGeolocation() {
  const [position, setPosition] = useState({ lat: null, lng: null });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const updatePosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, []);

  useEffect(() => { updatePosition(); }, [updatePosition]);

  return { position, error, loading, refresh: updatePosition };
}
