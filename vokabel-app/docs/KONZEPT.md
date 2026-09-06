# ÜBERKLEBT — Produktkonzept & Entscheidungen

Synthese der Phase-1-Ergebnisse (Concept/Game, UX/UI, Visual, Sound).
Dieses Dokument ist die verbindliche Entscheidungsgrundlage für die Implementierung.
Bei Widersprüchen zwischen Agentenberichten gilt, was hier steht.

---

## 1. Produkt

Mobile-First Web-App zum Vokabellernen. Deutsches Wort erscheint, die englische
Übersetzung wird **eingetippt**. Zielnutzerin: eine Schülerin, Englisch-Vokabeln
aus dem Schulbuch.

**Metapher: eine Wand mit Plakaten, nicht ein Stapel Karteikarten.**
Jede Vokabel ist ein aufgeklebtes Plakat. Beantwortete Vokabeln verschwinden nicht,
sie werden überklebt — die wachsende Papierschicht ist die Fortschrittsanzeige.
Richtige Antworten werden mit einem Gummistempel quittiert.

**Spielstruktur: Wellen und Runden** (aus dem Arcade-Denken übernommen, ohne
Retro-Arcade-Optik). Was nicht sitzt, wird wieder angeschlagen.

---

## 2. Kernmechanik (fix, nicht verhandelbar)

- Deutsch → Englisch, immer getippt. Keine Multiple Choice.
- **Richtig** → raus aus dem Pool.
- **Falsch** → die korrekte Antwort muss selbst noch einmal abgetippt werden
  (aktive Reproduktion), danach wandert die Vokabel in die nächste Runde.
- **Runden:** R1 = alle · R2 = nur die Falschen aus R1 · R3 = die weiterhin
  Falschen · … bis 0 übrig sind.
- Falsch-Feedback ist spielerisch, nie demütigend.

### Wellen innerhalb von Runde 1
Ab 20 Vokabeln wird Runde 1 in Wellen à 10–13 unterteilt, jede mit einem kurzen
Abschlussmoment. Grund: 52 Vokabeln am Stück sind ~8 Minuten ohne Erfolgserlebnis.
Ab Runde 2 keine Wellen mehr (dort sind es ohnehin wenige Wörter).
Die Rundenmechanik bleibt davon unberührt.

---

## 3. Bewertung: drei Zustände

| Zustand | Erkennung | Abtippen? | Kommt zurück? | Serie |
|---|---|---|---|---|
| **Richtig** | Treffer nach Normalisierung | nein | nein | +1 |
| **Fast** | Tippfehler (siehe unten) | **nein** | ja | **eingefroren** |
| **Noch nicht** | alles andere | **ja** | ja | → 0 |

**Entscheidung zu „Fast":** kein Abtippen. Die Vokabel war gewusst, nur falsch
geschrieben — Strafarbeit für Fast-Können demotiviert. Die korrekte Schreibweise
wird 1100 ms mit hervorgehobener Fehlstelle gezeigt. Der Lerneffekt geht nicht
verloren, weil die Vokabel in der nächsten Runde ohnehin wiederkommt und dort
korrekt geschrieben werden muss.

### Normalisierung (gilt als voll richtig, ohne Hinweis)
Trimmen · Mehrfach-Leerzeichen · Groß/Klein · Apostroph-Varianten ·
Endsatzzeichen · optionales führendes `to ` bei Verben · optionale Artikel
`a/an/the` · Bindestrich ↔ Leerzeichen (nur wenn die Lösung einen enthält) ·
BE/AE-Varianten beide gültig (`colour/color`, `-ise/-ize`).

### Tippfehler-Schwelle (Damerau-Levenshtein)
| Länge der Lösung | erlaubte Distanz |
|---|---|
| ≤ 4 Zeichen | **0** |
| 5–7 Zeichen | 1 |
| ≥ 8 Zeichen | 2 |

