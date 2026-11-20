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
    let user = await users.findOne({ email })

    if (!user) {
      const initialRole = role === 'technician' ? 'technician' : 'customer'
      const newUser = {
        email,
        name: name || '',
        role: initialRole,
        phone: '',
        area: '',
        bio: '',
        createdAt: new Date(),
        updatedAt: new Date()
      }
      const insertResult = await users.insertOne(newUser)
      user = { ...newUser, _id: insertResult.insertedId }
    }

    const userRole = user?.role || (role === 'technician' ? 'technician' : 'customer')
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
