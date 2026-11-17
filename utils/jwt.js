import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || process.env.BETTER_AUTH_SECRET || 'fixmate_jwt_secret_key_2026'

/**
 * Sign payload to generate JWT
 */
export function signJwt(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

/**
 * Verify token and return decoded payload
 */
export function verifyJwt(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return reject(err)
      resolve(decoded)
    })
  })
}

/**
 * Decode token without verification (for inspections)
 */
export function decodeJwt(token) {
  return jwt.decode(token)
}
