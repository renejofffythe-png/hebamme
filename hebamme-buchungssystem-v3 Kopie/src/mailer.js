// src/mailer.js
const nodemailer = require('nodemailer');
const htmlPdf   = require('html-pdf-node');
const { generateInvoiceHTML, getNextInvoiceNumber } = require('./pdf');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const FROM = `"${process.env.EMAIL_FROM_NAME || 'Hebamme Kristina Schuldeis'}" <${process.env.EMAIL_FROM_ADDRESS}>`;

// HTML → echtes PDF
async function generatePDF(html) {
  const file    = { content: html };
  const options = { format: 'A4', margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' } };
  return htmlPdf.generatePdf(file, options); // gibt Buffer zurück
}

// ── Bestätigung + Rechnung an Teilnehmer:in ───────────────────────────
async function sendConfirmationToParticipant({ toEmail, toName, course, paymentMethod, amount, participant }) {
  const invoiceNumber = getNextInvoiceNumber();
  const date = new Date().toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
  const methodLabel = { card:'Kreditkarte', paypal:'PayPal', sepa:'SEPA-Lastschrift', klarna:'Klarna' }[paymentMethod] || paymentMethod;

  const invoiceHTML = generateInvoiceHTML({ invoiceNumber, date, participant, course, amount, paymentMethod });

  // Echtes PDF generieren
  let pdfBuffer = null;
  try {
    pdfBuffer = await generatePDF(invoiceHTML);
  } catch(e) {
    console.warn('PDF-Generierung fehlgeschlagen, fahre ohne Anhang fort:', e.message);
  }

  const emailHTML = `
<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8f3ed;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f3ed;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#5a6e52,#5c4a38);padding:36px 40px;text-align:center;">
    <p style="margin:0 0 6px;color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Buchungsbestätigung</p>
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:normal;">Hebamme Kristina Schuldeis</h1>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:12px;">Wentorf &amp; Reinbek</p>
  </td></tr>
  <tr><td style="padding:32px 40px 0;">
    <p style="margin:0 0 6px;font-size:20px;color:#5c4a38;">Hallo ${toName}! 🌿</p>
    <p style="margin:0;color:#7a6655;font-size:14px;line-height:1.7;">Deine Buchung ist bestätigt. Ich freue mich sehr auf dich!</p>
  </td></tr>
  <tr><td style="padding:20px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f3ed;border-radius:6px;border-left:4px solid #c4836a;">
    <tr><td style="padding:18px 22px;">
      <p style="margin:0 0 4px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c4836a;">Dein Kurs</p>
      <h2 style="margin:0 0 6px;font-size:17px;color:#5c4a38;">${course.title}</h2>
      <p style="margin:0 0 3px;color:#7a6655;font-size:13px;">📅 ${course.date}</p>
      <p style="margin:0;color:#5a6e52;font-size:14px;font-weight:bold;">${amount}</p>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:0 40px 20px;">
    <table width="100%"><tr><td style="background:#f0f0f0;border-radius:4px;padding:12px 16px;">
      <p style="margin:0;font-size:13px;color:#555;">✅ Zahlung erhalten via <strong>${methodLabel}</strong> &nbsp;·&nbsp; Rechnungsnr. <strong>${invoiceNumber}</strong></p>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:0 40px 24px;">
    <h3 style="margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#5c4a38;">Was du mitbringen solltest</h3>
    <ul style="margin:0;padding-left:20px;color:#7a6655;font-size:13px;line-height:2.1;">
      <li>Bequeme Kleidung zum Bewegen</li>
      <li>Eine Decke oder Yogamatte</li>
      <li>Etwas zu trinken</li>
      <li>Deinen Mutterpass (ab 20. SSW)</li>
    </ul>
  </td></tr>
  <tr><td style="padding:0 40px 32px;border-top:1px solid #e8ddd0;">
    <p style="margin:20px 0 4px;font-size:12px;color:#7a6655;">📎 Deine Rechnung (${invoiceNumber}) findest du als PDF im Anhang.</p>
    <p style="margin:4px 0 0;font-size:12px;color:#7a6655;">Bei Fragen: <a href="mailto:${process.env.EMAIL_FROM_ADDRESS}" style="color:#c4836a;">${process.env.EMAIL_FROM_ADDRESS}</a></p>
    <p style="margin:12px 0 0;font-size:12px;color:#aaa;font-style:italic;">„Erdachtes mag zu denken geben, doch nur erlebtes wird beleben." – Paul von Heyse</p>
  </td></tr>
</table>
<p style="margin:14px 0 0;font-size:11px;color:#bbb;">© ${new Date().getFullYear()} Hebamme Kristina Schuldeis</p>
</td></tr></table>
</body></html>`;

  const mailOptions = {
    from: FROM,
    to:   toEmail,
    subject: `✅ Buchungsbestätigung: ${course.title} (${invoiceNumber})`,
    html:    emailHTML,
  };

  // PDF als Anhang hinzufügen wenn erfolgreich generiert
  if (pdfBuffer) {
    mailOptions.attachments = [{
      filename:    `Rechnung-${invoiceNumber}.pdf`,
      content:     pdfBuffer,
      contentType: 'application/pdf',
    }];
  }

  try {
    await transporter.sendMail(mailOptions);
  } catch (e) {
    console.error('Bestätigungs-Mail fehlgeschlagen:', e.message);
    throw e; // Weitergeben – Buchung bleibt gespeichert, aber Fehler wird gemeldet
  }
  return invoiceNumber;
}

// ── Admin-Benachrichtigung ─────────────────────────────────────────────
async function sendAdminNotification({ participant, course, paymentMethod, amount, paymentIntentId, invoiceNumber }) {
  const html = `
<div style="font-family:Arial,sans-serif;max-width:520px;color:#3d2e22;">
  <h2 style="color:#5c4a38;border-bottom:2px solid #e8ddd0;padding-bottom:10px;">🎉 Neue Buchung!</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:8px 0;color:#888;width:150px;">Kurs</td><td style="font-weight:bold;color:#333;">${course.title}</td></tr>
    <tr><td style="padding:8px 0;color:#888;">Termin</td><td>${course.date}</td></tr>
    <tr style="background:#f9f9f9"><td style="padding:8px 4px;color:#888;">Name</td><td>${participant.firstName} ${participant.lastName}</td></tr>
    <tr><td style="padding:8px 0;color:#888;">E-Mail</td><td><a href="mailto:${participant.email}" style="color:#c4836a;">${participant.email}</a></td></tr>
    <tr style="background:#f9f9f9"><td style="padding:8px 4px;color:#888;">Telefon</td><td>${participant.phone || '–'}</td></tr>
    <tr><td style="padding:8px 0;color:#888;">Geburtstermin</td><td>${participant.dueDate || '–'}</td></tr>
    <tr style="background:#f9f9f9"><td style="padding:8px 4px;color:#888;">Betrag</td><td style="font-weight:bold;color:#5a6e52;">${amount}</td></tr>
    <tr><td style="padding:8px 0;color:#888;">Zahlungsart</td><td>${paymentMethod}</td></tr>
    <tr style="background:#f9f9f9"><td style="padding:8px 4px;color:#888;">Rechnungsnr.</td><td style="font-weight:bold;">${invoiceNumber}</td></tr>
    <tr><td style="padding:8px 0;color:#888;">Stripe ID</td><td style="font-size:11px;color:#999;">${paymentIntentId}</td></tr>
    <tr style="background:#f9f9f9"><td style="padding:8px 4px;color:#888;">Plätze noch frei</td><td>${course.capacity - course.enrolled} von ${course.capacity}</td></tr>
    <tr><td style="padding:8px 0;color:#888;">AGB akzeptiert</td><td style="color:#2d6a2d;">✅ Ja</td></tr>
  </table>
</div>`;

  // Admin-Benachrichtigung ist nicht kritisch – Fehler nur loggen, nicht werfen
  try {
    await transporter.sendMail({
      from: FROM,
      to:   process.env.ADMIN_EMAIL,
      subject: `📋 Buchung: ${participant.firstName} ${participant.lastName} → ${course.title} (${invoiceNumber})`,
      html,
    });
  } catch (e) {
    console.error('Admin-Benachrichtigung fehlgeschlagen:', e.message);
  }
}

// ── Warteliste ─────────────────────────────────────────────────────────
async function sendWaitlistConfirmation({ toEmail, toName, course }) {
  try {
    await transporter.sendMail({
      from: FROM,
      to:   toEmail,
      subject: `Warteliste: ${course.title}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#3d2e22;">
        <h2 style="color:#5c4a38;">Du bist auf der Warteliste 📋</h2>
        <p>Hallo ${toName},</p>
        <p>wir haben dich auf der Warteliste für <strong>${course.title}</strong> (${course.date}) eingetragen.</p>
        <p>Sobald ein Platz frei wird, benachrichtigen wir dich umgehend.</p>
        <p style="color:#c4836a;margin-top:20px;">Herzliche Grüße,<br>Kristina Schuldeis</p>
      </div>`,
    });
  } catch (e) {
    console.error('Wartelisten-Mail fehlgeschlagen:', e.message);
    throw e;
  }
}

module.exports = { sendConfirmationToParticipant, sendAdminNotification, sendWaitlistConfirmation };
