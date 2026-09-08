import { el } from '../dom';
import { LANGS, DEFAULT_LANG, langByCode } from '../languages';
import { parseList, ParseError, type ParsedList } from '../import/parse';
import { freeId, saveSet } from '../library';
import type { WordSet } from '../types';

/**
 * Import einer neuen Liste.
 *
 * Der gedachte Weg: Buchseite fotografieren, von einem Sprachmodell abtippen
 * lassen, Datei hier rein. Deshalb steht die Anleitung mit fertigem Prompt
 * direkt auf dem Screen — ohne sie ist die Funktion nur die halbe Miete.
 *
 * Vorschau statt Vertrauen: erst wenn oben "42 Vokabeln erkannt" steht und die
 * drei Beispielzeilen stimmen, ist der Speichern-Knopf aktiv.
 */

const PROMPT = `Hier sind Fotos einer Vokabelliste aus einem Schulbuch. Tippe sie vollständig ab und gib ausschließlich JSON zurück — keine Erklärung davor oder danach, keine Markdown-Tabelle.

{
  "unit": "Unit 1 – Goodbye Greenwich",
  "quelle": "Schulbuch, Seiten 168–170",
  "abschnitte": [
    {
      "seite": 168,
      "titel": "Introduction",
      "vokabeln": [
        { "en": "journey", "lautschrift": "[ˈdʒɜːni]", "de": "Reise; Fahrt", "beispiel": "On our journey through England we met a lot of nice people." },
        { "en": "future", "lautschrift": "[ˈfjuːtʃə]", "de": "Zukunft", "beispiel": "What will the future be like?", "hinweis": "Fr. future (m)" },
        { "en": "to grow, grew, grown", "lautschrift": "[grəʊ], [gruː], [grəʊn]", "de": "wachsen" }
      ]
    }
  ]
}

Alle Werte oben sind Beispiele aus einer anderen Seite. "unit", "quelle", "seite" und "titel" kommen von den Fotos, die du gerade vor dir hast — übernimm nie die Beispielwerte.

Regeln:
1. "en" ist das fremdsprachige Wort genau wie im Buch — mit "to" bei englischen Verben, mit Stammformen ("to grow, grew, grown"), mit Klammern ("to move (house)", "(wind)surfing"). Auch bei anderen Sprachen heißt das Feld "en".
2. "de" ist die deutsche Bedeutung wie im Buch, mehrere Bedeutungen mit Semikolon: "Reise; Fahrt".
3. "lautschrift" in eckigen Klammern mit echten IPA-Zeichen. Steht keine im Buch, Feld weglassen.
4. "beispiel" nur, wenn das Buch einen Beispielsatz abdruckt — ohne Kursiv-Sternchen, ohne <br>.
5. "hinweis" für alles Übrige: Herkunft ("Lat. includere"), Merksätze ("! Surfen und Windsurfen sind verschiedene Sportarten"), Gegensätze ("negative ↔ positive"), Gleichsetzungen ("in the countryside = auf dem Land"). Mehreres mit " · " verbinden.
6. Ein Objekt pro Vokabel; Überschriftenzeilen wie "8 Introduction" sind keine Vokabeln. Randziffern kannst du weglassen.
7. Pro Buchseite ein Abschnitt mit "seite" (Zahl) und "titel".
8. Nichts erfinden, nichts weglassen, Reihenfolge wie im Buch. Keine Synonyme ergänzen.
9. Gültiges JSON: doppelte Anführungszeichen, kein Komma nach dem letzten Eintrag.`;

