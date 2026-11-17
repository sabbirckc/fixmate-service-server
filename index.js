import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { connectDB } from './config/db.js'
import authRoutes from './routes/auth.js'
import serviceRoutes from './routes/services.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 5000
const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'

// Middleware
app.use(cors({
  origin: [clientUrl, 'http://localhost:3000', 'https://fixmate-service.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/services', serviceRoutes)

// Root & Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'FixMate Service API',
    version: '1.0.0'
  })
})

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'FixMate Express Server is running and connected',
    timestamp: new Date().toISOString()
  })
})

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
