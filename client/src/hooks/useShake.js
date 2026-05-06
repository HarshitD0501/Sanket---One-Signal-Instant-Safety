import { useEffect, useRef } from 'react';

const SHAKE_THRESHOLD = 25;
const SHAKE_TIMEOUT = 1000;

export default function useShake(onShake, enabled = false) {
  const lastUpdate = useRef(0);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastZ = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const handleMotion = (event) => {
      const { x, y, z } = event.accelerationIncludingGravity || {};
      if (x == null) return;

      const now = Date.now();
      if (now - lastUpdate.current < 100) return;

      const diffTime = now - lastUpdate.current;
      lastUpdate.current = now;

      const speed = Math.abs(x + y + z - lastX.current - lastY.current - lastZ.current) / diffTime * 10000;

      if (speed > SHAKE_THRESHOLD) {
        onShake();
      }

      lastX.current = x;
      lastY.current = y;
      lastZ.current = z;
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [onShake, enabled]);
}
