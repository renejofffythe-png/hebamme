import { el, icon, announce, pick } from '../dom';
import { audio } from '../audio';
import { speech } from '../speech';
import { speakButton } from '../ui';
import { grade } from '../grading';
import type { Session } from '../state';
import type { Word } from '../types';

/**
 * Der Spielscreen. Wichtigster Screen der App, deshalb ein paar Regeln, von
 * denen keine gebrochen werden darf:
 *
 *  1. Das <input> ist EIN Knoten über die gesamte Session. Nie neu erzeugt,
 *     nie ausgetauscht, nie `disabled` (nur ein internes locked-Flag), nie
 *     geblurrt. Sonst schließt iOS die Tastatur und öffnet sie ohne echte
 *     Nutzergeste nicht wieder — dann ist der Flow tot.
 *  2. `locked` wird SYNCHRON im keydown gesetzt, bevor irgendetwas asynchron
 *     passiert. Das ist der Schutz gegen doppeltes Enter.
 *  3. Das Feld wird bei Enter sofort geleert. Wer schneller tippt als die
 *     Animation, verliert dadurch keine Zeichen — sie gehören zur nächsten
 *     Vokabel.
 */

const TILTS = ['-0.8deg', '-0.4deg', '0.3deg', '0.6deg', '-0.2deg'];
const STAMP_ROTS = ['-9deg', '-5deg', '4deg', '7deg', '-2deg'];
const STAMPS = ['SITZT', 'SAUBER', 'JA', 'GEHT KLAR', 'ECHT JETZT', 'PERFEKT', 'WEITER', 'HAST DU'];
const WRONG_LINES = ['Noch nicht.', 'Andere Baustelle.', 'Kommt gleich wieder.'];

/** Hebt die Stelle hervor, an der es hakte: "co**u**ntryside". */
function markDiff(solution: string, index: number): string {
  if (index < 0 || index >= solution.length) return solution;
  return `${solution.slice(0, index)} ▸${solution.slice(index)}`;
}

const T_CORRECT = 260;
const T_RESCUE = 460;
const T_UNLOCK = 120;
const T_NEAR = 1100;
const T_WRONG = 500;
const T_REVEAL = 1400;

type Phase = 'idle' | 'judging' | 'correcting';

export interface PlayHandlers {
  onWaveEnd(): void;
  onFinish(): void;
}

export class PlayScreen {
  readonly root: HTMLElement;
  readonly input: HTMLInputElement;

  private session: Session;
  private handlers: PlayHandlers;

  private phase: Phase = 'idle';
  private locked = false;
  private timer = 0;

  private posterEl: HTMLElement;
  private metaEl: HTMLElement;
  private wordEl: HTMLElement;
  private ipaEl: HTMLElement;
  private pronEl: HTMLElement;
  private fieldEl: HTMLElement;
  private extraEl: HTMLElement;
  private hintEl: HTMLElement;
  private scoreEl: HTMLElement;
  private comboEl: HTMLElement;
  private bannerEl: HTMLElement;
  private railEl: HTMLElement;
  private chipEl: HTMLElement;
  private badgeEl: HTMLElement;
  private solvedEl: HTMLElement;
  private skipBtn: HTMLButtonElement;

  /** Nur im Korrekturmodus gesetzt: die Lösung, die abgetippt werden muss. */
  private target = '';
  /** Was der Lautsprecher gerade sagen würde — erst nach der Bewertung gesetzt. */
  private spoken: string | null = null;
  private lastEmptyEnter = 0;
  private seenRules = { firstMiss: false };

