const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('🔑 Auth Middleware: No Bearer token provided in Authorization header.');
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user to request
    const user = await User.findById(decoded.id);
    if (!user) {
      console.warn(`🔑 Auth Middleware: User not found in database for ID ${decoded.id}`);
      return res.status(401).json({
        success: false,
        message: 'User not found. Token is invalid.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('🔑 Auth Middleware Error:', error.name, '-', error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
      });
    }
    next(error);
  }
};

module.exports = authMiddleware;
