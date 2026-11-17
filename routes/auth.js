import { Router } from 'express'
import { generateToken, verifyToken } from '../middlewares/auth.js'
import { getCollections } from '../config/db.js'

const router = Router()

/**
 * Generate or refresh a JWT token for an authenticated user
 */
router.post('/jwt', async (req, res) => {
  try {
    const { email, role, name, id } = req.body

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' })
    }

    const { users } = getCollections()
    const user = await users.findOne({ email })

    const userRole = user?.role || role || 'customer'
    const userName = user?.name || name || ''
    const userId = user?._id?.toString() || id || ''

    const token = generateToken({
      id: userId,
      email,
      name: userName,
      role: userRole,
    })

    return res.json({
      success: true,
      token,
      user: {
        id: userId,
        email,
        name: userName,
        role: userRole,
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to generate JWT token',
      error: error.message
    })
  }
})

/**
 * Check current token status
 */
router.get('/me', verifyToken, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  })
})

export default router
