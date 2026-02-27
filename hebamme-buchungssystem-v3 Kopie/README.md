# 🌿 Hebamme Buchungssystem – Setup-Anleitung für Einsteiger

---

## Was ist was?

```
hebamme-buchungssystem/
│
├── frontend/             ← Die Website (das was Besucher sehen)
│   ├── index.html        ← Startseite mit Buchungsformular
│   ├── agb.html          ← AGB (bitte anpassen!)
│   ├── teilnahmebedingungen.html
│   └── storno.html
│
├── src/                  ← Das Backend (die "Küche" im Hintergrund)
│   ├── server.js         ← Hauptprogramm
│   ├── courses.js        ← Kursdaten & Plätze
│   ├── mailer.js         ← E-Mail-Versand
│   └── pdf.js            ← Rechnungs-PDF-Erstellung
│
├── .env.example          ← Vorlage für deine geheimen Zugangsdaten
├── package.json          ← Liste der benötigten Pakete
└── README.md             ← Diese Anleitung
```

---

## Schritt 1: Node.js installieren (einmalig)

Node.js ist das Programm, das dein Backend ausführt – wie ein Motor.

1. Geh auf **https://nodejs.org**
2. Klick auf den großen grünen Button **„LTS"** (das ist die stabile Version)
3. Installiere es wie ein normales Programm (Weiter, Weiter, Fertig)
4. Zum Testen: Terminal öffnen, `node --version` eintippen → du siehst eine Versionsnummer ✅

**Terminal öffnen:**
- **Mac**: ⌘ + Leertaste → „Terminal" → Enter
- **Windows**: Windows-Taste → „cmd" → Enter

---

## Schritt 2: Projektordner öffnen

Im Terminal zum Projektordner navigieren:

```bash
# Beispiel Mac (passe den Pfad an wo du den Ordner gespeichert hast):
cd ~/Downloads/hebamme-buchungssystem

# Beispiel Windows:
cd C:\Users\DeinName\Downloads\hebamme-buchungssystem
```

Dann alle Pakete installieren (einmalig, dauert ~1 Minute):
```bash
npm install
```
Du siehst jetzt einen neuen Ordner `node_modules` – der ist normal und groß (nicht löschen).

---

## Schritt 3: Stripe-Konto einrichten

Stripe ist dein digitales Kartenterminal – kostenlos, keine Grundgebühr.

### 3a. Konto anlegen
1. Geh auf **https://stripe.com/de** → „Konto erstellen"
2. E-Mail bestätigen, Daten eingeben
3. Du landest im **Stripe Dashboard**

### 3b. Im TESTMODUS bleiben ⚠️
- Oben rechts im Dashboard siehst du einen Schalter: **„Testmodus"** – lass ihn AN!
- Im Testmodus wird kein echtes Geld bewegt – perfekt zum Ausprobieren.

### 3c. API-Schlüssel holen
1. Im Dashboard links auf **„Entwickler"** klicken
2. Dann **„API-Schlüssel"**
3. Du siehst:
   - **Veröffentlichbarer Schlüssel**: beginnt mit `pk_test_...` → für das Frontend
   - **Geheimer Schlüssel**: beginnt mit `sk_test_...` → für das Backend (NIEMALS öffentlich zeigen!)

### 3d. Testkarte (kein echtes Geld!)
Während du im Testmodus bist, zahlst du mit dieser Fantasie-Kreditkarte:
```
Nummer:      4242 4242 4242 4242
Ablaufdatum: 12/29  (oder irgendwas in der Zukunft)
CVC:         123
```

---

## Schritt 4: Gmail App-Passwort erstellen

Damit das System E-Mails verschicken kann.

1. Geh auf **https://myaccount.google.com/security**
2. Stelle sicher: **„2-Schritt-Verifizierung"** ist aktiviert (muss sein!)
3. Suche nach **„App-Passwörter"** (ggf. etwas nach unten scrollen)
4. Gib einen Namen ein, z.B. „Hebamme Buchung" → **„Erstellen"**
5. Du bekommst ein **16-stelliges Passwort** → kopiere es sofort!

