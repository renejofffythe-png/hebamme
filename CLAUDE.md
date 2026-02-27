# CLAUDE.md — Hebamme Buchungssystem

This file documents the codebase structure, conventions, and development workflows for AI assistants working on this project.

## Project Overview

A German-language **online booking and payment system** for a midwife (Hebamme) practice. Allows clients to browse courses, pay online (via Stripe), and receive automated invoices by email. Includes an admin dashboard for managing courses and viewing bookings.

**Primary directory:** `hebamme-buchungssystem-v3 Kopie/`

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Backend framework | Express.js 4.x |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
| Payments | Stripe (Elements + Webhooks) |
| Email | Nodemailer (SMTP/Gmail) |
| PDF | pdfkit + html-pdf-node |
| Data storage | JSON files (no database) |
| Language | JavaScript (no TypeScript) |

---

## Directory Structure

```
hebamme-buchungssystem-v3 Kopie/
├── src/                        # Backend source code
│   ├── server.js               # Main Express app & routes (entry point)
│   ├── courses.js              # Course data access layer (read/write JSON)
│   ├── mailer.js               # Email sending & HTML templates
│   ├── pdf.js                  # PDF invoice generation
│   └── admin-routes.js         # Admin API endpoints (auth, CRUD)
│
├── frontend/                   # Static frontend files
│   ├── index.html              # Customer booking page
│   ├── admin/
│   │   └── index.html          # Admin dashboard SPA
│   ├── agb.html                # Terms and conditions (German)
│   ├── teilnahmebedingungen.html # Participation terms
│   ├── storno.html             # Cancellation policy
│   └── setup-anleitung.html    # Setup guide
│
├── data/                       # Persistent JSON data (not committed)
│   ├── courses.json            # Course catalog
│   ├── bookings.json           # Booking records
│   └── waitlist.json           # Waitlist by course ID
│
├── package.json
├── README.md                   # German setup guide
└── .env                        # Environment config (not committed)
```

---

## Running the Project

```bash
cd "hebamme-buchungssystem-v3 Kopie"

# Install dependencies
npm install

# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

Server starts on `http://localhost:3000` by default.

**No build step is required** — frontend is served as static files directly by Express.

---

## Environment Variables

Create a `.env` file in the project root (alongside `package.json`). All keys below are required for full functionality:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx   # Gmail app-specific password (16 chars)
EMAIL_FROM_NAME=Hebamme Praxis
EMAIL_FROM_ADDRESS=your@gmail.com
ADMIN_EMAIL=admin@example.com

# App
PORT=3000
FRONTEND_URL=http://localhost:3000

# Admin panel
ADMIN_PASSWORD=change_this_in_production
```

**Never commit `.env` to version control.**

---

## Data Model (JSON files)

### courses.json
```json
[
  {
    "id": "gv-3-26",
    "type": "birth",
    "title": "Geburtsvorbereitung",
    "date": "Mo, 02.03.2026, 18–21 Uhr",
    "price": 18000,
    "currency": "eur",
    "capacity": 10,
    "enrolled": 3,
    "status": "open"
  }
]
```
- `price` is in **cents** (e.g., 18000 = 180,00 €)
- `status`: `"open"` | `"soon"` | `"done"`
- `type`: `"birth"` | `"recovery"`

### bookings.json
```json
[
  {
    "courseId": "gv-3-26",
    "paymentIntentId": "pi_...",
    "amount": 18000,
    "paymentMethod": "card",
    "participant": {
      "firstName": "...",
      "lastName": "...",
      "email": "...",
      "phone": "...",
      "dueDate": "...",
      "agbAccepted": true
    },
    "bookedAt": "2026-01-15T10:30:00.000Z"
  }
]
```

### waitlist.json
```json
{
  "gv-3-26": [
    { "email": "...", "name": "...", "addedAt": "..." }
  ]
}
```

---

## Key API Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/courses` | List all courses |
| `POST` | `/api/create-payment-intent` | Create Stripe payment intent |
| `POST` | `/api/confirm-booking` | Confirm booking after payment |
| `POST` | `/api/waitlist` | Join waitlist for a course |
| `POST` | `/api/webhook` | Stripe webhook (raw body required) |

