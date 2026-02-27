# CLAUDE.md — Hebamme Buchungssystem

This file provides context for AI assistants (Claude, Copilot, etc.) working on this codebase.

---

## Project Overview

**Hebamme Buchungssystem** is a course booking system for a German midwife (Hebamme). It allows pregnant participants to browse available courses, make payments (Stripe), and receive confirmation emails with PDF invoices. An admin dashboard lets the midwife manage courses, view bookings, and handle waitlists.

- **Language of the application:** German (UI text, email templates, comments, variable names)
- **Stack:** Node.js + Express backend, vanilla HTML/CSS/JS frontend, JSON file storage
- **No build step, no transpilation, no frontend framework**

---

## Repository Structure

```
hebamme/
├── src/                         # Backend source
│   ├── server.js                # Express app entry point, API routes, Stripe integration
│   ├── courses.js               # Data layer: CRUD for courses, bookings, waitlist
│   ├── admin-routes.js          # Admin-only API endpoints + auth middleware
│   ├── pdf.js                   # HTML invoice template generator
│   └── mailer.js                # Nodemailer email service + PDF attachment logic
├── frontend/                    # Static files served by Express
│   ├── index.html               # Main public booking page (~1800 lines)
│   ├── agb.html                 # Terms & Conditions
│   ├── teilnahmebedingungen.html# Participation terms
│   ├── storno.html              # Cancellation/refund policy
│   └── admin/
│       └── index.html           # Admin dashboard (~34k lines, vanilla JS SPA)
├── data/                        # JSON file-based persistence (gitignored in production)
│   ├── courses.json             # Course catalog
│   ├── bookings.json            # Confirmed booking records
│   └── waitlist.json            # Waitlist per course
├── package.json
├── README.md                    # German setup guide for non-technical users
└── CLAUDE.md                    # This file
```

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Server | Express v4 |
| Payment | Stripe v16 (card, SEPA, PayPal, Klarna) |
| Email | Nodemailer (Gmail SMTP) |
| PDF | html-pdf-node + pdfkit |
| Frontend | Vanilla HTML5 / CSS3 / JavaScript |
| Storage | JSON files (no database) |
| Dev reload | nodemon |

---

## Running the Project

```bash
# Install dependencies
npm install

# Development (with auto-reload)
npm run dev

# Production
npm start
```

The server starts on `http://localhost:3000` (or `PORT` from env).

- **Public site:** `http://localhost:3000`
- **Admin panel:** `http://localhost:3000/admin`

---

## Environment Variables

Create a `.env` file in the project root. No `.env.example` exists — use this reference:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Server
PORT=3000
FRONTEND_URL=http://localhost:3000

# Email (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=your-16-char-app-password

# Email display
EMAIL_FROM_NAME=Hebamme Kristina Schuldeis
EMAIL_FROM_ADDRESS=your.email@gmail.com
ADMIN_EMAIL=your.email@gmail.com

# Admin login
ADMIN_PASSWORD=hebamme2026
```

---

## API Routes

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/config` | Returns Stripe publishable key |
| `GET` | `/courses` | List all courses with availability |
| `POST` | `/create-payment-intent` | Create Stripe PaymentIntent |
| `POST` | `/confirm-booking` | Confirm booking post-payment |
| `POST` | `/waitlist` | Join course waitlist |
| `POST` | `/webhook` | Stripe webhook (payment events) |
| `GET` | `/health` | Health check |

### Admin Endpoints (require `x-admin-token` header)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/login` | Authenticate; returns token |
| `POST` | `/api/admin/logout` | Invalidate token |
| `GET` | `/api/admin/courses` | All courses |
| `POST` | `/api/admin/courses` | Create course |
| `PUT` | `/api/admin/courses/:id` | Update course |
| `DELETE` | `/api/admin/courses/:id` | Delete course |
| `GET` | `/api/admin/bookings` | All bookings |
| `GET` | `/api/admin/bookings/:courseId` | Bookings for one course |
| `GET` | `/api/admin/waitlist` | All waitlist entries |
| `DELETE` | `/api/admin/waitlist/:courseId/:email` | Remove from waitlist |
| `GET` | `/api/admin/stats` | Dashboard statistics |

---

## Data Models

### Course (`data/courses.json`)

```json
{
  "id": "gv-3-26",
  "type": "birth",
  "title": "Geburtsvorbereitung 3/26",
  "date": "Mo, 6. März 2026 – Mo, 27. April 2026 (8 Termine)",
  "price": 18000,
  "currency": "eur",
  "capacity": 8,
  "enrolled": 5,
  "status": "open"
}
```

- `id`: `{type-abbreviation}-{number}-{year}` (e.g. `gv-3-26`, `rb-1-26`)
- `price`: in **cents** (18000 = 180 €)
- `status`: `"open"` | `"soon"` | `"done"`
- `type`: `"birth"` | `"recovery"` | `"other"`

### Booking (`data/bookings.json`)

```json
{
  "courseId": "gv-3-26",
  "paymentIntentId": "pi_...",
  "amount": 18000,
  "paymentMethod": "card",
  "participant": {
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "phone": "+49123456789",
    "dueDate": "15.05.2026"
  },
  "bookedAt": "2026-02-20T10:00:00.000Z"
}
```

### Waitlist (`data/waitlist.json`)

