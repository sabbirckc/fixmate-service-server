# FixMate Service API (Backend Server)

FixMate is a full-stack, role-based smart device & home appliance repair service booking platform built with Node.js, Express, MongoDB Atlas, JWT, and Stripe.

---

## 🛠️ Technology Stack
- **Runtime & Framework**: Node.js, Express.js (ES Modules)
- **Database**: MongoDB Atlas (`fixmate-service` database)
- **Authentication & Security**: Custom Role-based JWT middlewares (`verifyToken`, `verifyCustomer`, `verifyTechnician`, `verifyAdmin`)
- **Payments**: Stripe Checkout & Webhook API
- **CORS & Environment**: `cors`, `dotenv`

---

## 🔑 Test Credentials
| Role | Email | Password / Access |
| :--- | :--- | :--- |
| **Administrator** | `admin@fixmate.com` | Full platform monitoring, role management & service approval |
| **Technician 1** | `technician@fixmate.com` | Apple & Android mobile specialist, CRUD services & job pipeline |
| **Technician 2** | `karim@fixmate.com` | AC & home appliances specialist |
| **Customer** | `customer@fixmate.com` | Repair booking, cancellations & Stripe payment checkout |

---

## 🗄️ Database Collections (4 Core Collections)
1. **`users`**: User records, roles (`customer` | `technician` | `admin`), phone, area, bio.
2. **`services`**: Repair services created by technicians, approved by admin.
3. **`bookings`**: Customer repair requests governed by strict status pipeline.
4. **`payments`**: Idempotent Stripe payment records and transaction logs.

---

## 📡 API Endpoint Reference

### Public Endpoints
- `GET /` — API greeting & version
- `GET /api/health` — Service health check and MongoDB ping status
- `GET /api/services` — Server-side search, category filter, service mode filter, price sorting, and pagination
- `GET /api/services/featured` — Top 6 approved & available services for Home page
- `GET /api/services/:id` — Single service details with technician profile

### Auth Endpoints
- `POST /api/auth/jwt` — Generate/exchange JWT token for user session
- `GET /api/auth/me` — Verify current JWT token and retrieve payload

### Customer Endpoints (`verifyToken`, `verifyCustomer`)
- `POST /api/bookings` — Submit repair request (prevents duplicate active requests)
- `GET /api/bookings/my` — View logged-in customer's bookings
- `PATCH /api/bookings/:id/cancel` — Cancel booking (only if status is `requested`)
- `POST /api/payments/create-checkout-session` — Generate Stripe Checkout URL for completed & unpaid jobs
- `GET /api/payments/verify` — Verify Stripe session and record payment
- `GET /api/payments/my` — View customer's payment history

### Technician Endpoints (`verifyToken`, `verifyTechnician`)
- `POST /api/services` — Create new repair service (`approvalStatus: 'pending'`)
- `GET /api/services/technician/my` — List all services created by technician
- `PATCH /api/services/:id` — Edit service (resets `approvalStatus` to `'pending'`)
- `PATCH /api/services/:id/availability` — Toggle service availability (`isAvailable`)
- `DELETE /api/services/:id` — Delete service
- `GET /api/bookings/technician` — View bookings assigned to technician
- `PATCH /api/bookings/:id/status` — Advance status pipeline (`requested` → `accepted`/`rejected` → `in-progress` → `completed` with `finalAmount`)

### Administrator Endpoints (`verifyToken`, `verifyAdmin`)
- `GET /api/admin/overview` — Platform KPI statistics & total revenue
- `GET /api/admin/users` — View all registered users
- `PATCH /api/admin/users/:id/role` — Update user role (protects admin from self-modification)
- `GET /api/admin/services` — Moderation queue for services
- `PATCH /api/admin/services/:id/approval` — Approve (`'approved'`) or reject (`'rejected'`) service
- `GET /api/admin/bookings` — Platform-wide booking ledger
- `GET /api/admin/transactions` — Platform financial transactions & revenue

### Profile Endpoints (`verifyToken`)
- `GET /api/users/profile` — Get profile information
- `PATCH /api/users/profile` — Update Name, Phone, Area, Bio, Image

---

## ⚙️ Environment Variables (`.env`)
```env
PORT=5000
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret_key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## 🚀 Running Locally
```bash
# Install dependencies
npm install

# Seed realistic database records
npm run seed

# Start server
npm start
```
