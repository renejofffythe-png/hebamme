# ÜBERKLEBT — Vokabeltrainer

Deutsch rein, Englisch raus. Mobile-First Web-App zum Vokabellernen.

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5180
npm run build    # Typecheck + statisches Bundle nach dist/
```

## Wie es funktioniert

Ein deutsches Wort erscheint, die englische Übersetzung wird getippt.
Richtige Antworten verschwinden aus dem Pool. Falsche müssen einmal korrekt
abgetippt werden und kommen in der nächsten Runde wieder — so lange, bis
nichts mehr offen ist.

Eine in Runde N verpasste und in Runde N+1 geknackte Vokabel ist mit 250
Punkten der höchste Einzelwert im Spiel. Der Fehler ist damit nicht bestraft,
sondern die Rundenmechanik belohnt.

Das vollständige Konzept mit allen Entscheidungen und ihren Begründungen:
[docs/KONZEPT.md](docs/KONZEPT.md).

## Struktur

| Pfad | Inhalt |
|---|---|
| `src/grading.ts` | Bewertung: Normalisierung, Tippfehler-Erkennung, Verwechslungs-Guard |
| `src/state.ts` | Runden, Wellen, Punkte, Persistenz |
| `src/audio.ts` | Sound-Engine — alles zur Laufzeit synthetisiert, keine Audiodateien |
| `src/screens/play.ts` | Der Spielscreen (siehe die drei eisernen Regeln im Dateikopf) |
| `data/` | Vokabelsets |
| `assets/logo/` | Platzhalter — hier kommt das Logo hin |
| `assets/music/` | Platzhalter — `manifest.json` anlegen, dann läuft die Musik |

## Noch offen

- Logo einsetzen (`assets/logo/`, der Slot blendet Rahmen und Label automatisch aus)
- Eigene Musik (`assets/music/manifest.json`) — A-Moll, 80–92 BPM, instrumental,
  2–4 kHz freihalten; die Begründung steht in KONZEPT.md Abschnitt 7
