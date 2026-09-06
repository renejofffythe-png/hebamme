import { el } from '../dom';
import type { Session } from '../state';

/**
 * Zwischenstand. Positiv formuliert — "20 von 24 sitzen", nie "4 Fehler".
 * Hier dürfen die Lösungen in Ruhe gelesen werden; im Spiel nicht.
 */
export function roundEndScreen(session: Session, onNext: () => void): HTMLElement {
  const s = session.waveSummary();
  const isWave = session.hasNextWave;
  const nextRound = !isWave && s.openTotal.length > 0;
  // In der Welle zeigen wir, was hier offen blieb; vor der nächsten Runde alles.
  const listIds = isWave ? s.open : s.openTotal;

  const openList = listIds
    .map((id) => session.wordById(id))
    .filter((w): w is NonNullable<typeof w> => !!w)
    .slice(0, 8);

  const btn = el('button', { class: 'btn btn--primary', type: 'button' }, [
    isWave
      ? `Weiter — Welle ${session.waveIndex + 2} von ${session.waveCount}`
      : `Runde ${session.round + 1} — ${s.openTotal.length} ${s.openTotal.length === 1 ? 'Wort' : 'Wörter'}`,
  ]);
  btn.addEventListener('click', onNext);

  const firstTime = !localStorage.getItem('ueberklebt.seen.round');
  if (nextRound && firstTime) {
    try { localStorage.setItem('ueberklebt.seen.round', '1'); } catch { /* private mode */ }
  }

  return el('section', { class: 'screen' }, [
    el('span', { class: 'round-badge t-stencil', 'style:align-self': 'flex-start' }, [
      isWave ? `WELLE ${session.waveIndex + 1} ✓` : `RUNDE ${session.round} ✓`,
    ]),
    el('h1', { class: 't-h1 misprint', 'style:margin': '0' }, [
      `${s.solved} von ${s.total} sitzen.`,
    ]),
    nextRound && firstTime
      ? el('p', { class: 't-body', 'style:color': 'var(--c-chalk-muted)', 'style:margin': '0' }, [
          `Runde ${session.round + 1}: nur die ${s.openTotal.length}, die dich erwischt haben.`,
        ])
      : session.round >= 2 && s.openTotal.length <= 5 && s.openTotal.length > 0
        ? el('p', { class: 't-body', 'style:color': 'var(--c-chalk-muted)', 'style:margin': '0' }, [
            `Noch ${s.openTotal.length}. Das ist die Zielgerade.`,
          ])
        : null,

    openList.length > 0
      ? el('div', { class: 'stack scroll-y paper', 'style:padding': 'var(--s-4)' }, [
          el('p', { class: 't-meta', 'style:color': 'var(--c-ink-muted)', 'style:margin': '0' }, ['Nochmal ansehen']),
          ...openList.map((w) =>
            el('div', { class: 'receipt-line' }, [
              el('span', { 'style:font-weight': '700' }, [w.de]),
              el('span', { class: 'receipt-line__lead' }),
              el('span', {}, [w.en.join(' / ')]),
            ]),
          ),
        ])
      : el('div', { class: 'spacer' }),

    el('div', { class: 'spacer' }),
    el('p', { class: 't-meta', 'style:color': 'var(--c-chalk-muted)', 'style:margin': '0' }, [
      `${session.score} Punkte · längste Serie ${session.bestCombo}`,
    ]),
    btn,
  ]);
}
