---
name: vokabel-transkription
description: Tippt Vokabellisten aus Schulbuch-Fotos ab und gibt sie als JSON für die ÜBERKLEBT-Vokabel-App aus. Nutze diesen Skill immer, wenn Fotos oder Scans einer Vokabelseite hochgeladen werden, wenn jemand "Vokabeln abtippen", "Vokabelliste transkribieren", "Unit 2 abtippen", "Seite 171 abtippen", "Liste für die Vokabel-App", "JSON für ÜBERKLEBT" oder Ähnliches schreibt — auch dann, wenn das Wort "JSON" nicht fällt und nur ein Foto mit "kannst du das abtippen?" kommt. Gilt für jede Zielsprache (Englisch, Französisch, Spanisch, Italienisch, Latein …), nicht nur Englisch.
---

# Vokabelliste abtippen → JSON für ÜBERKLEBT

Ziel dieses Skills ist eine Datei, die die Vokabel-App **ohne Nacharbeit importieren
kann**. Die App liest ausschließlich JSON mit benannten Feldern. Eine Markdown-Tabelle
— die Form, in die ein Chatmodell so eine Liste von sich aus gießt — kann sie nicht
lesen: Spalten sind dort nicht benannt, Kursiv-Sternchen und `<br>` landen mitten in
den Daten, und beim Kopieren zerfallen lange Zellen. Deshalb: JSON, sonst nichts.

## Ablauf

1. **Fotos sichten.** Welche Seiten sind es, welche Sprache, wie heißt die Einheit?
   Titel und Seitenzahlen stehen meist als Kopfzeile auf der Seite.
2. **Zeile für Zeile abtippen** — in der Reihenfolge des Buchs, ein Objekt je Vokabel.
3. **Datei schreiben** (wenn ein Dateisystem da ist): `unit2.json` o. ä., am besten
   neben die anderen Listen. Sonst den JSON-Block ausgeben — als reinen Text, ohne
   Erklärung davor oder danach.
4. **Prüfen** mit dem beiliegenden Skript:
   ```bash
   python3 scripts/pruefe_liste.py unit2.json
   ```
   Es findet genau die Fehler, an denen der Import scheitert (fehlende Felder, übrig
   gebliebene Sternchen, Lautschrift ohne Klammern, doppelte Einträge). Melde dem
   Nutzer, was es sagt, statt es stillschweigend zu übergehen.
5. **Kurz berichten:** wie viele Vokabeln, welche Seiten, wo die Datei liegt — und
   dass sie in der App über *Listen → Neue Liste hinzufügen* importiert wird.

## Das Format

```json
{
  "unit": "Unit 1 – Goodbye Greenwich",
  "quelle": "Schulbuch, Seiten 168–170",
  "abschnitte": [
    {
      "seite": 168,
      "titel": "Introduction",
      "vokabeln": [
        {
          "en": "journey",
          "lautschrift": "[ˈdʒɜːni]",
          "de": "Reise; Fahrt",
          "beispiel": "On our journey through England we met a lot of nice people."
        },
        {
          "en": "future",
          "lautschrift": "[ˈfjuːtʃə]",
          "de": "Zukunft",
          "beispiel": "What will the future be like?",
          "hinweis": "Fr. future (m)"
        }
      ]
    }
  ]
}
```

**Alle Werte oben sind Beispiele aus einer echten Seite, keine Vorgaben.** `unit`,
`quelle`, `seite` und `titel` kommen aus den Fotos, die gerade vorliegen. Wenn dort
„Unit 4 – Sports" auf Seite 92 steht, steht genau das in der Datei. Übernimm niemals
„Goodbye Greenwich" oder „168–170", weil es hier im Beispiel steht.

Ein vollständiges, echtes Beispiel über drei Seiten liegt in
`references/beispiel-unit1.json` — nachschlagen lohnt sich bei Zweifeln, wie ein
Sonderfall aussieht.

## Die Felder

| Feld | Pflicht | Inhalt |
|---|---|---|
| `en` | ja | das fremdsprachige Wort, **genau wie im Buch** |
| `de` | ja | die deutsche Bedeutung, genau wie im Buch |
| `lautschrift` | wenn abgedruckt | in eckigen Klammern, echte IPA-Zeichen |
| `beispiel` | wenn abgedruckt | der Beispielsatz, als reiner Satz |
| `hinweis` | wenn vorhanden | alles Übrige aus dem Eintrag |

Das Feld heißt **immer `en`**, auch bei Französisch oder Latein. Die App fragt die
Sprache beim Import ab; der Feldname ist nur ein Schlüssel, kein Sprachversprechen.

## Warum „genau wie im Buch" wörtlich gemeint ist

