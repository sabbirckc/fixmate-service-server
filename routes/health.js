import { Router } from 'express'
import { getDb } from '../config/db.js'

const router = Router()

/**
 * GET /api/health
 * Comprehensive health check with DB ping and server uptime
 */
router.get('/', async (req, res) => {
  try {
    const db = getDb()
    const pingResult = await db.command({ ping: 1 })
    const isDbConnected = pingResult.ok === 1

    return res.json({
      status: isDbConnected ? 'healthy' : 'degraded',
      service: 'FixMate Service Backend',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())}s`,
      database: {
        connected: isDbConnected,
        name: db.databaseName
      },
      environment: process.env.NODE_ENV || 'development'
    })
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      service: 'FixMate Service Backend',
      error: error.message
    })
  }
})

export default router
