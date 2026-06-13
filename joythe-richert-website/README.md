# Joythe & Richert — Website

Statische Marketing-Website für das Digitalisierungs-Duo **René Joythe & Marcel Richert**
(Websites · Automatisierung · KI-Lösungen · Digitale Beratung), umgesetzt aus dem Website-Konzept.

Vanilla HTML/CSS/JS, **kein Build-Step** — einfach hosten oder lokal öffnen.

## Seiten

| Datei | Inhalt |
|---|---|
| `index.html` | Startseite (Hero, Logos, Problem, Leistungen, Prozess, Stats, Über uns, Testimonials, Lead-CTA) |
| `leistung-websites.html` | Leistung: Websites |
| `leistung-automatisierung.html` | Leistung: Automatisierung |
| `leistung-ki.html` | Leistung: KI-Lösungen (inkl. Chatbot-Demo) |
| `leistung-beratung.html` | Leistung: Digitale Beratung |
| `referenzen.html` | Referenzen (Logo-Zeile, Case-Summaries, Testimonials) |
| `ueber-uns.html` | Über uns / das Duo |
| `insights.html` | Blog/Insights-Übersicht + Newsletter |
| `website-check.html` | Lead-Magnet-Landingpage (3-Fragen-Formular) |
| `kontakt.html` | Kontaktformular, Direktkontakt, Impressum/Datenschutz-Platzhalter |

## Struktur

```
joythe-richert-website/
├── *.html            # alle Seiten (flache Struktur, gemeinsame Header/Footer)
├── css/styles.css    # Design-System (Tokens, Komponenten, Responsive)
├── js/main.js        # Nav, Scroll-Reveal, Header-Shrink, Formular-Demo, Counter
└── README.md
```

## Lokal ansehen

```bash
cd joythe-richert-website
python3 -m http.server 8080
# http://localhost:8080
```

Oder `index.html` direkt im Browser öffnen.

## Design-System

- **Fonts:** Space Grotesk (Headlines) + Inter (Body) via Google Fonts
- **Farben:** Ink `#0f141c`, Akzent-Blau `#2f6bff`, Teal `#11cdb0`, Blau→Teal-Verlauf als Signatur
- Tokens zentral als CSS-Variablen in `css/styles.css` (`:root`)
- Responsive ab Mobile (Breakpoints 980px / 760px), Reduced-Motion-Support

## Noch zu erledigen vor dem Livegang

- **Formulare** sind aktuell Frontend-Demos (kein Backend) — Versand an E-Mail/CRM/Calendly anbinden.
- **Calendly-Links** auf den CTAs einsetzen.
- **Impressum & Datenschutz** mit echten Angaben füllen und rechtlich prüfen lassen (Platzhalter in `kontakt.html`).
- **Echte Portraits** von René & Marcel statt der Initialen-Badges einsetzen.
- **Referenz-/Markenlogos** nur mit Freigabe verwenden; Testimonials durch echte, namentliche ersetzen.
- **Blog-Artikel** verlinken aktuell auf Platzhalter — Detailseiten ergänzen.