Die App baut aus dem Rohtext die Lösung selbst. Sie erkennt das englische `to` als
Infinitivmarker und lässt es beim Tippen weg, sie zieht aus `to grow, grew, grown`
den Hinweis „Unregelmäßig" und macht `grow` zur Lösung, und sie versteht Klammern:
bei `to move (house)` gilt `move house` **und** `move`, bei `(wind)surfing` dagegen
nur `windsurfing`, weil die Klammer am Wort klebt. Wer beim Abtippen „aufräumt“,
nimmt ihr genau diese Information weg.

| Im Buch | ins Feld `en` | die App macht daraus |
|---|---|---|
| to include | `"to include"` | getippt wird `include`, Wortart „Verb" |
| to grow, grew, grown | `"to grow, grew, grown"` | Lösung `grow` + Hinweis „Unregelmäßig: grow – grew – grown" |
| to move (house) | `"to move (house)"` | `move house`, `move` gilt auch |
| (wind)surfing | `"(wind)surfing"` | `windsurfing` |
| single ticket | `"single ticket"` | eigene Vokabel, auch wenn die Bedeutung sich mit einer anderen deckt |

Mehrere deutsche Bedeutungen trennt das Buch mit Semikolon — das bleibt so:
`"de": "Reise; Fahrt"`. Nicht auf eine Bedeutung eindampfen.

## Was in `hinweis` gehört

Alles, was im Eintrag steht und weder Vokabel, Bedeutung, Lautschrift noch
Beispielsatz ist. Mehreres mit ` · ` verbinden:

- Herkunft: `"Lat. includere"`, `"Fr. médiéval/-e"`
- Merksätze mit Ausrufezeichen: `"! Surfen und Windsurfen sind verschiedene Sportarten"`
- Gegensatzpaare: `"negative ↔ positive"` (die Pfeile `<->` und `->` als ↔ und →)
- Gleichsetzungen: `"in the countryside = auf dem Land"`, `"single ticket = one-way ticket"`

Solche Zeilen stehen im Buch oft in der Beispielspalte, sind aber keine Beispielsätze.
In der App erscheint `beispiel` beim Abtippen einer falschen Antwort — dort hilft ein
echter Satz, während „negative <-> positive" nur verwirrt.

## Sorgfaltsregeln

**Nichts erfinden.** Keine Synonyme, keine zusätzlichen Bedeutungen, keine selbst
gebauten Beispielsätze. Die App wertet Antworten gegen genau diese Daten; eine
erfundene Alternative macht später eine richtige Antwort falsch oder umgekehrt.

**Nichts weglassen.** Auch Vokabeln ohne Lautschrift und ohne Beispiel gehören rein.
Weggelassen wird nur, was keine Vokabel ist: die kleinen Randziffern und
Überschriftenzeilen wie „8 Introduction" oder „Station 1: Moving to the middle of
nowhere" — Letztere sind der `titel` des Abschnitts, keine Vokabel.

**Echte IPA-Zeichen** (ˈ ˌ ː ə ɜ ʃ ʊ ʒ ŋ …), keine ASCII-Ersatzschreibung. Das Buch
setzt den Betonungsstrich oft als Apostroph (`['dʒɜːni]`); daraus wird `[ˈdʒɜːni]`.
Stehen mehrere Lautschriften da (`[grəʊ], [gruː], [grəʊn]`), übernimm alle so.

**Bei Unleserlichem nicht raten.** Frag lieber nach einem schärferen Foto der Stelle,
oder benenne die Lücke ausdrücklich im Bericht. Eine falsch geratene Vokabel wird
sonst wochenlang falsch gelernt.

**Vollständigkeit prüfen:** Zähle die Zeilen auf dem Foto und vergleiche mit der Zahl
der Objekte. Bei langen Seiten reißt eine Transkription gern in der Mitte ab.

## Mehrere Seiten, lange Listen

Pro Buchseite ein Eintrag in `abschnitte`, mit `seite` als Zahl. Eine Einheit über
drei Seiten ergibt **eine** Datei mit drei Abschnitten — in der App wird daraus eine
Liste, und das ist gewollt: gelernt wird die Einheit, nicht die Seite.

Wird es sehr lang (über ~80 Vokabeln), lieber zwei Dateien („Unit 4, Teil 1/2") als
eine abgeschnittene. Ein abgebrochenes JSON ist unbrauchbar, eine geteilte Liste nur
unbequem.

## Ausgabeform

Als Datei, wenn möglich. Im Chat: der reine JSON-Block, keine Tabelle, keine
Vorrede. Gültiges JSON heißt: doppelte Anführungszeichen, kein Komma nach dem letzten
Eintrag, keine Kommentare. Ein ```-Zaun ist unnötig (die App nimmt ihn zwar ab, aber
er hilft niemandem beim Kopieren).