Bei kurzen Wörtern ist Distanz 1 meist ein anderes Wort (`hat/hit/hot`).

**Harte Ausschlüsse — dann nie „Fast", immer „Noch nicht":**
1. Die Eingabe ist die Lösung einer **anderen Vokabel im Deck** → Verwechslung.
2. Bei Distanz 2 müssen die ersten zwei Zeichen stimmen.
3. Bei Mehrwortlösungen muss die Wortanzahl stimmen.
4. Leere Eingabe.

### Korrekturmodus („Noch nicht")
Lösung 1400 ms in voller Größe → verblasst zu einer **Geisterspur**
(erster Buchstabe sichtbar, Rest als Punkte, Wortlänge und Wortgrenzen erhalten).
Abtippen aus dem Kurzzeitgedächtnis statt Abschreiben.
**„Zeig's mir"-Button: halten = Lösung sichtbar, loslassen = wieder Geist.**
Kein Limit, keine Bestrafung. Kein Enter nötig — sobald der Text stimmt, geht es weiter.
Zeichenweiser Live-Abgleich in Monospace, **ohne** Tastenanschläge zu blockieren.

### Ventile
- **„weiß ich nicht"-Chip** — immer sichtbar, führt in den Korrekturpfad ohne Rot
  und ohne harten Sound. Ehrliches Nichtwissen darf nicht teurer sein als Raten.
- **„war richtig"-Chip** — stuft eine Fehlbewertung auf „Fast" herunter und wird
  geloggt, um fehlende Alternativantworten im Datensatz zu finden.
- **Leeres Enter** ist kein Fehler; zweites leeres Enter binnen 3 s = „weiß ich nicht".

---

## 4. Punkte und Motivation

```
Treffer (erster Versuch)   = 100 × combo
Treffer nach Tippfehler    =  50 × combo
RETTUNG (in Runde N falsch,
   in Runde N+1 richtig)   = 250 × combo   ← höchster Einzelwert im Spiel
Wellenabschluss            = +250
Perfekte Welle             = Wellensumme × 1,5
Session geschafft          = +500 + (100 × Anzahl Rettungen)
Fehler                     =    0   (niemals negativ)
```

`combo`: 1–2 → ×1,0 · 3–4 → ×1,2 · 5–7 → ×1,5 · 8–11 → ×2,0 · ab 12 → ×3,0 (Cap).
Bricht bei „Noch nicht" auf 0, friert bei „Fast" ein.

**Warum die Rettung der höchste Wert ist:** Sie markiert exakt den Moment, in dem
gelernt wurde. Wer alles sofort kann, bekommt weniger als wer Fehler macht und sie
schließt. Damit ist der Fehler entwertet und die Rundenmechanik wird zur Belohnung
statt zur Strafe.

**Rekorde (Selbstvergleich, pro Unit):** HÖCHSTE PUNKTZAHL · WENIGSTE RUNDEN · LÄNGSTE SERIE.

**Bewusst weggelassen** — jeweils mit Grund:
- **Täglicher Verfalls-Streak** → erzeugt Sessions, die nur den Zähler retten, und
  Auswahl der leichtesten Übungen. Ersatz: kumulativer Zähler „Stammgast: 7 Sessions",
  verfällt nie.
- **Herzen/Leben** → bestraft Ausprobieren und widerspricht der Kernmechanik.
- **Punktabzug** → erzeugt Vermeidung (leeres Feld statt Versuch).
- **Zeitlimit pro Vokabel** → belohnt Raten, bestraft Nachdenken.
- **Währung, Shop, Avatare** → erwartete materielle Belohnung untergräbt intrinsische Motivation.
- **Leaderboards, Ligen** → sozialer Vergleich, schwächstes Gamification-Element.
- **Multiple Choice als „einfacher Modus"** → höhlt die Kernmechanik aus.

---

## 5. UX

