import type { Word, Verdict } from './types';

/**
 * Bewertung einer getippten Antwort.
 *
 * Grundsatz: großzügig bei allem, was nicht die Vokabel ist (Groß/Klein,
 * Leerzeichen, Artikel, "to"), kompromisslos bei allem, was die Vokabel ist.
 */

export interface Grade {
  verdict: Verdict;
  /** Die Musterlösung, gegen die bewertet wurde (die nächstliegende). */
  solution: string;
  /** Bei 'correct': war es eine Alternative statt der Buchvokabel? */
  viaAlternative: string | null;
  /** Bei 'near': Index des ersten abweichenden Zeichens in der Musterlösung. */
  diffIndex: number;
  /** Bei 'near': Anzahl der Abweichungen. */
  distance: number;
}

const ARTICLES = /^(?:a|an|the)\s+/;
const LEADING_TO = /^to\s+/;
/** Wörterbuch-Kürzel wie "(fam.)" oder "adv." — Beschriftung, keine Vokabel. */
const MARKERS = /\(?\b(?:fam|ugs|f|m|pl|adv|adj|sg)\.\)?(?=\s|$)/g;

/** Vereinheitlicht alles, was nicht zur Vokabel gehört. */
export function normalize(raw: string): string {
  return clean(raw).replace(LEADING_TO, '').replace(ARTICLES, '').trim();
}

/** Wie normalize, aber ohne englisches "to"/Artikel — im Französischen ist "a" ein Wort. */
function clean(raw: string): string {
  let s = raw.toLowerCase().trim();
  s = s.replace(/[‘’´`]/g, "'"); // Apostroph-Varianten
  s = s.replace(/\.{2,}|…/g, ' '); // Platzhalter: "Où est …?"
  s = s.replace(MARKERS, ' ');
  s = s.replace(/\s+([!?:;])/g, '$1'); // frz. Satzzeichen-Abstand: "À bientôt !"
  s = s.replace(/\s+/g, ' '); // Mehrfach-Leerzeichen
  s = s.replace(/[.,!?;:]+$/, ''); // Endsatzzeichen
  return s.trim();
}

/** Zusätzliche Variante: Bindestriche als Leerzeichen bzw. ganz weg. */
function hyphenVariants(s: string): string[] {
  if (!s.includes('-')) return [s];
  return [s, s.replace(/-/g, ' '), s.replace(/-/g, '')];
}

/** Britisch/Amerikanisch — beide Schreibweisen gelten. */
function spellingVariants(s: string): string[] {
  const out = new Set([s]);
  out.add(s.replace(/our\b/g, 'or')); // harbour -> harbor
  out.add(s.replace(/or\b/g, 'our'));
  out.add(s.replace(/ise\b/g, 'ize'));
  out.add(s.replace(/ize\b/g, 'ise'));
  out.add(s.replace(/lled\b/g, 'led'));
  out.add(s.replace(/led\b/g, 'lled'));
  out.add(s.replace(/lling\b/g, 'ling'));
  out.add(s.replace(/ling\b/g, 'lling'));
  return [...out];
}

/** Alle Formen, unter denen eine Lösung akzeptiert wird. */
function expand(solution: string): string[] {
  const base = normalize(solution);
  const out = new Set<string>();
  for (const h of hyphenVariants(base)) {
    for (const v of spellingVariants(h)) out.add(v);
  }
  return [...out];
}

/** Damerau-Levenshtein (mit Vertauschung benachbarter Zeichen). */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // (m+1) x (n+1), zeilenweise als flaches Array
  const d = new Uint16Array((m + 1) * (n + 1));
  const at = (i: number, j: number) => i * (n + 1) + j;

  for (let i = 0; i <= m; i++) d[at(i, 0)] = i;
  for (let j = 0; j <= n; j++) d[at(0, j)] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(
        d[at(i - 1, j)]! + 1, // Löschung
        d[at(i, j - 1)]! + 1, // Einfügung
        d[at(i - 1, j - 1)]! + cost, // Ersetzung
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[at(i - 2, j - 2)]! + 1); // Vertauschung
      }
      d[at(i, j)] = v;
    }
  }
  return d[at(m, n)]!;
}

/**
 * Erlaubte Tippfehler-Distanz. Bei kurzen Wörtern null Toleranz, weil
 * Distanz 1 dort meist ein anderes Wort ist (hat / hit / hot).
 */
function tolerance(len: number): number {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  return 2;
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function firstDiff(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
}

export function grade(raw: string, word: Word, deck: readonly Word[]): Grade {
  const input = normalize(raw);
  const primary = word.en[0] ?? '';

  const empty: Grade = {
    verdict: 'wrong',
    solution: primary,
    viaAlternative: null,
    diffIndex: 0,
    distance: Infinity,
  };
  if (input.length === 0) return empty;

  // --- Stufe 1: exakter Treffer gegen Musterlösungen und Alternativen ---
  for (const sol of word.en) {
    if (expand(sol).includes(input)) {
      return { ...empty, verdict: 'correct', solution: sol, distance: 0 };
    }
  }
  for (const alt of word.accept) {
    if (expand(alt).includes(input)) {
      return {
        ...empty,
        verdict: 'correct',
        solution: primary,
        viaAlternative: alt,
        distance: 0,
      };
    }
  }

  // --- Guard: ist die Eingabe die Lösung einer ANDEREN Vokabel im Deck? ---
  // Dann ist es eine Verwechslung, kein Tippfehler — nie "fast".
  for (const other of deck) {
    if (other.id === word.id) continue;
    for (const sol of [...other.en, ...other.accept]) {
      if (expand(sol).includes(input)) return empty;
    }
  }

  // --- Akzente vergessen ("a bientot" statt "à bientôt") ist fast richtig,
  // unabhängig von der Länge — die Buchstaben stimmen ja alle.
  const plainInput = stripAccents(clean(raw));
  for (const sol of [...word.en, ...word.accept]) {
    const target = normalize(sol);
    if (stripAccents(clean(sol)) === plainInput) {
      return {
        verdict: 'near',
        solution: sol,
        viaAlternative: null,
        diffIndex: firstDiff(input, target),
        distance: editDistance(input, target),
      };
    }
  }

  // --- Stufe 2: Tippfehler gegen die nächstliegende Musterlösung ---
  let best: Grade | null = null;
  for (const sol of [...word.en, ...word.accept]) {
    const target = normalize(sol);
    const limit = tolerance(target.length);
    if (limit === 0) continue;

    // Bei Mehrwortlösungen muss die Wortanzahl stimmen.
    const targetWords = target.split(' ');
    const inputWords = input.split(' ');
    if (targetWords.length !== inputWords.length) continue;

    const dist = editDistance(input, target);
    if (dist > limit) continue;

    // Bei Distanz 2 müssen die ersten zwei Zeichen stimmen.
    if (dist >= 2 && input.slice(0, 2) !== target.slice(0, 2)) continue;

    if (!best || dist < best.distance) {
      best = {
        verdict: 'near',
        solution: sol,
        viaAlternative: null,
        diffIndex: firstDiff(input, target),
        distance: dist,
      };
    }
  }

  return best ?? empty;
}
