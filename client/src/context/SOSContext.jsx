import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import api from '../services/api';
import { useAuth } from './AuthContext';

const SOSContext = createContext(null);

export function SOSProvider({ children }) {
  const { user } = useAuth();
  const [activeSOS, setActiveSOS] = useState(null);
  const [shakeEnabled, setShakeEnabled] = useState(false);
  const socketRef = useRef(null);

  // Initialize Socket.IO
  useEffect(() => {
    if (!user) return;
    const socket = io(window.location.origin, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [user]);

  // Check for active SOS on mount
  useEffect(() => {
    if (!user) return;
    api.get('/sos/active').then((res) => {
      if (res.data.data) {
        setActiveSOS(res.data.data);
        socketRef.current?.emit('join-sos-room', res.data.data.trackingId);
      }
    }).catch(() => {});
  }, [user]);

  const triggerSOS = useCallback(async (triggerType, lat, lng) => {
    const res = await api.post('/sos/trigger', { triggerType, lat, lng });
    const data = res.data.data;
    setActiveSOS({ ...data, status: 'active' });
    socketRef.current?.emit('join-sos-room', data.trackingId);
    return data;
  }, []);

  const resolveSOS = useCallback(async (sosId) => {
    await api.patch(`/sos/${sosId}/resolve`, { status: 'resolved' });
    if (activeSOS?.trackingId) {
      socketRef.current?.emit('sos-resolved', activeSOS.trackingId);
    }
    setActiveSOS(null);
  }, [activeSOS]);

  const sendLocationUpdate = useCallback((lat, lng) => {
    if (!activeSOS) return;
    socketRef.current?.emit('location-update', {
      trackingId: activeSOS.trackingId,
      lat, lng,
      timestamp: new Date().toISOString(),
    });
    api.post('/tracking/update-location', { lat, lng }).catch(() => {});
  }, [activeSOS]);

  return (
    <SOSContext.Provider value={{
      activeSOS, triggerSOS, resolveSOS, sendLocationUpdate,
      shakeEnabled, setShakeEnabled, socket: socketRef.current,
    }}>
      {children}
    </SOSContext.Provider>
  );
}

export const useSOS = () => {
  const ctx = useContext(SOSContext);
  if (!ctx) throw new Error('useSOS must be used within SOSProvider');
  return ctx;
};
