const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { setupLocationSocket } = require('./socket/locationSocket');
const { recoverPendingSOSNotifications } = require('./services/sosNotification.service');
const errorMiddleware = require('./middleware/error.middleware');
const rateLimit = require('./middleware/rateLimit.middleware');
const securityHeaders = require('./middleware/securityHeaders.middleware');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

setupLocationSocket(io);
app.set('io', io);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(securityHeaders);
app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: 'Too many API requests. Please slow down and try again.',
}));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/contacts', require('./routes/contact.routes'));
app.use('/api/sos', require('./routes/sos.routes'));
app.use('/api/tracking', require('./routes/tracking.routes'));
app.use('/api/map', require('./routes/map.routes'));
app.use('/api/assistant', require('./routes/assistant.routes'));
app.use('/api/livekit', require('./routes/livekit.routes'));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    app: 'Sanket - Women Safety SOS',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ready', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;

  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ready' : 'not_ready',
    database: dbReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`\nSanket Server running on port ${PORT}`);
      console.log('Socket.IO ready for live tracking');
      console.log(`API: http://localhost:${PORT}/api\n`);
    });

    recoverPendingSOSNotifications().catch((error) => {
      console.error('Pending SOS notification recovery failed:', error.message);
    });
  } catch (_error) {
    console.error('Server startup aborted because MongoDB is not ready.');
    process.exit(1);
  }
};

startServer();