### Flow
`Start → Set wählen → Briefing → Spiel → Rundenende → (nächste Runde) → Session-Ende`

**Übergänge innerhalb einer Runde laufen automatisch, ohne einen einzigen Pflicht-Tap.**
Rundenwechsel brauchen einen Tap — psychologisch als Verschnaufmoment, technisch weil
iOS Tastatur und AudioContext nur in einer echten Nutzergeste freigibt.
Der **Briefing-Screen** existiert genau aus diesem Grund: Sein Button ist der
Unlock-Punkt für Tastatur und Audio.

### Die drei eisernen Regeln des Spielscreens
1. **Ein einziger Input-Knoten über die gesamte Session.** Nie neu gerendert, nie
   ausgetauscht, nie `disabled` (nur ein internes `locked`-Flag), nie geblurrt.
2. **`focus()` ausschließlich synchron in Click-Handlern**, nie nach `await`.
3. **Der gesamte Spielbereich ist Refokus-Fläche** — geht die Tastatur zu, reicht ein
   Tap irgendwo.

### Viewport
- `interactive-widget=resizes-content` im Meta-Viewport (löst Android).
- **Höhenquelle ist die VisualViewport API**, in eine CSS-Custom-Property geschrieben,
  rAF-gedrosselt auf `resize` + `scroll`. `dvh` nur als Fallback davor.
- Kein `position: fixed` für das Eingabefeld — landet auf iOS unter der Tastatur.
- `body { overflow: hidden; overscroll-behavior: none }`, kein Scrollbereich im Spiel.
- **Input-`font-size` niemals unter 16px** (sonst zoomt iOS rein und nicht zurück).
- Schrumpf-Priorität: erst Luft, dann Dekoration, dann Wortgröße. Das Feld schrumpft nie.

### Input-Attribute (gegen Autokorrektur-Fehler)
`type=text` `inputmode=text` `lang=en` `autocapitalize=off` `autocorrect=off`
`spellcheck=false` `autocomplete=off` + randomisierter `name` `enterkeyhint=go`
`data-1p-ignore` `data-lpignore`

### Fortschritt: Schichtkante und Stapel
Ein Segment pro Vokabel **der aktuellen Runde/Welle**, immer über die volle Breite.
Runde 1 mit 13 Wörtern = 13 feine Striche; Runde 3 mit 4 Wörtern = 4 fette Blöcke.
**Die Schrittweite wächst sichtbar, je weiter man kommt** — Zielgeraden-Effekt aus
reiner Geometrie, kein Motivationstext nötig.

Falsche Vokabeln lösen sich sichtbar aus der Kette und fliegen in den Stapel-Chip.
Der heißt **„Runde 2: 4"**, niemals „Fehler: 4", und ist bernstein, nicht rot.

Dazu ein Zähler „sitzt 12/24", der **nur steigt und nie fällt**. Runden-Chip zeigt
nur die Nummer — nie „Runde 3 von 5", die Gesamtzahl ist unbekannt.

### Onboarding: kein Tutorial
Drei kontextuelle Einzeiler, jeder genau einmal:
1. Briefing: „Deutsch → Englisch · Du tippst die Antwort."
2. Beim ersten Fehler, während das Segment in den Stapel fliegt: „Kommt in Runde 2 zurück."
3. Beim ersten Rundenende: „Runde 2: nur die vier, die dich erwischt haben."

Die Mechanik wird durch die Animation gelehrt, der Text bestätigt nur das Gesehene.

### Persistenz
Nach **jeder** beantworteten Vokabel Sessionzustand in `localStorage`
(Set-ID, Runde, aktueller Pool, nächster Pool, Index, Statistik, Zeitstempel).
Kein `beforeunload`. Sessions älter als 7 Tage werden verworfen.
Langzeit pro Wort: Anzahl benötigter Runden, letzter Fehlerzeitpunkt →
speist das Deck **„Wackelkandidaten"**.

