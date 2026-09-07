/**
 * Die Sammlung der Vokabellisten.
 *
 * Mitgeliefert ist Unit 1; alles Weitere kommt über den Import und lebt in
 * localStorage. Kein Konto, kein Server — die Listen gehören dem Gerät, auf
 * dem sie eingetragen wurden.
 */

import unit1 from '../data/unit1.json';
import type { WordSet } from './types';
import { clearSessionFor } from './state';
import { clearRecords } from './records';

const INDEX_KEY = 'ueberklebt.sets';
const setKey = (id: string) => `ueberklebt.set.${id}`;
const playedKey = (id: string) => `ueberklebt.played.${id}`;

const BUILTIN: readonly WordSet[] = [unit1 as WordSet];

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

  const builtin: LibraryEntry[] = BUILTIN.map((set) => ({
    set,
    builtin: true,
    addedAt: null,
    lastPlayedAt: readPlayed(set.id),
  }));

  return [...imported, ...builtin];
}

export function getSet(id: string): WordSet | null {
  return BUILTIN.find((s) => s.id === id) ?? readSet(id);
}

export function isBuiltin(id: string): boolean {
  return BUILTIN.some((s) => s.id === id);
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
