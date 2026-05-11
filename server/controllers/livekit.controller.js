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

    const requestedRoom = typeof req.body.roomName === 'string' ? req.body.roomName : '';
    const roomName = requestedRoom.match(/^sanket-assistant-[a-zA-Z0-9-]{6,64}$/)
      ? requestedRoom
      : `sanket-assistant-${crypto.randomUUID()}`;

    const identity = `guest-${crypto.randomUUID()}`;
    const participantName = typeof req.body.name === 'string' && req.body.name.trim()
      ? req.body.name.trim().slice(0, 40)
      : 'Sanket visitor';

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: participantName,
      ttl: '20m',
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