---

## 6. Visuelle Identität — „ÜBERKLEBT"

**Dunkle Hülle, helles Papier. Kein Light-Mode.** Alles Gelesene steht auf Papier
(15,55:1) — es gibt kein graues Kleingedrucktes auf grauem Grund.

Zwei Motive tragen die ganze Identität: **Schicht** (Plakate überkleben einander)
und **Stempel** (Gummistempel statt Häkchen). Kein Maskottchen, kein Emblem,
keine Illustration nötig.

### Farbtoken
```css
--c-bg:            #131110;  /* Asphaltschwarz */
--c-bg-2:          #1D1A17;  /* Beton */
--c-chalk:         #F4EFE6;  /* 16,44:1 auf bg  AAA */
--c-chalk-muted:   #A79E90;  /*  7,12:1 auf bg  AAA */
--c-border-strong: #6B6154;  /*  3,10:1  AA (UI) */
--c-border-soft:   #2E2924;  /* rein dekorativ */

--c-paper:         #F1E9DB;  /* 15,62:1 auf bg */
--c-paper-2:       #E4DAC7;  /* Schichtkante */
--c-ink:           #16110D;  /* 15,55:1 auf paper  AAA */
--c-ink-muted:     #5F5449;  /*  6,11:1 auf paper  AA+ */
--c-paper-line:    #8A7D6C;  /*  3,33:1  AA (UI) */

--c-brown:         #5A2A1D;  /* 2. Druckebene, 9,77:1 auf paper  AAA */
--c-signal:        #FFD100;  /* Riso-Gelb, 12,89:1 auf bg — NIE als Text auf Papier */

--c-ok:            #3FCF4E;  /* auf dunkel 9,19:1 */
--c-ok-ink:        #1B6A25;  /* auf Papier 5,56:1 */
--c-near:          #FFD100;
--c-bad:           #FF4B2E;  /* auf dunkel 5,65:1 */
--c-bad-ink:       #B32410;  /* auf Papier 5,48:1 — c-bad auf Papier = 2,77:1, verboten */
--c-focus:         #F4EFE6;
```

**Regel „nie nur Farbe":** Jeder Zustand ist an Farbe **+ Linienform** (richtig =
dick durchgezogen, fast = gestrichelt, falsch = doppelt) **+ Glyph** (Häkchen / ≈ / ×)
**+ Klartext** erkennbar. Funktioniert bei Rot-Grün-Schwäche und in Graustufen.

### Typografie
- **Big Shoulders Display 800** (OFL) — Vokabelwort, Titel. Schmal genug, dass
  lange deutsche Wörter auf 390px in eine Zeile passen.
- **Big Shoulders Stencil Display 900** (OFL) — Stempel, Badges. Identisches Skelett.
- **Archivo 400/600/700** (OFL) — alles Gelesene. Große x-Höhe, hält 12–16px auf dem Handy.
- **Noto Sans** (OFL) — **nur** die Lautschrift, eigener Token `--font-ipa`.

> **Achtung Lautschrift:** Das Google-Fonts-`latin`-Subset enthält **keine**
> IPA-Extensions (U+0250–02AF). Über die Google-CSS-API eingebunden erscheinen bei
> `ˈ ː ə ʃ ʒ ɜ ɒ æ ʊ` Ersatzglyphen. Lösung: Noto Sans selbst hosten, mit `pyftsubset`
> auf `U+0020-007E, U+00A0-00FF, U+0250-02AF, U+02B0-02FF, U+1D00-1D7F` subsetten
> (~20 KB WOFF2). Teststring:
> `[ˈbjuːtɪfl̩] [ʃɜːt] [ˈæpl̩] [ˌɪntəˈnæʃənəl] [θɪŋk] [ˈmɛʒə] äöüß ÄÖÜ`

