import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import type { ActiveSOS } from '../types';

interface SOSContextType {
  activeSOS: ActiveSOS | null;
  shakeEnabled: boolean;
  setShakeEnabled: (v: boolean) => void;
  triggerSOS: (type: 'tap' | 'shake', lat: number, lng: number) => Promise<{ contactsNotified: number }>;
  resolveSOS: (sosId: string) => Promise<void>;
  sendLocationUpdate: (lat: number, lng: number) => void;
}

const SOSContext = createContext<SOSContextType | null>(null);

export function SOSProvider({ children }: { children: ReactNode }) {
  const [activeSOS, setActiveSOS] = useState<ActiveSOS | null>(null);
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('sanket_token');
    if (!token) return;

    const s = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    setSocket(s);

    api.get('/sos/active').then((r) => {
      if (r.data.data) setActiveSOS(r.data.data);
    }).catch(() => {});

    return () => { s.disconnect(); };
  }, []);

  const triggerSOS = useCallback(async (type: 'tap' | 'shake', lat: number, lng: number) => {
    const res = await api.post('/sos/trigger', { triggerType: type, lat, lng });
    setActiveSOS(res.data.data);
    if (socket) {
      socket.emit('join-sos', res.data.data.trackingId);
    }
    return { contactsNotified: res.data.contactsNotified || 0 };
  }, [socket]);

  const resolveSOS = useCallback(async (sosId: string) => {
    await api.patch(`/sos/${sosId}/resolve`);
    setActiveSOS(null);
  }, []);

  const sendLocationUpdate = useCallback((lat: number, lng: number) => {
    if (socket && activeSOS) {
      socket.emit('location-update', {
        trackingId: activeSOS.trackingId,
        lat, lng,
        timestamp: new Date().toISOString(),
      });
      api.post('/tracking/update-location', { lat, lng }).catch(() => {});
    }
  }, [socket, activeSOS]);

  return (
    <SOSContext.Provider value={{ activeSOS, shakeEnabled, setShakeEnabled, triggerSOS, resolveSOS, sendLocationUpdate }}>
      {children}
    </SOSContext.Provider>
  );
}

export function useSOS() {
  const ctx = useContext(SOSContext);
  if (!ctx) throw new Error('useSOS must be used within SOSProvider');
  return ctx;
}
