import { el } from '../dom';
import { logoSlot, soundToggle } from '../ui';
import type { WordSet } from '../types';

export function startScreen(
  set: WordSet,
  resume: { round: number; open: number } | null,
  onStart: (fresh: boolean) => void,
): HTMLElement {
  const strip = el('button', { class: 'set-strip paper', type: 'button' }, [
    el('span', { class: 'stack', 'style:gap': '2px' }, [
      el('span', { class: 't-meta', 'style:color': 'var(--c-ink-muted)' }, [set.source]),
      el('span', { 'style:font-weight': '700', 'style:font-size': '17px' }, [set.title]),
    ]),
    el('span', { class: 'set-strip__num' }, [String(set.words.length)]),
  ]);
  strip.addEventListener('click', () => onStart(true));

  const actions: Node[] = [];
  if (resume) {
    const cont = el('button', { class: 'btn btn--primary', type: 'button' }, [
      `Weiter — Runde ${resume.round}, noch ${resume.open}`,
    ]);
    cont.addEventListener('click', () => onStart(false));
    const fresh = el('button', { class: 'btn btn--secondary', type: 'button' }, ['Neu anfangen']);
    fresh.addEventListener('click', () => onStart(true));
    actions.push(cont, fresh);
  } else {
    const go = el('button', { class: 'btn btn--primary', type: 'button' }, ['Loslegen']);
    go.addEventListener('click', () => onStart(true));
    actions.push(go);
  }

  return el('section', { class: 'screen' }, [
    el('div', { class: 'row' }, [logoSlot('lg'), el('div', { class: 'spacer' }), soundToggle()]),
    el('h1', { class: 'wordmark' }, ['Über-', el('br'), 'klebt']),
    el('p', { class: 't-body', 'style:max-width': '28em', 'style:margin': '0' }, [
      `Deutsch rein, Englisch raus. ${set.words.length} Wörter, danach hast du frei.`,
    ]),
    strip,
    el('div', { class: 'spacer' }),
    el('div', { class: 'stack' }, actions),
  ]);
}
