import { el, icon } from './dom';
import { audio } from './audio';

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
    if (!audio.muted) audio.correct(1); // Bestätigung, dass es funktioniert
  });

  sync();
  return btn;
}

export function logoSlot(size: 'sm' | 'lg'): HTMLElement {
  return el('div', { class: `logo-slot logo-slot--${size}` });
}

export function glyph(name: Parameters<typeof icon>[0], cls = ''): SVGSVGElement {
  const g = icon(name);
  if (cls) g.classList.add(cls);
  return g;
}
