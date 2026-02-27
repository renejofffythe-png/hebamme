# CLAUDE.md — Hebamme Buchungssystem

This file provides AI assistants with context about the codebase structure, conventions, and development workflows.

---

## Project Overview

**Hebamme Buchungssystem** is a German-language midwife course booking system. It allows patients to browse available courses (birth preparation, postpartum recovery), make payments via Stripe, and join waitlists for full courses. An admin panel provides course management and booking visibility.

**Application URL:** `http://localhost:3000`
**Admin Panel:** `http://localhost:3000/admin`
**Language:** German (UI, error messages, comments in code)

---

## Repository Layout

```
/home/user/hebamme/
└── hebamme-buchungssystem-v3 Kopie/   ← main project root (note the space in name)
    ├── src/                            ← backend Node.js source
    │   ├── server.js                   ← Express app entry point
    │   ├── courses.js                  ← course data management
    │   ├── mailer.js                   ← email + PDF invoice sending
    │   ├── pdf.js                      ← HTML invoice template
    │   └── admin-routes.js             ← protected admin API routes
    ├── frontend/                       ← plain HTML/CSS/JS frontend
    │   ├── index.html                  ← main booking site (~123 KB)
    │   ├── agb.html                    ← terms & conditions
    │   ├── teilnahmebedingungen.html   ← participation terms
    │   ├── storno.html                 ← cancellation policy
    │   ├── setup-anleitung.html        ← deployment guide
    │   └── admin/
    │       └── index.html              ← admin dashboard SPA
    ├── data/                           ← JSON file-based persistence
    │   ├── courses.json                ← course catalog
    │   ├── bookings.json               ← confirmed bookings
    │   └── waitlist.json               ← waitlist entries by courseId
    ├── mailer.js                       ← duplicate of src/mailer.js (root-level copy, ignore)
    ├── package.json
    ├── package-lock.json
    └── README.md                       ← German setup guide
```

> **Note:** The project directory contains a space in its name (`hebamme-buchungssystem-v3 Kopie`). Always quote paths when using shell commands: `cd "hebamme-buchungssystem-v3 Kopie"`.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (LTS) |
| Web Framework | Express.js ^4.19.2 |
| Payment | Stripe ^16.2.0 |
| Email | Nodemailer ^6.9.14 (Gmail SMTP) |
| PDF Generation | html-pdf-node ^1.0.8, PDFKit ^0.15.0 |
| Environment | dotenv ^16.4.5 |
| CORS | cors ^2.8.5 |
| Dev Server | Nodemon ^3.1.4 |
| Frontend | Vanilla HTML5/CSS3/JS (no build tool) |
| Payment UI | Stripe.js v3 + Payment Element |
| Storage | JSON files (no database) |

---

## Development Commands

All commands run from inside the project directory:

```bash
cd "hebamme-buchungssystem-v3 Kopie"

npm install          # install dependencies (first-time setup)
npm run dev          # start with auto-reload (nodemon src/server.js)
npm start            # start production server (node src/server.js)
```

There are **no tests, no linter, and no formatter** configured. If adding them, prefer Jest for tests and ESLint + Prettier for code style.

---

## Environment Variables

Create a `.env` file in the project root (`hebamme-buchungssystem-v3 Kopie/.env`):

```env
# Stripe (use test keys locally)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Server
PORT=3000
FRONTEND_URL=http://localhost:3000

# Gmail SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=xxxx-xxxx-xxxx-xxxx   # 16-char Gmail app password

# Email identities
EMAIL_FROM_NAME=Hebamme Kristina Schuldeis
EMAIL_FROM_ADDRESS=your-email@gmail.com
ADMIN_EMAIL=your-email@gmail.com

# Admin panel
ADMIN_PASSWORD=hebamme2026   # change before production
```

The `.env` file is **not committed** to source control. Never hardcode secrets.

---

## API Routes

### Public API (`src/server.js`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/config` | Returns Stripe publishable key |
| GET | `/courses` | List all courses |
| POST | `/create-payment-intent` | Initialize Stripe payment |
| POST | `/confirm-booking` | Finalize booking after payment |
| POST | `/waitlist` | Add to a course waitlist |
| POST | `/webhook` | Stripe webhook handler |
| GET | `/health` | Health check endpoint |

