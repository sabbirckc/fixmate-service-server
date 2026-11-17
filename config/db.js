import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const uri = process.env.MONGODB_URI
if (!uri) {
  throw new Error("Please define the MONGODB_URI environment variable inside .env")
}

const client = new MongoClient(uri)
let db = null

export async function connectDB() {
  if (db) return db
  try {
    await client.connect()
    db = client.db('fixmate-service')
    console.log("Successfully connected to MongoDB Atlas (fixmate-service)")
    return db
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err)
    throw err
  }
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB() first.")
  }
  return db
}

export function getCollections() {
  const database = getDb()
  return {
    users: database.collection('users'),
    services: database.collection('services'),
    bookings: database.collection('bookings'),
    payments: database.collection('payments'),
  }
}

export { client }
