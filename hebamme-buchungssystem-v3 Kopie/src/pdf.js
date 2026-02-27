// src/pdf.js – Rechnungs-HTML-Generator
let invoiceCounter = 1000;

function getNextInvoiceNumber() {
  const year = new Date().getFullYear();
  const num  = String(++invoiceCounter).padStart(4, '0');
  return `RE-${year}-${num}`;
}

function generateInvoiceHTML({ invoiceNumber, date, participant, course, amount, paymentMethod }) {
  const methodLabel = { card:'Kreditkarte', paypal:'PayPal', sepa:'SEPA-Lastschrift', klarna:'Klarna' }[paymentMethod] || paymentMethod;
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><title>Rechnung ${invoiceNumber}</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family: Arial, sans-serif; font-size:13px; color:#3d2e22; background:white; line-height:1.6; }
.page { max-width:794px; margin:0 auto; padding:60px 70px; min-height:1123px; position:relative; }
.header { display:flex; justify-content:space-between; margin-bottom:50px; padding-bottom:24px; border-bottom:2px solid #e8ddd0; }
.logo h1 { font-size:20px; color:#5c4a38; font-weight:bold; }
.logo p  { font-size:11px; color:#7a6655; margin-top:2px; }
.inv-meta { text-align:right; }
.inv-meta .label  { font-size:10px; text-transform:uppercase; letter-spacing:2px; color:#c4836a; }
.inv-meta .number { font-size:26px; color:#5c4a38; line-height:1.1; }
.inv-meta .idate  { font-size:11px; color:#7a6655; margin-top:4px; }
.addresses { display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-bottom:40px; }
.addr-label { font-size:10px; text-transform:uppercase; letter-spacing:2px; color:#c4836a; margin-bottom:8px; }
.addr-block p { line-height:1.8; }
table { width:100%; border-collapse:collapse; margin-bottom:28px; }
thead tr { background:#5c4a38; color:white; }
thead th { padding:10px 14px; font-size:11px; text-transform:uppercase; letter-spacing:1px; font-weight:normal; text-align:left; }
thead th:last-child { text-align:right; }
tbody tr { border-bottom:1px solid #e8ddd0; }
tbody td { padding:14px; vertical-align:top; }
tbody td:last-child { text-align:right; font-weight:bold; }
.item-title { font-weight:bold; color:#5c4a38; }
.item-desc  { font-size:12px; color:#7a6655; margin-top:3px; }
.totals { display:flex; justify-content:flex-end; margin-bottom:24px; }
.totals-box { width:260px; }
.trow { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #e8ddd0; font-size:13px; }
.trow:last-child { border-bottom:none; font-weight:bold; font-size:15px; color:#5c4a38; padding-top:10px; }
.trow .lbl { color:#7a6655; }
.paid-box { background:#f0f7f0; border:1px solid #c3dbc3; border-radius:4px; padding:12px 16px; margin-bottom:24px; font-size:13px; color:#2d6a2d; }
.tax-note { font-size:11px; font-style:italic; color:#7a6655; padding:10px 14px; background:#faf7f4; border-left:3px solid #e8ddd0; margin-bottom:28px; }
.footer { position:absolute; bottom:40px; left:70px; right:70px; border-top:1px solid #e8ddd0; padding-top:14px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; }
.fl { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#c4836a; margin-bottom:4px; }
.footer p { font-size:11px; color:#7a6655; line-height:1.7; }
@media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head>
<body><div class="page">
  <div class="header">
    <div class="logo"><h1>Hebamme Kristina Schuldeis</h1><p>Wentorf &amp; Reinbek</p></div>
    <div class="inv-meta"><div class="label">Rechnung</div><div class="number">${invoiceNumber}</div><div class="idate">Datum: ${date}</div></div>
  </div>
  <div class="addresses">
    <div><div class="addr-label">Rechnungsempfänger</div><div class="addr-block"><p><strong>${participant.firstName} ${participant.lastName}</strong><br>${participant.email}${participant.phone ? '<br>'+participant.phone : ''}</p></div></div>
    <div><div class="addr-label">Rechnungssteller</div><div class="addr-block"><p><strong>Kristina Schuldeis</strong><br>Hebamme<br>[Deine Adresse]<br>[PLZ] Wentorf</p></div></div>
  </div>
  <table>
    <thead><tr><th style="width:40px">#</th><th>Leistung</th><th style="width:80px;text-align:center">Menge</th><th style="width:100px;text-align:right">Betrag</th></tr></thead>
    <tbody><tr><td>1</td><td><div class="item-title">${course.title}</div><div class="item-desc">Termin: ${course.date}<br>Hebammenkurs · 7 Einheiten à 90 Minuten</div></td><td style="text-align:center">1</td><td>${amount}</td></tr></tbody>
  </table>
  <div class="totals"><div class="totals-box">
    <div class="trow"><span class="lbl">Zwischensumme</span><span>${amount}</span></div>
    <div class="trow"><span class="lbl">USt. (0%)</span><span>0,00 €</span></div>
    <div class="trow"><span>Gesamtbetrag</span><span>${amount}</span></div>
  </div></div>
  <div class="paid-box">✅ &nbsp;<strong>Bezahlt – vielen Dank!</strong> &nbsp;·&nbsp; Zahlung via ${methodLabel} am ${date}</div>
  <div class="tax-note">Gemäß §4 Nr. 14 UStG umsatzsteuerfrei.</div>
  <div class="footer">
    <div><div class="fl">Kontakt</div><p>[deine@email.de]<br>[Telefon]<br>www.hebamme-wentorf.de</p></div>
    <div><div class="fl">Bankverbindung</div><p>Kristina Schuldeis<br>IBAN: DE__ ____<br>BIC: ________</p></div>
    <div><div class="fl">Steuer</div><p>Steuernr.: [______]<br>§4 Nr. 14 UStG</p></div>
  </div>
</div></body></html>`;
}

module.exports = { generateInvoiceHTML, getNextInvoiceNumber };
