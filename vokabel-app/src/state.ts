import type { Word, WordSet, Verdict } from './types';
import { record as recordShaky } from './shaky';
import { recordAnswer } from './stats';

/**
 * Sessionzustand: Runden, Wellen, Punkte, Persistenz.
 *
 * Die Rundenmechanik ist der Kern: Runde 1 = alle Wörter, Runde 2 = nur die
 * Falschen aus Runde 1, usw. bis nichts mehr offen ist.
 *
 * Runde 1 wird ab 20 Wörtern in Wellen unterteilt, damit nicht acht Minuten
 * ohne Erfolgsmoment vergehen. Die Rundenlogik bleibt davon unberührt.
 */

/** Je Liste ein eigener Stand — eine pausierte Session soll nicht verfallen,
    nur weil zwischendurch eine andere Liste geübt wurde. */
const sessionKey = (setId: string) => `ueberklebt.session.${setId}`;
/** Vor den mehreren Listen gab es genau einen Stand unter diesem Schlüssel. */
const LEGACY_KEY = 'ueberklebt.session';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const WAVE_TARGET = 13;

export interface Persisted {
  setId: string;
  /** Wie viele Wörter diese Session umfasst — bei Teilsessions < set.words.length. */
  poolSize: number;
  round: number;
  waves: string[][];
  waveIndex: number;
  cursor: number;
  nextRound: string[];
  solved: string[];
  score: number;
  combo: number;
  bestCombo: number;
  rescues: number;
  nearMisses: number;
  /** Wort-ID -> letzte Runde, in der es danebenging. Basis für Rettungen. */
  missedIn: Record<string, number>;
  /** Wort-ID -> wie oft insgesamt danebengegangen. */
  misses: Record<string, number>;
  /** Letzte Bewertung je Wort — färbt die Fortschrittskette. */
  verdicts: Record<string, Verdict>;
  /** Punkte je Wort der laufenden Welle — Basis für den Perfekt-Bonus. */
  waveScore: Record<string, number>;
  startedAt: number;
  updatedAt: number;
}

export interface AnswerResult {
  verdict: Verdict;
  points: number;
  combo: number;
  isRescue: boolean;
  streakMilestone: number | null;
}

/** Gleichmäßige Wellen; Rest wird auf die vorderen Wellen verteilt. */
function splitIntoWaves(ids: string[]): string[][] {
  if (ids.length <= 20) return [ids];
  const count = Math.ceil(ids.length / WAVE_TARGET);
  const base = Math.floor(ids.length / count);
  const extra = ids.length % count;

  const waves: string[][] = [];
  let i = 0;
  for (let w = 0; w < count; w++) {
    const size = base + (w < extra ? 1 : 0);
    waves.push(ids.slice(i, i + size));
    i += size;
  }
  return waves;
}

function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Löscht den gespeicherten Stand einer Liste (auch den alten Einzel-Slot). */
export function clearSessionFor(setId: string): void {
  try {
    localStorage.removeItem(sessionKey(setId));
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* private mode */
  }
}

export function comboMultiplier(combo: number): number {
  if (combo >= 12) return 3.0;
  if (combo >= 8) return 2.0;
  if (combo >= 5) return 1.5;
  if (combo >= 3) return 1.2;
  return 1.0;
}

const MILESTONES = [5, 10, 20];

export class Session {
  readonly set: WordSet;
  private byId: Map<string, Word>;
  private s: Persisted;

  private constructor(set: WordSet, state: Persisted) {
    this.set = set;
    this.byId = new Map(set.words.map((w) => [w.id, w]));
    this.s = state;
  }

  static start(set: WordSet, ids?: readonly string[]): Session {
    const pool = shuffle(ids ?? set.words.map((w) => w.id));
    const now = Date.now();
    return new Session(set, {
      setId: set.id,
      poolSize: pool.length,
      round: 1,
      waves: splitIntoWaves(pool),
      waveIndex: 0,
      cursor: 0,
      nextRound: [],
      solved: [],
      score: 0,
      combo: 0,
      bestCombo: 0,
      rescues: 0,
      nearMisses: 0,
      missedIn: {},
      misses: {},
      verdicts: {},
      waveScore: {},
      startedAt: now,
      updatedAt: now,
    });
  }

