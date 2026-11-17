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

/**
 * POST /api/users/upgrade-pro
 * Optional Feature: Upgrade technician to Pro Plan (Unlimited services + Verified Pro badge)
 */
router.post('/upgrade-pro', verifyToken, async (req, res) => {
  try {
    const userEmail = req.user.email
    const { users, payments } = getCollections()

    const user = await users.findOne({ email: userEmail })
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    const now = new Date()
    await users.updateOne(
      { email: userEmail },
      { $set: { plan: 'pro', upgradedAt: now } }
    )

    // Record subscription in payments
    const subscriptionRecord = {
      serviceTitle: 'FixMate Verified Pro Technician Subscription',
      customerName: user.name,
      customerEmail: user.email,
      technicianName: user.name,
      technicianEmail: user.email,
      amount: 29.00,
      currency: 'usd',
      transactionId: `sub_${Date.now()}`,
      stripeSessionId: `sub_session_${Date.now()}`,
      paymentStatus: 'paid',
      type: 'subscription',
      paidAt: now
    }
    await payments.insertOne(subscriptionRecord)

    return res.json({
      success: true,
      message: 'Congratulations! You are now upgraded to FixMate Verified Pro with unlimited listings.',
      plan: 'pro'
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to upgrade to Pro', error: error.message })
  }
})

export default router