### Form
Radien **0** (einzige Ausnahme: der Sound-Kippschalter).
**Keine weichen Schatten** — nur harter Versatz ohne Blur (`4px 4px 0`), das simuliert
eine zweite Druckfarbe statt Material-Design-Licht. Einzige Ausnahme: ein
großflächiger Radialgradient als „Natriumlicht" im Hintergrund.

### Bewegung
```css
--ease-stamp: cubic-bezier(.2,.9,.25,1);
--ease-slide: cubic-bezier(.16,1,.3,1);
--ease-snap:  cubic-bezier(.5,0,.75,0);
--t-instant:  60ms;  --t-fast: 120ms;  --t-base: 180ms;
--t-slow:    320ms;  --t-cele: 900ms;
```
Nichts fadet weich, nichts pulsiert im Leerlauf, **keine Endlos-Loops**, kein Spinner.

**Richtige Antwort: 260 ms, ab 120 ms wieder tippbar.** Vier Maßnahmen, damit die
Animation beim 50. Mal noch trägt:
1. **Sie ist nie ein Gate.** Enter bricht sie ab und springt weiter. Tastenanschläge
   während der Animation werden **gepuffert, nicht verworfen** — diese eine Regel
   entscheidet, ob sich die App schnell oder klebrig anfühlt.
2. **Konstanter Rhythmus, variierendes Detail:** Rotation (5 Werte), Ankerpunkt
   (5 Positionen), Stempelwort (8: SITZT · SAUBER · JA · GEHT KLAR · ECHT JETZT ·
   PERFEKT · WEITER · HAST DU) — deterministisch über den Index, ~200 Kombinationen.
3. **Eskalationsleiter:** Die Basisbestätigung bleibt für immer klein. Größeres ist rar.
4. **Keine Partikel bei Einzelantworten. Nie.**

**Falsch:** nur das Plakat wackelt, nicht der Screen. Kein Vollbild-Rotblitz.
**Fast:** kein Schütteln (das wäre Strafe für fast Richtiges) — gelber Textmarker
zieht in 160 ms über die Fehlstelle.
**Session-Ende:** der einzige große Moment (~900 ms), Stempel schlägt zweifarbig
versetzt ein (braune Ebene 20 ms vor der gelben, 2 px daneben).

`prefers-reduced-motion`: alle Transforms entfallen, Zustandswechsel bleiben über
Farbe, Linienform, Glyph und Text vollständig lesbar. Schütteln entfällt ersatzlos.

### Illustration ohne zu zeichnen
Korn (`feTurbulence` als Data-URI, zwei Frequenzen = Papier und Beton) ·
Halbtonraster (`radial-gradient`) · Fehlregister (`text-shadow` 1–3px diagonal,
pro Screen immer dieselbe Richtung) · Typo als Bild (angeschnittene Schablonenwörter) ·
**genau fünf Icons** (×, Häkchen im Quadrat, ≈, drei Balken, Pfeil) · Perforationsrand
statt `<hr>`.

**Verboten:** Fotos, KI-Bilder, Icon-Bibliotheken, Emoji als UI-Element, Maskottchen,
Wappen-/Schildformen, Totenköpfe in jeder Abwandlung, Trikot-/Streifenmuster,
erkennbare Vereinsmotive. Testfrage bei jedem Element: *löst es die Frage aus
„ist das ein Vereinslogo?" — dann fliegt es raus.*

### Logo-Platzhalter
`<div class="logo-slot">` nimmt genau ein `<img>`/`<svg>` auf. Per `:has(> *)`
verschwinden gestrichelter Rahmen und Label automatisch. **Kein Innenabstand**, damit
ein späteres Logo randlos sitzt. Bis dahin ein reiner Wortmarken-Typoblock — kein Emblem.

---

## 7. Sound

