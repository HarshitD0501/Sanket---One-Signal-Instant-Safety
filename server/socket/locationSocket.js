const jwt = require('jsonwebtoken');
const SOSEvent = require('../models/SOSEvent');
const User = require('../models/User');

const TRACKING_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidTrackingId = (trackingId) => (
  typeof trackingId === 'string' && TRACKING_ID_PATTERN.test(trackingId)
);

const parseCoordinate = (value, min, max) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return number;
};

const getTokenFromSocket = (socket) => {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken.trim()) return authToken.trim();

  const header = socket.handshake.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }

  return null;
};

const authenticateSocket = async (socket) => {
  if (socket.data.user) return socket.data.user;

  const token = getTokenFromSocket(socket);
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('_id name');
    socket.data.user = user || null;
    return socket.data.user;
  } catch (_error) {
    socket.data.user = null;
    return null;
  }
};

const findOwnedActiveSOS = async (trackingId, userId) => {
  if (!isValidTrackingId(trackingId) || !userId) return null;

  return SOSEvent.findOne({
    trackingId,
    userId,
    status: 'active',
  }).select('_id trackingId userId');
};

const emitSocketError = (socket, message) => {
  socket.emit('socket-error', { success: false, message });
};

/**
 * Public viewers can subscribe to tracking updates, but only the authenticated
 * SOS owner can publish location updates or end-room notifications.
 */
const setupLocationSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    const joinOwnedSOSRoom = async (trackingId) => {
      try {
        const user = await authenticateSocket(socket);
        const activeSOS = await findOwnedActiveSOS(trackingId, user?._id);

        if (!activeSOS) {
          return emitSocketError(socket, 'You are not allowed to join this SOS room.');
        }

        socket.join(`sos-${trackingId}`);
        console.log(`Socket ${socket.id} joined owned room sos-${trackingId}`);
      } catch (error) {
        console.error('Socket join-sos-room error:', error.message);
        emitSocketError(socket, 'Unable to join SOS room.');
      }
    };

    socket.on('join-sos-room', joinOwnedSOSRoom);
    socket.on('join-sos', joinOwnedSOSRoom);

    socket.on('join-tracking', async (trackingId) => {
      try {
        if (!isValidTrackingId(trackingId)) {
          return emitSocketError(socket, 'Invalid tracking link.');
        }

        const sosEvent = await SOSEvent.findOne({ trackingId }).select('_id trackingId');
        if (!sosEvent) {
          return emitSocketError(socket, 'Tracking link not found.');
        }

        socket.join(`sos-${trackingId}`);
        console.log(`Viewer ${socket.id} joined tracking sos-${trackingId}`);
      } catch (error) {
        console.error('Socket join-tracking error:', error.message);
        emitSocketError(socket, 'Unable to join tracking room.');
      }
    });

    socket.on('location-update', async (data = {}) => {
      try {
        const { trackingId, timestamp } = data;
        const lat = parseCoordinate(data.lat, -90, 90);
        const lng = parseCoordinate(data.lng, -180, 180);
        const user = await authenticateSocket(socket);
        const activeSOS = await findOwnedActiveSOS(trackingId, user?._id);

        if (!activeSOS) {
          return emitSocketError(socket, 'You are not allowed to update this SOS location.');
        }

        if (lat === null || lng === null) {
          return emitSocketError(socket, 'Invalid location coordinates.');
        }

        socket.to(`sos-${trackingId}`).emit('location-updated', {
          lat,
          lng,
          timestamp: timestamp || new Date().toISOString(),
        });
      } catch (error) {
        console.error('Socket location-update error:', error.message);
        emitSocketError(socket, 'Unable to broadcast location update.');
      }
    });

    socket.on('sos-resolved', async (trackingId) => {
      try {
        const user = await authenticateSocket(socket);
        const activeSOS = await findOwnedActiveSOS(trackingId, user?._id);

        if (!activeSOS) {
          return emitSocketError(socket, 'You are not allowed to resolve this SOS room.');
        }

        io.to(`sos-${trackingId}`).emit('sos-ended', {
          message: 'SOS has been resolved. The user is safe.',
          timestamp: new Date().toISOString(),
        });
        console.log(`SOS resolved event emitted for room sos-${trackingId}`);
      } catch (error) {
        console.error('Socket sos-resolved error:', error.message);
        emitSocketError(socket, 'Unable to resolve SOS room.');
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = { setupLocationSocket };
