/**
 * Die Sammlung der Vokabellisten.
 *
 * Mitgeliefert sind Unit 1 (Englisch, S. 168–170 als eine Liste, S. 172–175 in
 * Tagesportionen) und Französisch Au début / Unité 1 und Unité 2 in
 * Tagesportionen; alles Weitere kommt über den Import und lebt in localStorage.
 * Kein Konto, kein Server — die Listen gehören dem Gerät, auf dem sie
 * eingetragen wurden.
 */

import unit1 from '../data/unit1.json';
import frTag1 from '../data/fr-unite1-tag1.json';
import frTag2 from '../data/fr-unite1-tag2.json';
import frTag3 from '../data/fr-unite1-tag3.json';
import frTag4 from '../data/fr-unite1-tag4.json';
import frTag5 from '../data/fr-unite1-tag5.json';
import frTag6 from '../data/fr-unite1-tag6.json';
import frTag7 from '../data/fr-unite1-tag7.json';
import fr2Tag1 from '../data/fr-unite2-tag1.json';
import fr2Tag2 from '../data/fr-unite2-tag2.json';
import fr2Tag3 from '../data/fr-unite2-tag3.json';
import papaTag1 from '../data/papas-vokabeln-tag1.json';
import papaTag2 from '../data/papas-vokabeln-tag2.json';
import papaTag3 from '../data/papas-vokabeln-tag3.json';
import papaTag4 from '../data/papas-vokabeln-tag4.json';
import papaTag5 from '../data/papas-vokabeln-tag5.json';
import papaTag6 from '../data/papas-vokabeln-tag6.json';
import enTag1 from '../data/en-unit1-tag1.json';
import enTag2 from '../data/en-unit1-tag2.json';
import enTag3 from '../data/en-unit1-tag3.json';
import enTag4 from '../data/en-unit1-tag4.json';
import enTag5 from '../data/en-unit1-tag5.json';
import enTag6 from '../data/en-unit1-tag6.json';
import type { WordSet } from './types';
import { clearSessionFor } from './state';
import { clearRecords } from './records';
import { clearShaky, familyOf, shakyIds } from './shaky';
import { clearStats } from './stats';

const INDEX_KEY = 'ueberklebt.sets';
const setKey = (id: string) => `ueberklebt.set.${id}`;
const playedKey = (id: string) => `ueberklebt.played.${id}`;

// Französisch in Portionen von ~15 Vokabeln — eine Liste pro Lerntag.
// Erzeugt aus den Dateien in data/quellen/.
const BUILTIN: readonly WordSet[] = [
  frTag1 as WordSet,
  frTag2 as WordSet,
  frTag3 as WordSet,
  frTag4 as WordSet,
  frTag5 as WordSet,
  frTag6 as WordSet,
  frTag7 as WordSet,
  fr2Tag1 as WordSet,
  fr2Tag2 as WordSet,
  fr2Tag3 as WordSet,
  papaTag1 as WordSet,
  papaTag2 as WordSet,
  papaTag3 as WordSet,
  papaTag4 as WordSet,
  papaTag5 as WordSet,
  papaTag6 as WordSet,
  unit1 as WordSet,
  enTag1 as WordSet,
  enTag2 as WordSet,
  enTag3 as WordSet,
  enTag4 as WordSet,
  enTag5 as WordSet,
  enTag6 as WordSet,
];

/**
 * Wackelkandidaten: eine Liste, die es nur gibt, solange sie Inhalt hat.
 *
 * Sie wird bei jedem Blick auf die Sammlung neu aus dem Wortgedächtnis
 * zusammengesetzt — deshalb steht ein Wort am Tag nach der dritten richtigen
 * Antwort nicht mehr drin, ohne dass jemand etwas aufräumen müsste.
 */
const SIG_KEY = (id: string) => `ueberklebt.shakysig.${id}`;

function shakySetFor(family: string, sets: readonly WordSet[]): WordSet | null {
  const ids = shakyIds(family);
  if (!ids.size) return null;

  const words = [];
  const taken = new Set<string>();
  for (const set of sets) {
    for (const w of set.words) {
      if (!ids.has(w.id) || taken.has(w.id)) continue;
      taken.add(w.id);
      words.push(w);
    }
  }
  if (!words.length) return null;

  const first = sets[0]!;
  // "Papas Vokabeln Tag 3 — …" → "Papas", "Französisch Tag 3 — …" → "Französisch"
  const base = first.title.split(' Tag ')[0]!.replace(/\s+Vokabeln$/, '');
  const id = `${family}-wackelkandidaten`;

  // Ändert sich der Inhalt, passt eine pausierte Session nicht mehr dazu.
  const signature = words.map((w) => w.id).join(',');
  try {
    if (localStorage.getItem(SIG_KEY(id)) !== signature) {
      clearSessionFor(id);
      localStorage.setItem(SIG_KEY(id), signature);
    }
  } catch {
    /* private mode — dann beginnt die Liste eben neu */
  }

  return {
    id,
    title: `${base} Wackelkandidaten`,
    source: 'Wörter, die mindestens zweimal daneben waren',
    lang: first.lang,
    langLabel: first.langLabel,
    direction: first.direction,
    words,
  };
}

/** Die mitgelieferten Listen nach Familie: alle "papas-vokabeln-tag*" zusammen. */
function families(): Map<string, WordSet[]> {
  const out = new Map<string, WordSet[]>();
  for (const set of BUILTIN) {
    const fam = familyOf(set.id);
    if (fam === set.id) continue; // Einzelliste ohne Tagesportionen
    const list = out.get(fam) ?? [];
    list.push(set);
    out.set(fam, list);
  }
  return out;
}

