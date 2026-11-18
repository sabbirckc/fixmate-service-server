import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getCollections, getDb } from '../config/db.js'
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
    const db = getDb()
    const authUserCol = db.collection('user')

    const updateDoc = {
      updatedAt: new Date()
    }

    if (name !== undefined) updateDoc.name = typeof name === 'string' ? name.trim() : name
    if (phone !== undefined) updateDoc.phone = typeof phone === 'string' ? phone.trim() : phone
    if (area !== undefined) updateDoc.area = typeof area === 'string' ? area.trim() : area
    if (bio !== undefined) updateDoc.bio = typeof bio === 'string' ? bio.trim() : bio
    if (image !== undefined) updateDoc.image = typeof image === 'string' ? image.trim() : image

    // 1. Update or upsert in Express 'users' collection
    await users.updateOne(
      { email: userEmail },
      { 
        $set: updateDoc,
        $setOnInsert: {
          email: userEmail,
          role: req.user.role || 'customer',
          createdAt: new Date()
        }
      },
      { upsert: true }
    )

    // 2. Also update BetterAuth 'user' collection to keep session in sync
    await authUserCol.updateOne(
      { email: userEmail },
      { $set: updateDoc }
    ).catch(() => {})

    // 3. Fetch latest combined user to return
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
    const db = getDb()
    const authUserCol = db.collection('user')

    let user = await users.findOne({ email: userEmail }, { projection: { password: 0 } })
    const authUser = await authUserCol.findOne({ email: userEmail }, { projection: { password: 0 } }).catch(() => null)

    if (!user && !authUser) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const mergedUser = {
      ...authUser,
      ...user,
      email: userEmail,
      name: user?.name || authUser?.name || '',
      phone: user?.phone || authUser?.phone || '',
      area: user?.area || authUser?.area || '',
      bio: user?.bio || authUser?.bio || '',
      image: user?.image || authUser?.image || null,
      role: user?.role || authUser?.role || 'customer',
      plan: user?.plan || authUser?.plan || 'free'
    }

    return res.json({ success: true, user: mergedUser })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user profile', error: error.message })
  }
})

/**
 * POST /api/users/upgrade-pro
 * Optional Feature: Upgrade technician to Pro Plan (Unlimited services + Verified Pro badge)
 */
router.post('/upgrade-pro', verifyToken, async (req, res) => {
  return res.status(402).json({
    success: false,
    message: 'Payment Required: Upgrading to FixMate Verified Pro requires completing the $29 Stripe Checkout payment first.'
  })
})

export default router
