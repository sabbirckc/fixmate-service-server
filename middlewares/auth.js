import jwt from 'jsonwebtoken'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import dotenv from 'dotenv'
import { getCollections } from '../config/db.js'

dotenv.config()

const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'
const JWT_SECRET = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || 'fixmate_super_secret_jwt_key_2026_secured'

// Initialize BetterAuth JWKS remote key set
let remoteJWKS = null
try {
  remoteJWKS = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`))
} catch (e) {
  console.warn('[Auth Middleware] JWKS URL setup notice:', e.message)
}

/**
 * Verify JWT Token Middleware
 * Structure:
 * 1. Extract Bearer token from Authorization header
 * 2. Verify JWT using Better Auth JWKS (with JWT secret fallback)
 * 3. Extract user information (email, role, name, id)
 * 4. Sync/Create user in database if not present
 * 5. Attach req.user for downstream controllers
 */
export async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: No token provided'
      })
    }

    const token = authHeader.split(' ')[1]
    let decoded = null

    // 1. Try verifying with BetterAuth JWKS
    if (remoteJWKS) {
      try {
        const { payload } = await jwtVerify(token, remoteJWKS)
        decoded = payload
      } catch (jwksErr) {
        // Fallback to local secret verification
      }
    }

    // 2. Fallback to HMAC JWT Secret verification if JWKS didn't match or was unreachable
    if (!decoded) {
      try {
        decoded = jwt.verify(token, JWT_SECRET)
      } catch (secretErr) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized: Invalid or expired token'
        })
      }
    }

    // 3. Extract user information from token payload
    const userEmail = decoded.email || decoded.sub
    if (!userEmail) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Token contains no valid user email'
      })
    }

    const userRole = decoded.role || 'customer'
    const userName = decoded.name || ''

    // 4. Sync / Create user in database (MongoDB users collection)
    const { users } = getCollections()
    let user = await users.findOne({ email: userEmail })

    if (!user) {
      const now = new Date()
      const newUser = {
        name: userName || 'FixMate User',
        email: userEmail,
        role: userRole,
        phone: decoded.phone || '',
        area: decoded.area || '',
        bio: decoded.bio || '',
        createdAt: now,
        updatedAt: now
      }
      const insertResult = await users.insertOne(newUser)
      user = { ...newUser, _id: insertResult.insertedId }
    }

    // 5. Attach req.user for downstream handlers and role middlewares
    req.user = {
      id: user._id.toString(),
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role || userRole,
      phone: user.phone || '',
      area: user.area || '',
      bio: user.bio || '',
      plan: user.plan || 'free'
    }

    next()
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Authentication failed',
      error: error.message
    })
  }
}

/**
 * Role Middleware: Verify Customer
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
 * Role Middleware: Verify Technician
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
 * Role Middleware: Verify Admin
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
 * Helper to generate signed JWT tokens
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}