```json
{
  "rb-1-26": [
    {
      "email": "jane@example.com",
      "name": "Jane Doe",
      "addedAt": "2026-02-20T10:00:00.000Z"
    }
  ]
}
```

---

## Key Conventions

### Naming

- **Course IDs:** `{type-prefix}-{sequence}-{2-digit-year}` — e.g. `gv-3-26`, `rb-2-26`
  - `gv` = Geburtsvorbereitung (birth prep)
  - `rb` = Rückbildung (postnatal recovery)
- **Invoice numbers:** `RE-{YYYY}-{NNNN}` (e.g. `RE-2026-1001`)
- **JS files:** camelCase
- **HTML files:** kebab-case
- **All user-facing text:** German

### Monetary values

Always store and transmit prices in **cents** (integer). Convert to euros only for display: `(price / 100).toFixed(2) + ' €'`.

### Admin Authentication

- Password is compared against `ADMIN_PASSWORD` env var
- Tokens are stored in-memory (lost on server restart — users must log in again)
- Token lifetime: 8 hours
- Pass token via `x-admin-token` request header or `token` query parameter

### Email Flow

When a booking is confirmed (`/confirm-booking`):
1. `mailer.js` generates an HTML invoice via `pdf.js`
2. `html-pdf-node` converts the HTML to a PDF buffer
3. Nodemailer sends two emails:
   - **To participant:** confirmation + PDF invoice attachment
   - **To admin (`ADMIN_EMAIL`):** notification of new booking

### Stripe Integration

- Use `create-payment-intent` to get a `clientSecret`
- Frontend uses Stripe Elements to collect payment
- `confirm-booking` is called from the frontend after Stripe confirms payment
- Webhook at `/webhook` handles `payment_intent.succeeded` for server-side verification

---

## Code Architecture Notes

### `src/server.js`
- Single Express file that wires all routes
- Serves static files: `frontend/` at `/`, `frontend/admin/` at `/admin`
- Applies raw body parsing for the Stripe webhook endpoint (must come before JSON middleware for that route)

### `src/courses.js`
- All data access goes through this module
- Reads/writes JSON files synchronously (small data set, acceptable)
- Exports: `getCourses`, `getBookings`, `getWaitlist`, `addBooking`, `addToWaitlist`, `updateCourse`, `deleteCourse`, `createCourse`

### `src/admin-routes.js`
- Exports an Express `Router`
- `authMiddleware` validates `x-admin-token` header against in-memory token store
- Stats endpoint aggregates revenue and enrollment metrics

### `frontend/index.html`
- Monolithic single file: HTML structure + `<style>` + `<script>` all inline
- Fetches `/courses` on load, renders course cards dynamically
- Opens booking modal with Stripe Elements on course selection
- Handles payment confirmation and shows success/error state

### `frontend/admin/index.html`
- Monolithic SPA-style admin panel (~34k lines)
- Vanilla JS with `fetch` for API calls
- Token stored in `localStorage`
- Sections: Dashboard stats, Course CRUD, Bookings list, Waitlist

---

## Testing

**No automated tests.** This is a small single-operator business application.

**Manual testing:**
1. Use Stripe test mode (`sk_test_...` keys)
2. Test card: `4242 4242 4242 4242`, any future expiry, any CVC
3. Test SEPA IBAN: `DE89370400440532013000`
4. Admin login: default password `hebamme2026` (change via `ADMIN_PASSWORD` env)
5. Check emails arrive in test inbox / use Mailtrap

---

## Known Limitations & Security Notes

- **No HTTPS enforcement** — must be handled by hosting platform (Render.com, nginx proxy, etc.)
- **No rate limiting** on public endpoints
- **In-memory sessions** — admin tokens are lost on server restart
- **File-based storage** — not suitable for concurrent high-traffic; fine for single-user scheduling
- **CORS** is open by default — restrict `FRONTEND_URL` in production
- **No input sanitization beyond basic validation** — avoid exposing to public internet without a reverse proxy
- **Default admin password** (`hebamme2026`) must be changed via `ADMIN_PASSWORD` env var before going live

---

## Deployment

The app is designed for simple single-process hosting:

- **Recommended:** [Render.com](https://render.com) free tier (Node.js service)
- Set all env vars in the hosting platform's environment settings
- Stripe webhooks require a publicly accessible URL — configure the webhook endpoint in Stripe dashboard to point to `https://your-domain.com/webhook`
- No database migration needed — `data/` directory persists on disk
- On Render, use a persistent disk for `data/` or data will be lost on redeploy

---

## Common Tasks

### Add a new course
Edit `data/courses.json` directly, or use the admin dashboard at `/admin`. Follow the existing ID convention: `{type}-{n}-{yy}`.

### Change the admin password
Set `ADMIN_PASSWORD` in your `.env` file and restart the server.

### Update email templates
Edit `src/mailer.js` — email bodies are inline HTML template literals. The invoice layout is in `src/pdf.js`.

### Update legal text
Edit the corresponding HTML file directly:
- `frontend/agb.html` — AGB (Terms)
- `frontend/teilnahmebedingungen.html` — Participation conditions
- `frontend/storno.html` — Cancellation policy

### Reset test data
Delete or clear `data/bookings.json` and `data/waitlist.json`. Do **not** delete `data/courses.json` unless you want to reconfigure all courses.
