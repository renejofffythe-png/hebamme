import { el } from '../dom';
import { soundToggle, speechToggle } from '../ui';
import type { WordSet } from '../types';
import type { Records } from '../records';
import { formatDate } from '../library';

export function startScreen(
  set: WordSet,
  records: Records,
  resume: { round: number; open: number } | null,
  onStart: (fresh: boolean) => void,
  onLibrary: (() => void) | null,
): HTMLElement {
  const record = (value: string, label: string) =>
    el('div', { class: 'record' }, [
      el('span', { class: 'record__value' }, [value]),
      el('span', { class: 'record__label' }, [label]),
    ]);

  const hasRecords = records.sessions > 0;

  const actions: HTMLElement[] = [];
  if (resume) {
    const cont = el('button', { class: 'btn btn--primary', type: 'button' }, [
      `Weiter — Runde ${resume.round}, noch ${resume.open}`,
    ]);
    cont.addEventListener('click', () => onStart(false));

    // Eine laufende Session zu verwerfen ist nicht umkehrbar — einmal nachfragen.
    const fresh = el('button', { class: 'btn btn--secondary', type: 'button' }, ['Neu anfangen']);
    let armed = false;
    fresh.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        fresh.textContent = 'Wirklich? Der Stand geht verloren';
        window.setTimeout(() => {
          armed = false;
          fresh.textContent = 'Neu anfangen';
        }, 4000);
        return;
      }
      onStart(true);
    });
    actions.push(cont, fresh);
  } else {
    const go = el('button', { class: 'btn btn--primary', type: 'button' }, ['Loslegen']);
    go.addEventListener('click', () => onStart(true));
    actions.push(go);
  }

  const toLibrary = onLibrary
    ? el('button', { class: 'chip chip--wall', type: 'button' }, ['Listen'])
    : null;
  toLibrary?.addEventListener('click', onLibrary!);

  return el('section', { class: 'screen' }, [
    el('div', { class: 'row' }, [
      toLibrary,
      el('div', { class: 'spacer' }),
      speechToggle(set.lang),
      soundToggle(),
    ].filter((n) => n !== null)),
    el('h1', { class: 'wordmark' }, ['Über-', el('br'), 'klebt']),
    el('p', { class: 't-body', 'style:max-width': '28em', 'style:margin': '0' }, [
      `Deutsch rein, ${set.langLabel} raus. ${set.words.length} ${
        set.words.length === 1 ? 'Wort' : 'Wörter'
      }, danach hast du frei.`,
    ]),

    el('div', { class: 'set-strip paper', 'style:cursor': 'default', 'style:transform': 'rotate(-1deg)' }, [
      el('span', { class: 'stack', 'style:gap': '2px' }, [
        el('span', { class: 't-meta', 'style:color': 'var(--c-ink-muted)' }, [
          [set.source, set.addedAt ? formatDate(set.addedAt) : null].filter(Boolean).join(' · '),
        ]),
        el('span', { 'style:font-weight': '700', 'style:font-size': '17px' }, [set.title]),
      ]),
      el('span', { class: 'set-strip__num' }, [String(set.words.length)]),
    ]),

    hasRecords
      ? el('div', { class: 'records' }, [
          record(String(records.bestScore), 'Bestwert'),
          record(String(records.fewestRounds), records.fewestRounds === 1 ? 'Runde' : 'Runden'),
          record(String(records.longestStreak), 'Serie'),
          record(String(records.sessions), records.sessions === 1 ? 'Session' : 'Sessions'),
        ])
      : null,

    // Angeschnittene Schablonenschrift als Wandtextur — die einzige
    // "Illustration" des Screens, und sie kostet kein einziges Asset.
    el('div', { class: 'spacer wall-word', 'aria-hidden': 'true' }, [
      el('span', {}, ['Kiez']),
    ]),
    el('div', { class: 'stack' }, actions),
  ]);
}