  constructor(session: Session, handlers: PlayHandlers, soundToggle: HTMLElement) {
    this.session = session;
    this.handlers = handlers;

    this.input = el('input', {
      class: 'field__input',
      type: 'text',
      inputmode: 'text',
      lang: session.set.lang,
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      autocomplete: 'off',
      name: `answer-${Math.random().toString(36).slice(2)}`,
      enterkeyhint: 'go',
      'data-1p-ignore': 'true',
      'data-lpignore': 'true',
      'aria-label': `Übersetzung eingeben — ${session.set.langLabel}`,
      placeholder: 'hier tippen',
    });

    this.badgeEl = el('span', { class: 'round-badge t-stencil', text: `RUNDE ${session.round}` });
    this.solvedEl = el('span', { class: 't-meta rail__count' });
    this.chipEl = el('span', { class: 'stack-chip', hidden: true });
    this.railEl = el('div', { class: 'rail__segments', role: 'progressbar' });

    this.scoreEl = el('span', { class: 'score' });
    this.comboEl = el('span', { class: 'combo', hidden: true });
    this.hintEl = el('div', { class: 'hint-zone' });
    this.metaEl = el('p', { class: 't-meta poster__meta' });
    this.wordEl = el('h1', { class: 't-display poster__word misprint' });
    this.ipaEl = el('p', { class: 't-ipa', 'style:margin': '0' });
    this.pronEl = el('div', { class: 'pron', hidden: true }, [
      this.ipaEl,
      speakButton(() =>
        this.spoken ? { text: this.spoken, lang: this.session.set.lang } : null,
      ),
    ]);
    this.extraEl = el('div');

    this.fieldEl = el('div', { class: 'field' }, [
      el('span', { class: 'field__marker', 'aria-hidden': 'true' }),
      this.input,
    ]);

    this.skipBtn = el('button', { class: 'chip', type: 'button' }, ['weiß ich nicht']);

    this.posterEl = el(
      'div',
      { class: 'poster paper paper--torn', 'style:--tilt': TILTS[0]! },
      [
        el('span', { class: 'tape tape--l', 'aria-hidden': 'true' }),
        el('span', { class: 'tape tape--r', 'aria-hidden': 'true' }),
        this.metaEl,
        this.wordEl,
        this.pronEl,
        el('div', { class: 'poster__gap', 'aria-hidden': 'true' }),
        this.hintEl,
        el('div', { class: 'row', 'style:justify-content': 'flex-end' }, [this.skipBtn]),
        this.fieldEl,
        this.extraEl,
      ],
    );

    this.bannerEl = el('div', { class: 'feedback feedback--empty' });

    this.root = el('section', { class: 'screen screen--play' }, [
      el('header', { class: 'topbar' }, [
        this.badgeEl,
        this.solvedEl,
        el('div', { class: 'spacer' }),
        this.comboEl,
        this.scoreEl,
        soundToggle,
      ]),
      el('div', { class: 'rail', 'style:padding': '0 var(--s-4) var(--s-2)' }, [
        this.railEl,
        this.chipEl,
      ]),
      el('div', { class: 'stage' }, [this.posterEl]),
      this.bannerEl,
    ]);

    this.bindInput();
    this.render();
  }

  // ------------------------------------------------------------------ Events

  private bindInput(): void {
    // Regel 2: locked wird synchron gesetzt, vor allem Asynchronen.
    this.input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') {
        if (e.key.length === 1) audio.key();
        return;
      }
      e.preventDefault();

      // Im Korrekturmodus entscheidet der Textabgleich, nicht Enter. Ohne
      // diesen Guard bewertete Enter hier die nächste, nie gezeigte Vokabel.
      if (this.phase === 'correcting') return;

      // Während der Erfolgsanimation kürzt Enter sie ab, statt blind zu werten.
      if (this.phase === 'judging') {
        if (this.locked) return;
        window.clearTimeout(this.timer);
        this.next();
        return;
      }

