const express = require('express');
const http = require('http');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const { setupLocationSocket } = require('./socket/locationSocket');
const errorMiddleware = require('./middleware/error.middleware');

// Load environment variables from parent directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Connect to MongoDB
connectDB();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Setup Socket.IO location streaming
setupLocationSocket(io);

// Make io accessible in routes
app.set('io', io);

// ──── Middleware ────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// ──── Routes ────
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/contacts', require('./routes/contact.routes'));
app.use('/api/sos', require('./routes/sos.routes'));
app.use('/api/tracking', require('./routes/tracking.routes'));
app.use('/api/map', require('./routes/map.routes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Sanket — Women Safety SOS',
    timestamp: new Date().toISOString(),
  });
});

// ──── Error Handling ────
app.use(errorMiddleware);

// ──── Start Server ────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🛡️  Sanket Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for live tracking`);
  console.log(`🌐 API: http://localhost:${PORT}/api\n`);
});
