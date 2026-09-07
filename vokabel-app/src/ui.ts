import { el, icon } from './dom';
import { audio } from './audio';
import { speech } from './speech';

/** Sound-Kippschalter. Mutet alles — wer auf Mute drückt, will Ruhe, nicht Teilruhe. */
export function soundToggle(): HTMLElement {
  const track = el('span', { class: 'toggle__track' }, [el('span', { class: 'toggle__knob' })]);
  const label = el('span', { class: 'toggle__label' });
  const btn = el('button', { class: 'toggle', type: 'button', role: 'switch' }, [track, label]);

  const sync = () => {
    const on = !audio.muted;
    btn.setAttribute('aria-checked', String(on));
    btn.setAttribute('aria-label', on ? 'Ton ausschalten' : 'Ton einschalten');
    label.textContent = on ? 'Ton an' : 'Ton aus';
  };

  btn.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    sync();
    if (audio.muted) speech.cancel();
    else audio.correct(1); // Bestätigung, dass es funktioniert
  });

  sync();
  return btn;
}

/**
 * Kippschalter für die Sprachausgabe. Getrennt vom Ton, weil beides
 * unterschiedliche Gründe hat: Sounds nerven im Bus, die Aussprache ist genau
 * dort besonders nützlich (mit Kopfhörern). Ohne Stimme auf dem Gerät gibt es
 * den Schalter nicht — ein toter Schalter ist schlimmer als keiner.
 */
export function speechToggle(lang: string): HTMLElement | null {
  if (!speech.supported) return null;

  const track = el('span', { class: 'toggle__track' }, [el('span', { class: 'toggle__knob' })]);
  const label = el('span', { class: 'toggle__label' });
  const btn = el('button', { class: 'toggle', type: 'button', role: 'switch' }, [track, label]);

  const sync = () => {
    // Die Stimmenliste kommt in Chrome erst nach dem ersten Rendern.
    btn.hidden = !speech.available(lang);
    btn.setAttribute('aria-checked', String(speech.enabled));
    btn.setAttribute('aria-label', speech.enabled ? 'Aussprache ausschalten' : 'Aussprache einschalten');
    label.textContent = 'Aussprache';
  };

  btn.addEventListener('click', () => {
    speech.setEnabled(!speech.enabled);
    sync();
  });

  sync();
  speech.whenReady(sync);
  return btn;
}

/**
 * Lautsprecher zum Nachhören.
 *
 * `pointerdown` mit preventDefault, nicht `click`: sonst nimmt der Knopf dem
 * Eingabefeld den Fokus und iOS klappt die Tastatur zu (siehe Regel 1 in
 * screens/play.ts). Der zusätzliche click-Handler ist für die Tastatur da,
 * ein Zeitfenster verhindert die doppelte Ausgabe.
 */
export function speakButton(
  get: () => { text: string; lang: string } | null,
  label = 'nochmal hören',
): HTMLButtonElement {
  const btn = el('button', { class: 'speak', type: 'button', 'aria-label': `${label} — Aussprache` }, [
    glyph('sound', 'speak__glyph'),
    el('span', { class: 'speak__label' }, [label]),
  ]);

  let last = 0;
  const fire = () => {
    const now = performance.now();
    if (now - last < 500) return;
    last = now;
    const target = get();
    if (!target) return;
    speech.speak(target.text, target.lang, { slowOnRepeat: true });
  };

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); // Fokus bleibt im Eingabefeld
    fire();
  });
  btn.addEventListener('click', fire);
  return btn;
}

export function glyph(name: Parameters<typeof icon>[0], cls = ''): SVGSVGElement {
  const g = icon(name);
  if (cls) g.classList.add(cls);
  return g;
}
