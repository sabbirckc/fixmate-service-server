import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getCollections } from '../config/db.js'
import { verifyToken, verifyAdmin } from '../middlewares/auth.js'

const router = Router()

// All admin routes require verifyToken and verifyAdmin
router.use(verifyToken, verifyAdmin)

/**
 * GET /api/admin/overview
 * Dashboard stats: total users, technicians, pending services, total revenue
 */
router.get('/overview', async (req, res) => {
  try {
    const { users, services, bookings, payments } = getCollections()

    const [
      totalUsers,
      totalTechnicians,
      totalCustomers,
      pendingServices,
      totalApprovedServices,
      totalBookings,
      paymentList
    ] = await Promise.all([
      users.countDocuments(),
      users.countDocuments({ role: 'technician' }),
      users.countDocuments({ role: 'customer' }),
      services.countDocuments({ approvalStatus: 'pending' }),
      services.countDocuments({ approvalStatus: 'approved' }),
      bookings.countDocuments(),
      payments.find().toArray()
    ])

    const totalRevenue = paymentList.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)

    return res.json({
      success: true,
      stats: {
        totalUsers,
        totalTechnicians,
        totalCustomers,
        pendingServices,
        totalApprovedServices,
        totalBookings,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalTransactions: paymentList.length
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch admin overview', error: error.message })
  }
})

/**
 * GET /api/admin/users
 * Table of all users
 */
router.get('/users', async (req, res) => {
  try {
    const { users } = getCollections()
    const allUsers = await users
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .toArray()

    return res.json({ success: true, users: allUsers })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message })
  }
})

/**
 * PATCH /api/admin/users/:id/role
 * Admin updates a user's role (Rule: Admin cannot change their own role)
 */
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params
    const { role } = req.body

    if (!['customer', 'technician', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Role must be 'customer', 'technician', or 'admin'"
      })
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' })
    }

    const { users } = getCollections()
    const targetUser = await users.findOne({ _id: new ObjectId(id) })

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' })
    }

    // Rule: Admin cannot change their own role
    if (targetUser.email === req.user.email) {
      return res.status(400).json({
        success: false,
        message: 'Forbidden: Administrators cannot modify their own role.'
      })
    }

    await users.updateOne(
      { _id: new ObjectId(id) },
      { $set: { role, updatedAt: new Date() } }
    )

    return res.json({
      success: true,
      message: `User role successfully updated to '${role}'`,
      userId: id,
      newRole: role
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update user role', error: error.message })
  }
})

/**
 * GET /api/admin/services
 * Table of all services from all technicians with filter by approval status
 */
router.get('/services', async (req, res) => {
  try {
    const { status } = req.query
    const { services } = getCollections()

    const query = {}
    if (status && status !== 'all') {
      query.approvalStatus = status
    }

    // Default sorts pending services first, then newest
    const allServices = await services
      .find(query)
      .sort({ approvalStatus: 1, createdAt: -1 })
      .toArray()

    return res.json({ success: true, services: allServices })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch services for admin', error: error.message })
  }
})

/**
 * PATCH /api/admin/services/:id/approval
 * Approve or Reject any service
 */
router.patch('/services/:id/approval', async (req, res) => {
  try {
    const { id } = req.params
    const { approvalStatus } = req.body

    if (!['approved', 'rejected', 'pending'].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval status. Must be 'approved', 'rejected', or 'pending'"
      })
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID format' })
    }

    const { services } = getCollections()
    const result = await services.updateOne(
      { _id: new ObjectId(id) },
      { $set: { approvalStatus, updatedAt: new Date() } }
    )

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'Service not found' })
    }

    return res.json({
      success: true,
      message: `Service approval status updated to '${approvalStatus}'`,
      serviceId: id,
      approvalStatus
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update service approval', error: error.message })
  }
})

/**
 * GET /api/admin/bookings
 * Read-only table of every booking on the platform
 */
router.get('/bookings', async (req, res) => {
  try {
    const { status } = req.query
    const { bookings } = getCollections()

    const query = {}
    if (status && status !== 'all') {
      query.status = status === "cancelled" ? { $in: ["cancelled", "rejected"] } : status
    }

    const allBookings = await bookings
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()

    return res.json({ success: true, bookings: allBookings })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch all bookings', error: error.message })
  }
})

/**
 * GET /api/admin/transactions
 * Table of every payment + total revenue calculation
 */
router.get('/transactions', async (req, res) => {
  try {
    const { payments } = getCollections()
    const allPayments = await payments
      .find()
      .sort({ paidAt: -1 })
      .toArray()

    const totalRevenue = allPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)

    return res.json({
      success: true,
      payments: allPayments,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      count: allPayments.length
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch transactions', error: error.message })
  }
})

export default router
