/**
 * 404 Not Found Handler for unknown API endpoints
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  })
}

/**
 * Global Error Handler
 */
export function globalErrorHandler(err, req, res, next) {
  console.error("Global Error Handler caught an error:", err)

  const statusCode = err.statusCode || 500
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}
