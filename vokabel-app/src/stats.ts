/**
 * Lernstatistik: was geübt wurde, über alle Sessions und Listen hinweg.
 *
 * Drei kleine Speicher:
 *  - Tage     — je Kalendertag die Antworten (richtig, fast, falsch) und die
 *               Übungszeit.
 *  - Wörter   — je Wort die Zähler und die Serie richtiger Antworten. Gezählt
 *               wird je Listenfamilie wie bei den Wackelkandidaten: ein Wort
 *               ist dasselbe, ob es in Tag 1 oder in den Wackelkandidaten kommt.
 *  - Sessions — die letzten abgeschlossenen Durchgänge.
 *
 * „Sitzt“ heißt: die letzten zwei Antworten waren richtig. Innerhalb einer
 * Session verschwindet ein Wort nach der ersten richtigen Antwort, also
 * braucht „sitzt“ zwei Sessions — einmal Glück reicht nicht.
 *
 * Gezählt wird ab dem ersten Spiel mit dieser Version; frühere Durchgänge
 * kennt nur der Sessionzähler der Bestwerte.
 */

import type { Verdict } from './types';
import { familyOf } from './shaky';

const DAYS_KEY = 'ueberklebt.stats.days';
const WORDS_KEY = 'ueberklebt.stats.words';
const SESSIONS_KEY = 'ueberklebt.stats.sessions';
/** So viele abgeschlossene Durchgänge bleiben gespeichert. */
const MAX_SESSIONS = 300;
/** Längere Pausen zwischen zwei Antworten zählen nicht als Übungszeit. */
const MAX_GAP_MS = 2 * 60 * 1000;
/** Ab so vielen richtigen Antworten in Folge sitzt ein Wort. */
export const SITS_AT = 2;

export interface DayStat {
  correct: number;
  near: number;
  wrong: number;
  ms: number;
}

export interface WordStat {
  seen: number;
  correct: number;
  near: number;
  wrong: number;
  streak: number;
  last: number;
}

export interface SessionLog {
  set: string;
  at: number;
  words: number;
  firstTry: number;
  rounds: number;
  ms: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — dann zählt die Statistik nur für diese Sitzung nicht */
  }
}

/** Lokaler Kalendertag, "2026-11-08". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const wordKey = (setId: string, wordId: string) => `${familyOf(setId)}::${wordId}`;

let lastAnswerAt = 0;

/** Verbucht eine Antwort. Wird aus der Session gerufen, neben den Wackelkandidaten. */
export function recordAnswer(setId: string, wordId: string, verdict: Verdict): void {
  const now = Date.now();

  const days = read<Record<string, DayStat>>(DAYS_KEY, {});
  const k = dayKey(now);
  const day: DayStat = { correct: 0, near: 0, wrong: 0, ms: 0, ...days[k] };
  day[verdict] += 1;
  const gap = now - lastAnswerAt;
  if (lastAnswerAt && gap < MAX_GAP_MS) day.ms += gap;
  lastAnswerAt = now;
  days[k] = day;
  write(DAYS_KEY, days);

  const words = read<Record<string, WordStat>>(WORDS_KEY, {});
  const wk = wordKey(setId, wordId);
  const w: WordStat = { seen: 0, correct: 0, near: 0, wrong: 0, streak: 0, last: 0, ...words[wk] };
  w.seen += 1;
  w[verdict] += 1;
  w.streak = verdict === 'correct' ? w.streak + 1 : 0;
  w.last = now;
  words[wk] = w;
  write(WORDS_KEY, words);
}

/** Verbucht einen abgeschlossenen Durchgang. */
export function logSession(entry: SessionLog): void {
  const list = read<SessionLog[]>(SESSIONS_KEY, []);
  list.push(entry);
  write(SESSIONS_KEY, list.slice(-MAX_SESSIONS));
}

export function loadDays(): Record<string, DayStat> {
  return read<Record<string, DayStat>>(DAYS_KEY, {});
}

export function loadWords(): Record<string, WordStat> {
  return read<Record<string, WordStat>>(WORDS_KEY, {});
}

export function loadSessions(): SessionLog[] {
  return read<SessionLog[]>(SESSIONS_KEY, []);
}

/** Beim Löschen einer Liste verschwinden auch ihre Zahlen — die Tage bleiben. */
export function clearStats(setId: string): void {
  const words = loadWords();
  const prefix = `${familyOf(setId)}::`;
  for (const k of Object.keys(words)) if (k.startsWith(prefix)) delete words[k];
  write(WORDS_KEY, words);
  write(SESSIONS_KEY, loadSessions().filter((s) => s.set !== setId));
}