export function importScreen(handlers: {
  onSaved(id: string): void;
  onCancel(): void;
}): HTMLElement {
  // ------------------------------------------------------------------ Felder

  const titleInput = el('input', {
    class: 'input',
    type: 'text',
    placeholder: 'z. B. Unit 2 — Living together',
    'aria-label': 'Titel der Liste',
  });
  let titleTouched = false;
  titleInput.addEventListener('input', () => {
    titleTouched = titleInput.value.trim() !== '';
  });

  const sourceInput = el('input', {
    class: 'input',
    type: 'text',
    placeholder: 'z. B. Schulbuch S. 171–173',
    'aria-label': 'Quelle',
  });

  const langSelect = el('select', { class: 'input', 'aria-label': 'Sprache' });
  for (const l of LANGS) {
    langSelect.append(el('option', { value: l.code }, [l.long]));
  }
  langSelect.value = DEFAULT_LANG.code;

  const file = el('input', {
    class: 'sr-only',
    type: 'file',
    id: 'import-file',
    accept: '.json,.txt,.csv,.tsv,.md,application/json,text/plain',
  });
  const fileLabel = el('label', { class: 'btn btn--secondary btn--inline', for: 'import-file' }, [
    'Datei wählen',
  ]);

  const area = el('textarea', {
    class: 'input input--area',
    rows: '8',
    spellcheck: 'false',
    placeholder: 'oder JSON bzw. Zeilen hier einfügen:\nZukunft = future\nReise; Fahrt = journey [ˈdʒɜːni]',
    'aria-label': 'Vokabelliste einfügen',
  });

  const swapChip = el('button', { class: 'chip chip--wall', type: 'button', 'aria-pressed': 'false' }, [
    'Spalten tauschen',
  ]);
  let swap = false;
  swapChip.addEventListener('click', () => {
    swap = !swap;
    swapChip.setAttribute('aria-pressed', String(swap));
    swapChip.classList.toggle('chip--on', swap);
    update();
  });

  const preview = el('div', { class: 'preview' });
  const save = el('button', { class: 'btn btn--primary', type: 'button', disabled: true }, [
    'Liste speichern',
  ]);

  // ----------------------------------------------------------------- Vorschau

  let parsed: ParsedList | null = null;
  let timer = 0;

  const update = (): void => {
    const raw = area.value.trim();
    parsed = null;

    if (!raw) {
      preview.replaceChildren(
        el('p', { class: 't-meta', 'style:color': 'var(--c-chalk-muted)' }, [
          'Noch nichts eingelesen.',
        ]),
      );
      save.disabled = true;
      return;
    }

    try {
      parsed = parseList(raw, { lang: langSelect.value, swap });
    } catch (e) {
      preview.replaceChildren(
        el('p', { class: 'preview__error' }, [
          e instanceof ParseError ? e.message : 'Das konnte ich nicht lesen.',
        ]),
      );
      save.disabled = true;
      return;
    }

    if (!titleTouched && parsed.title) titleInput.value = parsed.title;
    if (!sourceInput.value.trim() && parsed.source) sourceInput.value = parsed.source;

    const sample = parsed.words.slice(0, 3).map((w) =>
      el('div', { class: 'preview__row' }, [
        el('span', {}, [w.de]),
        el('span', { class: 'receipt-line__lead' }),
        el('span', { 'style:font-weight': '700' }, [w.en.join(' / ')]),
        w.ipa ? el('span', { class: 't-ipa' }, [`[${w.ipa}]`]) : null,
      ]),
    );

    preview.replaceChildren(
      el('p', { class: 'preview__count' }, [
        `${parsed.words.length} ${parsed.words.length === 1 ? 'Vokabel' : 'Vokabeln'} erkannt`,
      ]),
      ...sample,
      ...parsed.warnings.map((w) => el('p', { class: 'preview__warn' }, [w])),
    );
    save.disabled = false;
  };

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(update, 250);
  };

  area.addEventListener('input', schedule);
  langSelect.addEventListener('change', update);

  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (!f) return;
    fileLabel.textContent = f.name;
    void f
      .text()
      .then((text) => {
        area.value = text;
        if (!titleTouched) titleInput.value = f.name.replace(/\.[a-z]+$/i, '');
        titleTouched = titleInput.value.trim() !== '';
        update();
      })
      .catch(() => {
        preview.replaceChildren(el('p', { class: 'preview__error' }, ['Datei nicht lesbar.']));
      });
  });

  save.addEventListener('click', () => {
    if (!parsed || !parsed.words.length) return;
    const lang = langByCode(langSelect.value);
    const title = titleInput.value.trim() || parsed.title || 'Neue Liste';

    const set: WordSet = {
      id: freeId(title),
      title,
      source: sourceInput.value.trim() || parsed.source || '',
      lang: lang.code,
      langLabel: lang.label,
      direction: `de-${lang.code.slice(0, 2)}`,
      addedAt: Date.now(),
      words: parsed.words,
    };

    try {
      saveSet(set);
    } catch (e) {
      preview.replaceChildren(el('p', { class: 'preview__error' }, [(e as Error).message]));
      return;
    }
    handlers.onSaved(set.id);
  });

  // ---------------------------------------------------------------- Anleitung

  const copy = el('button', { class: 'chip chip--wall', type: 'button' }, ['Prompt kopieren']);
  copy.addEventListener('click', () => {
    const done = () => {
      copy.textContent = 'kopiert';
      window.setTimeout(() => { copy.textContent = 'Prompt kopieren'; }, 2000);
    };
    navigator.clipboard?.writeText(PROMPT).then(done, () => {
      // Ohne Clipboard-Rechte: Text sichtbar machen, dann kann man ihn markieren.
      area.value = PROMPT;
      copy.textContent = 'oben markieren und kopieren';
    });
  });

  const help = el('details', { class: 'help' }, [
    el('summary', {}, ['Woher kommt so eine Datei?']),
    el('p', { class: 't-body' }, [
      'Buchseite fotografieren, das Foto einem Sprachmodell geben und diesen Prompt dazu. ' +
        'Das Ergebnis als Datei speichern oder direkt hier einfügen. ' +
        'Die Tabelle, die ein Chatmodell von sich aus ausgibt, versteht die App nicht — ' +
        'der Prompt sorgt dafür, dass JSON zurückkommt.',
    ]),
    el('pre', { class: 'help__prompt' }, [PROMPT]),
    el('div', { class: 'row' }, [copy]),
    el('p', { class: 't-body' }, [
      'Es geht auch ohne JSON: eine Zeile pro Vokabel, deutsch zuerst, getrennt durch Tab, | oder =. ' +
        'Lautschrift in eckige Klammern, Beispielsatz hinter ein #.',
    ]),
  ]);

  // ------------------------------------------------------------------ Aufbau

  const back = el('button', { class: 'chip chip--wall', type: 'button' }, ['Zurück']);
  back.addEventListener('click', handlers.onCancel);

  const label = (text: string) => el('span', { class: 't-h2', 'style:color': 'var(--c-chalk-muted)' }, [text]);

  update();

  return el('section', { class: 'screen' }, [
    el('div', { class: 'row' }, [back, el('div', { class: 'spacer' })]),
    el('h1', { class: 't-h1' }, ['Neue Liste']),
    el('div', { class: 'stack scroll-y', 'style:flex': '1', 'style:gap': 'var(--s-4)' }, [
      el('div', { class: 'stack', 'style:gap': 'var(--s-2)' }, [label('Sprache'), langSelect]),
      el('div', { class: 'stack', 'style:gap': 'var(--s-2)' }, [label('Titel'), titleInput]),
      el('div', { class: 'stack', 'style:gap': 'var(--s-2)' }, [label('Quelle'), sourceInput]),
      el('div', { class: 'stack', 'style:gap': 'var(--s-2)' }, [
        label('Vokabeln'),
        el('div', { class: 'row row--wrap' }, [fileLabel, file, swapChip]),
        area,
      ]),
      preview,
      help,
    ]),
    save,
  ]);
}
