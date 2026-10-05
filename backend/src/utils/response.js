const AppError = require('./AppError');

const sendSuccess = (res, data = null, message = 'Success', statusCode = 200, meta = null) => {
  const response = {
    success: true,
    message,
    data,
  };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
};

const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  if (error.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token', 401);
  }
  if (error.name === 'TokenExpiredError') {
    error = new AppError('Token expired', 401);
  }
  if (error.code === 'P2002') {
    error = new AppError('Duplicate entry. This record already exists.', 409);
  }
  if (error.code === 'P2025') {
    error = new AppError('Record not found', 404);
  }

  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
  });
};

module.exports = { sendSuccess, notFoundHandler, errorHandler };
