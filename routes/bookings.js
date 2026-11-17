import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getCollections } from '../config/db.js'
import { verifyToken, verifyCustomer, verifyTechnician } from '../middlewares/auth.js'

const router = Router()

/**
 * POST /api/bookings
 * Create a new repair request (Customer only)
 */
router.post('/', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const {
      serviceId,
      customerPhone,
      address,
      preferredDate,
      problemDescription
    } = req.body

    const customerEmail = req.user.email
    const customerName = req.user.name || 'Valued Customer'

    // Validation
    if (!serviceId || !customerPhone || !address || !preferredDate || !problemDescription) {
      return res.status(400).json({
        success: false,
        message: 'All fields (serviceId, customerPhone, address, preferredDate, problemDescription) are required'
      })
    }

    if (problemDescription.trim().length < 20) {
      return res.status(400).json({
        success: false,
        message: 'Problem description must be at least 20 characters long'
      })
    }

    const bookingDate = new Date(preferredDate)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (isNaN(bookingDate.getTime()) || bookingDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Preferred date must be today or a future date'
      })
    }

    if (!ObjectId.isValid(serviceId)) {
      return res.status(400).json({ success: false, message: 'Invalid service ID format' })
    }

    const { services, bookings } = getCollections()
    const service = await services.findOne({ _id: new ObjectId(serviceId) })

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' })
    }

    if (service.approvalStatus !== 'approved' || !service.isAvailable) {
      return res.status(400).json({ success: false, message: 'This service is currently unavailable for booking' })
    }

    // Rule: Technicians/Admins cannot request repair, nor can anyone request their own service
    if (service.technicianEmail === customerEmail) {
      return res.status(400).json({ success: false, message: 'You cannot book your own service' })
    }

    // Rule: Prevent duplicate active requests for the same service
    const existingActiveBooking = await bookings.findOne({
      serviceId: service._id.toString(),
      customerEmail,
      status: { $in: ['requested', 'accepted', 'in-progress'] }
    })

    if (existingActiveBooking) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active request for this service'
      })
    }

    const now = new Date()
    const newBooking = {
      serviceId: service._id.toString(),
      serviceTitle: service.title,
      serviceImage: service.image,
      category: service.category,
      basePrice: service.basePrice,
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      customerName,
      customerEmail,
      customerPhone: customerPhone.trim(),
      address: address.trim(),
      preferredDate: bookingDate,
      problemDescription: problemDescription.trim(),
      status: 'requested',
      finalAmount: service.basePrice,
      paymentStatus: 'unpaid',
      createdAt: now,
      updatedAt: now,
      statusHistory: [
        {
          status: 'requested',
          changedAt: now,
          changedBy: customerEmail
        }
      ]
    }

    const result = await bookings.insertOne(newBooking)

    return res.status(201).json({
      success: true,
      message: 'Repair request submitted successfully',
      bookingId: result.insertedId,
      booking: { ...newBooking, _id: result.insertedId }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create booking', error: error.message })
  }
})

/**
 * GET /api/bookings/my
 * Customer views their own bookings
 */
router.get('/my', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { bookings } = getCollections()
    const customerEmail = req.user.email

    const myList = await bookings
      .find({ customerEmail })
      .sort({ createdAt: -1 })
      .toArray()

    return res.json({ success: true, bookings: myList })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch customer bookings', error: error.message })
  }
})

/**
 * PATCH /api/bookings/:id/cancel
 * Customer cancels booking (Only permitted while status === 'requested')
 */
router.patch('/:id/cancel', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { id } = req.params
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID format' })
    }

    const { bookings } = getCollections()
    const booking = await bookings.findOne({ _id: new ObjectId(id) })

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    // Customer isolation check
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only cancel your own bookings' })
    }

    // Pipeline rule: can only cancel if requested
    if (booking.status !== 'requested') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status '${booking.status}'. Cancellation is only allowed for 'requested' jobs.`
      })
    }

    const now = new Date()
    await bookings.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: { status: 'cancelled', updatedAt: now },
        $push: {
          statusHistory: {
            status: 'cancelled',
            changedAt: now,
            changedBy: req.user.email
          }
        }
      }
    )

    return res.json({ success: true, message: 'Booking cancelled successfully' })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to cancel booking', error: error.message })
  }
})

/**
 * GET /api/bookings/technician
 * Technician views requests assigned to them
 */
router.get('/technician', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { bookings } = getCollections()
    const technicianEmail = req.user.email
    const { status } = req.query

    const query = { technicianEmail }
    if (status && status !== 'all') {
      query.status = status
    }

    const technicianBookings = await bookings
      .find(query)
      .sort({ createdAt: -1 })
      .toArray()

    return res.json({ success: true, bookings: technicianBookings })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch technician requests', error: error.message })
  }
})

/**
 * PATCH /api/bookings/:id/status
 * Technician updates status with strict pipeline enforcement (Challenge 3)
 */
router.patch('/:id/status', verifyToken, verifyTechnician, async (req, res) => {
  try {
    const { id } = req.params
    const { nextStatus, finalAmount } = req.body

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID format' })
    }

    if (!nextStatus) {
      return res.status(400).json({ success: false, message: 'nextStatus is required' })
    }

    const { bookings } = getCollections()
    const booking = await bookings.findOne({ _id: new ObjectId(id) })

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    // Technician ownership validation
    if (booking.technicianEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only update bookings assigned to you' })
    }

    const currentStatus = booking.status
    const now = new Date()

    // Strict Pipeline Validation
    // requested -> accepted OR rejected
    // accepted -> in-progress
    // in-progress -> completed (requires finalAmount)
    const validTransitions = {
      requested: ['accepted', 'rejected'],
      accepted: ['in-progress'],
      'in-progress': ['completed']
    }

    const allowed = validTransitions[currentStatus]
    if (!allowed || !allowed.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${currentStatus}' to '${nextStatus}'.`
      })
    }

    const updateDoc = {
      status: nextStatus,
      updatedAt: now
    }

    // When marking 'completed', must send finalAmount > 0
    if (nextStatus === 'completed') {
      const amount = parseFloat(finalAmount)
      if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'A valid final amount greater than 0 is required to mark the job as completed.'
        })
      }
      updateDoc.finalAmount = amount
    }

    await bookings.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: updateDoc,
        $push: {
          statusHistory: {
            status: nextStatus,
            changedAt: now,
            changedBy: req.user.email
          }
        }
      }
    )

    return res.json({
      success: true,
      message: `Booking status successfully updated to '${nextStatus}'`,
      updatedStatus: nextStatus,
      finalAmount: updateDoc.finalAmount || booking.finalAmount
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update booking status', error: error.message })
  }
})

export default router
