// src/admin-routes.js
// Alle API-Routen für das Admin-Panel – passwortgeschützt

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const {
  getAllCourses, getCourse, createCourse, updateCourse, deleteCourse,
  getAllBookings, getBookingsForCourse,
  getAllWaitlists, getWaitlist, removeFromWaitlist,
} = require('./courses');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'hebamme2026';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('[SICHERHEIT] ADMIN_PASSWORD nicht in .env gesetzt – Standard-Passwort aktiv! Bitte .env konfigurieren.');
}

// ── Einfache Session-Tokens (in-memory, reicht für Einzelnutzer) ──────
const validTokens = new Set();

// Kryptografisch sicherer Token (ersetzt Math.random)
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ── Auth-Middleware ───────────────────────────────────────────────────
function requireAuth(req, res, next) {
  // Nur Header akzeptieren – kein Query-Parameter (würde in Logs landen)
  const token = req.headers['x-admin-token'];
  if (!token || !validTokens.has(token)) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }
  next();
}

// ── LOGIN ─────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }
  const token = generateToken();
  validTokens.add(token);
  // Token nach 8 Stunden ungültig
  setTimeout(() => validTokens.delete(token), 8 * 60 * 60 * 1000);
  res.json({ token });
});

router.post('/logout', (req, res) => {
  const token = req.headers['x-admin-token'];
  if (token) validTokens.delete(token);
  res.json({ ok: true });
});

// ── KURSE ─────────────────────────────────────────────────────────────
router.get('/courses', requireAuth, (req, res) => {
  res.json(getAllCourses());
});

router.post('/courses', requireAuth, (req, res) => {
  const { title, date, price, capacity, type, status } = req.body;
  if (!title || !date || !price || !capacity) {
    return res.status(400).json({ error: 'Titel, Datum, Preis und Kapazität sind Pflichtfelder' });
  }
  const course = createCourse({ title, date, price, capacity, type, status });
  res.status(201).json(course);
});

router.put('/courses/:id', requireAuth, (req, res) => {
  try {
    const course = updateCourse(req.params.id, req.body);
    res.json(course);
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

router.delete('/courses/:id', requireAuth, (req, res) => {
  try {
    deleteCourse(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

// ── BUCHUNGEN ─────────────────────────────────────────────────────────
router.get('/bookings', requireAuth, (req, res) => {
  const bookings = getAllBookings();
  const courses  = getAllCourses();
  // Kursname dazuhängen
  const enriched = bookings.map(b => ({
    ...b,
    courseTitle: courses.find(c => c.id === b.courseId)?.title || b.courseId,
  }));
  res.json(enriched);
});

router.get('/bookings/:courseId', requireAuth, (req, res) => {
  res.json(getBookingsForCourse(req.params.courseId));
});

// ── WARTELISTE ────────────────────────────────────────────────────────
router.get('/waitlist', requireAuth, (req, res) => {
  const wl      = getAllWaitlists();
  const courses = getAllCourses();
  // Kursname dazuhängen
  const enriched = {};
  for (const [courseId, entries] of Object.entries(wl)) {
    enriched[courseId] = {
      courseTitle: courses.find(c => c.id === courseId)?.title || courseId,
      entries,
    };
  }
  res.json(enriched);
});

router.delete('/waitlist/:courseId/:email', requireAuth, (req, res) => {
  removeFromWaitlist(req.params.courseId, decodeURIComponent(req.params.email));
  res.json({ ok: true });
});

// ── DASHBOARD-STATS ───────────────────────────────────────────────────
router.get('/stats', requireAuth, (req, res) => {
  const courses  = getAllCourses();
  const bookings = getAllBookings();
  const wl       = getAllWaitlists();

  const totalRevenue    = bookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  const totalEnrolled   = courses.reduce((sum, c) => sum + c.enrolled, 0);
  const totalWaitlist   = Object.values(wl).reduce((sum, arr) => sum + arr.length, 0);
  const openCourses     = courses.filter(c => c.status === 'open').length;

  res.json({
    totalCourses:   courses.length,
    openCourses,
    totalEnrolled,
    totalBookings:  bookings.length,
    totalRevenue,   // in Cent
    totalWaitlist,
  });
});

module.exports = router;
