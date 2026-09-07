export interface Word {
  id: string;
  de: string;
  en: string[];
  accept: string[];
  ipa: string | null;
  pos: string;
  hint: string;
  example: string | null;
  note: string | null;
  page?: number;
}

export interface WordSet {
  id: string;
  title: string;
  source: string;
  /** BCP-47 der Zielsprache — steuert die Sprachausgabe. */
  lang: string;
  /** Sprachname für die Oberfläche: "Englisch", "Französisch", … */
  langLabel: string;
  /** Historisch; die Richtung ist immer Deutsch → Zielsprache. */
  direction?: string;
  /** Zeitpunkt des Imports. Fehlt bei den mitgelieferten Listen. */
  addedAt?: number;
  words: Word[];
}

export type Verdict = 'correct' | 'near' | 'wrong';