### Admin (requires Bearer token)
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/login` | Authenticate, returns token |
| `GET` | `/api/admin/bookings` | All bookings |
| `GET` | `/api/admin/waitlist` | All waitlist entries |
| `POST` | `/api/admin/courses` | Create course |
| `PUT` | `/api/admin/courses/:id` | Update course |
| `DELETE` | `/api/admin/courses/:id` | Delete course |

**Admin auth:** Bearer token in `Authorization` header. Tokens expire after 8 hours and are stored **in-memory** (lost on server restart).

---

## Payment Flow

1. User selects course → fills form → clicks "Jetzt buchen"
2. Frontend calls `POST /api/create-payment-intent` with course ID + participant data
3. Server creates Stripe PaymentIntent, returns `client_secret`
4. Frontend renders Stripe Elements for card/PayPal/SEPA/Klarna
5. User submits payment → Stripe confirms
6. Frontend calls `POST /api/confirm-booking` with `paymentIntentId`
7. Server verifies payment with Stripe, saves booking, sends confirmation email + PDF invoice

---

## Email System (`src/mailer.js`)

- Uses **Nodemailer** with SMTP transport
- Sends HTML emails with embedded CSS (for email client compatibility)
- Two email templates:
  - **Participant confirmation** — booking details + PDF invoice attachment
  - **Admin notification** — new booking summary
- Invoice numbers start at 1000 and auto-increment (read from `data/bookings.json` count)
- PDF generation uses `pdfkit`

---

## Admin Panel (`frontend/admin/index.html`)

- Single-page application (vanilla JS, no framework)
- Password login → receives token → stores in `sessionStorage`
- Features: dashboard stats, course CRUD, bookings list, waitlist view
- Design: Cormorant Garamond + Jost fonts, neutral color palette

---

## Code Conventions

- **JavaScript only** — no TypeScript, no transpilation
- **No test framework** — tests must be run manually or with an external tool
- **Synchronous file I/O** — `fs.readFileSync`/`fs.writeFileSync` used for data storage
- **No ORM/database** — read/write raw JSON files directly
- **Mixed German/English** — German for user-facing strings and course data; English for code identifiers
- **Error handling** — try/catch blocks with `console.error`; email failures logged as warnings without crashing
- **No rate limiting** — not implemented; add if deploying publicly
- **No input validation library** — basic checks only; validate more thoroughly before production

### Data access pattern (courses.js)
```javascript
function readCourses() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeCourses(courses) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(courses, null, 2));
}
```

---

## Frontend Design System

### Frontend (index.html)
- **Fonts:** Fraunces (serif, headings) + DM Sans (body)
- **Colors:** Olive green (`#6b7c5c`), Earth brown (`#7a6045`), Sand (`#f5efe6`)
- **Text:** Dark ink (`#2a2318`)

### Admin (admin/index.html)
- **Fonts:** Cormorant Garamond + Jost
- **Colors:** Neutral palette, white background

---

## Known Limitations & Important Caveats

| Issue | Impact | Recommendation |
|---|---|---|
| JSON file storage | Not concurrent-safe; data loss risk under simultaneous writes | Add SQLite or similar before high traffic |
| In-memory session tokens | Tokens invalidated on every server restart | Use signed JWTs or persistent store |
| No rate limiting | Payment endpoints are open to abuse | Add `express-rate-limit` |
| No input validation library | Injection risks | Add `zod` or `express-validator` |
| No logging framework | Hard to debug in production | Add `pino` or `winston` |
| No CI/CD | Manual deployment only | Add GitHub Actions |
| No tests | Regressions untestable | Add Jest for unit tests |
| Hardcoded default password | Security risk | Always set `ADMIN_PASSWORD` via env |

---

## Legal / Compliance Notes

- Invoices are marked `§4 Nr. 14 UStG umsatzsteuerfrei` (VAT-exempt per German law for midwifery)
- Invoices require the practice's **Steuernummer**, **IBAN/BIC**, and **full address** — edit `src/pdf.js`
- `agb.html` and `teilnahmebedingungen.html` are placeholder templates — **require legal review before production use**

---

## Development Tips

- Use `npm run dev` for hot-reload during development
- Stripe test card: `4242 4242 4242 4242` (any future date, any CVC)
- Admin panel: `http://localhost:3000/admin` — default password is `ADMIN_PASSWORD` env var (or `hebamme2026`)
- To test webhooks locally, use [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:3000/api/webhook`
- Data files in `data/` are created automatically if missing; safe to delete for a clean reset

---

## Git Workflow

- Main branch: `master`
- Feature/AI branches: `claude/<task-id>` pattern
- Commit messages: English, imperative mood, concise (e.g., `Add waitlist email notification`)