  /** Stellt eine unterbrochene Session wieder her, falls sie zum Set passt. */
  static restore(set: WordSet): Session | null {
    try {
      const raw = localStorage.getItem(sessionKey(set.id)) ?? localStorage.getItem(LEGACY_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as Persisted;
      if (s.setId !== set.id) return null;
      if (Date.now() - s.updatedAt > MAX_AGE_MS) {
        localStorage.removeItem(sessionKey(set.id));
        return null;
      }
      if (typeof s.poolSize !== 'number' || !s.verdicts || !s.waveScore) return null;
      const known = new Set(set.words.map((w) => w.id));
      if (s.waves.flat().some((id) => !known.has(id))) return null;
      return new Session(set, s);
    } catch {
      return null;
    }
  }

  static clearSaved(setId: string): void {
    clearSessionFor(setId);
  }

  private save(): void {
    this.s.updatedAt = Date.now();
    try {
      localStorage.setItem(sessionKey(this.s.setId), JSON.stringify(this.s));
    } catch {
      /* private mode — die Session läuft trotzdem weiter */
    }
  }

  // ------------------------------------------------------------------ Lesen

  get round(): number {
    return this.s.round;
  }
  get score(): number {
    return this.s.score;
  }
  get combo(): number {
    return this.s.combo;
  }
  get bestCombo(): number {
    return this.s.bestCombo;
  }
  get rescues(): number {
    return this.s.rescues;
  }
  get nearMisses(): number {
    return this.s.nearMisses;
  }
  get solvedCount(): number {
    return this.s.solved.length;
  }
  get totalCount(): number {
    return this.s.poolSize;
  }
  get pendingCount(): number {
    return this.s.nextRound.length;
  }
  /** Wörter, die gleich beim ersten Mal saßen. */
  get firstTryCount(): number {
    return this.s.poolSize - Object.keys(this.s.missedIn).length;
  }
  get elapsedMs(): number {
    return this.s.updatedAt - this.s.startedAt;
  }

  /** Wörter der aktuellen Welle — das ist die Fortschrittskette. */
  get wave(): readonly string[] {
    return this.s.waves[this.s.waveIndex] ?? [];
  }
  get waveIndex(): number {
    return this.s.waveIndex;
  }
  get waveCount(): number {
    return this.s.waves.length;
  }
  get cursor(): number {
    return this.s.cursor;
  }

  get current(): Word | null {
    const id = this.wave[this.s.cursor];
    return id ? (this.byId.get(id) ?? null) : null;
  }

  /** Alle Wörter der laufenden Runde — Deck für die Verwechslungsprüfung. */
  get deck(): readonly Word[] {
    return this.set.words;
  }

  wordById(id: string): Word | undefined {
    return this.byId.get(id);
  }

  /** Wörter, die mehr als eine Runde gebraucht haben. */
  get shaky(): Word[] {
    return Object.entries(this.s.misses)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => this.byId.get(id))
      .filter((w): w is Word => w !== undefined);
  }

  // --------------------------------------------------------------- Schreiben