      if (this.locked) return; // doppeltes Enter
      this.locked = true;
      this.submit();
    });

    this.input.addEventListener('input', () => {
      if (this.phase === 'correcting') this.checkCorrection();
    });

    this.input.addEventListener('focus', () => this.fieldEl.classList.add('field--focus'));
    this.input.addEventListener('blur', () => this.fieldEl.classList.remove('field--focus'));

    // Regel 1: der gesamte Screen ist Refokus-Fläche. Geht die Tastatur zu,
    // reicht ein Tap irgendwo — kein Treffer auf ein 56px-Feld nötig.
    this.root.addEventListener('pointerdown', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('button, a, input')) return;
      this.input.focus(); // synchron, im Gesture-Kontext
    });

    this.skipBtn.addEventListener('click', () => {
      if (this.locked || this.phase !== 'idle') return;
      this.locked = true;
      this.input.focus();
      this.judge('wrong', '', true);
    });
  }

  /** Muss aus einem echten Click-Handler kommen (iOS-Tastatur). */
  focusInput(): void {
    this.input.focus();
  }

  /** Nachmessen, sobald das Plakat im DOM hängt oder sich die Höhe ändert. */
  refit(): void {
    this.fitWord();
  }

  // -------------------------------------------------------------- Bewertung

  private submit(): void {
    const word = this.session.current;
    if (!word) return;

    const raw = this.input.value;
    // Regel 3: sofort leeren. Wer schneller tippt als die Animation, verliert nichts.
    this.input.value = '';

    if (raw.trim() === '') {
      this.locked = false;
      const now = performance.now();
      if (now - this.lastEmptyEnter < 3000) {
        this.lastEmptyEnter = 0;
        this.locked = true;
        this.judge('wrong', '', true);
        return;
      }
      this.lastEmptyEnter = now;
      this.banner('empty', 'Tipp was — oder zweimal Enter, wenn du nicht weißt.');
      return;
    }

    audio.submit();
    const g = grade(raw, word, this.session.deck);
    this.judge(g.verdict, raw, false, g.solution, g.viaAlternative, g.diffIndex);
  }

  private judge(
    verdict: 'correct' | 'near' | 'wrong',
    typed: string,
    gaveUp = false,
    solution?: string,
    viaAlt?: string | null,
    diffIndex = -1,
  ): void {
    const word = this.session.current;
    if (!word) return;
    this.phase = 'judging';

    const sol = solution ?? word.en[0] ?? '';
    const result = this.session.answer(verdict);
    this.showPronunciation(word, sol);
    // Erst jetzt sprechen: vorher wäre die Aussprache die Lösung.
    if (verdict !== 'wrong') speech.speak(sol, this.session.set.lang);

    if (verdict === 'correct') {
      // Eine gerettete Vokabel ist der Moment, in dem gelernt wurde. Sie
      // bekommt eigenen Stempel, eigenen Text und einen volleren Klang.
      audio.correct(result.isRescue ? Math.max(result.combo, 7) : result.combo);
      this.fieldEl.className = 'field field--correct';
      this.stamp(word.id, result.isRescue);
      this.posterEl.classList.add('thunk');

      if (result.isRescue) {
        this.banner('correct', `Gerettet. +${result.points}`);
        announce(`Gerettet. ${result.points} Punkte.`);
      } else {
        const alt = viaAlt ? ` auch: ${word.en[0]}` : '';
        this.banner('correct', `${pick(STAMPS, word.id)}.${alt}`, undefined, `+${result.points}`);
        announce(`Richtig. ${result.points} Punkte.`);
      }
      this.bumpScore();
      this.after(result.isRescue ? T_RESCUE : T_CORRECT, T_UNLOCK);
      return;
    }

    if (verdict === 'near') {
      audio.nearMiss();
      this.fieldEl.className = 'field field--near';
      this.banner('near', `Fast — ${markDiff(sol, diffIndex)}`, typed, `+${result.points}`);
      this.bumpScore();
      announce(`Fast richtig. Korrekt ist: ${sol}.`);
      this.markMissed();
      this.after(T_NEAR, T_NEAR);
      return;
    }

    // wrong
    if (gaveUp) audio.submit();
    else audio.wrong();
    this.fieldEl.className = gaveUp ? 'field' : 'field field--wrong';
    if (!gaveUp) this.posterEl.classList.add('shake');
    this.banner(gaveUp ? 'near' : 'wrong', gaveUp ? 'Kein Problem. Einmal abtippen.' : pick(WRONG_LINES, word.id), typed);
    announce(`Leider falsch. Richtig ist: ${sol}. Bitte einmal abtippen.`);
    this.markMissed();

    // `word` mitgeben: answer() hat den Cursor schon weitergesetzt, session.current
    // wäre hier die nächste Vokabel — und ihr Beispielsatz ein Spoiler.
    this.timer = window.setTimeout(() => this.startCorrection(sol, word), T_WRONG);
  }

  private markMissed(): void {
    this.chipEl.hidden = false;
    this.chipEl.textContent = `Runde ${this.session.round + 1}: ${this.session.pendingCount}`;
    this.chipEl.classList.remove('stack-chip--pulse');
    void this.chipEl.offsetWidth; // Reflow, damit die Animation erneut startet
    this.chipEl.classList.add('stack-chip--pulse');

    // Onboarding ohne Tutorial: einmal im Leben der App, im Moment des Fliegens.
    if (!this.seenRules.firstMiss && !localStorage.getItem('ueberklebt.seen.miss')) {
      this.seenRules.firstMiss = true;
      try { localStorage.setItem('ueberklebt.seen.miss', '1'); } catch { /* private mode */ }
      window.setTimeout(() => this.banner('near', `Kommt in Runde ${this.session.round + 1} zurück.`), 900);
    }
  }

  // ----------------------------------------------------------- Korrekturmodus

  /**
   * Lösung kurz zeigen, dann zur Geisterspur verblassen lassen — abtippen aus
   * dem Kurzzeitgedächtnis statt abschreiben. "Zeig's mir" halten macht sie
   * jederzeit wieder sichtbar, damit nie eine Sackgasse entsteht.
   */
  private startCorrection(solution: string, word: Word): void {
    this.phase = 'correcting';
    this.locked = false;
    this.target = solution;

    const reveal = el('p', { class: 'ghost ghost__solution', text: solution });
    const peek = el('button', { class: 'chip', type: 'button' }, ["Zeig's mir"]);
    this.hintEl.replaceChildren(reveal, el('div', { class: 'row', 'style:margin-top': 'var(--s-2)' }, [peek]));

    // Der Beispielsatz aus dem Buch liegt ungenutzt in den Daten und gehört
    // genau hierhin: er macht aus Abtippen ein Verstehen.
    this.extraEl.replaceChildren();
    if (word.example) {
      this.extraEl.append(el('p', { class: 'example' }, [word.example]));
    }

    speech.speak(solution, this.session.set.lang);

    this.input.value = '';
    this.input.placeholder = 'abtippen';
    this.input.setAttribute('enterkeyhint', 'done');
    this.fieldEl.className = 'field';
    this.fitWord();
    this.input.focus();

    const ghost = () => {
      reveal.className = 'ghost';
      reveal.textContent = solution.replace(/\S+/g, (w) => w[0] + '•'.repeat(w.length - 1));
    };
    this.timer = window.setTimeout(ghost, T_REVEAL);

    const show = () => { reveal.className = 'ghost ghost__solution'; reveal.textContent = solution; };
    peek.addEventListener('pointerdown', show);
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) {
      peek.addEventListener(ev, () => { if (this.phase === 'correcting') ghost(); });
    }
  }

  /** Kein Enter nötig: sobald der Text stimmt, geht es weiter. */
  private checkCorrection(): void {
    const typed = this.input.value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (typed !== this.target.trim().toLowerCase()) return;

    window.clearTimeout(this.timer);
    audio.corrected();
    this.phase = 'judging';
    this.locked = true;
    this.fieldEl.className = 'field field--correct';
    this.banner('correct', 'Abgetippt.');
    announce('Abgetippt. Weiter.');
    this.input.placeholder = 'hier tippen';
    this.input.setAttribute('enterkeyhint', 'go');
    this.after(420, 420, true);
  }

  // ------------------------------------------------------------- Darstellung

  private after(total: number, unlockAt: number, clearField = false): void {
    if (clearField) this.input.value = '';
    window.setTimeout(() => { this.locked = false; }, unlockAt);
    this.timer = window.setTimeout(() => this.next(), total);
  }

  private next(): void {
    this.phase = 'idle';
    this.locked = false;
    this.extraEl.replaceChildren();
    this.hintEl.replaceChildren();
    this.fieldEl.className = 'field';
    this.posterEl.classList.remove('shake', 'thunk');
    this.posterEl.querySelector('.stamp')?.remove();

    if (this.session.waveFinished) {
      if (this.session.finished) this.handlers.onFinish();
      else this.handlers.onWaveEnd();
      return;
    }
    this.render();
    this.posterEl.classList.add('enter-up');
    window.setTimeout(() => this.posterEl.classList.remove('enter-up'), 200);
    this.input.focus();
  }

  /** Aktualisiert nur Inhalte — das Eingabefeld bleibt derselbe Knoten. */
  render(): void {
    const word = this.session.current;
    if (!word) return;

    this.posterEl.style.setProperty('--tilt', pick(TILTS, word.id));
    this.metaEl.textContent = word.hint;
    this.wordEl.textContent = word.de;
    this.wordEl.classList.toggle('poster__word--long', word.de.length > 16 && word.de.length <= 26);
    this.wordEl.classList.toggle('poster__word--xlong', word.de.length > 26);
    this.pronEl.hidden = true;
    this.spoken = null;
    this.badgeEl.textContent = `RUNDE ${this.session.round}`;
    this.banner('empty', `${this.session.set.langLabel} tippen, dann Enter.`);
    this.renderRail();
    this.scoreEl.textContent = String(this.session.score);
    this.comboEl.hidden = this.session.combo < 3;
    this.comboEl.textContent = `${this.session.combo}×`;
    this.fitWord();
  }

  /**
   * Schrumpf-Priorität: erst die Luft (das macht Flexbox), dann die Wortgröße.
   * Das Eingabefeld schrumpft nie — es muss über der Tastatur sichtbar bleiben.
   * Reines CSS reicht dafür nicht, weil die nötige Größe von Wortlänge UND
   * verfügbarer Höhe abhängt.
   */
  private fitWord(): void {
    const poster = this.posterEl;
    if (poster.clientHeight === 0) return; // noch nicht im DOM — später erneut

    poster.classList.remove('poster--tight');
    const fits = () => poster.scrollHeight <= poster.clientHeight;

    for (const step of [1, 0.88, 0.76, 0.64, 0.54, 0.46]) {
      this.wordEl.style.setProperty('--fit', String(step));
      if (fits()) return;
    }
    // Immer noch zu eng: Dekoration weg, bevor die Schrift unlesbar wird.
    poster.classList.add('poster--tight');
    for (const step of [0.64, 0.54, 0.46, 0.4]) {
      this.wordEl.style.setProperty('--fit', String(step));
      if (fits()) return;
    }
  }

  /**
   * Lautschrift und Lautsprecher erst nach der Auswertung — vorher wären sie
   * ein Spoiler. Ohne Stimme für diese Sprache bleibt es bei der Lautschrift.
   */
  private showPronunciation(word: Word, solution: string): void {
    this.spoken = solution;
    const canSpeak = speech.available(this.session.set.lang);
    if (!word.ipa && !canSpeak) return;

    this.ipaEl.textContent = word.ipa ? `[${word.ipa}]` : '';
    this.ipaEl.hidden = !word.ipa;
    this.pronEl.hidden = false;
    this.pronEl.classList.toggle('pron--mute', !canSpeak);
    this.fitWord();
  }

  private renderRail(): void {
    const wave = this.session.wave;
    const cursor = this.session.cursor;
    const segs = wave.map((id, i) => {
      let mod = '';
      if (i === cursor) mod = ' rail__seg--current';
      else if (i < cursor) {
        const v = this.session.verdictOf(id);
        mod = v === 'correct' ? ' rail__seg--ok' : v === 'near' ? ' rail__seg--near' : ' rail__seg--bad';
      }
      return el('span', { class: `rail__seg${mod}` });
    });
    this.railEl.replaceChildren(...segs);
    this.railEl.setAttribute('aria-label', 'Fortschritt in dieser Runde');
    this.railEl.setAttribute('aria-valuemin', '0');
    this.railEl.setAttribute('aria-valuenow', String(cursor));
    this.railEl.setAttribute('aria-valuemax', String(wave.length));
    this.railEl.setAttribute('aria-valuetext', `${cursor} von ${wave.length} in dieser Runde`);

    this.solvedEl.textContent = `${this.session.solvedCount}/${this.session.totalCount}`;
    if (this.session.pendingCount > 0) {
      this.chipEl.hidden = false;
      this.chipEl.textContent = `Runde ${this.session.round + 1}: ${this.session.pendingCount}`;
    }
  }

  private banner(
    kind: 'empty' | 'correct' | 'near' | 'wrong',
    text: string,
    typed?: string,
    points?: string,
  ): void {
    const glyph = kind === 'correct' ? 'check' : kind === 'near' ? 'tilde' : kind === 'wrong' ? 'cross' : null;
    this.bannerEl.className = `feedback feedback--${kind}${kind === 'empty' ? '' : ' feedback--in'}`;

    const nodes: Node[] = [];
    if (glyph) {
      const g = icon(glyph);
      g.classList.add('feedback__glyph');
      nodes.push(g);
    }
    nodes.push(el('span', {}, [text]));
    if (typed) {
      nodes.push(el('span', { 'style:opacity': '.75', 'style:font-weight': '500' }, [`du: ${typed}`]));
    }
    if (points) {
      nodes.push(el('span', { class: 'spacer' }));
      nodes.push(el('span', { class: 'banner-points' }, [points]));
    }
    this.bannerEl.replaceChildren(...nodes);
  }

  private stamp(seed: string, rescue = false): void {
    const s = el(
      'span',
      {
        class: rescue ? 'stamp stamp--rescue' : 'stamp',
        'style:--stamp-rot': rescue ? '-11deg' : pick(STAMP_ROTS, seed),
        'aria-hidden': 'true',
      },
      [rescue ? 'GERETTET' : pick(STAMPS, seed)],
    );
    this.posterEl.append(s);
  }

  /** Punktestand und Serie sichtbar machen — sonst existiert das Spiel nicht. */
  private bumpScore(): void {
    this.scoreEl.textContent = String(this.session.score);
    this.scoreEl.classList.remove('score--bump');
    void this.scoreEl.offsetWidth;
    this.scoreEl.classList.add('score--bump');

    const c = this.session.combo;
    this.comboEl.hidden = c < 3;
    this.comboEl.textContent = `${c}×`;
  }

  destroy(): void {
    window.clearTimeout(this.timer);
  }
}
