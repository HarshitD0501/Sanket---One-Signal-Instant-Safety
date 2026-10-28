import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import type { ActiveSOS } from '../types';
import { useAuth } from './AuthContext';

interface SOSContextType {
  activeSOS: ActiveSOS | null;
  shakeEnabled: boolean;
  setShakeEnabled: (v: boolean) => void;
  triggerSOS: (type: 'tap' | 'shake', lat: number, lng: number) => Promise<{ contactsNotified: number }>;
  resolveSOS: (sosId: string) => Promise<void>;
  sendLocationUpdate: (lat: number, lng: number) => void;
  rehydrateSOS: () => Promise<void>;
}

const SOSContext = createContext<SOSContextType | null>(null);

export function SOSProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [activeSOS, setActiveSOS] = useState<ActiveSOS | null>(null);
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  const fetchActiveSOS = useCallback(async () => {
    try {
      const res = await api.get('/sos/active');
      if (res.data?.data) {
        setActiveSOS(res.data.data);
      } else {
        setActiveSOS(null);
      }
    } catch {
      setActiveSOS(null);
    }
  }, []);

  useEffect(() => {
    // If user is not authenticated, clean up active state and socket
    if (!user) {
      setActiveSOS(null);
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const token = localStorage.getItem('sanket_token');
    if (!token) {
      setActiveSOS(null);
      return;
    }

    let isSubscribed = true;

    // Establish authenticated owner socket
    const s = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
    });
    setSocket(s);

    // Rehydrate active SOS for current session
    api.get('/sos/active')
      .then((r) => {
        if (isSubscribed) {
          if (r.data?.data) {
            setActiveSOS(r.data.data);
            s.emit('join-sos-room', r.data.data.trackingId);
          } else {
            setActiveSOS(null);
          }
        }
      })
      .catch(() => {
        if (isSubscribed) setActiveSOS(null);
      });

    return () => {
      isSubscribed = false;
      s.disconnect();
      setSocket(null);
    };
  }, [user]);

  const triggerSOS = useCallback(async (type: 'tap' | 'shake', lat: number, lng: number) => {
    const res = await api.post('/sos/trigger', { triggerType: type, lat, lng });
    setActiveSOS(res.data.data);
    if (socket && res.data.data?.trackingId) {
      socket.emit('join-sos-room', res.data.data.trackingId);
    }
    return { contactsNotified: res.data.data.contactsNotified || 0 };
  }, [socket]);

  const resolveSOS = useCallback(async (sosId: string) => {
    await api.patch(`/sos/${sosId}/resolve`);
    setActiveSOS(null);
  }, []);

  const sendLocationUpdate = useCallback((lat: number, lng: number) => {
    if (activeSOS) {
      api.post('/tracking/update-location', { lat, lng }).catch(() => {});
    }
  }, [activeSOS]);

  return (
    <SOSContext.Provider
      value={{
        activeSOS,
        shakeEnabled,
        setShakeEnabled,
        triggerSOS,
        resolveSOS,
        sendLocationUpdate,
        rehydrateSOS: fetchActiveSOS,
      }}
    >
      {children}
    </SOSContext.Provider>
  );
}

export function useSOS() {
  const ctx = useContext(SOSContext);
  if (!ctx) throw new Error('useSOS must be used within SOSProvider');
  return ctx;
}
