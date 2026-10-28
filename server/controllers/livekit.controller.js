const crypto = require('crypto');
const { AccessToken } = require('livekit-server-sdk');

const createLiveKitToken = async (req, res, next) => {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.status(503).json({
        success: false,
        message: 'LiveKit is not configured.',
      });
    }

    const authorizedRoom = `sanket-assistant-${req.user.id}`;
    const requestedRoom = typeof req.body?.roomName === 'string' ? req.body.roomName.trim() : '';

    if (requestedRoom && requestedRoom !== authorizedRoom) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: You are not authorized to join the requested room.',
      });
    }

    const roomName = authorizedRoom;
    const identity = `user-${req.user.id}`;
    const participantName = typeof req.body?.name === 'string' && req.body.name.trim()
      ? req.body.name.trim().slice(0, 40)
      : (req.user.name || 'User');

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName,
      ttl: '15m',
    });

    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    res.json({
      success: true,
      data: {
        url: livekitUrl,
        token: await Promise.resolve(token.toJwt()),
        roomName,
        identity,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createLiveKitToken };
