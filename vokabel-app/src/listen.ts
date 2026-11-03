/**
 * Spracheingabe über die Web Speech API (Gegenstück zu speech.ts).
 *
 * Gedacht für Vokabeln, die man sprechen können will, nicht schreiben — bei
 * "Papas Vokabeln" zählt die Aussprache mehr als die Rechtschreibung.
 *
 * Drei Eigenheiten der Schnittstelle, die den Aufbau hier erklären:
 *  1. Sie heißt auf Safari `webkitSpeechRecognition` und schickt das Audio an
 *     Apple bzw. Google. Ohne Netz kommt nichts zurück.
 *  2. Jeder Lauf endet von selbst, sobald es still wird. Für die nächste
 *     Vokabel wird neu gestartet, nie durchgehend gelauscht.
 *  3. Die erste Erlaubnis kommt als Systemdialog. Wird sie verweigert, bleibt
 *     das dauerhaft so — dann hilft nur noch die Tastatur, und genau das sagt
 *     `denied` dem Spielscreen.
 */

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

interface RecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: {
      isFinal: boolean;
      length: number;
      [j: number]: { transcript: string };
    };
  };
}

export type ListenEnd = 'done' | 'denied' | 'silent' | 'error';

export interface ListenHandlers {
  /** Zwischenstand, während gesprochen wird — nur zum Anzeigen. */
  onInterim?(text: string): void;
  /** Das Ergebnis. `alternatives` sind weitere Deutungen derselben Äußerung. */
  onFinal(text: string, alternatives: string[]): void;
  onEnd?(reason: ListenEnd): void;
}

class Listen {
  private Ctor: (new () => RecognitionLike) | null = null;
  private rec: RecognitionLike | null = null;
  private running = false;
  private got = false;

  /** Einmal verweigert, bleibt es verweigert — dann gar nicht erst anbieten. */
  denied = false;

  constructor() {
    if (typeof window === 'undefined') return;
    const w = window as unknown as Record<string, unknown>;
    const C = (w['SpeechRecognition'] ?? w['webkitSpeechRecognition']) as
      | (new () => RecognitionLike)
      | undefined;
    this.Ctor = C ?? null;
  }

  get supported(): boolean {
    return this.Ctor !== null;
  }

  get active(): boolean {
    return this.running;
  }

  /** Startet einen Lauf. Gibt false zurück, wenn gar nicht erst gestartet wurde. */
  start(lang: string, h: ListenHandlers): boolean {
    if (!this.Ctor || this.denied) return false;
    this.stop();

    let rec: RecognitionLike;
    try {
      rec = new this.Ctor();
    } catch {
      return false;
    }

    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    this.got = false;

    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const best = res[0]?.transcript?.trim() ?? '';
        if (!best) continue;
        if (!res.isFinal) {
          h.onInterim?.(best);
          continue;
        }
        const alts: string[] = [];
        for (let j = 1; j < res.length; j++) {
          const t = res[j]?.transcript?.trim();
          if (t) alts.push(t);
        }
        this.got = true;
        h.onFinal(best, alts);
      }
    };

    rec.onerror = (e) => {
      const kind = e.error ?? '';
      if (kind === 'not-allowed' || kind === 'service-not-allowed') {
        this.denied = true;
        h.onEnd?.('denied');
        return;
      }
      // "aborted" ist unser eigener stop() — das ist kein Fehlerfall.
      if (kind === 'aborted') return;
      h.onEnd?.(kind === 'no-speech' ? 'silent' : 'error');
    };

    rec.onend = () => {
      this.running = false;
      this.rec = null;
      if (!this.got) h.onEnd?.('silent');
      else h.onEnd?.('done');
    };

    try {
      rec.start();
    } catch {
      return false;
    }
    this.rec = rec;
    this.running = true;
    return true;
  }

  stop(): void {
    const rec = this.rec;
    if (!rec) return;
    this.rec = null;
    this.running = false;
    try {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.abort();
    } catch {
      /* egal — der Lauf endet ohnehin von selbst */
    }
  }
}

export const listen = new Listen();
