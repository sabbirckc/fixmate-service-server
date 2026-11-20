import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getCollections, getDb } from '../config/db.js'
import { verifyToken } from '../middlewares/auth.js'

const router = Router()

/**
 * PATCH /api/users/profile
 * Update profile details (Name, Phone, Area, Bio, Image)
 * Email and Role are read-only and immutable by user
 * Cascades name and contact updates to services, bookings, and payments
 */
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { name, phone, area, bio, image } = req.body
    const userEmail = req.user.email

    const { users, services, bookings, payments } = getCollections()
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

    const emailRegex = new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')

    // 1. Update or upsert in Express 'users' collection
    await users.updateMany(
      { email: emailRegex },
      { $set: updateDoc }
    )

    const existingUser = await users.findOne({ email: emailRegex })
    if (!existingUser) {
      await users.insertOne({
        ...updateDoc,
        email: userEmail,
        role: req.user.role || 'customer',
        createdAt: new Date(),
      })
    }

    // 2. Also update BetterAuth 'user' collection to keep session in sync
    await authUserCol.updateMany(
      { email: emailRegex },
      { $set: updateDoc }
    ).catch(() => {})

    // 3. Cascade updates to services collection if user is a technician
    const serviceUpdates = { updatedAt: new Date() }
    if (updateDoc.name) serviceUpdates.technicianName = updateDoc.name
    if (updateDoc.image !== undefined) serviceUpdates.technicianImage = updateDoc.image
    if (updateDoc.phone !== undefined) serviceUpdates.technicianPhone = updateDoc.phone

    if (Object.keys(serviceUpdates).length > 1) {
      await services.updateMany(
        { technicianEmail: emailRegex },
        { $set: serviceUpdates }
      ).catch(() => {})
    }

    // 4. Cascade updates to bookings collection
    if (updateDoc.name) {
      // If user is the technician on the booking
      await bookings.updateMany(
        { technicianEmail: emailRegex },
        { $set: { technicianName: updateDoc.name, updatedAt: new Date() } }
      ).catch(() => {})

      // If user is the customer on the booking
      const custBookingUpdates = { customerName: updateDoc.name, updatedAt: new Date() }
      if (updateDoc.phone) custBookingUpdates.customerPhone = updateDoc.phone
      await bookings.updateMany(
        { customerEmail: emailRegex },
        { $set: custBookingUpdates }
      ).catch(() => {})
    } else if (updateDoc.phone) {
      await bookings.updateMany(
        { customerEmail: emailRegex },
        { $set: { customerPhone: updateDoc.phone, updatedAt: new Date() } }
      ).catch(() => {})
    }

    // 5. Cascade updates to payments collection
    if (updateDoc.name) {
      await payments.updateMany(
        { technicianEmail: emailRegex },
        { $set: { technicianName: updateDoc.name } }
      ).catch(() => {})

      await payments.updateMany(
        { customerEmail: emailRegex },
        { $set: { customerName: updateDoc.name } }
      ).catch(() => {})
    }

    // 6. Fetch latest combined user to return
    const updatedUser = await users.findOne(
      { email: emailRegex },
      { projection: { password: 0 } }
    )

    return res.json({
      success: true,
      message: 'Profile updated successfully across all platform records',
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
