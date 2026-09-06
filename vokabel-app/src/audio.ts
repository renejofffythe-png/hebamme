/**
 * Sound-Engine — alles zur Laufzeit synthetisiert, keine Audiodateien.
 *
 * Tonales System: A-Moll-Pentatonik (A C D E G). Keine Halbtonreibung,
 * überlappende Sounds bleiben konsonant.
 *
 * Der Erfolgston wird pro Serienstufe transponiert. Das ist primär
 * Ermüdungsschutz (er wird ~50x pro Session gehört), erst sekundär Belohnung.
 */

type Bus = 'ui' | 'feedback' | 'music';

const LS = {
  muted: 'ueberklebt.audio.muted',
  keyclick: 'ueberklebt.audio.keyclick',
} as const;

/** Pentatonik-Stufen in Halbtönen, Index = Serienstufe - 1. */
const PENTA = [0, 3, 5, 7, 10, 12];
const semitone = (n: number) => Math.pow(2, n / 12);

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* private mode */
  }
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<Bus, GainNode>;
  private noise!: AudioBuffer;

  private duckCount = 0;
  private lastPlayed = new Map<string, number>();
  private voices = 0;

  muted = readFlag(LS.muted, false);
  keyclick = readFlag(LS.keyclick, false);

  /** Muss aus einem echten Click-Handler heraus laufen (iOS verlangt das). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return;

    const ctx: AudioContext = new Ctor({ latencyHint: 'interactive' });
    this.ctx = ctx;

    // Signalkette: voice -> bus -> master -> limiter -> out
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.12;
    limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0.0001 : 0.75;
    this.master.connect(limiter);

    const mk = (v: number) => {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(this.master);
      return g;
    };
    this.buses = { ui: mk(0.45), feedback: mk(0.85), music: mk(0.35) };

    // Rauschpuffer einmalig vorberechnen
    const len = Math.floor(ctx.sampleRate * 0.25);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Warm-up gegen den stummen ersten Ton auf iOS
    const warm = ctx.createBufferSource();
    warm.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    warm.connect(ctx.destination);
    warm.start(0);

    // Safari schickt den Context bei Anruf/Tabwechsel in suspended/interrupted
    const revive = () => {
      if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
    };
    document.addEventListener('visibilitychange', revive);
    ctx.addEventListener('statechange', revive);
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    writeFlag(LS.muted, muted);
    if (!this.ctx) return;
    // Gain-Ramp statt ctx.suspend() — sonst fehlt beim Einschalten der erste Sound.
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(muted ? 0.0001 : 0.75, t + 0.08);
  }

  setKeyclick(on: boolean): void {
    this.keyclick = on;
    writeFlag(LS.keyclick, on);
  }

  // ---------------------------------------------------------------- Bausteine

  private now(): number {
    return this.ctx!.currentTime + 0.005;
  }

  /** Throttle pro Sound-ID gegen Kammfilter-Artefakte bei schnellem Tippen. */
  private gate(id: string, minGapMs: number): boolean {
    if (!this.ready || this.muted) return false;
    if (this.voices > 12) return false;
    const t = performance.now();
    const last = this.lastPlayed.get(id) ?? -Infinity;
    if (t - last < minGapMs) return false;
    this.lastPlayed.set(id, t);
    return true;
  }

  private env(gain: GainNode, t: number, peak: number, attack: number, decay: number): void {
    const g = gain.gain;
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.setValueAtTime(0, t + attack + decay + 0.001);
  }

  private tone(
    bus: Bus,
    opts: {
      type: OscillatorType;
      freq: number;
      at: number;
      dur: number;
      gain: number;
      attack?: number;
      lowpass?: number;
      glideTo?: number;
      detune?: number;
      pan?: number;
    },
  ): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.freq, opts.at);
    if (opts.glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(opts.glideTo, opts.at + opts.dur);
    }
    if (opts.detune) osc.detune.value = opts.detune;

    const g = ctx.createGain();
    this.env(g, opts.at, opts.gain, opts.attack ?? 0.003, opts.dur);

    let node: AudioNode = osc;
    if (opts.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.lowpass;
      f.Q.value = 0.7;
      node.connect(f);
      node = f;
    }
    node.connect(g);

    if (opts.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = opts.pan;
      g.connect(p);
      p.connect(this.buses[bus]);
    } else {
      g.connect(this.buses[bus]);
    }

    this.voices++;
    osc.onended = () => this.voices--;
    osc.start(opts.at);
    osc.stop(opts.at + opts.dur + 0.02);
  }

  private burst(
    bus: Bus,
    opts: { at: number; dur: number; gain: number; freq: number; q: number; type?: BiquadFilterType },
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;

    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.value = opts.freq;
    f.Q.value = opts.q;

    const g = ctx.createGain();
    this.env(g, opts.at, opts.gain, 0.001, opts.dur);

    src.connect(f);
    f.connect(g);
    g.connect(this.buses[bus]);

    this.voices++;
    src.onended = () => this.voices--;
    src.start(opts.at);
    src.stop(opts.at + opts.dur + 0.02);
  }

  /** Klatschen mit drei Vor-Echos — klingt nach Menge statt nach einer Hand. */
  private clap(at: number, gain: number, centre = 1600): void {
    for (const [dt, f] of [[-0.012, 0.6], [-0.008, 0.6], [-0.004, 0.6], [0, 1]] as const) {
      this.burst('feedback', {
        at: at + dt,
        dur: 0.09,
        gain: gain * f,
        freq: centre,
        q: 1.4,
      });
    }
  }

  /** Musik weicht kurz zurück. Referenzzähler, sonst bleibt sie unten hängen. */
  private duck(factor: number, holdMs: number): void {
    if (!this.ctx) return;
    const g = this.buses.music.gain;
    const t = this.ctx.currentTime;
    this.duckCount++;
    g.setTargetAtTime(0.35 * factor, t, 0.02);
    window.setTimeout(() => {
      this.duckCount--;
      if (this.duckCount === 0 && this.ctx) {
        g.setTargetAtTime(0.35, this.ctx.currentTime, 0.25);
      }
    }, holdMs);
  }

  // ------------------------------------------------------------------- States

  key(): void {
    if (!this.keyclick || !this.gate('key', 25)) return;
    const t = this.now();
    const pick = [1650, 1800, 1980][Math.floor(Math.random() * 3)]!;
    this.burst('ui', { at: t, dur: 0.018, gain: 0.12, freq: 2200, q: 1.2 });
    this.tone('ui', { type: 'triangle', freq: pick, at: t, dur: 0.018, gain: 0.05, attack: 0.001 });
  }

  submit(): void {
    if (!this.gate('submit', 60)) return;
    const t = this.now();
    this.tone('ui', { type: 'square', freq: 330, at: t, dur: 0.045, gain: 0.3, lowpass: 2500 });
    this.burst('ui', { at: t, dur: 0.006, gain: 0.09, freq: 3000, q: 1, type: 'highpass' });
  }

  /** Erfolgston. `streak` ab 1; transponiert entlang der Pentatonik. */
  correct(streak = 1): void {
    if (!this.gate('correct', 40)) return;
    const t = this.now();

    const step = Math.max(0, Math.min(streak - 1, PENTA.length - 1));
    const capped = streak > PENTA.length; // ab Stufe 7: Tonhöhe eingefroren
    const k = semitone(PENTA[step]!);
    const lp = 3200 + step * 460;

    // Zwei Töne, aufsteigende Quarte. Triangle-Layer gibt Körper.
    for (const [f, at, dur] of [[880 * k, t, 0.07], [1174.66 * k, t + 0.055, 0.11]] as const) {
      this.tone('feedback', { type: 'square', freq: f, at, dur, gain: 0.5, lowpass: lp });
      this.tone('feedback', { type: 'triangle', freq: f / 2, at, dur, gain: 0.2, detune: 7 });
    }

    if (capped) {
      // Eskalation nur noch über Dichte, nie über Lautstärke.
      this.tone('feedback', { type: 'triangle', freq: 440, at: t, dur: 0.18, gain: 0.15 });
      this.clap(t + 0.055, 0.25);
    }
    if (streak >= 10) {
      this.tone('feedback', {
        type: 'square', freq: 2793.83, at: t + 0.095, dur: 0.14, gain: 0.35, lowpass: 5500, pan: 0,
      });
    }
    this.duck(0.45, 150);
  }

  /** Tippfehler. Beginnt wie der Erfolg und erreicht das Ziel nicht ganz. */
  nearMiss(): void {
    if (!this.gate('near', 40)) return;
    const t = this.now();
    this.tone('feedback', { type: 'triangle', freq: 880, at: t, dur: 0.07, gain: 0.5, lowpass: 2200, attack: 0.004 });
    this.tone('feedback', {
      type: 'triangle', freq: 1174.66, glideTo: 1046.5, at: t + 0.06, dur: 0.12, gain: 0.45, lowpass: 2200, attack: 0.004,
    });
    this.burst('feedback', { at: t + 0.06, dur: 0.06, gain: 0.06, freq: 4000, q: 1, type: 'highpass' });
    this.duck(0.55, 130);
  }

  /**
   * Fehler. Leiser als der Erfolg, dunkler statt heller, konsonante kleine
   * Terz mit leichtem Absacken. Kein Buzzer — der erzeugt Scham.
   */
  wrong(): void {
    if (!this.gate('wrong', 60)) return;
    const t = this.now();
    const glide = Math.pow(2, -40 / 1200); // -40 Cent
    for (const f of [293.66, 349.23]) {
      this.tone('feedback', {
        type: 'triangle', freq: f, glideTo: f * glide, at: t, dur: 0.22, gain: 0.3, lowpass: 900, attack: 0.006,
      });
    }
    this.tone('feedback', { type: 'sine', freq: 90, at: t, dur: 0.07, gain: 0.15 });
    this.duck(0.7, 150); // der Fehler wird bewusst nicht inszeniert
  }

  /** Korrektur abgetippt — "abgehakt", nicht "belohnt". */
  corrected(): void {
    if (!this.gate('corrected', 60)) return;
    const t = this.now();
    this.burst('feedback', { at: t, dur: 0.006, gain: 0.09, freq: 3500, q: 1.5 });
    this.tone('feedback', { type: 'triangle', freq: 587.33, at: t + 0.01, dur: 0.06, gain: 0.33, lowpass: 2800 });
    this.tone('feedback', { type: 'triangle', freq: 698.46, at: t + 0.065, dur: 0.09, gain: 0.33, lowpass: 2800 });
    this.duck(0.55, 120);
  }

  /** Anpfiff: synthetische Trillerpfeife plus Auftakt. */
  roundStart(): void {
    if (!this.gate('roundStart', 300)) return;
    const ctx = this.ctx!;
    const t = this.now();

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 18;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 35;
    lfo.connect(lfoGain);

    for (const f of [2100, 2160]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      lfoGain.connect(osc.frequency);
      const g = ctx.createGain();
      this.env(g, t, 0.25, 0.015, 0.18);
      osc.connect(g);
      g.connect(this.buses.feedback);
      osc.start(t);
      osc.stop(t + 0.24);
    }
    lfo.start(t);
    lfo.stop(t + 0.24);
    this.burst('feedback', { at: t, dur: 0.2, gain: 0.12, freq: 2000, q: 8 });

    this.tone('feedback', { type: 'triangle', freq: 440, at: t + 0.34, dur: 0.09, gain: 0.35 });
    this.tone('feedback', { type: 'triangle', freq: 659.25, at: t + 0.43, dur: 0.09, gain: 0.35 });
    this.duck(0.55, 600);
  }

  /** Stadiontrommel plus aufsteigendes Pentatonik-Motiv. */
  roundComplete(): void {
    if (!this.gate('roundComplete', 500)) return;
    const t = this.now();
    for (const dt of [0, 0.26, 0.52]) {
      this.tone('feedback', { type: 'sine', freq: 150, glideTo: 55, at: t + dt, dur: 0.2, gain: 0.45, attack: 0.002 });
      this.burst('feedback', { at: t + dt, dur: 0.005, gain: 0.1, freq: 3000, q: 1, type: 'highpass' });
    }
    const motif = [880, 1046.5, 1318.51];
    motif.forEach((f, i) => {
      const at = t + 0.52 + i * 0.12;
      this.tone('feedback', { type: 'square', freq: f, at, dur: 0.11, gain: 0.4, lowpass: 4500 });
      this.tone('feedback', { type: 'triangle', freq: f / 2, at, dur: 0.11, gain: 0.16 });
    });
    this.clap(t + 0.76, 0.35);
    this.duck(0.4, 1200);
  }

  /** Perfekte Runde — ersetzt roundComplete, wird nicht zusätzlich gespielt. */
  perfectRound(): void {
    if (!this.gate('perfect', 500)) return;
    const t = this.now();
    [[0, 0.3, 1500], [0.15, 0.4, 1600], [0.3, 0.5, 1750]].forEach(([dt, g, c]) =>
      this.clap(t + dt!, g!, c!),
    );
    for (const [at, a, b] of [[0.3, 659.25, 987.77], [0.54, 880, 1318.51]] as const) {
      this.tone('feedback', { type: 'square', freq: a, at: t + at, dur: 0.22, gain: 0.3, lowpass: 2400, attack: 0.012 });
      this.tone('feedback', { type: 'square', freq: b, at: t + at, dur: 0.22, gain: 0.3, lowpass: 2400, attack: 0.012 });
    }
    this.duck(0.35, 1000);
  }

  /** Session geschafft — wird genau einmal gehört, darf groß sein. */
  sessionComplete(): void {
    if (!this.gate('session', 1000)) return;
    const t = this.now();
    this.burst('feedback', { at: t, dur: 0.7, gain: 0.3, freq: 400, q: 3 });
    this.tone('feedback', { type: 'sine', freq: 150, glideTo: 50, at: t + 0.7, dur: 0.26, gain: 0.5, attack: 0.002 });
    this.clap(t + 0.7, 0.5);

    const chant = [440, 523.25, 659.25, 880, 1046.5, 1318.51, 1760];
    const times = [0.7, 0.82, 0.94, 1.06, 1.24, 1.36, 1.54];
    chant.forEach((f, i) => {
      const at = t + times[i]!;
      const dur = i === chant.length - 1 ? 0.7 : 0.14;
      this.tone('feedback', { type: 'square', freq: f, at, dur, gain: 0.42, lowpass: 6000 });
      this.tone('feedback', { type: 'triangle', freq: f / 2, at, dur, gain: 0.17 });
    });
    this.tone('feedback', { type: 'square', freq: 1318.51, at: t + 1.54, dur: 0.7, gain: 0.2, lowpass: 6000 });
    this.duck(0.25, 2000);
  }
}

export const audio = new AudioEngine();