---

## Schritt 5: .env-Datei ausfüllen

Die `.env`-Datei ist wie ein Tresor für deine geheimen Zugangsdaten.

1. Kopiere die Beispieldatei:
   ```bash
   cp .env.example .env
   ```
2. Öffne `.env` mit einem Texteditor (z.B. Notepad auf Windows, TextEdit auf Mac)
3. Fülle alle Felder aus:

```
STRIPE_SECRET_KEY=sk_test_DeinGeheimesSchlüssel...
STRIPE_PUBLISHABLE_KEY=pk_test_DeinÖffentlicherSchlüssel...
STRIPE_WEBHOOK_SECRET=whsec_...   (kommt später, erstmal leer lassen)

PORT=3000
FRONTEND_URL=http://localhost:3000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=deine.email@gmail.com
SMTP_PASS=dein-16-stelliges-app-passwort

EMAIL_FROM_NAME=Hebamme Kristina Schuldeis
EMAIL_FROM_ADDRESS=deine.email@gmail.com
ADMIN_EMAIL=deine.email@gmail.com
```

---

## Schritt 6: Starten & Testen!

```bash
npm start
```

Du siehst:
```
🌿 Hebamme Buchungssystem läuft auf http://localhost:3000
   Frontend: http://localhost:3000/index.html
   Stripe-Modus: 🟡 TEST
```

Jetzt **http://localhost:3000** im Browser öffnen – fertig!

### Eine Testbuchung machen:
1. Auf „Jetzt buchen" klicken
2. Formulardaten eingeben (beliebig)
3. AGB-Checkboxen anhaken
4. Testkarte eingeben: `4242 4242 4242 4242` / `12/29` / `123`
5. „Jetzt buchen & bezahlen" klicken
6. Du siehst den Erfolgs-Screen
7. Schau in dein Gmail-Postfach → du bekommst eine Bestätigungs-E-Mail mit PDF-Rechnung!
8. Im Stripe Dashboard (Testmodus) → „Zahlungen" → du siehst die Zahlung ✅

---

## Was macht Stripe Invoicing (zusätzlich zu unserer eigenen Rechnung)?

Unser System erstellt zwei Dinge:
1. **Unsere eigene PDF-Rechnung** (im eigenen Design, wird per E-Mail versendet)
2. **Stripe Invoice** (zusätzlich im Stripe-Dashboard gespeichert, für deine Buchhaltung)

Die Stripe Invoice ist praktisch weil:
- Sie automatisch im Stripe-Dashboard archiviert wird
- Du sie für die Buchhaltung / Steuer exportieren kannst
- Sie als Backup dient falls unsere E-Mail verloren geht

---

## Was ist render.com?

Render ist ein kostenloser Hosting-Dienst. Damit dein Backend nicht nur auf deinem Computer läuft, sondern 24/7 im Internet erreichbar ist.

**Jetzt noch nicht nötig** – erst wenn du live gehen willst.

Wenn es so weit ist: einfach fragen, ich erkläre das dann Schritt für Schritt!

---

## AGB, Teilnahmebedingungen & Storno anpassen

Die Dateien `agb.html`, `teilnahmebedingungen.html` und `storno.html` sind Vorlagen.
**Bitte vor dem Liveschalten von einem Anwalt prüfen lassen!**
Du kannst sie mit jedem Texteditor bearbeiten.

---

## Hilfe & häufige Probleme

| Problem | Lösung |
|---|---|
| `npm: command not found` | Node.js neu installieren von nodejs.org |
| `Cannot find module 'stripe'` | `npm install` nochmal ausführen |
| E-Mail kommt nicht an | App-Passwort prüfen, Spam-Ordner checken |
| Stripe-Zahlung schlägt fehl | Sicherstellen dass Testmodus AN ist, Testkarte verwenden |
| Port 3000 schon belegt | In .env `PORT=3001` setzen |

