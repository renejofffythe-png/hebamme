import { el } from '../dom';
import { groupEntries, type LibraryEntry } from '../library';
import { loadRecords } from '../records';
import {
  SITS_AT,
  dayKey,
  loadDays,
  loadSessions,
  loadWords,
  wordKey,
  type DayStat,
  type SessionLog,
  type WordStat,
} from '../stats';
import type { Word } from '../types';

/**
 * Die Lernstatistik. Ein Blatt Papier wie der Beleg, von oben nach unten:
 * Überblick, die letzten 14 Tage, je Sprache was sitzt, die schwersten Wörter.
 *
 * Reiner Selbstvergleich wie bei den Bestwerten: keine Ziele, keine roten
 * Zahlen für Tage ohne Übung. Eine Lücke im Balkendiagramm ist eine Lücke,
 * kein Vorwurf.
 */
const DAY_SPAN = 14;
const HARDEST = 8;
const WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)} %` : '–');

function duration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

const answersOf = (d: DayStat) => d.correct + d.near + d.wrong;

function line(label: string, value: string, note?: string): HTMLElement {
  return el('div', { class: 'stack', 'style:gap': '0' }, [
    el('div', { class: 'receipt-line' }, [
      el('span', { class: 't-meta', 'style:color': 'var(--c-ink-muted)' }, [label]),
      el('span', { class: 'receipt-line__lead' }),
      el('span', { 'style:font-weight': '700' }, [value]),
    ]),
    note ? el('span', { class: 'receipt-note' }, [note]) : null,
  ]);
}

const heading = (text: string) => el('h2', { class: 't-h2 stat-head' }, [text]);

/** Ein Balken aus drei Teilen: sitzt, geübt, neu. */
function bar(sits: number, practised: number, total: number, label: string): HTMLElement {
  const w = (n: number) => `${total ? (n / total) * 100 : 0}%`;
  return el('div', { class: 'stat-bar', role: 'img', 'aria-label': label }, [
    el('span', { class: 'stat-bar__sits', 'style:width': w(sits) }),
    el('span', { class: 'stat-bar__practised', 'style:width': w(practised) }),
  ]);
}

function daysChart(days: Record<string, DayStat>): HTMLElement {
  const today = new Date();
  const span = Array.from({ length: DAY_SPAN }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (DAY_SPAN - 1 - i));
    const stat = days[dayKey(d.getTime())];
    return { date: d, answers: stat ? answersOf(stat) : 0, correct: stat?.correct ?? 0 };
  });
  const max = Math.max(1, ...span.map((d) => d.answers));

  const summary = span
    .filter((d) => d.answers)
    .map((d) => `${WEEKDAY[d.date.getDay()]} ${d.date.getDate()}.: ${d.answers} Antworten, ${d.correct} richtig`)
    .join('; ');

  return el('div', { class: 'stack', 'style:gap': 'var(--s-2)' }, [
    el(
      'div',
      { class: 'stat-days', role: 'img', 'aria-label': summary ? `Letzte 14 Tage — ${summary}` : 'Letzte 14 Tage: noch nichts geübt' },
      span.map((d) =>
        el('div', { class: 'stat-day' }, [
          el('div', { class: 'stat-day__col' }, [
            el('span', { class: 'stat-day__bar', 'style:height': `${(d.answers / max) * 100}%` }, [
              el('span', { class: 'stat-day__ok', 'style:height': `${d.answers ? (d.correct / d.answers) * 100 : 0}%` }),
            ]),
          ]),
          el('span', { class: 'stat-day__label' }, [WEEKDAY[d.date.getDay()]!.slice(0, 1)]),
        ]),
      ),
    ),
    el('div', { class: 'stat-legend' }, [
      el('span', {}, [el('i', { class: 'stat-key stat-key--ok' }), 'richtig']),
      el('span', {}, [el('i', { class: 'stat-key' }), 'fast oder falsch']),
    ]),
  ]);
}

interface Counted {
  total: number;
  sits: number;
  practised: number;
}

function count(words: readonly Word[], setId: string, stats: Record<string, WordStat>, seen?: Set<string>): Counted {
  const out: Counted = { total: 0, sits: 0, practised: 0 };
  for (const w of words) {
    const k = wordKey(setId, w.id);
    if (seen) {
      if (seen.has(k)) continue;
      seen.add(k);
    }
    out.total += 1;
    const s = stats[k];
    if (!s) continue;
    if (s.streak >= SITS_AT) out.sits += 1;
    else out.practised += 1;
  }
  return out;
}

function groupCard(
  group: { label: string; entries: LibraryEntry[] },
  words: Record<string, WordStat>,
  sessions: SessionLog[],
): HTMLElement {
  // Die Wackelkandidaten sind eine Auswahl, keine eigene Liste — sie würden
  // Wörter doppelt zählen.
  const lists = group.entries.filter((e) => !e.set.id.endsWith('-wackelkandidaten'));
  const seen = new Set<string>();
  const all = lists.reduce(
    (acc, e) => {
      const c = count(e.set.words, e.set.id, words, seen);
      return { total: acc.total + c.total, sits: acc.sits + c.sits, practised: acc.practised + c.practised };
    },
    { total: 0, sits: 0, practised: 0 },
  );
  const fresh = all.total - all.sits - all.practised;

  const rows = lists.map((e) => {
    const c = count(e.set.words, e.set.id, words);
    const done = loadRecords(e.set.id).sessions;
    const last = [...sessions].reverse().find((s) => s.set === e.set.id);
    // "Französisch Unité 2 Tag 1 — une activité bis …" → "Unité 2 Tag 1"
    const name = e.set.title.split(' — ')[0]!.replace(/^(Französisch|Englisch|Papas Vokabeln)\s+/, '') || e.set.title;
    const meta = [
      `${c.sits}/${c.total} sitzen`,
      done ? `${done}× geschafft` : 'noch nicht geschafft',
      last ? `zuletzt ${pct(last.firstTry, last.words)} gleich richtig` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return el('div', { class: 'stat-list' }, [
      el('span', { class: 'stat-list__name' }, [name]),
      bar(c.sits, c.practised, c.total, `${name}: ${c.sits} von ${c.total} sitzen, ${c.practised} geübt`),
      el('span', { class: 'stat-list__meta' }, [meta]),
    ]);
  });

  return el('div', { class: 'stack', 'style:gap': 'var(--s-3)' }, [
    heading(group.label),
    bar(all.sits, all.practised, all.total, `${all.sits} von ${all.total} Wörtern sitzen, ${all.practised} geübt, ${fresh} neu`),
    el('div', { class: 'stat-legend' }, [
      el('span', {}, [el('i', { class: 'stat-key stat-key--ok' }), `sitzt ${all.sits}`]),
      el('span', {}, [el('i', { class: 'stat-key stat-key--brown' }), `geübt ${all.practised}`]),
      el('span', {}, [el('i', { class: 'stat-key stat-key--empty' }), `neu ${fresh}`]),
    ]),
    ...rows,
  ]);
}

function hardest(entries: LibraryEntry[], words: Record<string, WordStat>): HTMLElement | null {
  const byKey = new Map<string, { word: Word; lang: string }>();
  for (const e of entries) {
    for (const w of e.set.words) {
      const k = wordKey(e.set.id, w.id);
      if (!byKey.has(k)) byKey.set(k, { word: w, lang: e.set.langLabel });
    }
  }
  const top = Object.entries(words)
    .filter(([k, s]) => s.wrong + s.near > 0 && byKey.has(k))
    .sort((a, b) => b[1].wrong - a[1].wrong || b[1].near - a[1].near || b[1].last - a[1].last)
    .slice(0, HARDEST);
  if (!top.length) return null;

  return el('div', { class: 'stack', 'style:gap': 'var(--s-2)' }, [
    heading('Schwerste Wörter'),
    ...top.map(([k, s]) => {
      const { word } = byKey.get(k)!;
      const misses = s.wrong + s.near;
      return line(
        word.de,
        word.en[0]!,
        `${misses}× daneben bei ${s.seen} Versuchen${s.streak >= SITS_AT ? ' · sitzt inzwischen' : ''}`,
      );
    }),
  ]);
}

export function statsScreen(entries: LibraryEntry[], onBack: () => void): HTMLElement {
  const days = loadDays();
  const words = loadWords();
  const sessions = loadSessions();

  const totals = Object.values(days).reduce(
    (acc, d) => ({
      answers: acc.answers + answersOf(d),
      correct: acc.correct + d.correct,
      ms: acc.ms + d.ms,
    }),
    { answers: 0, correct: 0, ms: 0 },
  );
  const learningDays = Object.values(days).filter((d) => answersOf(d) > 0).length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = Object.entries(days)
    .filter(([k]) => new Date(`${k}T12:00:00`).getTime() >= weekAgo)
    .reduce((n, [, d]) => n + answersOf(d), 0);
  const sits = Object.values(words).filter((w) => w.streak >= SITS_AT).length;

  const back = el('button', { class: 'chip chip--wall', type: 'button' }, ['Zurück']);
  back.addEventListener('click', onBack);

  const empty = totals.answers === 0;

  const paper = el('div', { class: 'paper scroll-y stat-paper', 'style:flex': '1' }, [
    el('div', { class: 'stack', 'style:gap': 'var(--s-2)' }, [
      heading('Überblick'),
      empty
        ? el('p', { class: 't-body', 'style:margin': '0' }, [
            'Noch nichts geübt, seit die Statistik mitzählt. Nach der ersten Runde steht hier, was sitzt.',
          ])
        : null,
      line('Lerntage', String(learningDays)),
      line('Antworten diese Woche', String(thisWeek)),
      line('Antworten insgesamt', String(totals.answers)),
      line('Richtig', pct(totals.correct, totals.answers)),
      line('Wörter, die sitzen', String(sits), `Sitzt = ${SITS_AT}× hintereinander richtig, über verschiedene Durchgänge`),
      line('Durchgänge geschafft', String(sessions.length)),
      line('Übungszeit', duration(totals.ms)),
    ]),
    el('div', { class: 'stack', 'style:gap': 'var(--s-2)' }, [heading('Letzte 14 Tage'), daysChart(days)]),
    ...groupEntries(entries).map((g) => groupCard(g, words, sessions)),
    hardest(entries, words),
  ]);

  return el('section', { class: 'screen' }, [
    el('div', { class: 'row' }, [back, el('div', { class: 'spacer' })]),
    el('h1', { class: 'wordmark wordmark--sm' }, ['Statistik']),
    paper,
  ]);
}
