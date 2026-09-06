import { el, icon, announce, pick } from '../dom';
import { audio } from '../audio';
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

const T_CORRECT = 260;
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
  private fieldEl: HTMLElement;
  private extraEl: HTMLElement;
  private bannerEl: HTMLElement;
  private railEl: HTMLElement;
  private countEl: HTMLElement;
  private chipEl: HTMLElement;
  private badgeEl: HTMLElement;
  private solvedEl: HTMLElement;
  private skipBtn: HTMLButtonElement;

  /** Nur im Korrekturmodus gesetzt: die Lösung, die abgetippt werden muss. */
  private target = '';
  private seenRules = { firstMiss: false };

  constructor(session: Session, handlers: PlayHandlers, soundToggle: HTMLElement) {
    this.session = session;
    this.handlers = handlers;

    this.input = el('input', {
      class: 'field__input',
      type: 'text',
      inputmode: 'text',
      lang: 'en',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      autocomplete: 'off',
      name: `answer-${Math.random().toString(36).slice(2)}`,
      enterkeyhint: 'go',
      'data-1p-ignore': 'true',
      'data-lpignore': 'true',
      'aria-label': 'Englische Übersetzung eingeben',
      placeholder: 'hier tippen',
    });

    this.badgeEl = el('span', { class: 'round-badge t-stencil', text: `RUNDE ${session.round}` });
    this.solvedEl = el('span', { class: 't-meta rail__count' });
    this.countEl = el('span', { class: 't-meta rail__count' });
    this.chipEl = el('span', { class: 'stack-chip', hidden: true });
    this.railEl = el('div', { class: 'rail__segments', role: 'progressbar' });

    this.metaEl = el('p', { class: 't-meta poster__meta' });
    this.wordEl = el('h1', { class: 't-display poster__word misprint' });
    this.ipaEl = el('p', { class: 't-ipa', hidden: true });
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
        this.ipaEl,
        el('div', { class: 'poster__gap', 'aria-hidden': 'true' }),
        el('div', { class: 'row', 'style:justify-content': 'flex-end' }, [this.skipBtn]),
        this.fieldEl,
        this.extraEl,
      ],
    );

    this.bannerEl = el('div', { class: 'feedback feedback--empty' });

    this.root = el('section', { class: 'screen screen--play' }, [
      el('header', { class: 'topbar' }, [
        el('div', { class: 'logo-slot logo-slot--sm' }),
        this.badgeEl,
        this.solvedEl,
        el('div', { class: 'spacer' }),
        soundToggle,
      ]),
      el('div', { class: 'rail', 'style:padding': '0 var(--s-4) var(--s-2)' }, [
        this.countEl,
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

  // -------------------------------------------------------------- Bewertung

  private submit(): void {
    const word = this.session.current;
    if (!word) return;

    const raw = this.input.value;
    // Regel 3: sofort leeren. Wer schneller tippt als die Animation, verliert nichts.
    this.input.value = '';

    if (raw.trim() === '') {
      this.locked = false;
      this.banner('empty', 'Tipp was — oder „weiß ich nicht".');
      return;
    }

    audio.submit();
    const g = grade(raw, word, this.session.deck);
    this.judge(g.verdict, raw, false, g.solution, g.viaAlternative);
  }

  private judge(
    verdict: 'correct' | 'near' | 'wrong',
    typed: string,
    gaveUp = false,
    solution?: string,
    viaAlt?: string | null,
  ): void {
    const word = this.session.current;
    if (!word) return;
    this.phase = 'judging';

    const sol = solution ?? word.en[0] ?? '';
    const result = this.session.answer(verdict);
    this.showIpa(word);

    if (verdict === 'correct') {
      audio.correct(result.combo);
      this.fieldEl.className = 'field field--correct';
      this.stamp(word.id);
      this.posterEl.classList.add('thunk');
      const alt = viaAlt ? ` auch: ${word.en[0]}` : '';
      this.banner('correct', `${pick(STAMPS, word.id)}.${alt}`);
      announce(`Richtig. ${result.points} Punkte.`);
      this.after(T_CORRECT, T_UNLOCK);
      return;
    }

    if (verdict === 'near') {
      audio.nearMiss();
      this.fieldEl.className = 'field field--near';
      this.banner('near', `Fast. Es heißt: ${sol}`, typed);
      announce(`Fast richtig. Korrekt ist: ${sol}.`);
      this.markMissed();
      this.after(T_NEAR, T_NEAR);
      return;
    }

    // wrong
    audio.wrong();
    this.fieldEl.className = 'field field--wrong';
    if (!gaveUp) this.posterEl.classList.add('shake');
    this.banner('wrong', gaveUp ? 'Kein Problem. Einmal abtippen.' : pick(WRONG_LINES, word.id), typed);
    announce(`Leider falsch. Richtig ist: ${sol}. Bitte einmal abtippen.`);
    this.markMissed();

    this.timer = window.setTimeout(() => this.startCorrection(sol), T_WRONG);
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
  private startCorrection(solution: string): void {
    this.phase = 'correcting';
    this.locked = false;
    this.target = solution;

    const reveal = el('p', { class: 'ghost ghost__solution', text: solution });
    const peek = el('button', { class: 'chip', type: 'button' }, ["Zeig's mir"]);
    this.extraEl.replaceChildren(reveal, el('div', { class: 'row', 'style:margin-top': 'var(--s-2)' }, [peek]));

    this.input.placeholder = 'abtippen';
    this.input.setAttribute('enterkeyhint', 'done');
    this.fieldEl.className = 'field';
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
    this.after(420, 420);
  }

  // ------------------------------------------------------------- Darstellung

  private after(total: number, unlockAt: number): void {
    window.setTimeout(() => { this.locked = false; }, unlockAt);
    this.timer = window.setTimeout(() => this.next(), total);
  }

  private next(): void {
    this.phase = 'idle';
    this.locked = false;
    this.input.value = '';
    this.extraEl.replaceChildren();
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
    this.ipaEl.hidden = true;
    this.badgeEl.textContent = `RUNDE ${this.session.round}`;
    this.banner('empty', 'Englisch tippen, dann Enter.');
    this.renderRail();
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
    for (const step of [1, 0.88, 0.76, 0.64, 0.54, 0.46]) {
      this.wordEl.style.setProperty('--fit', String(step));
      if (poster.scrollHeight <= poster.clientHeight) return;
    }
  }

  /** Lautschrift erst nach der Auswertung — vorher wäre sie ein Spoiler. */
  private showIpa(word: Word): void {
    if (!word.ipa) return;
    this.ipaEl.textContent = `[${word.ipa}]`;
    this.ipaEl.hidden = false;
    this.fitWord();
  }

  private renderRail(): void {
    const wave = this.session.wave;
    const cursor = this.session.cursor;
    const segs = wave.map((_, i) =>
      el('span', { class: `rail__seg${i < cursor ? ' rail__seg--ok' : i === cursor ? ' rail__seg--current' : ''}` }),
    );
    this.railEl.replaceChildren(...segs);
    this.railEl.setAttribute('aria-valuenow', String(cursor));
    this.railEl.setAttribute('aria-valuemax', String(wave.length));
    this.railEl.setAttribute('aria-valuetext', `${cursor} von ${wave.length} in dieser Runde`);

    this.countEl.textContent = `${String(cursor).padStart(2, '0')}/${wave.length}`;
    this.solvedEl.textContent = `sitzt ${this.session.solvedCount}/${this.session.totalCount}`;
    if (this.session.pendingCount > 0) {
      this.chipEl.hidden = false;
      this.chipEl.textContent = `Runde ${this.session.round + 1}: ${this.session.pendingCount}`;
    }
  }

  private banner(kind: 'empty' | 'correct' | 'near' | 'wrong', text: string, typed?: string): void {
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
    this.bannerEl.replaceChildren(...nodes);
  }

  private stamp(seed: string): void {
    const s = el('span', { class: 'stamp', 'style:--stamp-rot': pick(STAMP_ROTS, seed), 'aria-hidden': 'true' }, [
      pick(STAMPS, seed),
    ]);
    this.posterEl.append(s);
  }

  destroy(): void {
    window.clearTimeout(this.timer);
  }
}
