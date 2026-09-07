/**
 * Bestleistungen pro Set. Reiner Selbstvergleich — kein Leaderboard, kein
 * täglicher Verfalls-Streak. Der Sessionzähler wächst nur und verfällt nie:
 * er soll anerkennen, nicht unter Druck setzen.
 */

export interface Records {
  bestScore: number;
  fewestRounds: number;
  longestStreak: number;
  sessions: number;
}

const EMPTY: Records = { bestScore: 0, fewestRounds: 0, longestStreak: 0, sessions: 0 };
const key = (setId: string) => `ueberklebt.records.${setId}`;

export function loadRecords(setId: string): Records {
  try {
    const raw = localStorage.getItem(key(setId));
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Records>) };
  } catch {
    return { ...EMPTY };
  }
}

/** Verbucht eine abgeschlossene Session und meldet, was neu ist. */
export function saveRecords(
  setId: string,
  run: { score: number; rounds: number; streak: number },
): { records: Records; beaten: Array<'score' | 'rounds' | 'streak'> } {
  const prev = loadRecords(setId);
  const beaten: Array<'score' | 'rounds' | 'streak'> = [];

  if (run.score > prev.bestScore) beaten.push('score');
  if (prev.fewestRounds === 0 || run.rounds < prev.fewestRounds) beaten.push('rounds');
  if (run.streak > prev.longestStreak) beaten.push('streak');

  const records: Records = {
    bestScore: Math.max(prev.bestScore, run.score),
    fewestRounds: prev.fewestRounds === 0 ? run.rounds : Math.min(prev.fewestRounds, run.rounds),
    longestStreak: Math.max(prev.longestStreak, run.streak),
    sessions: prev.sessions + 1,
  };

  try {
    localStorage.setItem(key(setId), JSON.stringify(records));
  } catch {
    /* private mode */
  }
  return { records, beaten };
}

/** Beim Löschen einer Liste verschwinden auch ihre Bestwerte. */
export function clearRecords(setId: string): void {
  try {
    localStorage.removeItem(key(setId));
  } catch {
    /* private mode */
  }
}
