import { useEffect, useRef } from 'react';

export default function useShake(callback: () => void, enabled: boolean) {
  const lastAccel = useRef({ x: 0, y: 0, z: 0 });
  const shakeThreshold = 30;

  useEffect(() => {
    if (!enabled) return;

    const handleMotion = (e: DeviceMotionEvent) => {
      const accel = e.accelerationIncludingGravity;
      if (!accel || accel.x === null || accel.y === null || accel.z === null) return;

      const deltaX = Math.abs(accel.x - lastAccel.current.x);
      const deltaY = Math.abs(accel.y - lastAccel.current.y);
      const deltaZ = Math.abs(accel.z - lastAccel.current.z);

      if (deltaX + deltaY + deltaZ > shakeThreshold) {
        callback();
      }

      lastAccel.current = { x: accel.x, y: accel.y, z: accel.z };
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [callback, enabled]);
}
