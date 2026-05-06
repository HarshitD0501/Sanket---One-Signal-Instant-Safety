/**
 * Socket.IO handler for real-time location streaming during active SOS events
 */
const setupLocationSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`📡 Socket connected: ${socket.id}`);

    // User joins a tracking room (for broadcasting their location)
    socket.on('join-sos-room', (trackingId) => {
      socket.join(`sos-${trackingId}`);
      console.log(`🔗 Socket ${socket.id} joined room sos-${trackingId}`);
    });

    // Viewer joins a tracking room (to receive location updates)
    socket.on('join-tracking', (trackingId) => {
      socket.join(`sos-${trackingId}`);
      console.log(`👁️  Viewer ${socket.id} joined tracking sos-${trackingId}`);
    });

    // User sends GPS location update
    socket.on('location-update', (data) => {
      const { trackingId, lat, lng, timestamp } = data;

      // Broadcast to everyone in the room except the sender
      socket.to(`sos-${trackingId}`).emit('location-updated', {
        lat,
        lng,
        timestamp: timestamp || new Date().toISOString(),
      });
    });

    // SOS resolved — notify all viewers
    socket.on('sos-resolved', (trackingId) => {
      io.to(`sos-${trackingId}`).emit('sos-ended', {
        message: 'SOS has been resolved. The user is safe.',
        timestamp: new Date().toISOString(),
      });
      console.log(`✅ SOS resolved for room sos-${trackingId}`);
    });

    socket.on('disconnect', () => {
      console.log(`📡 Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = { setupLocationSocket };