function shakySets(): WordSet[] {
  const out: WordSet[] = [];
  for (const [fam, sets] of families()) {
    const set = shakySetFor(fam, sets);
    if (set) out.push(set);
  }
  return out;
}

export interface LibraryEntry {
  set: WordSet;
  builtin: boolean;
  /** Import-Datum; mitgelieferte Listen haben keins. */
  addedAt: number | null;
  lastPlayedAt: number | null;
}

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw) as unknown;
    return Array.isArray(ids) ? ids.filter((i): i is string => typeof i === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(ids));
}

function readSet(id: string): WordSet | null {
  try {
    const raw = localStorage.getItem(setKey(id));
    if (!raw) return null;
    const set = JSON.parse(raw) as WordSet;
    if (!set || !Array.isArray(set.words) || !set.words.length) return null;
    return set;
  } catch {
    return null;
  }
}

function readPlayed(id: string): number | null {
  try {
    const raw = localStorage.getItem(playedKey(id));
    return raw ? Number(raw) || null : null;
  } catch {
    return null;
  }
}

/** Neueste zuerst — die Liste von heute Abend steht oben. */
export function listSets(): LibraryEntry[] {
  const imported: LibraryEntry[] = [];
  for (const id of readIndex()) {
    const set = readSet(id);
    if (!set) continue;
    imported.push({
      set,
      builtin: false,
      addedAt: set.addedAt ?? null,
      lastPlayedAt: readPlayed(id),
    });
  }
  imported.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));

  const shaky: LibraryEntry[] = shakySets().map((set) => ({
    set,
    builtin: true,
    addedAt: null,
    lastPlayedAt: readPlayed(set.id),
  }));

  const builtin: LibraryEntry[] = BUILTIN.map((set) => ({
    set,
    builtin: true,
    addedAt: null,
    lastPlayedAt: readPlayed(set.id),
  }));

  return [...shaky, ...imported, ...builtin];
}

export function getSet(id: string): WordSet | null {
  return (
    BUILTIN.find((s) => s.id === id) ??
    (id.endsWith('-wackelkandidaten') ? shakySets().find((s) => s.id === id) ?? null : null) ??
    readSet(id)
  );
}

export function isBuiltin(id: string): boolean {
  return BUILTIN.some((s) => s.id === id) || id.endsWith('-wackelkandidaten');
}

/** Freie ID aus dem Titel — sie taucht in keiner URL auf, muss aber eindeutig sein. */
export function freeId(title: string): string {
  const base =
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'liste';

  const taken = new Set([...readIndex(), ...BUILTIN.map((s) => s.id)]);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function saveSet(set: WordSet): void {
  try {
    localStorage.setItem(setKey(set.id), JSON.stringify(set));
  } catch {
    throw new Error(
      'Der Speicher des Browsers ist voll. Lösch eine alte Liste, dann passt die neue rein.',
    );
  }
  const ids = readIndex().filter((i) => i !== set.id);
  ids.unshift(set.id);
  try {
    writeIndex(ids);
  } catch {
    /* Index gescheitert — dann liegt das Set verwaist da, aber nichts kaputt */
  }
}

export function deleteSet(id: string): void {
  if (isBuiltin(id)) return;
  try {
    localStorage.removeItem(setKey(id));
    localStorage.removeItem(playedKey(id));
    writeIndex(readIndex().filter((i) => i !== id));
  } catch {
    /* private mode */
  }
  clearSessionFor(id);
  clearRecords(id);
  clearShaky(id);
  clearStats(id);
}

/** Merkt sich, wann zuletzt gespielt wurde — die Bibliothek sortiert danach. */
export function markPlayed(id: string): void {
  try {
    localStorage.setItem(playedKey(id), String(Date.now()));
  } catch {
    /* private mode */
  }
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** "heute", "gestern", sonst das Datum — Listen werden nach Tagen gesucht. */
export function formatDay(ts: number): string {
  const day = (t: number) => {
    const d = new Date(t);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const diff = Math.round((day(Date.now()) - day(ts)) / 86400000);
  if (diff === 0) return 'heute';
  if (diff === 1) return 'gestern';
  if (diff < 7) return `vor ${diff} Tagen`;
  return formatDate(ts);
}

/** Die festen Gruppen der Bibliothek und der Statistik, in dieser Reihenfolge. */
export const GROUPS: readonly { label: string; short: string }[] = [
  { label: 'Französisch', short: 'FR' },
  { label: 'Englisch', short: 'EN' },
  { label: 'Papas Vokabeln', short: 'Papa' },
];

/** Papas Vokabeln sind Englisch, gehören aber jemand anderem — eigene Gruppe. */
export function groupOf(set: WordSet): string {
  return familyOf(set.id).startsWith('papas-vokabeln') ? 'Papas Vokabeln' : set.langLabel;
}

/**
 * Teilt die Einträge in Gruppen: feste Gruppen zuerst, weitere Sprachen aus dem
 * Import in der Reihenfolge, in der sie zuerst vorkommen. Leere fallen weg.
 */
export function groupEntries(
  entries: LibraryEntry[],
): { label: string; short: string; entries: LibraryEntry[] }[] {
  const labels = GROUPS.map((g) => g.label);
  for (const e of entries) if (!labels.includes(groupOf(e.set))) labels.push(groupOf(e.set));
  return labels
    .map((label) => ({
      label,
      short: GROUPS.find((g) => g.label === label)?.short ?? label,
      entries: entries.filter((e) => groupOf(e.set) === label),
    }))
    .filter((g) => g.entries.length);
}
