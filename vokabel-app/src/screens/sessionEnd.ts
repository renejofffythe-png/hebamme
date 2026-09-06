import { el } from '../dom';
import type { Session } from '../state';
import type { Records } from '../records';

/** Der Beleg. Das einzige Element der App, das gerade hängt. */
export function sessionEndScreen(
  session: Session,
  records: Records,
  beaten: Array<'score' | 'rounds' | 'streak'>,
  onAgain: (onlyShaky: boolean) => void,
  onHome: () => void,
): HTMLElement {
  const total = session.totalCount;
  const rounds = session.round;
  const shaky = session.shaky;
  const minutes = Math.max(1, Math.round(session.elapsedMs / 60000));
  const verdict = rounds === 1 ? 'STARK' : rounds <= 2 ? 'GEHT KLAR' : 'WEITERMACHEN';

  const line = (label: string, value: string, note?: string) =>
    el('div', { class: 'stack', 'style:gap': '0' }, [
      el('div', { class: 'receipt-line' }, [
        el('span', { class: 't-meta', 'style:color': 'var(--c-ink-muted)' }, [label]),
        el('span', { class: 'receipt-line__lead' }),
        el('span', { 'style:font-weight': '700' }, [value]),
      ]),
      note ? el('span', { class: 'receipt-note' }, [note]) : null,
    ]);

  // Nur zeigen, was auch passiert ist. Nullen auf einem Beleg lesen sich wie
  // "nichts erreicht".
  const stats: (HTMLElement | null)[] = [
    line(
      'Punkte',
      String(session.score),
      beaten.includes('score') ? 'Neuer Bestwert' : `Dein Bestwert: ${records.bestScore}`,
    ),
    line(
      'Längste Serie',
      String(session.bestCombo),
      beaten.includes('streak') ? 'Neuer Bestwert' : `Dein Bestwert: ${records.longestStreak}`,
    ),
    session.rescues > 0
      ? line('Gerettet', String(session.rescues), 'Beim zweiten Anlauf gesessen — das zählt am meisten')
      : null,
    line(
      'Runden gebraucht',
      String(rounds),
      beaten.includes('rounds') ? 'So wenige wie nie' : `Dein Bestwert: ${records.fewestRounds}`,
    ),
  ];

  const again = el('button', { class: 'btn btn--primary', type: 'button' }, ['Nochmal — alle']);
  again.addEventListener('click', () => onAgain(false));
  const only = shaky.length
    ? el('button', { class: 'btn btn--primary', type: 'button' }, [
        `Die ${shaky.length} Wackelkandidaten nochmal`,
      ])
    : null;
  only?.addEventListener('click', () => onAgain(true));
  if (only) again.className = 'btn btn--secondary';
  const home = el('button', { class: 'btn btn--secondary', type: 'button' }, ['Fertig']);
  home.addEventListener('click', onHome);

  return el('section', { class: 'screen' }, [
    el('div', { class: 'paper paper--stub scroll-y', 'style:padding': 'var(--s-6) var(--s-5)', 'style:flex': '1' }, [
      el('p', { class: 't-meta', 'style:color': 'var(--c-ink-muted)', 'style:margin': '0' }, [
        `Geschafft · ${session.set.title} · ${minutes} min`,
      ]),
      el('div', { class: 'row', 'style:align-items': 'center', 'style:gap': 'var(--s-4)' }, [
        el('span', { class: 't-num misprint' }, [`${total}/${total}`]),
        el('span', { class: 'stamp stamp--final', 'style:position': 'static', 'style:--stamp-rot': '-6deg' }, [verdict]),
      ]),
      el('hr', { class: 'perf' }),
      ...stats,
      el('hr', { class: 'perf' }),
      shaky.length
        ? el('p', { class: 't-meta', 'style:color': 'var(--c-ink-muted)', 'style:margin': '0' }, [
            'Die haben dich beschäftigt',
          ])
        : el('p', { class: 'closing' }, [
            rounds === 1
              ? 'Kein einziges Wort hat dich erwischt. Einmal durch, alles gesessen.'
              : 'Am Ende saß jedes Wort. Genau darum geht die zweite Runde.',
          ]),
      ...shaky.slice(0, 12).map((w) =>
        el('div', { class: 'stack', 'style:gap': '0', 'style:margin-top': 'var(--s-2)' }, [
          el('div', { class: 'receipt-line' }, [
            el('span', { 'style:font-weight': '700' }, [w.de]),
            el('span', { class: 'receipt-line__lead' }),
            el('span', {}, [w.en.join(' / ')]),
          ]),
          w.ipa ? el('span', { class: 't-ipa' }, [`[${w.ipa}]`]) : null,
        ]),
      ),
      records.sessions > 1
        ? el('p', { class: 'receipt-note', 'style:margin-top': 'var(--s-4)' }, [
            `${records.sessions}. Session mit diesem Set.`,
          ])
        : null,
    ]),
    el('div', { class: 'stack' }, [only, again, home].filter((n) => n !== null)),
  ]);
}