**Alles zur Laufzeit mit der Web Audio API synthetisiert. Keine einzige Audiodatei**
(außer der später gelieferten Musik). Grund: Die Streak-Eskalation braucht
Tonhöhenvariation — mit Oszillatoren ist das `f × 2^(n/12)`, mit Dateien entweder
12 Exporte oder `playbackRate`-Resampling, das ab 3 Halbtönen künstlich klingt.
Gesamter Sound-Code < 8 KB. Null Lizenzrisiko.

**Tonales System: A-Moll-Pentatonik** (A–C–D–E–G). Keine Halbtonreibung, jede
Überlappung bleibt konsonant. Moll klingt urban statt kindlich.

### Streak-Eskalation — der wichtigste Trick
Der Erfolgston wird pro Serienstufe entlang der Pentatonik transponiert
(+0/+3/+5/+7/+10/+12 Halbtöne). **Das ist primär eine Anti-Ermüdungs-Maßnahme**, erst
sekundär eine Belohnung: bei 50 Vokabeln hört man sonst 50× exakt denselben Ton.
Ab Stufe 7 friert die Tonhöhe ein, die Eskalation läuft über Dichte und Klangfarbe,
**nie über Lautstärke**. Ab Stufe 12 keine Steigerung mehr.
Serienbruch braucht keinen eigenen Sound — der Rückfall auf Stufe 1 ist die Information.

### Fehler-Sound
**4,5 dB leiser als der Erfolg**, dunkler statt heller, konsonante kleine Terz mit
–40 Cent Glide („ausatmen", kein Absturz), Tiefpass 900 Hz. Die Musik duckt sich dabei
kaum (–3 dB) — der Fehler wird akustisch **nicht** inszeniert.
Kein Buzzer, keine fallende Oktave, kein „sad trombone": erzeugt Scham, und Scham ist
der stärkste Abbruchtreiber beim Vokabellernen.

### Busse und Defaults
`master 0.75` · `ui 0.45` · `feedback 0.85` · `music 0.35`
Safety-Limiter immer aktiv (threshold −8 dB, ratio 12). Master-Peak nie über −1 dBFS.
Ducking per `setTargetAtTime` mit **Referenzzähler** (sonst bleibt die Musik bei
überlappenden Ducks unten hängen).

### Defaults
- **Sounds AN, Musik AUS.** Musik ungefragt zu starten ist auf dem Handy invasiv.
- **Tastenklick AUS.** 50 Vokabeln × 7 Zeichen = ~350 Ticks pro Session.
- Ein sichtbarer Haupt-Toggle mutet **alles**, per 80 ms Gain-Ramp — **nicht**
  `ctx.suspend()`, sonst fehlt beim Wiedereinschalten der erste Sound.
- Zustand in `localStorage`, wiederhergestellt **bevor** der erste Sound spielen kann.

### Mobile Fallstricke
AudioContext einmalig beim Briefing-Tap unlocken (+ Silent-Buffer-Warm-up) ·
`latencyHint: 'interactive'`, Start immer bei `currentTime + 0.005` ·
Ein Singleton-Context für die App-Lebensdauer · `visibilitychange` + `onstatechange`
→ `resume()`, laufende Voices hart abbrechen · Envelopes nie hart auf 0
(Attack ≥ 2 ms, exponentieller Decay auf 0.0001) · Voice-Limit 12, pro Sound-ID
40 ms Mindestabstand · **iOS-Stummschalter wird respektiert, nicht umgangen** —
deshalb hat jedes Audio-Feedback ein redundantes visuelles Pendant.

### Musik-Slot
`/assets/music/manifest.json` mit `loopStart`/`loopEnd`/`gain` pro Track.
Opus/OGG 96 kbps + AAC/M4A 128 kbps (`canPlayType`). **Kein MP3** — Encoder-Padding
erzeugt hörbare Loop-Lücken. Wiedergabe über `AudioBufferSourceNode` mit `loop=true`,
nicht `<audio loop>`. Kein Neustart bei Rundenwechsel, nur Ducking.
Ist das Manifest leer, läuft ein synthetisierter „Kiez-Puls" (Sub-Kick, Hi-Hats,
Vinyl-Knistern, 84 BPM) — Default bleibt aber Stille.

