/**
 * Central 404 Route Not Found Middleware
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not Found',
    message: `The requested endpoint '${req.method} ${req.originalUrl}' does not exist.`
  });
}

/**
 * Central Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Unhandled Application Error:', err);

  // Body parser syntax error (invalid JSON)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Malformed JSON payload in request body.'
    });
  }

  // Database Duplicate Key Error
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A duplicate record already exists with the supplied unique identifier.'
    });
  }

  // General internal server error
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected server error occurred.'
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
