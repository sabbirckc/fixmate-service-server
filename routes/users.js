import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getCollections } from '../config/db.js'
import { verifyToken } from '../middlewares/auth.js'

const router = Router()

/**
 * PATCH /api/users/profile
 * Update profile details (Name, Phone, Area, Bio, Image)
 * Email and Role are read-only and immutable by user
 */
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { name, phone, area, bio, image } = req.body
    const userEmail = req.user.email

    const { users } = getCollections()
    const existing = await users.findOne({ email: userEmail })

    if (!existing) {
      return res.status(404).json({ success: false, message: 'User profile not found' })
    }

    const updateDoc = {
      updatedAt: new Date()
    }

    if (name !== undefined) updateDoc.name = name.trim()
    if (phone !== undefined) updateDoc.phone = phone.trim()
    if (area !== undefined) updateDoc.area = area.trim()
    if (bio !== undefined) updateDoc.bio = bio.trim()
    if (image !== undefined) updateDoc.image = image.trim()

    await users.updateOne({ email: userEmail }, { $set: updateDoc })

    const updatedUser = await users.findOne(
      { email: userEmail },
      { projection: { password: 0 } }
    )

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message })
  }
})

/**
 * GET /api/users/profile
 * Retrieve current user profile
 */
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email
    const { users } = getCollections()
    const user = await users.findOne({ email: userEmail }, { projection: { password: 0 } })

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    return res.json({ success: true, user })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user profile', error: error.message })
  }
})

export default router