**Briefing für die gelieferte Musik:** A-Moll · 80–92 BPM · instrumental, kein Gesang ·
keine Melodie-Hooks · **2–4 kHz freihalten** (dort sitzen die Feedback-Sounds) ·
kein Build-up/Drop · Loop 30–90 s, sauber am Taktende.

---

## 8. Technische Architektur

| Entscheidung | Begründung |
|---|---|
| **Vite + TypeScript** | Schneller Dev-Server, HMR, ein Build-Befehl, statisches Ergebnis |
| **Vanilla DOM, kein Framework** | Die eiserne Regel „ein persistenter Input-Knoten, nie neu gerendert" ist mit direktem DOM garantiert. Mit React wäre sie eine Konvention, die ein späterer Re-Render bricht — und dann klappt auf iOS die Tastatur zu und der Flow ist tot. Bei 6 Screens kostet das Framework mehr, als es bringt. |
| **CSS mit Custom Properties, kein Tailwind** | Die Print-Ästhetik (Korn, Fehlregister, Halbton, Klebeband) ist custom; Utility-Klassen helfen dabei nicht. |
| **localStorage** | Kein Backend, kein Login, keine Datenschutzfragen. Alles bleibt auf dem Gerät. |
| **Web Audio API, selbst gebaut** | Siehe Abschnitt 7. |
| **Selbst gehostete Schriften (WOFF2, subsetted)** | IPA-Abdeckung; und kein Google-Fonts-Request. |
| **Deploy: Netlify** | Repo hat bereits `netlify.toml`; statisches Bundle. |

### Struktur
```
vokabel-app/
├── index.html
├── src/
│   ├── main.ts            Bootstrap, Router
│   ├── state.ts           Sessionzustand, Runden-/Wellenlogik, Persistenz
│   ├── grading.ts         Normalisierung, Damerau-Levenshtein, drei Zustände
│   ├── audio.ts           Web-Audio-Engine, Busse, Ducking, alle States
│   ├── screens/           start · briefing · play · roundEnd · sessionEnd
│   └── styles/            tokens.css · print.css (Korn/Raster) · components.css
├── data/                  Vokabelsets als JSON
├── assets/logo/           Platzhalter — Logo kommt später
├── assets/music/          Platzhalter + manifest.json
└── docs/KONZEPT.md        dieses Dokument
```

### Datenmodell (erweitert gegenüber dem Rohimport)
```json
{
  "id": "journey",
  "de": "Reise; Fahrt",
  "en": ["journey"],
  "accept": [],
  "ipa": "['dʒɜːni]",
  "hint": "Substantiv",
  "example": "On our journey through England we met a lot of nice people.",
  "note": "Fr. future (m)"
}
```
`en` = gleichwertige Musterlösungen · `accept` = weitere gültige Übersetzungen,
werden richtig gewertet, aber am Ende mit der Buchvokabel gezeigt.
**Ohne gepflegte Alternativen ist die Bewertung unfair** — das ist eine
Datenanforderung, keine UI-Frage.

---

## 9. Definition of Done

Kernmechanik läuft · Falsche landen in der nächsten Runde · Richtige verschwinden ·
Session endet zuverlässig bei 0 · Korrektur muss abgetippt werden ·
Mobile UX funktioniert (iPhone SE und Android mit Vorschlagsleiste getestet) ·
Desktop funktioniert · Sounds funktionieren und sind abschaltbar ·
Animationen funktionieren, `prefers-reduced-motion` respektiert ·
Fortschritt sichtbar · WCAG-AA-Kontraste eingehalten · keine offensichtlichen UI-Bugs ·
QA hat die Kernflows getestet · Critic hat keine kritischen Befunde mehr.
