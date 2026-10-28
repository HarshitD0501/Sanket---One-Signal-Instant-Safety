const crypto = require('crypto');

const errorMiddleware = (err, req, res, _next) => {
  const errorId = crypto.randomUUID();
  console.error(`❌ [Error ${errorId}]`, err.name || 'Error', ':', err.stack || err.message);

  // Sequelize validation error (safe 400 client error)
  if (err.name === 'SequelizeValidationError') {
    const messages = (err.errors || []).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: messages,
    });
  }

  // Sequelize unique-constraint violation (safe 400 client error)
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = (err.errors && err.errors[0] && err.errors[0].path) || 'value';
    return res.status(400).json({
      success: false,
      message: `${field} already exists.`,
    });
  }

  // Sequelize invalid type / bad UUID etc.
  if (err.name === 'SequelizeDatabaseError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid request data.',
    });
  }

  // Distinguish client errors (4xx) from internal server errors (5xx)
  const statusCode = Number(err.statusCode) || (err.status ? Number(err.status) : 500);
  const isClientError = statusCode >= 400 && statusCode < 500;

  // 5xx errors must NOT expose internal exception details or stack traces to clients (AUDIT-014)
  const responseMessage = isClientError
    ? (err.message || 'Bad Request')
    : 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message: responseMessage,
    errorId: isClientError ? undefined : errorId,
  });
};

module.exports = errorMiddleware;

