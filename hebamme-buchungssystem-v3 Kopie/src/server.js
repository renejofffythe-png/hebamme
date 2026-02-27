// src/server.js
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const adminRoutes = require('./admin-routes');

const {
  getCourse, getAllCourses, incrementEnrolled,
  addToWaitlist, getWaitlist, saveBooking,
} = require('./courses');
const { sendConfirmationToParticipant, sendAdminNotification, sendWaitlistConfirmation } = require('./mailer');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Frontend & Admin statisch ausliefern
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/admin', express.static(path.join(__dirname, '../frontend/admin')));

// Admin-API
app.use('/api/admin', adminRoutes);

// ── /config ───────────────────────────────────────────────────────────
app.get('/config', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// ── /courses ──────────────────────────────────────────────────────────
app.get('/courses', (req, res) => res.json(getAllCourses()));

// ── /create-payment-intent ────────────────────────────────────────────
app.post('/create-payment-intent', async (req, res) => {
  const { courseId, paymentMethod, participant } = req.body;
  if (!courseId || !participant?.email)
    return res.status(400).json({ error: 'courseId und E-Mail sind Pflicht' });

  const course = getCourse(courseId);
  if (!course)                            return res.status(404).json({ error: 'Kurs nicht gefunden' });
  if (course.status === 'done')           return res.status(400).json({ error: 'Kurs ist beendet' });
  if (course.enrolled >= course.capacity) return res.status(409).json({ error: 'Kurs ausgebucht' });

  const methodMap = { card: ['card'], paypal: ['paypal'], sepa: ['sepa_debit'], klarna: ['klarna'] };

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount:               course.price,
      currency:             course.currency,
      payment_method_types: methodMap[paymentMethod] || ['card'],
      metadata: {
        courseId,
        courseTitle:      course.title,
        participantEmail: participant.email,
        participantName:  `${participant.firstName} ${participant.lastName}`,
        participantPhone: participant.phone  || '',
        dueDate:          participant.dueDate || '',
        agbAccepted:      participant.agbAccepted ? 'true' : 'false',
      },
      receipt_email: participant.email,
      description:   `Buchung: ${course.title}`,
    });

    // Stripe Invoice (Buchhaltungs-Backup)
    try {
      const existing = await stripe.customers.list({ email: participant.email, limit: 1 });
      const customer = existing.data[0] || await stripe.customers.create({
        email: participant.email,
        name:  `${participant.firstName} ${participant.lastName}`,
      });
      await stripe.invoiceItems.create({ customer: customer.id, amount: course.price, currency: course.currency, description: course.title });
      const inv = await stripe.invoices.create({ customer: customer.id, auto_advance: true, collection_method: 'charge_automatically' });
      await stripe.invoices.finalizeInvoice(inv.id);
    } catch (e) { console.warn('Stripe Invoice (nicht kritisch):', e.message); }

    res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── /confirm-booking ──────────────────────────────────────────────────
app.post('/confirm-booking', async (req, res) => {
  const { paymentIntentId, participant } = req.body;
  if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId fehlt' });

  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'succeeded')
      return res.status(402).json({ error: `Zahlung nicht abgeschlossen (${pi.status})` });

    const course = getCourse(pi.metadata.courseId);
    if (!course) return res.status(404).json({ error: 'Kurs nicht gefunden' });

    incrementEnrolled(course.id);

    const amount        = `${(pi.amount / 100).toFixed(2).replace('.', ',')} €`;
    const paymentMethod = pi.payment_method_types?.[0] || 'card';

    // Buchung persistieren
    saveBooking({
      courseId:        course.id,
      paymentIntentId: pi.id,
      amount:          pi.amount,
      paymentMethod,
      participant,
    });

    const invoiceNumber = await sendConfirmationToParticipant({
      toEmail: participant.email,
      toName:  `${participant.firstName} ${participant.lastName}`,
      course, paymentMethod, amount, participant,
    });

    await sendAdminNotification({ participant, course, paymentMethod, amount, paymentIntentId: pi.id, invoiceNumber });

    res.json({ success: true, invoiceNumber });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── /waitlist ─────────────────────────────────────────────────────────
app.post('/waitlist', async (req, res) => {
  const { courseId, email, firstName, lastName } = req.body;
  if (!courseId || !email) return res.status(400).json({ error: 'courseId und E-Mail fehlen' });

  const course = getCourse(courseId);
  if (!course) return res.status(404).json({ error: 'Kurs nicht gefunden' });

  const position = addToWaitlist(courseId, email, `${firstName} ${lastName}`);
  await sendWaitlistConfirmation({ toEmail: email, toName: `${firstName} ${lastName}`, course })
    .catch(e => console.warn('Wartelisten-Mail:', e.message));

  res.json({ success: true, position });
});

// ── /webhook ──────────────────────────────────────────────────────────
app.post('/webhook', async (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  if (event.type === 'payment_intent.succeeded') {
    const pi     = event.data.object;
    const course = getCourse(pi.metadata.courseId);
    if (course) {
      try {
        incrementEnrolled(pi.metadata.courseId);
        const nameParts   = (pi.metadata.participantName || '').split(' ');
        const participant = { firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || '', email: pi.metadata.participantEmail, phone: pi.metadata.participantPhone, dueDate: pi.metadata.dueDate };
        const amount      = `${(pi.amount / 100).toFixed(2).replace('.', ',')} €`;
        saveBooking({ courseId: course.id, paymentIntentId: pi.id, amount: pi.amount, paymentMethod: pi.payment_method_types?.[0], participant });
        const invoiceNumber = await sendConfirmationToParticipant({ toEmail: participant.email, toName: pi.metadata.participantName, course, paymentMethod: pi.payment_method_types?.[0] || 'card', amount, participant });
        await sendAdminNotification({ participant, course, paymentMethod: pi.payment_method_types?.[0] || 'card', amount, paymentIntentId: pi.id, invoiceNumber });
      } catch (e) { console.error('Webhook Fehler:', e.message); }
    }
  }
  res.json({ received: true });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`\n🌿 Hebamme Buchungssystem läuft auf http://localhost:${PORT}`);
  console.log(`   🌐 Website:     http://localhost:${PORT}`);
  console.log(`   🔧 Admin-Panel: http://localhost:${PORT}/admin`);
  console.log(`   Stripe-Modus:  ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? '🟢 LIVE' : '🟡 TEST'}\n`);
});

module.exports = app;
