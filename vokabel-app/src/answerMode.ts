/**
 * Wie geantwortet wird: getippt oder gesprochen.
 *
 * Die Wahl fällt vor der Runde (Briefing) und gilt bis sie geändert wird —
 * pro Liste, denn Schulvokabeln schreibt man, Hörvokabeln spricht man.
 */

import { listen } from './listen';

export type AnswerMode = 'type' | 'speak';

const key = (setId: string) => `ueberklebt.answermode.${setId}`;

export function readMode(setId: string): AnswerMode {
  if (!listen.supported || listen.denied) return 'type';
  try {
    return localStorage.getItem(key(setId)) === 'speak' ? 'speak' : 'type';
  } catch {
    return 'type';
  }
}

export function writeMode(setId: string, mode: AnswerMode): void {
  try {
    localStorage.setItem(key(setId), mode);
  } catch {
    /* private mode — dann gilt die Wahl nur für diese Runde */
  }
}
