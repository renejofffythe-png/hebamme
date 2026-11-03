/**
 * Wackelkandidaten: die Wörter, die wiederholt danebengehen.
 *
 * Zwei Zahlen je Wort, dauerhaft über Sessions hinweg:
 *  - `wrong`  — wie oft es falsch war, seit es zuletzt sicher saß.
 *  - `streak` — wie oft es seitdem am Stück richtig war.
 *
 * Ab dem zweiten Fehler kommt ein Wort auf die Liste, nach drei richtigen
 * Antworten in Folge wieder herunter. „Am Stück“ ist Absicht: zweimal richtig,
 * einmal daneben heißt, dass es noch nicht sitzt, und die Zählung fängt von
 * vorn an. Ein „Fast“ ist kein Fehler, unterbricht aber die Serie.
 *
 * Gezählt wird je Listenfamilie, nicht je Tagesliste: „conflict“ ist dasselbe
 * Wort, ob es in Tag 1 oder in den Wackelkandidaten auftaucht.
 */

import type { Verdict } from './types';

const KEY = 'ueberklebt.shaky';
/** Ab so vielen Fehlern steht ein Wort auf der Liste. */
const ENTER_AT = 2;
/** So viele richtige Antworten in Folge holen es wieder herunter. */
const LEAVE_AT = 3;

export interface ShakyStat {
  wrong: number;
  streak: number;
  shaky: boolean;
}

type Store = Record<string, ShakyStat>;

const EMPTY: ShakyStat = { wrong: 0, streak: 0, shaky: false };

/** "papas-vokabeln-tag3" und "papas-vokabeln-wackelkandidaten" → "papas-vokabeln". */
export function familyOf(setId: string): string {
  return setId.replace(/-(?:tag\d+|wackelkandidaten)$/, '');
}

const keyOf = (setId: string, wordId: string) => `${familyOf(setId)}::${wordId}`;

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode — dann gilt die Liste nur für diese Sitzung */
  }
}

export function statOf(setId: string, wordId: string): ShakyStat {
  return { ...EMPTY, ...read()[keyOf(setId, wordId)] };
}

/** Verbucht eine Antwort. Wird aus der Session gerufen, für jedes Wort. */
export function record(setId: string, wordId: string, verdict: Verdict): void {
  const store = read();
  const k = keyOf(setId, wordId);
  const stat: ShakyStat = { ...EMPTY, ...store[k] };

  if (verdict === 'wrong') {
    stat.wrong += 1;
    stat.streak = 0;
    if (stat.wrong >= ENTER_AT) stat.shaky = true;
  } else if (verdict === 'near') {
    stat.streak = 0;
  } else {
    stat.streak += 1;
    if (stat.shaky && stat.streak >= LEAVE_AT) {
      // Sitzt wieder: Konto auf null. Zurück kommt es erst nach zwei neuen Fehlern.
      stat.shaky = false;
      stat.wrong = 0;
      stat.streak = 0;
    }
  }

  store[k] = stat;
  write(store);
}

/** Alle Wort-IDs dieser Familie, die gerade auf der Liste stehen. */
export function shakyIds(family: string): Set<string> {
  const out = new Set<string>();
  const prefix = `${familyOf(family)}::`;
  for (const [k, stat] of Object.entries(read())) {
    if (k.startsWith(prefix) && stat.shaky) out.add(k.slice(prefix.length));
  }
  return out;
}

/** Beim Löschen einer Liste verschwindet auch ihr Wortgedächtnis. */
export function clearShaky(setId: string): void {
  const store = read();
  const prefix = `${familyOf(setId)}::`;
  for (const k of Object.keys(store)) if (k.startsWith(prefix)) delete store[k];
  write(store);
}
