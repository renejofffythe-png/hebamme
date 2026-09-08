/**
 * Import fremder Vokabellisten.
 *
 * Der Weg, für den das hier gebaut ist: eine Buchseite abfotografieren, von
 * einem Sprachmodell abtippen lassen, die Datei hier hochladen. Deshalb ist
 * der Parser bewusst tolerant — er akzeptiert die Transkriptions-Form mit
 * Abschnitten, eine flache Liste, ein fertiges Set und rohen Text.
 *
 * Was er NICHT tut: Synonyme erfinden. Die `accept`-Liste der mitgelieferten
 * Sets ist redaktionelle Arbeit. Automatisch entstehen hier nur Formen, die
 * mechanisch aus dem Eintrag folgen (Klammern, Schrägstriche). Für Tippfehler,
 * Bindestriche und BE/AE ist ohnehin die Bewertung zuständig, nicht die Liste.
 */

import type { Word } from '../types';
import { isEnglish } from '../languages';

export interface ParsedList {
  words: Word[];
  title: string | null;
  source: string | null;
  warnings: string[];
}

export class ParseError extends Error {}

export interface ParseOptions {
  lang: string;
  /** Nur für rohen Text: steht die Zielsprache in der ersten Spalte? */
  swap?: boolean;
}

/** Höchstzahl je Liste — darüber wird localStorage zur Wundertüte. */
const MAX_WORDS = 400;

// ------------------------------------------------------------------ Felder

type Raw = Record<string, unknown>;

