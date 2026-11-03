import { el } from '../dom';
import { soundToggle } from '../ui';
import { listen } from '../listen';
import { readMode, writeMode, type AnswerMode } from '../answerMode';
import type { WordSet } from '../types';

/**
 * Dieser Screen existiert aus einem technischen Grund: iOS gibt Tastatur und
 * AudioContext nur innerhalb einer echten Nutzergeste frei. Sein Button ist
 * der Unlock-Punkt für beides. Aus der Not wird ein sinnvoller Moment — und
 * der richtige Platz für die Frage, ob getippt oder gesprochen wird.
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

  let mode = readMode(set.id);
  const how = el('p', { class: 't-body', 'style:margin': '0', 'style:color': 'var(--c-chalk-muted)' });
  const setHow = () => {
    how.textContent =
      mode === 'speak'
        ? `Deutsch → ${set.langLabel} · Du sprichst die Antwort`
        : `Deutsch → ${set.langLabel} · Du tippst die Antwort`;
  };
  setHow();

  const children: (Node | string)[] = [
    el('div', { class: 'row' }, [el('div', { class: 'spacer' }), soundToggle()]),
    el('div', { class: 'spacer' }),
    el('p', { class: 't-meta', 'style:color': 'var(--c-chalk-muted)', 'style:margin': '0' }, [set.source]),
    el('h1', { class: 't-h1 misprint', 'style:margin': '0' }, [
      `${set.title} — ${count} ${count === 1 ? 'Vokabel' : 'Vokabeln'}`,
    ]),
    how,
  ];

  // Die Wahl erscheint nur, wo sie etwas bewirkt: Spracherkennung gibt es
  // nicht in jedem Browser, und einmal verweigert bleibt sie verweigert.
  if (listen.supported && !listen.denied) {
    const pick = (m: AnswerMode, label: string) => {
      const b = el('button', {
        class: 'chip',
        type: 'button',
        'aria-pressed': String(mode === m),
      }, [label]);
      b.addEventListener('click', () => {
        mode = m;
        writeMode(set.id, m);
        setHow();
        for (const other of [...b.parentElement!.children]) {
          other.setAttribute('aria-pressed', String(other === b));
          other.classList.toggle('chip--on', other === b);
        }
      });
      b.classList.toggle('chip--on', mode === m);
      return b;
    };
    children.push(
      el('div', { class: 'row', 'style:margin-top': 'var(--s-2)' }, [
        pick('type', 'Tippen'),
        pick('speak', 'Sprechen'),
      ]),
    );
  }

  children.push(el('div', { class: 'spacer' }), go);

  return el('section', { class: 'screen' }, children);
}