  /**
   * Verbucht eine Antwort. `wrong` wird erst nach dem Abtippen der Korrektur
   * aufgerufen — die Vokabel ist zu diesem Zeitpunkt bereits vorgemerkt.
   */
  answer(verdict: Verdict): AnswerResult {
    const id = this.wave[this.s.cursor];
    if (!id) {
      return { verdict, points: 0, combo: this.s.combo, isRescue: false, streakMilestone: null };
    }

    this.s.verdicts[id] = verdict;
    // Dauerhaftes Gedächtnis je Wort — daraus entstehen die Wackelkandidaten.
    recordShaky(this.set.id, id, verdict);
    recordAnswer(this.set.id, id, verdict);
    const missedRound = this.s.missedIn[id];
    const isRescue = verdict === 'correct' && missedRound !== undefined && missedRound < this.s.round;

    if (verdict === 'correct') {
      this.s.combo += 1;
      this.s.bestCombo = Math.max(this.s.bestCombo, this.s.combo);
      this.s.solved.push(id);
      if (isRescue) this.s.rescues += 1;
    } else if (verdict === 'near') {
      // Serie friert ein statt zu brechen: das Wort war gewusst, nur vertippt.
      this.s.nearMisses += 1;
      this.s.nextRound.push(id);
      this.s.missedIn[id] = this.s.round;
      this.s.misses[id] = (this.s.misses[id] ?? 0) + 1;
    } else {
      this.s.combo = 0;
      this.s.nextRound.push(id);
      this.s.missedIn[id] = this.s.round;
      this.s.misses[id] = (this.s.misses[id] ?? 0) + 1;
    }

    const base = verdict === 'correct' ? (isRescue ? 250 : 100) : verdict === 'near' ? 50 : 0;
    const points = Math.round(base * comboMultiplier(this.s.combo));
    this.s.score += points;
    this.s.waveScore[id] = points;

    const milestone =
      verdict === 'correct' && MILESTONES.includes(this.s.combo) ? this.s.combo : null;

    this.s.cursor += 1;
    this.save();

    return { verdict, points, combo: this.s.combo, isRescue, streakMilestone: milestone };
  }

  /** Bewertung eines Wortes — für die Fortschrittskette. */
  verdictOf(id: string): Verdict | null {
    return this.s.verdicts[id] ?? null;
  }

  /** Wellenabschluss +250, perfekte Welle zusätzlich die halbe Wellensumme. */
  closeWave(): { bonus: number; perfect: boolean } {
    const perfect = this.wavePerfect();
    const waveScore = this.wave.reduce((sum, id) => sum + (this.s.waveScore[id] ?? 0), 0);
    const bonus = 250 + (perfect ? Math.round(waveScore * 0.5) : 0);
    this.s.score += bonus;
    this.save();
    return { bonus, perfect };
  }

  /** Session-Abschluss: +500 und 100 je geretteter Vokabel. */
  closeSession(): number {
    const bonus = 500 + 100 * this.s.rescues;
    this.s.score += bonus;
    this.save();
    return bonus;
  }

  get waveFinished(): boolean {
    return this.s.cursor >= this.wave.length;
  }

  /** Hat die gerade beendete Welle keinen einzigen Fehler gesehen? */
  wavePerfect(): boolean {
    // Gegen die Bewertung dieser Runde prüfen, nicht gegen missedIn — das
    // bleibt über Runden gefüllt und machte perfekte Runden ab Runde 2 unmöglich.
    return this.wave.every((id) => this.s.verdicts[id] === 'correct');
  }

  get hasNextWave(): boolean {
    return this.s.waveIndex + 1 < this.s.waves.length;
  }

  get finished(): boolean {
    return this.waveFinished && !this.hasNextWave && this.s.nextRound.length === 0;
  }

  /** Nächste Welle derselben Runde. */
  advanceWave(): void {
    if (!this.hasNextWave) return;
    this.s.waveIndex += 1;
    this.s.cursor = 0;
    this.s.waveScore = {};
    this.save();
  }

  /** Nächste Runde: nur die Wörter, die danebengingen. */
  advanceRound(): void {
    if (this.s.nextRound.length === 0) return;
    this.s.round += 1;
    this.s.waves = [shuffle(this.s.nextRound)];
    this.s.waveIndex = 0;
    this.s.cursor = 0;
    this.s.nextRound = [];
    this.s.waveScore = {};
    this.save();
  }

  /**
   * Bilanz einer abgeschlossenen Welle. `open` sind die Wörter DIESER Welle,
   * `openTotal` alle, die in die nächste Runde gehen — sonst widerspricht die
   * Überschrift der Liste darunter.
   */
  waveSummary(): { solved: number; total: number; open: string[]; openTotal: string[] } {
    const wave = [...this.wave];
    const open = wave.filter((id) => this.s.nextRound.includes(id));
    return { solved: wave.length - open.length, total: wave.length, open, openTotal: [...this.s.nextRound] };
  }
}
