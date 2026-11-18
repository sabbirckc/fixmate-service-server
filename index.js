import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB } from './config/db.js'
import authRoutes from './routes/auth.js'
import serviceRoutes from './routes/services.js'
import bookingRoutes from './routes/bookings.js'
import paymentRoutes from './routes/payments.js'
import adminRoutes from './routes/admin.js'
import userRoutes from './routes/users.js'
import healthRoutes from './routes/health.js'
import { notFoundHandler, globalErrorHandler } from './middlewares/errorHandler.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 5000
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'
const allowedOrigins = [
  clientUrl,
  'http://localhost:3000',
  'http://localhost:5000',
  'https://fixmate-service.vercel.app',
  process.env.CLIENT_URL,
].filter(Boolean)

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. curl, postman, server-to-server)
    if (!origin) return callback(null, true)

    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      return callback(null, true)
    }

    // Fallback permit for deployed reviewer domains
    return callback(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'stripe-signature']
}))
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf
  }
}))

// Root & Health check endpoints
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'FixMate Service Express API Server is running',
    version: '1.0.0',
    documentation: {
      health: '/api/health',
      services: '/api/services',
      auth: '/api/auth'
    }
  })
})

// Routes
app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/users', userRoutes)

// 404 & Global Error Middlewares (Must be last)
app.use(notFoundHandler)
app.use(globalErrorHandler)

// Initialize database and start server
async function startServer() {
  try {
    await connectDB()
    app.listen(port, () => {
      console.log(`FixMate Server is running on port ${port}`)
    })
  } catch (error) {
    console.error("Error starting server:", error)
    process.exit(1)
  }
}

startServer()

export default app
