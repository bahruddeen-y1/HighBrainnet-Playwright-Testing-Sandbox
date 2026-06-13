const { ZodError } = require('zod');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const env = require('../config/env');

// 404 fallback
function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// Centralised error responder
function errorHandler(err, req, res, _next) {
  let status = 500;
  let message = 'Internal Server Error';
  let details;

  if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    details = err.flatten().fieldErrors;
  } else if (err instanceof ApiError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err?.code === 'P2002') {
    // Prisma unique constraint
    status = 409;
    message = 'Duplicate value';
    details = err.meta;
  } else if (err?.code === 'P2025') {
    status = 404;
    message = 'Record not found';
  } else if (err?.message) {
    message = err.message;
  }

  if (status >= 500) {
    logger.error(err.stack || err.message);
  } else {
    logger.warn(`${status} ${req.method} ${req.originalUrl} — ${message}`);
  }

  res.status(status).json({
    error: {
      message,
      ...(details ? { details } : {}),
      ...(env.isDev && status >= 500 ? { stack: err.stack } : {}),
    },
  });
}

module.exports = { notFoundHandler, errorHandler };
