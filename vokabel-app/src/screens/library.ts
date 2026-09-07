import { el } from '../dom';
import { soundToggle, speechToggle } from '../ui';
import { Session } from '../state';
import { formatDay, type LibraryEntry } from '../library';

/**
 * Die Bibliothek. Sie sortiert nach Datum, weil Vokabellisten so entstehen:
 * eine pro Woche, die neueste ist die, die drankommt. Der Titel steht groß,
 * das Datum darüber — gesucht wird nach "die von Montag".
 */
export function libraryScreen(
  entries: LibraryEntry[],
  handlers: {
    onPick(id: string): void;
    onAdd(): void;
    onDelete(id: string): void;
  },
): HTMLElement {
  const card = (entry: LibraryEntry): HTMLElement => {
    const { set } = entry;
    const saved = Session.restore(set);

    const stamp = entry.addedAt
      ? `hinzugefügt ${formatDay(entry.addedAt)}`
      : entry.lastPlayedAt
        ? `zuletzt ${formatDay(entry.lastPlayedAt)}`
        : 'mitgeliefert';

    const open = el('button', { class: 'set-card__main', type: 'button' }, [
      el('span', { class: 't-meta set-card__date' }, [stamp]),
      el('span', { class: 'set-card__title' }, [set.title]),
      el('span', { class: 't-meta set-card__meta' }, [
        [`${set.words.length} Wörter`, set.langLabel, set.source].filter(Boolean).join(' · '),
      ]),
      saved
        ? el('span', { class: 'set-card__resume' }, [
            `Angefangen — Runde ${saved.round}, noch ${saved.wave.length - saved.cursor}`,
          ])
        : null,
    ]);
    open.addEventListener('click', () => handlers.onPick(set.id));

    const children: (HTMLElement | null)[] = [open];

    if (!entry.builtin) {
      // Löschen ist endgültig (Liste, Stand und Bestwerte) — also zweistufig.
      const del = el('button', { class: 'chip set-card__del', type: 'button' }, ['löschen']);
      let armed = false;
      del.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          del.textContent = 'Wirklich löschen?';
          window.setTimeout(() => {
            armed = false;
            del.textContent = 'löschen';
          }, 4000);
          return;
        }
        handlers.onDelete(set.id);
      });
      children.push(del);
    }

    return el('div', { class: 'set-card paper' }, children);
  };

  const add = el('button', { class: 'btn btn--primary', type: 'button' }, ['Neue Liste hinzufügen']);
  add.addEventListener('click', handlers.onAdd);

  return el('section', { class: 'screen' }, [
    el('div', { class: 'row' }, [
      el('div', { class: 'spacer' }),
      speechToggle(entries[0]?.set.lang ?? 'en-GB'),
      soundToggle(),
    ]),
    el('h1', { class: 'wordmark wordmark--sm' }, ['Über-', el('br'), 'klebt']),
    el('p', { class: 't-h2', 'style:color': 'var(--c-chalk-muted)', 'style:margin': '0' }, [
      `Deine Listen · ${entries.length}`,
    ]),
    el('div', { class: 'stack scroll-y', 'style:flex': '1', 'style:gap': 'var(--s-3)' }, [
      ...entries.map(card),
      entries.length <= 1
        ? el('p', { class: 't-body', 'style:color': 'var(--c-chalk-muted)' }, [
            'Neue Liste heißt: Buchseite abtippen lassen, Datei hier rein. Jede Liste bleibt einzeln gespeichert — mit Datum, Stand und Bestwerten.',
          ])
        : null,
    ]),
    add,
  ]);
}
