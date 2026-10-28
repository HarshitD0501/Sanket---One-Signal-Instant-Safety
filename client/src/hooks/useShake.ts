import { useEffect, useRef } from 'react';

export type MotionPermissionState = 'granted' | 'denied' | 'unsupported';

export async function requestMotionPermission(): Promise<MotionPermissionState> {
  if (typeof window === 'undefined') return 'unsupported';

  // iOS 13+ requires explicit permission request from a user gesture
  if (typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
    try {
      const response = await (DeviceMotionEvent as any).requestPermission();
      return response === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }

  // Modern Android and desktop browsers supporting DeviceMotionEvent don't require explicit permission
  if ('DeviceMotionEvent' in window) {
    return 'granted';
  }

  return 'unsupported';
}

export default function useShake(callback: () => void, enabled: boolean) {
  const lastAccel = useRef({ x: 0, y: 0, z: 0 });
  const lastTriggerTime = useRef<number>(0);
  const shakeThreshold = 30;
  const COOLDOWN_MS = 5000; // 5-second cooldown to prevent trigger storm

  useEffect(() => {
    if (!enabled) return;

    const handleMotion = (e: DeviceMotionEvent) => {
      const accel = e.accelerationIncludingGravity;
      if (!accel || accel.x === null || accel.y === null || accel.z === null) return;
      if (!Number.isFinite(accel.x) || !Number.isFinite(accel.y) || !Number.isFinite(accel.z)) return;

      const deltaX = Math.abs(accel.x - lastAccel.current.x);
      const deltaY = Math.abs(accel.y - lastAccel.current.y);
      const deltaZ = Math.abs(accel.z - lastAccel.current.z);

      if (deltaX + deltaY + deltaZ > shakeThreshold) {
        const now = Date.now();
        if (now - lastTriggerTime.current >= COOLDOWN_MS) {
          lastTriggerTime.current = now;
          callback();
        }
      }

      lastAccel.current = { x: accel.x, y: accel.y, z: accel.z };
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [callback, enabled]);
}
