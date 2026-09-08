# ÜBERKLEBT — Vokabeltrainer

Deutsch rein, Fremdsprache raus. Mobile-First Web-App zum Vokabellernen.

## Entwicklung

```bash
npm install
npm run dev      # http://localhost:5180
npm run build    # Typecheck + statisches Bundle nach dist/
```

## Wie es funktioniert

Ein deutsches Wort erscheint, die Übersetzung wird getippt.
Richtige Antworten verschwinden aus dem Pool. Falsche müssen einmal korrekt
abgetippt werden und kommen in der nächsten Runde wieder — so lange, bis
nichts mehr offen ist.

Eine in Runde N verpasste und in Runde N+1 geknackte Vokabel ist mit 250
Punkten der höchste Einzelwert im Spiel. Der Fehler ist damit nicht bestraft,
sondern die Rundenmechanik belohnt.

Nach der Bewertung wird die Lösung **vorgelesen** — mit der Stimme der Zielsprache,
damit die Betonung hörbar ist, nicht nur die Lautschrift lesbar. Zweites Antippen des
Lautsprechers spricht langsamer. Gibt es für die Sprache keine Stimme (Latein, ältere
Geräte), verschwindet der Knopf, statt falsch auszusprechen.

## Eigene Listen

„Listen" → „Neue Liste hinzufügen". Der Import frisst JSON (Transkription mit
Abschnitten, flache Liste oder fertiges Set) und rohen Text
(`Reise; Fahrt = journey [ˈdʒɜːni] # Beispielsatz`), in acht Zielsprachen.

Der gedachte Weg: Buchseite fotografieren, von einem Sprachmodell abtippen lassen,
Datei hochladen. Der passende Prompt steht auf dem Import-Screen zum Kopieren und
ausführlich in [docs/TRANSKRIPTION.md](docs/TRANSKRIPTION.md). Markdown-Tabellen,
wie ein Chatmodell sie von sich aus ausgibt, liest die App nicht — der Prompt sorgt
dafür, dass JSON zurückkommt.

Jede Liste bleibt einzeln gespeichert — mit Datum, eigenem Spielstand und eigenen
Bestwerten. Die Bibliothek sortiert nach Datum, neueste zuerst.

Das vollständige Konzept mit allen Entscheidungen und ihren Begründungen:
[docs/KONZEPT.md](docs/KONZEPT.md).

## Struktur

| Pfad | Inhalt |
|---|---|
| `src/grading.ts` | Bewertung: Normalisierung, Tippfehler-Erkennung, Verwechslungs-Guard |
| `src/state.ts` | Runden, Wellen, Punkte, Persistenz |
| `src/audio.ts` | Sound-Engine — alles zur Laufzeit synthetisiert, keine Audiodateien |
| `src/speech.ts` | Aussprache über die Web Speech API — Stimmen des Geräts |
| `src/library.ts` | Sammlung der Listen: laden, speichern, löschen, Datum |
| `src/import/parse.ts` | Import fremder Vokabellisten (JSON und Text) |
| `src/screens/play.ts` | Der Spielscreen (siehe die drei eisernen Regeln im Dateikopf) |
| `data/` | Vokabelsets |
| `assets/logo/` | Platzhalter — hier kommt das Logo hin |
| `assets/music/` | Platzhalter — `manifest.json` anlegen, dann läuft die Musik |

## Noch offen

- Logo einsetzen (`assets/logo/`, der Slot blendet Rahmen und Label automatisch aus)
- Eigene Musik (`assets/music/manifest.json`) — A-Moll, 80–92 BPM, instrumental,
  2–4 kHz freihalten; die Begründung steht in KONZEPT.md Abschnitt 7
