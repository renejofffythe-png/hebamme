import { el } from '../dom';
import { soundToggle, speechToggle } from '../ui';
import { Session } from '../state';
import { formatDay, groupEntries, type LibraryEntry } from '../library';

/**
 * Die Bibliothek. Sie gruppiert nach Sprache — Französisch, Englisch, Papas
 * Vokabeln —, weil zuerst nach dem Fach gesucht wird und dann nach dem Tag.
 * Innerhalb einer Gruppe bleibt die Reihenfolge der Sammlung: Wackelkandidaten,
 * eigene Listen (neueste zuerst), dann die mitgelieferten in Buchreihenfolge.
 * Der Titel steht groß, das Datum darüber — gesucht wird nach "die von Montag".
 */
export function libraryScreen(
  entries: LibraryEntry[],
  handlers: {
    onPick(id: string): void;
    onAdd(): void;
    onDelete(id: string): void;
    onStats(): void;
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
        [
          `${set.words.length} ${set.words.length === 1 ? 'Wort' : 'Wörter'}`,
          set.langLabel,
          set.source,
        ]
          .filter(Boolean)
          .join(' · '),
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

  const groups = groupEntries(entries).map((g, i) => ({ ...g, anchor: `gruppe-${i}` }));

  const jump = groups.length > 1
    ? el('div', { class: 'row', 'style:gap': 'var(--s-2)', 'style:flex-wrap': 'wrap' },
        groups.map((g) => {
          const chip = el('button', { class: 'chip chip--wall', type: 'button' }, [`${g.short} · ${g.entries.length}`]);
          chip.addEventListener('click', () =>
            document.getElementById(g.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
          );
          return chip;
        }))
    : null;

  const sections = groups.flatMap((g) => [
    groups.length > 1
      ? el('h2', { class: 't-h2', id: g.anchor, 'style:color': 'var(--c-chalk-muted)', 'style:margin': 'var(--s-3) 0 0' }, [
          `${g.label} · ${g.entries.length}`,
        ])
      : null,
    ...g.entries.map(card),
  ]);

  const add = el('button', { class: 'btn btn--primary', type: 'button' }, ['Neue Liste hinzufügen']);
  add.addEventListener('click', handlers.onAdd);

  const stats = el('button', { class: 'chip chip--wall', type: 'button' }, ['Statistik']);
  stats.addEventListener('click', handlers.onStats);

  return el('section', { class: 'screen' }, [
    el('div', { class: 'row' }, [
      stats,
      el('div', { class: 'spacer' }),
      speechToggle(entries[0]?.set.lang ?? 'en-GB'),
      soundToggle(),
    ]),
    el('h1', { class: 'wordmark wordmark--sm' }, ['Über-', el('br'), 'klebt']),
    el('p', { class: 't-h2', 'style:color': 'var(--c-chalk-muted)', 'style:margin': '0' }, [
      `Deine Listen · ${entries.length}`,
    ]),
    jump,
    el('div', { class: 'stack scroll-y', 'style:flex': '1', 'style:gap': 'var(--s-3)' }, [
      ...sections,
      entries.length <= 1
        ? el('p', { class: 't-body', 'style:color': 'var(--c-chalk-muted)' }, [
            'Neue Liste heißt: Buchseite abtippen lassen, Datei hier rein. Jede Liste bleibt einzeln gespeichert — mit Datum, Stand und Bestwerten.',
          ])
        : null,
    ]),
    add,
  ]);
}
