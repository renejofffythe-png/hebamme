import { el } from '../dom';
import type { Session } from '../state';

/** Der Beleg. Das einzige Element der App, das gerade hängt. */
export function sessionEndScreen(
  session: Session,
  onAgain: (onlyShaky: boolean) => void,
  onHome: () => void,
): HTMLElement {
  const total = session.totalCount;
  const rounds = session.round;
  const shaky = session.shaky;
  const minutes = Math.max(1, Math.round(session.elapsedMs / 60000));

  const verdict = rounds === 1 ? 'STARK' : rounds <= 2 ? 'GEHT KLAR' : 'WEITERMACHEN';

  const lines: [string, string][] = [
    ['Längste Serie', String(session.bestCombo)],
    ['Gerettet', String(session.rescues)],
    ['Fast richtig', String(session.nearMisses)],
    ['Runden gebraucht', String(rounds)],
  ];

  const again = el('button', { class: 'btn btn--primary', type: 'button' }, ['Nochmal — alle']);
  again.addEventListener('click', () => onAgain(false));
  const only = shaky.length
    ? el('button', { class: 'btn btn--secondary', type: 'button' }, [
        `Nur die Wackelkandidaten (${shaky.length})`,
      ])
    : null;
  only?.addEventListener('click', () => onAgain(true));
  const home = el('button', { class: 'btn btn--secondary', type: 'button' }, ['Fertig']);
  home.addEventListener('click', onHome);

  return el('section', { class: 'screen' }, [
    el('div', { class: 'paper paper--stub scroll-y', 'style:padding': 'var(--s-6) var(--s-5)', 'style:flex': '1' }, [
      el('p', { class: 't-meta', 'style:color': 'var(--c-ink-muted)', 'style:margin': '0' }, [
        `Geschafft · ${session.set.title} · ${minutes} min`,
      ]),
      el('div', { class: 'row', 'style:align-items': 'flex-start', 'style:gap': 'var(--s-4)' }, [
        el('span', { class: 't-num misprint' }, [`${total}/${total}`]),
        el('span', { class: 'stamp', 'style:position': 'static', 'style:--stamp-rot': '-6deg' }, [verdict]),
      ]),
      el('p', { class: 't-meta', 'style:color': 'var(--c-ink-muted)', 'style:margin': '0' }, [
        `${session.score} Punkte`,
      ]),
      el('hr', { class: 'perf' }),
      ...lines.map(([k, v]) =>
        el('div', { class: 'receipt-line' }, [
          el('span', { class: 't-meta', 'style:color': 'var(--c-ink-muted)' }, [k]),
          el('span', { class: 'receipt-line__lead' }),
          el('span', { 'style:font-weight': '700' }, [v]),
        ]),
      ),
      shaky.length ? el('hr', { class: 'perf' }) : null,
      shaky.length
        ? el('p', { class: 't-meta', 'style:color': 'var(--c-ink-muted)', 'style:margin': '0' }, ['Wackelkandidaten'])
        : null,
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
    ]),
    el('div', { class: 'stack' }, [again, only, home].filter((n) => n !== null)),
  ]);
}
