# Fahrschule Sikorra – Website

Moderne, responsive Website (statisch, kein Build-Step). Ersetzt die alte NetObjects-Fusion-Seite.

## Struktur

```
fahrschule-sikorra/
├── index.html          # Startseite
├── impressum.html      # Impressum
├── datenschutz.html    # Datenschutzerklärung
├── danke.html          # Bestätigungsseite nach Formular-Versand
├── legal.css           # Styles für die Unterseiten
├── robots.txt
├── sitemap.xml
├── netlify.toml        # Netlify-Konfiguration
└── assets/             # Bilder
```

## Lokal ansehen

```bash
cd fahrschule-sikorra
python3 -m http.server 4190
# -> http://localhost:4190
```

## Deployment (Netlify)

1. Ordner `fahrschule-sikorra/` als Site bei Netlify anlegen (Drag & Drop oder Git-Verknüpfung).
2. **Kontaktformular:** funktioniert automatisch über *Netlify Forms* (das Formular hat `data-netlify="true"`).
   - E-Mail-Benachrichtigung einrichten: Netlify-Dashboard → **Forms → Settings → Form notifications** → E-Mail an `info@fahrschule-sikorra.eu`.
3. Eigene Domain `fahrschule-sikorra.eu` in Netlify verbinden (HTTPS/SSL ist automatisch).

## Noch zu erledigen vor dem Live-Gang

- [ ] **Impressum:** Fahrschulerlaubnis-Nr. und zuständige Aufsichtsbehörde ergänzen (in `impressum.html` markiert).
- [ ] **Datenschutz:** Hosting-Anbieter + Formular-Dienst (Netlify) namentlich nennen (in `datenschutz.html` markiert).
- [ ] **Bessere Fotos:** aktuelle Bilder sind niedrig aufgelöst (255 px). Hochauflösende Fotos in `assets/` ersetzen.
- [ ] Öffnungs-/Theoriezeiten, Führerscheinklassen, ggf. Preise ergänzen.
