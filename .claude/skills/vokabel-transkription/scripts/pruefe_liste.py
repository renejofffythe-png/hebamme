#!/usr/bin/env python3
"""Prüft eine transkribierte Vokabelliste, bevor sie in die App wandert.

Sucht genau die Fehler, an denen der Import scheitert oder — schlimmer — still
etwas Falsches lernt: fehlende Felder, Reste aus der Markdown-Ausgabe,
Lautschrift ohne Klammern, doppelte Vokabeln, versehentlich übernommene
Beispielwerte aus der Vorlage.

    python3 pruefe_liste.py unit2.json

Rückgabe 0 = importierbar (evtl. mit Hinweisen), 1 = kaputt.
"""

import json
import re
import sys
from collections import Counter

# Werte aus der Vorlage. Tauchen sie auf, wurde das Beispiel abgetippt statt der Seite.
VORLAGE = {
    "Unit 1 – Goodbye Greenwich",
    "Unit 1 — Goodbye Greenwich",
    "Schulbuch, Seiten 168–170",
    "Unit 2 — Titel der Einheit",
    "Unit 2 – Titel der Einheit",
}

fehler: list[str] = []
# (Kategorie, Text) — gleichartige Hinweise werden am Ende zusammengefasst,
# sonst gehen die zwei wichtigen in dreißig gleichlautenden unter.
hinweise: list[tuple[str, str]] = []
apostrophe = 0


def eintraege(daten):
    """Fördert (abschnitt, vokabel) zutage — egal ob verschachtelt oder flach."""
    if isinstance(daten, list):
        for x in daten:
            yield from eintraege(x)
        return
    if not isinstance(daten, dict):
        return

    verschachtelt = daten.get("abschnitte") or daten.get("sections")
    liste = daten.get("vokabeln") or daten.get("words") or daten.get("entries")
    if verschachtelt or liste:
        for x in verschachtelt or []:
            yield from eintraege(x)
        for v in liste or []:
            if isinstance(v, dict):
                yield daten, v
        return
    if daten.get("en") or daten.get("de"):
        yield {}, daten


def text(v, *namen):
    for n in namen:
        w = v.get(n)
        if isinstance(w, str) and w.strip():
            return w.strip()
        if isinstance(w, list) and w:
            return "; ".join(str(x) for x in w)
    return ""


def main() -> int:
    global apostrophe
    if len(sys.argv) != 2:
        print("Aufruf: python3 pruefe_liste.py <datei.json>")
        return 1

    pfad = sys.argv[1]
    try:
        roh = open(pfad, encoding="utf-8").read()
    except OSError as e:
        print(f"Datei nicht lesbar: {e}")
        return 1

    if roh.lstrip().startswith("|") or re.search(r"^\|?\s*:?-{2,}", roh, re.M):
        print("✗ Das sieht nach einer Markdown-Tabelle aus. Die App liest JSON.")
        return 1

    entzaunt = re.sub(r"^```[a-z]*\s*|\s*```$", "", roh.strip())
    try:
        daten = json.loads(entzaunt)
    except json.JSONDecodeError as e:
        print(f"✗ Kein gültiges JSON: {e.msg} (Zeile {e.lineno}, Spalte {e.colno})")
        print("  Häufigste Ursache: die Antwort wurde in der Mitte abgeschnitten.")
        return 1

    if isinstance(daten, dict):
        for feld in ("unit", "quelle"):
            wert = text(daten, feld)
            if wert in VORLAGE:
                hinweise.append((
                    "vorlage",
                    f'"{feld}" steht auf dem Beispielwert „{wert}“ — '
                    "stammt die Angabe wirklich von diesem Foto?",
                ))

    paare = list(eintraege(daten))
    if not paare:
        print("✗ Kein einziger Eintrag mit den Feldern en und de gefunden.")
        return 1

    pro_seite = Counter()
    woerter = []

    for abschnitt, v in paare:
        en = text(v, "en", "wort", "vokabel", "target")
        de = text(v, "de", "deutsch", "bedeutung")
        ipa = text(v, "lautschrift", "ipa", "aussprache")
        bsp = text(v, "beispiel", "example")
        hnw = text(v, "hinweis", "note")
        marke = en or de or "(leer)"

        if not en or not de:
            fehlend = "de" if en else "en"
            fehler.append(f"„{marke}“: {fehlend} fehlt — die App überspringt den Eintrag.")
            continue

        woerter.append(en.lower())
        seite = abschnitt.get("seite") or abschnitt.get("page")
        pro_seite[seite if isinstance(seite, int) else "ohne Seite"] += 1

        for feld, wert in (("en", en), ("de", de), ("beispiel", bsp), ("hinweis", hnw)):
            if not wert:
                continue
            if "<br" in wert.lower():
                fehler.append(f"„{marke}“: <br> im Feld {feld} — Rest aus der Tabellenausgabe.")
            if "**" in wert or re.search(r"(?<!\w)\*\w", wert):
                fehler.append(f"„{marke}“: Sternchen im Feld {feld} — Kursiv-Markierung entfernen.")
            if "|" in wert:
                hinweise.append(("strich", f"„{marke}“: senkrechter Strich im Feld {feld} — Spaltenrest?"))

        if ipa:
            if not (ipa.startswith("[") and ipa.endswith("]")):
                hinweise.append(("klammern", f"„{marke}“: Lautschrift ohne eckige Klammern ({ipa})."))
            if re.search(r"['`´]", ipa):
                apostrophe += 1
        if bsp and re.search(r"<->|(?<!-)->|\s=\s", bsp):
            hinweise.append((
                "merksatz",
                f"„{marke}“: „{bsp}“ ist ein Merksatz, kein Beispielsatz — gehört in hinweis.",
            ))

    for wort, n in Counter(woerter).items():
        if n > 1:
            hinweise.append(("doppelt", f"„{wort}“ steht {n}-mal in der Liste."))

    print(f"{len(woerter)} Vokabeln in {len(pro_seite)} Abschnitt(en)")
    for seite, n in pro_seite.items():
        print(f"  Seite {seite}: {n}")
    print("  Zähl das mit den Zeilen auf dem Foto gegen — abgerissene Listen sehen sonst heil aus.")

    for f in fehler:
        print(f"✗ {f}")

    gruppen: dict[str, list[str]] = {}
    for kat, msg in hinweise:
        gruppen.setdefault(kat, [])
        if msg not in gruppen[kat]:
            gruppen[kat].append(msg)
    for msgs in gruppen.values():
        for msg in msgs[:3]:
            print(f"· {msg}")
        if len(msgs) > 3:
            print(f"  … und {len(msgs) - 3} weitere derselben Art")

    if apostrophe:
        print(
            f"· In {apostrophe} Einträgen steht der Betonungsstrich als Apostroph "
            "(['dʒɜːni]). Die App wandelt das selbst in ˈ um — nichts zu tun."
        )

    if fehler:
        print("\nNicht importierbar, solange die ✗-Punkte offen sind.")
        return 1
    print("\n✓ Importierbar." + (" Die ·-Punkte einmal prüfen." if hinweise else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
