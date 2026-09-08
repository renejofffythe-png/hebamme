import { el } from '../dom';
import { soundToggle } from '../ui';
import type { WordSet } from '../types';

/**
 * Dieser Screen existiert aus einem technischen Grund: iOS gibt Tastatur und
 * AudioContext nur innerhalb einer echten Nutzergeste frei. Sein Button ist
 * der Unlock-Punkt für beides. Aus der Not wird ein sinnvoller Moment.
 */
export function briefingScreen(
  set: WordSet,
  round: number,
  count: number,
  onGo: () => void,
): HTMLElement {
  const go = el('button', { class: 'btn btn--primary', type: 'button' }, [
    round === 1 ? `Runde 1 — los` : `Runde ${round} — ${count} Wörter`,
  ]);
  go.addEventListener('click', onGo);

  return el('section', { class: 'screen' }, [
    el('div', { class: 'row' }, [el('div', { class: 'spacer' }), soundToggle()]),
    el('div', { class: 'spacer' }),
    el('p', { class: 't-meta', 'style:color': 'var(--c-chalk-muted)', 'style:margin': '0' }, [set.source]),
    el('h1', { class: 't-h1 misprint', 'style:margin': '0' }, [
      `${set.title} — ${count} ${count === 1 ? 'Vokabel' : 'Vokabeln'}`,
    ]),
    el('p', { class: 't-body', 'style:margin': '0', 'style:color': 'var(--c-chalk-muted)' }, [
      `Deutsch → ${set.langLabel} · Du tippst die Antwort`,
    ]),
    el('div', { class: 'spacer' }),
    go,
  ]);
}
