/**
 * Aussprache über die Web Speech API.
 *
 * Die Betonung ist der halbe Vokabeltest: "ˈrekɔːd" (Substantiv) und
 * "rɪˈkɔːd" (Verb) unterscheiden sich nur darin. Die Lautschrift steht zwar
 * auf dem Plakat, aber gelesen wird sie erst, wenn man sie einmal gehört hat.
 *
 * Zwei Regeln:
 *  1. Gesprochen wird immer erst NACH der Bewertung. Vorher wäre es die Lösung.
 *  2. Kein Fallback auf eine falsche Stimme. Gibt es für die Sprache keine
 *     Stimme (Latein, alte Android-Geräte), verschwindet der Lautsprecher.
 *     Deutsch ausgesprochenes Englisch ist schlimmer als gar keine Ausgabe.
 */

import { audio } from './audio';

const LS_KEY = 'ueberklebt.speech';

/** Etwas langsamer als Gesprächstempo — es geht um Silben, nicht um Fluss. */
const RATE = 0.85;
const RATE_SLOW = 0.6;

function readFlag(fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

class Speech {
  private synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

  private voices: SpeechSynthesisVoice[] = [];
  private unlocked = false;
  private lastSpoken = { text: '', at: 0 };
  private listeners = new Set<() => void>();

  enabled = readFlag(true);

  constructor() {
    if (!this.synth) return;
    const load = () => {
      this.voices = this.synth!.getVoices();
      if (this.voices.length) {
        for (const fn of this.listeners) fn();
        this.listeners.clear(); // einmalig — Stimmen laden nur ein Mal nach
      }
    };
    load();
    // Chrome liefert die Liste asynchron nach; ohne das Event bleibt sie leer.
    this.synth.addEventListener?.('voiceschanged', load);
  }

  /**
   * Ruft `fn`, sobald Stimmen da sind (und sofort, wenn sie es schon sind).
   * Nötig, weil beim ersten Rendern noch keine Liste existiert — sonst
   * verschwindet der Schalter dauerhaft, obwohl es Stimmen gibt.
   */
  whenReady(fn: () => void): void {
    if (this.voices.length) fn();
    else this.listeners.add(fn);
  }

  get supported(): boolean {
    return this.synth !== null;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(LS_KEY, on ? '1' : '0');
    } catch {
      /* private mode */
    }
    if (!on) this.cancel();
  }

  /**
   * Muss aus einem echten Click-Handler laufen — iOS spricht sonst nie, auch
   * nicht später. Derselbe Knopf, der Tastatur und AudioContext freigibt.
   */
  unlock(): void {
    if (!this.synth || this.unlocked) return;
    this.unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      this.synth.speak(u);
    } catch {
      /* manche WebViews werfen hier — dann bleibt es bei der Lautschrift */
    }
  }

  /** Exakte Stimme, sonst dieselbe Sprache in anderer Region, sonst keine. */
  private voiceFor(lang: string): SpeechSynthesisVoice | null {
    if (!this.voices.length) this.voices = this.synth?.getVoices() ?? [];
    const want = lang.toLowerCase();
    const base = want.split('-')[0]!;

    const exact = this.voices.filter((v) => v.lang.toLowerCase().replace('_', '-') === want);
    const family = this.voices.filter((v) => v.lang.toLowerCase().startsWith(base));
    const pool = exact.length ? exact : family;
    if (!pool.length) return null;

    // Lokale Stimmen klingen auf iOS deutlich besser als die Netzstimmen.
    return pool.find((v) => v.localService && v.default) ?? pool.find((v) => v.localService) ?? pool[0]!;
  }

  /** Gibt es für diese Sprache überhaupt eine Stimme? */
  available(lang: string): boolean {
    return this.supported && this.voiceFor(lang) !== null;
  }

  cancel(): void {
    try {
      this.synth?.cancel();
    } catch {
      /* egal */
    }
  }

  /**
   * Spricht `text`. Zweimal dasselbe Wort kurz hintereinander heißt: "ich
   * hab's nicht verstanden" — dann langsamer.
   */
  speak(text: string, lang: string, opts: { slowOnRepeat?: boolean } = {}): void {
    if (!this.synth || !this.enabled || audio.muted) return;
    const clean = text.trim();
    if (!clean) return;

    const voice = this.voiceFor(lang);
    if (!voice) return;

    const now = performance.now();
    const repeat = opts.slowOnRepeat === true && this.lastSpoken.text === clean && now - this.lastSpoken.at < 4000;
    this.lastSpoken = { text: clean, at: now };

    this.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = repeat ? RATE_SLOW : RATE;
    u.pitch = 1;
    u.volume = 1;
    try {
      this.synth.speak(u);
    } catch {
      /* egal — die Lautschrift steht ohnehin auf dem Plakat */
    }
  }
}

export const speech = new Speech();
