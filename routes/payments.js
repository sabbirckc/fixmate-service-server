import { Router } from 'express'
import { ObjectId } from 'mongodb'
import Stripe from 'stripe'
import dotenv from 'dotenv'
import { getCollections } from '../config/db.js'
import { verifyToken, verifyCustomer } from '../middlewares/auth.js'

dotenv.config()

const router = Router()
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_fixmate_key'
const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'

/**
 * POST /api/payments/create-checkout-session
 * Creates a Stripe Checkout Session for a completed & unpaid booking (Customer only)
 */
router.post('/create-checkout-session', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { bookingId } = req.body

    if (!bookingId || !ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Valid booking ID is required' })
    }

    const { bookings } = getCollections()
    const booking = await bookings.findOne({ _id: new ObjectId(bookingId) })

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    // Customer isolation check
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only pay for your own bookings' })
    }

    // Business rule: Payment only possible when status === 'completed' and paymentStatus === 'unpaid'
    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Payment not permitted. Current job status is '${booking.status}'. Jobs can only be paid when 'completed'.`
      })
    }

    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'This booking has already been paid.' })
    }

    const amount = booking.finalAmount || booking.basePrice
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid final amount for booking' })
    }

    const unitAmountCents = Math.round(amount * 100)

    // Check if real Stripe key is provided
    const isMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_mock')

    if (isMock) {
      // Test simulation session for seamless testing without crashing
      const mockSessionId = `cs_test_sim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const simulatedUrl = `${clientUrl}/payment/success?session_id=${mockSessionId}&booking_id=${booking._id.toString()}&simulated=true`

      return res.json({
        success: true,
        sessionId: mockSessionId,
        url: simulatedUrl,
        isSimulated: true
      })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `FixMate Repair: ${booking.serviceTitle}`,
              description: `Technician: ${booking.technicianName} | Category: ${booking.category}`,
              images: booking.serviceImage ? [booking.serviceImage] : []
            },
            unit_amount: unitAmountCents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/payment/cancel?booking_id=${booking._id.toString()}`,
      metadata: {
        bookingId: booking._id.toString(),
        customerEmail: booking.customerEmail,
        technicianEmail: booking.technicianEmail
      }
    })

    return res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create Stripe checkout session',
      error: error.message
    })
  }
})

/**
 * GET /api/payments/verify
 * Verifies payment session and records payment document (Idempotent)
 */
router.get('/verify', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { session_id, booking_id } = req.query

    if (!session_id) {
      return res.status(400).json({ success: false, message: 'Session ID is required' })
    }

    const { payments, bookings } = getCollections()

    // 1. Check if already recorded (Idempotency check)
    const existingPayment = await payments.findOne({ stripeSessionId: session_id })
    if (existingPayment) {
      return res.json({
        success: true,
        message: 'Payment verified (already recorded)',
        payment: existingPayment
      })
    }

    let bookingTargetId = booking_id
    let transactionId = `txn_${Date.now()}`
    let paidAmount = 0

    const isMockSession = String(session_id).startsWith('cs_test_sim_')
    if (isMockSession) {
      if (!bookingTargetId || !ObjectId.isValid(bookingTargetId)) {
        return res.status(400).json({ success: false, message: 'Valid booking ID required for verification' })
      }
      const b = await bookings.findOne({ _id: new ObjectId(bookingTargetId) })
      if (!b) return res.status(404).json({ success: false, message: 'Booking not found' })
      paidAmount = b.finalAmount || b.basePrice
    } else {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ success: false, message: 'Payment has not been completed on Stripe' })
      }
      bookingTargetId = session.metadata?.bookingId
      transactionId = session.payment_intent ? String(session.payment_intent) : `txn_${session.id}`
      paidAmount = (session.amount_total || 0) / 100
    }

    if (!bookingTargetId || !ObjectId.isValid(bookingTargetId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID associated with session' })
    }

    const booking = await bookings.findOne({ _id: new ObjectId(bookingTargetId) })
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' })
    }

    const now = new Date()
    const paymentDoc = {
      bookingId: booking._id.toString(),
      serviceTitle: booking.serviceTitle,
      customerName: booking.customerName,
      customerEmail: booking.customerEmail,
      technicianName: booking.technicianName,
      technicianEmail: booking.technicianEmail,
      amount: paidAmount || booking.finalAmount || booking.basePrice,
      currency: 'usd',
      transactionId,
      stripeSessionId: String(session_id),
      paymentStatus: 'paid',
      paidAt: now
    }

    // Insert payment record
    const paymentResult = await payments.insertOne(paymentDoc)

    // Update booking status
    await bookings.updateOne(
      { _id: booking._id },
      {
        $set: {
          paymentStatus: 'paid',
          updatedAt: now
        },
        $push: {
          statusHistory: {
            status: 'paid',
            changedAt: now,
            changedBy: req.user.email
          }
        }
      }
    )

    return res.json({
      success: true,
      message: 'Payment recorded and verified successfully',
      payment: { ...paymentDoc, _id: paymentResult.insertedId }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    })
  }
})

/**
 * GET /api/payments/my
 * Customer views their own payment transactions
 */
router.get('/my', verifyToken, verifyCustomer, async (req, res) => {
  try {
    const { payments } = getCollections()
    const customerEmail = req.user.email

    const myList = await payments
      .find({ customerEmail })
      .sort({ paidAt: -1 })
      .toArray()

    return res.json({ success: true, payments: myList })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch customer payments', error: error.message })
  }
})

export default router
