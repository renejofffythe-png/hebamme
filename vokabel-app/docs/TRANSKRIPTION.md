# Transkriptions-Vorlage

Womit die App gefüttert wird: **eine JSON-Datei pro Vokabelliste.** Diese Datei
entsteht, indem ein Sprachmodell (Gemini, Claude, ChatGPT) die abfotografierte
Buchseite abtippt. Der Prompt dafür steht unten — er ist derselbe, der im
Import-Screen unter „Woher kommt so eine Datei?" zum Kopieren bereitliegt.

**Wichtig:** Markdown-Tabellen, wie ein Chatmodell sie von sich aus ausgibt, liest
die App nicht. Deshalb der Prompt: er verlangt JSON, und zwar ohne Rahmen drumherum.

---

## Der Prompt

> Hier sind Fotos einer Vokabelliste aus einem Schulbuch. Tippe sie vollständig ab
> und gib **ausschließlich JSON** zurück — keine Erklärung davor oder danach, keine
> Markdown-Tabelle, keine ``` -Zäune.
>
> Format:
>
> ```
> {
>   "unit": "Unit 1 – Goodbye Greenwich",
>   "quelle": "Schulbuch, Seiten 168–170",
>   "abschnitte": [
>     {
>       "seite": 168,
>       "titel": "Introduction",
>       "vokabeln": [
>         {
>           "en": "journey",
>           "lautschrift": "[ˈdʒɜːni]",
>           "de": "Reise; Fahrt",
>           "beispiel": "On our journey through England we met a lot of nice people."
>         },
>         {
>           "en": "future",
>           "lautschrift": "[ˈfjuːtʃə]",
>           "de": "Zukunft",
>           "beispiel": "What will the future be like?",
>           "hinweis": "Fr. future (m)"
>         },
>         {
>           "en": "to grow, grew, grown",
>           "lautschrift": "[grəʊ], [gruː], [grəʊn]",
>           "de": "wachsen",
>           "beispiel": "All kinds of flowers grow in our garden."
>         }
>       ]
>     }
>   ]
> }
> ```
>
> Regeln:
>
> 1. **"en"** ist das fremdsprachige Wort **genau wie im Buch** — mit „to" bei
>    englischen Verben, mit den Stammformen („to grow, grew, grown"), mit Klammern
>    („to move (house)", „(wind)surfing"). Bei anderen Sprachen als Englisch bleibt
>    der Feldname trotzdem "en".
> 2. **"de"** ist die deutsche Bedeutung, wie sie im Buch steht; mehrere Bedeutungen
>    mit Semikolon: "Reise; Fahrt".
> 3. **"lautschrift"** in eckigen Klammern, mit echten IPA-Zeichen (ˈ ˌ ː ə ɜ ʃ …),
>    nicht mit Ersatzzeichen. Steht im Buch keine, lass das Feld weg.
> 4. **"beispiel"** nur, wenn das Buch einen Beispielsatz abdruckt — ohne
>    Kursiv-Sternchen, ohne `<br>`, als ein Satz.
> 5. **"hinweis"** für alles Übrige im Eintrag: Herkunft („Fr. future (m)",
>    „Lat. includere"), Merksätze („! Surfen und Windsurfen sind verschiedene
>    Sportarten"), Gegensätze („negative ↔ positive"), Gleichsetzungen
>    („in the countryside = auf dem Land"). Mehreres mit „ · " verbinden.
> 6. **Ein Objekt pro Vokabel.** Überschriftenzeilen aus der Tabelle
>    („8 Introduction") sind keine Vokabeln. Die kleinen Randziffern kannst du
>    weglassen.
> 7. **Pro Buchseite ein Abschnitt** mit "seite" (Zahl) und "titel" (die Überschrift
>    auf der Seite, sonst weglassen).
> 8. **Nichts erfinden, nichts weglassen, Reihenfolge wie im Buch.** Keine Synonyme
>    ergänzen, keine Bedeutungen dazudichten.
> 9. Gültiges JSON: doppelte Anführungszeichen, keine Kommentare, kein Komma nach
>    dem letzten Eintrag.

---

## Was in der App damit passiert

| Buchvorlage | JSON | In der App |
|---|---|---|
| `to include` | `"en": "to include"` | getippt wird `include`, Wortart „Verb" |
| `to grow, grew, grown` | dasselbe, mit Kommas | Lösung `grow`, Hinweis „Unregelmäßig: grow – grew – grown" |
| `to move (house)` | dasselbe, mit Klammern | Lösung `move house`, `move` gilt auch |
| `(wind)surfing` | dasselbe | Lösung `windsurfing` (die Klammer klebt am Wort) |
| `['dʒɜːni]` | `"[ˈdʒɜːni]"` | Lautschrift auf dem Plakat + Sprachausgabe |
| Reise; Fahrt | `"de": "Reise; Fahrt"` | steht so auf dem Plakat |

Was die App **nicht** automatisch ergänzt: gleichwertige Alternativlösungen
(`journey` → auch `trip`). Die stehen in `accept` und sind Handarbeit — automatisch
entstünde Halbwissen, das falsche Antworten durchwinkt. Tippfehler, Bindestriche und
britische/amerikanische Schreibweisen fängt die Bewertung ohnehin selbst ab.

---

## Kurzform ohne JSON

Für eine schnelle Liste ohne Buch reicht purer Text, eine Zeile pro Vokabel,
**deutsch zuerst**:

```
Zukunft = future
Reise; Fahrt = journey [ˈdʒɜːni] # On our journey through England we met a lot of nice people.
```

Trennzeichen: `=`, `|` oder Tab. Lautschrift in eckige Klammern, Beispielsatz hinter
ein `#`. Steht die Fremdsprache in der ersten Spalte, hilft im Import-Screen der
Schalter „Spalten tauschen".