### Admin API (`src/admin-routes.js`) — requires auth token

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/login` | Authenticate, returns token |
| POST | `/api/admin/logout` | Invalidate session token |
| GET | `/api/admin/courses` | List all courses |
| POST | `/api/admin/courses` | Create a new course |
| PUT | `/api/admin/courses/:id` | Update a course |
| DELETE | `/api/admin/courses/:id` | Delete a course |
| GET | `/api/admin/bookings` | List all bookings |
| GET | `/api/admin/waitlist` | View all waitlists |
| DELETE | `/api/admin/waitlist/:courseId/:email` | Remove from waitlist |
| GET | `/api/admin/stats` | Dashboard statistics |

Admin authentication uses in-memory tokens with an 8-hour expiry. Tokens are sent as `Authorization: Bearer <token>` header.

---

## Data Model

### Course (`data/courses.json`)

```json
{
  "id": "string",
  "type": "geburtsvorbereitung | rueckbildung",
  "title": "string",
  "date": "ISO date string",
  "price": 15000,         // in cents (e.g. 15000 = €150.00)
  "currency": "eur",
  "capacity": 8,
  "enrolled": 3,
  "status": "open | soon | done"
}
```

### Booking (`data/bookings.json`)

```json
{
  "courseId": "string",
  "paymentIntentId": "pi_...",
  "amount": 15000,
  "paymentMethod": "card | sepa_debit | ...",
  "participant": {
    "firstName": "string",
    "lastName": "string",
    "email": "string",
    "phone": "string",
    "dueDate": "string"
  },
  "bookedAt": "ISO timestamp"
}
```

### Waitlist (`data/waitlist.json`)

```json
{
  "courseId": [
    { "email": "string", "name": "string", "addedAt": "ISO timestamp" }
  ]
}
```

---

## Key Source File Summaries

### `src/server.js`
Main Express application. Sets up middleware (CORS, JSON body parsing, static file serving), mounts admin routes, and defines all public API endpoints. Integrates Stripe payment intents and webhook event handling. Calls into `courses.js` for data persistence and `mailer.js` for email delivery.

### `src/courses.js`
Manages the course catalog and booking records using synchronous JSON file I/O (`fs.readFileSync` / `fs.writeFileSync`). Exports functions: `getCourses`, `updateCourse`, `addBooking`, `getBookings`, `addToWaitlist`, `getWaitlist`, `removeFromWaitlist`.

### `src/mailer.js`
Configures a Nodemailer transporter for Gmail SMTP. Sends confirmation emails to participants and notification emails to the admin after each booking. Generates PDF invoices using `html-pdf-node` and attaches them to emails.

### `src/pdf.js`
Exports a function that returns an HTML string for invoice rendering. Used by `mailer.js` to generate PDFs. Contains the invoice layout with course details, participant info, and pricing.

### `src/admin-routes.js`
Express Router with all `/api/admin/*` endpoints. Validates `Authorization: Bearer <token>` on protected routes. Handles admin login/logout, CRUD for courses, and read access to bookings and waitlists.

### `frontend/index.html`
Self-contained single-file booking website (~123 KB). Fetches course list from the backend, renders course cards, collects participant details, and integrates Stripe Payment Element. No external JS framework.

### `frontend/admin/index.html`
Self-contained admin dashboard. Authenticates via the admin API, then provides views for courses, bookings, waitlists, and statistics. Includes inline forms for creating/editing courses.

---

## Code Conventions

- **Language:** JavaScript (ES6+), `const`/`let`, arrow functions, async/await
- **Comments:** Written in **German** for business logic; English is acceptable for technical explanations
- **Error messages:** German strings returned in API responses
- **File naming:** `camelCase` for backend JS files, `kebab-case` for HTML pages
- **Prices:** Always stored and processed in **cents** (integer). Display formatting handles euro symbol.
- **No TypeScript:** Plain JS only. Do not introduce TypeScript without discussion.
- **No build step:** Frontend is served as-is. Do not add webpack/vite/bundlers without discussion.
- **Avoid global state:** Business data lives in `/data/*.json` files; admin session tokens live in a `Set` in memory.

---

## Data Persistence Notes

The app uses **synchronous JSON file I/O** — there are no transactions or locking mechanisms. This is intentional for simplicity (small-scale single-midwife use case). Be aware:

- Concurrent writes could corrupt JSON files under high load.
- Changes to `data/*.json` take effect immediately on the next read — no cache invalidation needed.
- The `data/` directory must exist and be writable by the Node.js process.
- Do **not** replace this with a database without understanding the deployment constraints.

---

## Authentication

- Admin login: POST `/api/admin/login` with `{ password }` in the body.
- On success, a UUID token is stored in a server-side `Set` with an 8-hour TTL.
- Token is passed as `Authorization: Bearer <token>` on subsequent requests.
- No persistent sessions — tokens are lost on server restart.
- Default password: `hebamme2026` (set `ADMIN_PASSWORD` in `.env` for production).

---

## Payment Flow

1. User selects a course → frontend calls `POST /create-payment-intent` → backend creates Stripe PaymentIntent, returns `clientSecret`.
2. Frontend mounts Stripe Payment Element using `clientSecret`.
3. User completes payment → Stripe confirms on client side.
4. Frontend calls `POST /confirm-booking` with PaymentIntent ID + participant data.
5. Backend verifies PaymentIntent status with Stripe API, records booking, sends confirmation email.
6. Stripe also sends a `payment_intent.succeeded` webhook to `POST /webhook` as a secondary confirmation path.

---

## Deployment

The README references **render.com** for hosting. Key points:
- Set all environment variables in the render.com dashboard (not in the repo).
- The `PORT` variable is automatically set by render.com.
- Set `FRONTEND_URL` to the public render.com URL.
- Register the render.com URL as a Stripe webhook endpoint.
- Switch Stripe keys from test (`sk_test_...`) to live (`sk_live_...`) for production.

---

## Known Issues / Limitations

- No test suite exists. Manual testing is required.
- No linting or formatting tools configured.
- `mailer.js` exists at both root level and `src/` — the root-level copy appears to be a duplicate and can be ignored.
- No `.gitignore` — `node_modules/` and `.env` should be added.
- No rate limiting on public endpoints (booking, waitlist).
- In-memory admin session tokens are lost on server restart — users must re-login.
- Synchronous file I/O is not suitable for high concurrency.

---

## Adding Features — Guidelines

1. **New API endpoints:** Add public routes to `src/server.js`; add admin routes to `src/admin-routes.js`.
2. **New data fields:** Update the relevant JSON file in `data/` and the read/write functions in `src/courses.js`.
3. **Email changes:** Edit templates in `src/mailer.js`; invoice HTML is in `src/pdf.js`.
4. **Frontend changes:** Edit the relevant HTML file directly — no build step required.
5. **New dependencies:** Run `npm install <package>` and commit the updated `package.json` and `package-lock.json`.
