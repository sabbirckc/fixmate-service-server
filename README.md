# FixMate Server

## Purpose
FixMate Server is the backend REST API for the FixMate on-demand repair service platform. It manages role-based authentication, user records, technician service listings with administrative approval queues, customer booking lifecycles with strict status transitions, and secure Stripe payment processing.

## Live URL
[https://fixmate-service.vercel.app](https://fixmate-service.vercel.app)

## Admin Credentials
- **Email:** `admin@fixmate.com`
- **Password:** `Password123`

## Key Features
- **Role-Based Access Control:** Custom Express middlewares (`verifyToken`, `verifyCustomer`, `verifyTechnician`, `verifyAdmin`) enforcing role authorization and 401/403 status responses.
- **Server-Side Search, Filter & Sort:** MongoDB queries with regex search, category and service mode filters, price/date sorting, and pagination.
- **Server-Enforced Job Status Pipeline:** State machine transition validation preventing unauthorized status skips and restricting status updates to the assigned technician.
- **Stripe Checkout & Idempotent Verification:** Protected endpoints for Stripe session creation based on verified database amounts, with duplicate-safe payment recording.
- **Administrative Moderation APIs:** Endpoints for approving/rejecting technician service listings, updating user roles, and viewing global booking/payment ledgers.

## NPM Packages Used
- `express`
- `mongodb`
- `jsonwebtoken`
- `jose`
- `stripe`
- `cors`
- `dotenv`
