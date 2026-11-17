import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || 'fixmate_jwt_secret_key_2026'

/**
 * Verify JWT Token Middleware
 * Rejects with 401 Unauthorized if token is missing or invalid
 */
export function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No token provided'
      })
    }

    const token = authHeader.split(' ')[1]
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Invalid or expired token'
        })
      }
      req.user = decoded
      next()
    })
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Authentication failed',
      error: error.message
    })
  }
}

/**
 * Verify Customer Middleware
 * Rejects with 403 Forbidden if user is not a customer
 */
export function verifyCustomer(req, res, next) {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Access restricted to customers only'
    })
  }
  next()
}

/**
 * Verify Technician Middleware
 * Rejects with 403 Forbidden if user is not a technician
 */
export function verifyTechnician(req, res, next) {
  if (!req.user || req.user.role !== 'technician') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Access restricted to technicians only'
    })
  }
  next()
}

/**
 * Verify Admin Middleware
 * Rejects with 403 Forbidden if user is not an admin
 */
export function verifyAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Access restricted to administrators only'
    })
  }
  next()
}

/**
 * Helper to generate JWT token for a user
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}
