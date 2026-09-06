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
  direction: 'de-en';
  words: Word[];
}

export type Verdict = 'correct' | 'near' | 'wrong';
