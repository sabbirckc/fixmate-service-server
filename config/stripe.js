import Stripe from 'stripe'
import dotenv from 'dotenv'

dotenv.config()

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_mock_fixmate_key'

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
  appInfo: {
    name: 'FixMate Service Platform',
    version: '1.0.0'
  }
})

export const isStripeMock = !process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith('sk_test_mock')

export function verifyWebhookSignature(payload, signature, endpointSecret) {
  return stripe.webhooks.constructEvent(payload, signature, endpointSecret)
}
