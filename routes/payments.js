import { Router } from 'express'
import { ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import { getCollections } from '../config/db.js'
import { verifyToken, verifyCustomer } from '../middlewares/auth.js'
import { stripe, isStripeMock } from '../config/stripe.js'

dotenv.config()

const router = Router()
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
    const isMock = isStripeMock

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
      customer_email: booking.customerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `FixMate Repair: ${booking.serviceTitle}`,
              description: `Technician: ${booking.technicianName} | Category: ${booking.category}`,
              ...(booking.serviceImage && booking.serviceImage.startsWith('https://') ? { images: [booking.serviceImage] } : {})
            },
            unit_amount: unitAmountCents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${booking._id.toString()}`,
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
 * Handler for Payment Session Verification & MongoDB Update
 * Handles both POST and GET from client success page
 */
async function handlePaymentVerification(req, res) {
  try {
    const session_id = req.body?.session_id || req.query?.session_id
    const booking_id = req.body?.booking_id || req.query?.booking_id

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
      bookingTargetId = session.metadata?.bookingId || booking_id
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

    // Insert payment record into MongoDB payments collection
    const paymentResult = await payments.insertOne(paymentDoc)

    // Update booking status in MongoDB bookings collection to 'paid'
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
}

/**
 * POST & GET /api/payments/verify
 * Verifies payment session and updates MongoDB (Idempotent)
 */
router.post('/verify', verifyToken, verifyCustomer, handlePaymentVerification)
router.get('/verify', verifyToken, verifyCustomer, handlePaymentVerification)
router.post('/confirm', verifyToken, verifyCustomer, handlePaymentVerification)

/**
 * POST /api/payments/verify-pro
 * Verifies Stripe payment session for Technician Pro Plan upgrade
 */
router.post('/verify-pro', verifyToken, async (req, res) => {
  try {
    const session_id = req.body?.session_id || req.query?.session_id
    if (!session_id) {
      return res.status(400).json({ success: false, message: 'Session ID is required' })
    }

    const { payments, users } = getCollections()
    const technicianEmail = req.user.email

    // Idempotency check: see if already recorded
    const existingPayment = await payments.findOne({ stripeSessionId: String(session_id) })
    if (existingPayment) {
      await users.updateOne(
        { email: technicianEmail },
        { $set: { plan: 'pro', updatedAt: new Date() } }
      )
      return res.json({
        success: true,
        message: 'Verified Pro subscription active!',
        plan: 'pro',
        payment: existingPayment
      })
    }

    let transactionId = `sub_${Date.now()}`
    let paidAmount = 29.00

    const isMockSession = String(session_id).startsWith('cs_test_sim_')
    if (!isMockSession) {
      const session = await stripe.checkout.sessions.retrieve(session_id)
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ success: false, message: 'Payment has not been completed on Stripe' })
      }
      transactionId = session.payment_intent ? String(session.payment_intent) : `sub_${session.id}`
      paidAmount = (session.amount_total || 2900) / 100
    }

    const now = new Date()

    // 1. Update user to Pro in MongoDB
    await users.updateOne(
      { email: technicianEmail },
      { $set: { plan: 'pro', upgradedAt: now, updatedAt: now } }
    )

    // 2. Insert subscription payment record
    const paymentDoc = {
      serviceTitle: 'FixMate Verified Pro Technician Plan',
      customerName: req.user.name || 'Technician',
      customerEmail: technicianEmail,
      technicianName: req.user.name || 'Technician',
      technicianEmail: technicianEmail,
      amount: paidAmount,
      currency: 'usd',
      transactionId,
      stripeSessionId: String(session_id),
      paymentStatus: 'paid',
      type: 'subscription',
      paidAt: now
    }

    const insertResult = await payments.insertOne(paymentDoc)

    return res.json({
      success: true,
      message: 'Congratulations! You are now upgraded to FixMate Verified Pro with unlimited listings.',
      plan: 'pro',
      payment: { ...paymentDoc, _id: insertResult.insertedId }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to verify Pro upgrade payment',
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

/**
 * POST /api/payments/webhook
 * Stripe Webhook Handler for asynchronous fulfillment (Stripe Docs standard)
 */
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature']
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event
  try {
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(req.rawBody || JSON.stringify(req.body), sig, endpointSecret)
    } else {
      event = req.body
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const bookingId = session.metadata?.bookingId

    if (bookingId && ObjectId.isValid(bookingId)) {
      try {
        const { payments, bookings } = getCollections()
        const existing = await payments.findOne({ stripeSessionId: session.id })

        if (!existing) {
          const booking = await bookings.findOne({ _id: new ObjectId(bookingId) })
          if (booking) {
            const now = new Date()
            const paymentDoc = {
              bookingId: booking._id.toString(),
              serviceTitle: booking.serviceTitle,
              customerName: booking.customerName,
              customerEmail: booking.customerEmail,
              technicianName: booking.technicianName,
              technicianEmail: booking.technicianEmail,
              amount: (session.amount_total || 0) / 100 || booking.finalAmount || booking.basePrice,
              currency: session.currency || 'usd',
              transactionId: session.payment_intent ? String(session.payment_intent) : `txn_${session.id}`,
              stripeSessionId: session.id,
              paymentStatus: 'paid',
              paidAt: now,
              source: 'webhook'
            }

            await payments.insertOne(paymentDoc)
            await bookings.updateOne(
              { _id: booking._id },
              {
                $set: { paymentStatus: 'paid', updatedAt: now },
                $push: { statusHistory: { status: 'paid', changedAt: now, changedBy: 'stripe_webhook' } }
              }
            )
            console.log(`[Stripe Webhook] Successfully recorded payment for booking ${bookingId}`)
          }
        }
      } catch (dbErr) {
        console.error('[Stripe Webhook] Error updating database:', dbErr)
      }
    }
  }

  return res.json({ received: true })
})

export default router