function field(obj: Raw, names: string[]): string | null {
  const lower = new Map(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
  for (const n of names) {
    const v = lower.get(n);
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
    if (Array.isArray(v) && v.length) {
      const parts = v.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
      if (parts.length) return parts.join('; ');
    }
  }
  return null;
}

const F = {
  target: ['en', 'target', 'wort', 'word', 'fremdwort', 'englisch', 'französisch', 'franzoesisch', 'spanisch', 'italienisch', 'vokabel', 'fr', 'es', 'it', 'nl', 'tr', 'la'],
  de: ['de', 'deutsch', 'german', 'bedeutung', 'übersetzung', 'uebersetzung', 'translation'],
  ipa: ['lautschrift', 'ipa', 'aussprache', 'pronunciation'],
  example: ['beispiel', 'example', 'satz', 'sentence'],
  note: ['hinweis', 'note', 'anmerkung', 'merke', 'notiz'],
  page: ['seite', 'page'],
};

// ------------------------------------------------------------ Wortaufbereitung

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "[ˈdʒɜːni]" → "ˈdʒɜːni", "['grəʊ], [gruː]" → "ˈgrəʊ; gruː". */
function cleanIpa(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw
    .split(/\]\s*[,;]?\s*\[|\s*;\s*/)
    .map((p) => p.replace(/[[\]/()]/g, '').replace(/_/g, ' ').trim())
    .filter(Boolean)
    // Im Buchsatz ist der Apostroph der Betonungsstrich.
    .map((p) => p.replace(/['´`’]/g, 'ˈ'));
  return parts.length ? parts.join('; ') : null;
}

/**
 * Klammern haben zwei Bedeutungen, und man erkennt sie am Leerzeichen:
 * "to move (house)" ist ein optionales Wort, "(wind)surfing" gehört fest dazu.
 */
function parenForms(s: string): { full: string; short: string | null } {
  if (!s.includes('(')) return { full: s, short: null };
  const full = s.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  const standalone = /(^|\s)\([^)]*\)(\s|$)/.test(s);
  if (!standalone) return { full, short: null };
  const short = s
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { full, short: short && short !== full ? short : null };
}

const ADJ_DE = /(ig|lich|isch|sam|bar|haft|los|voll|iv|ell|al|ös|ant|ent)$/;
const ADJ_TARGET = /(y|ful|ous|ive|al|ic|ish|less|able|ible|ent|ant)$/;
/** Artikel verstellen die Sicht auf das, was die Wortart verrät. */
const ARTICLE_DE = /^(?:der|die|das|den|dem|des|ein|eine|einen|einem|einer|sich)\s+/i;
const ADVERBS_DE = new Set([
  'nirgendwo', 'irgendwo', 'überall', 'immer', 'nie', 'niemals', 'oft', 'selten',
  'manchmal', 'bald', 'gestern', 'heute', 'morgen', 'sofort', 'endlich', 'zusammen',
]);

function classify(
  de: string,
  primary: string,
  isVerb: boolean,
): { pos: string; hint: string } {
  const words = primary.split(/\s+/).length;
  // Führende Klammern, Zeichen und Artikel weg: "(Wind-)Surfen" und "das Haus"
  // sind beide Substantive.
  const bare = de.replace(/^[^\p{L}(]+/u, '').replace(ARTICLE_DE, '');
  const first = bare.replace(/^[^\p{L}]+/u, '')[0] ?? '';
  const deHead = bare.split(/[;,(]/)[0]!.trim().toLowerCase();

  let pos = 'word';
  let hint = 'Vokabel';

  if (isVerb) {
    pos = 'verb';
    hint = 'Verb';
  } else if (first !== '' && first === first.toUpperCase() && first !== first.toLowerCase()) {
    // Deutsche Substantive sind großgeschrieben — das ist das verlässlichste
    // Signal, das ohne Wörterbuch zu haben ist, und es gilt in jeder Zielsprache.
    pos = 'noun';
    hint = 'Substantiv';
  } else if (ADVERBS_DE.has(deHead) || /ly$/.test(primary)) {
    pos = 'adverb';
    hint = 'Adverb';
  } else if (deHead.length > 3 && /(?:en|eln|ern)$/.test(deHead)) {
    // Deutsche Infinitive enden auf -en. Das trägt die Wortart auch dort, wo
    // die Zielsprache kein "to" kennt (Französisch, Spanisch, Latein).
    pos = 'verb';
    hint = 'Verb';
  } else if (words >= 3 || de.includes('(nicht)')) {
    pos = 'phrase';
    hint = 'Wendung';
  } else if (ADJ_DE.test(deHead) || ADJ_TARGET.test(primary)) {
    pos = 'adjective';
    hint = 'Adjektiv';
  } else if (words >= 2) {
    pos = 'phrase';
    hint = 'Wendung';
  }

  if (words > 1) hint += ` · ${words} Wörter`;
  return { pos, hint };
}

interface RawWord {
  target: string;
  de: string;
  ipa?: string | null;
  example?: string | null;
  note?: string | null;
  page?: number | null;
}

function buildWord(raw: RawWord, lang: string, taken: Set<string>, index: number): Word | null {
  let target = raw.target.replace(/\s+/g, ' ').trim();
  const de = raw.de.replace(/\s+/g, ' ').trim();
  if (!target || !de) return null;

  const notes: string[] = [];
  if (raw.note) notes.push(raw.note.trim());

  // "to grow, grew, grown" — die Stammformen gehören in den Hinweis, nicht
  // in die Lösung. Getippt wird der Infinitiv.
  const forms = target.split(',').map((p) => p.trim()).filter(Boolean);
  if (forms.length >= 3 && forms.every((f) => !f.includes(' ') || f.startsWith('to '))) {
    target = forms[0]!;
    notes.unshift(`Unregelmäßig: ${forms.map((f) => f.replace(/^to\s+/, '')).join(' – ')}`);
  }

  const idSource = target;
  const isVerb = isEnglish(lang) && /^to\s+/i.test(target);

  const en: string[] = [];
  const accept: string[] = [];
  for (const variant of target.split(/\s*[/;]\s*|\s+oder\s+/i)) {
    const v = variant.trim();
    if (!v) continue;
    const { full, short } = parenForms(v);
    const strip = (x: string) => (isVerb ? x.replace(/^to\s+/i, '') : x).trim();
    if (full) en.push(strip(full));
    if (short) accept.push(strip(short));
  }
  if (!en.length) return null;

  const primary = en[0]!;
  const { pos, hint } = classify(de, primary, isVerb);

  let id = slug(idSource) || `wort-${index + 1}`;
  if (taken.has(id)) {
    let n = 2;
    while (taken.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  taken.add(id);

  return {
    id,
    de,
    en,
    accept: accept.filter((a) => !en.includes(a)),
    ipa: cleanIpa(raw.ipa ?? null),
    pos,
    hint,
    example: raw.example?.trim() || null,
    note: notes.length ? notes.join(' · ') : null,
    ...(raw.page ? { page: raw.page } : {}),
  };
}

// --------------------------------------------------------------------- JSON

function entriesFrom(node: unknown, page: number | null, out: RawWord[]): void {
  if (Array.isArray(node)) {
    for (const item of node) entriesFrom(item, page, out);
    return;
  }
  if (!node || typeof node !== 'object') return;
  const obj = node as Raw;

  const nested = obj['abschnitte'] ?? obj['sections'] ?? obj['seiten'] ?? obj['pages'];
  const list = obj['vokabeln'] ?? obj['words'] ?? obj['entries'] ?? obj['einträge'] ?? obj['eintraege'];

  if (nested || list) {
    const p = field(obj, F.page);
    const nextPage = p && /^\d+$/.test(p) ? Number(p) : page;
    if (nested) entriesFrom(nested, nextPage, out);
    if (list) entriesFrom(list, nextPage, out);
    return;
  }

  const target = field(obj, F.target);
  const de = field(obj, F.de);
  if (!target || !de) return;

  const p = field(obj, F.page);
  out.push({
    target,
    de,
    ipa: field(obj, F.ipa),
    example: field(obj, F.example),
    note: field(obj, F.note),
    page: p && /^\d+$/.test(p) ? Number(p) : page,
  });
}

function parseJson(data: unknown, opts: ParseOptions): ParsedList {
  const root = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Raw;
  const raws: RawWord[] = [];
  entriesFrom(data, null, raws);

  return finish(raws, {
    title: field(root, ['unit', 'title', 'titel', 'name']),
    source: field(root, ['quelle', 'source', 'buch', 'book']),
    warnings: [],
    lang: opts.lang,
  });
}

// --------------------------------------------------------------------- Text

const SEPARATORS = ['\t', '|', ' = ', '=', ' – ', ' — ', ' -- ', ' → ', ';;'];

function splitLine(line: string): string[] | null {
  for (const sep of SEPARATORS) {
    if (line.includes(sep)) {
      return line.split(sep).map((p) => p.trim());
    }
  }
  return null;
}

function parseText(text: string, opts: ParseOptions): ParsedList {
  const raws: RawWord[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  let title: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith('#') || l.startsWith('//')) continue;

    const heading = l.match(/^=+\s*(.+?)\s*=+$/);
    if (heading) {
      title ??= heading[1]!;
      continue;
    }

    const cols = splitLine(l);
    if (!cols || cols.length < 2 || !cols[0] || !cols[1]) {
      skipped++;
      continue;
    }

    let [a, b, third, fourth] = cols as [string, string, string?, string?];
    if (opts.swap) [a, b] = [b, a];

    // "[ˈdʒɜːni]" und "# Beispielsatz" dürfen in derselben Spalte stehen.
    let target = b;
    let ipa: string | null = third ?? null;
    let example: string | null = fourth ?? null;

    const inlineIpa = target.match(/\[([^\]]+)\]/);
    if (inlineIpa) {
      ipa = inlineIpa[1]!;
      target = target.replace(inlineIpa[0], '').trim();
    }
    const hash = target.indexOf('#');
    if (hash >= 0) {
      example = target.slice(hash + 1).trim();
      target = target.slice(0, hash).trim();
    }

    if (!target) {
      skipped++;
      continue;
    }
    raws.push({ target, de: a, ipa, example });
  }

  if (skipped > 0) {
    warnings.push(
      `${skipped} ${skipped === 1 ? 'Zeile' : 'Zeilen'} ohne Trennzeichen übersprungen.`,
    );
  }
  return finish(raws, { title, source: null, warnings, lang: opts.lang });
}

// ------------------------------------------------------------------ Abschluss

function finish(
  raws: RawWord[],
  ctx: { title: string | null; source: string | null; warnings: string[]; lang: string },
): ParsedList {
  const taken = new Set<string>();
  const words: Word[] = [];
  const warnings = [...ctx.warnings];

  raws.forEach((raw, i) => {
    const w = buildWord(raw, ctx.lang, taken, i);
    if (w) words.push(w);
  });

  const lost = raws.length - words.length;
  if (lost > 0) warnings.push(`${lost} unvollständige Einträge übersprungen.`);

  if (words.length > MAX_WORDS) {
    warnings.push(`Nur die ersten ${MAX_WORDS} Vokabeln übernommen.`);
    words.length = MAX_WORDS;
  }

  return { words, title: ctx.title, source: ctx.source, warnings };
}

/**
 * Sprachmodelle verpacken JSON gern in einen Markdown-Zaun, auch wenn der Prompt
 * das Gegenteil verlangt. Den nimmt der Import stillschweigend ab.
 */
function stripFence(text: string): string {
  if (!text.startsWith('```')) return text;
  return text
    .replace(/^```[a-z]*\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

/** Einstiegspunkt: erkennt selbst, ob JSON oder Text vorliegt. */
export function parseList(input: string, opts: ParseOptions): ParsedList {
  const text = stripFence(input.trim());
  if (!text) throw new ParseError('Da ist nichts drin.');

  if (text.startsWith('{') || text.startsWith('[')) {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new ParseError(
        `Die Datei sieht nach JSON aus, ist aber keins: ${(e as Error).message}`,
      );
    }
    const result = parseJson(data, opts);
    if (!result.words.length) {
      throw new ParseError('Kein einziger Eintrag mit deutschem UND fremdsprachigem Wort gefunden.');
    }
    return result;
  }

  const result = parseText(text, opts);
  if (!result.words.length) {
    // Der häufigste Fehlversuch: die Tabelle, die ein Chatmodell von sich aus
    // ausgibt. Dann hilft nur ein klarer Hinweis auf den Prompt.
    if (/^\|?\s*:?-{2,}/m.test(text) && text.includes('|')) {
      throw new ParseError(
        'Das ist eine Markdown-Tabelle. Die App liest JSON — lass die Liste mit dem Prompt unten noch einmal ausgeben.',
      );
    }
    throw new ParseError(
      'Keine Zeile erkannt. Jede Zeile braucht deutsches Wort, ein Trennzeichen (Tab, | oder =) und die Übersetzung.',
    );
  }
  return result;
}
