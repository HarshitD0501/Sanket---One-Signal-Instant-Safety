import { useState, useEffect } from 'react';

interface Position {
  lat: number;
  lng: number;
}

export default function useGeolocation() {
  const [position, setPosition] = useState<Position>({ lat: 0, lng: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLoading(false);
      return;
    }

    const watcher = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      () => setLoading(false),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  return { position, loading };
}
