import './styles/tokens.css';
import './styles/print.css';
import './styles/components.css';

import { installViewport } from './viewport';
import { audio } from './audio';
import { speech } from './speech';
import { Session } from './state';
import { PlayScreen } from './screens/play';
import { startScreen } from './screens/start';
import { briefingScreen } from './screens/briefing';
import { roundEndScreen } from './screens/roundEnd';
import { sessionEndScreen } from './screens/sessionEnd';
import { libraryScreen } from './screens/library';
import { importScreen } from './screens/importList';
import { soundToggle } from './ui';
import { loadRecords, saveRecords } from './records';
import { announce } from './dom';
import { deleteSet, getSet, listSets, markPlayed } from './library';
import type { WordSet } from './types';

const app = document.getElementById('app')!;

let set: WordSet = listSets()[0]!.set;
let session: Session | null = null;
let play: PlayScreen | null = null;

function show(node: HTMLElement): void {
  app.replaceChildren(node);
}

// ------------------------------------------------------------------- Screens

/** Eine einzige Liste braucht keine Bibliothek — dann ist der Start der Start. */
function goHome(): void {
  const entries = listSets();
  if (entries.length === 1) {
    goStart(entries[0]!.set);
    return;
  }
  goLibrary();
}

function goLibrary(): void {
  play?.destroy();
  play = null;
  session = null;
  show(
    libraryScreen(listSets(), {
      onPick: (id) => {
        const picked = getSet(id);
        if (picked) goStart(picked);
      },
      onAdd: goImport,
      onDelete: (id) => {
        deleteSet(id);
        goHome();
      },
    }),
  );
}

function goImport(): void {
  show(
    importScreen({
      onSaved: (id) => {
        const fresh = getSet(id);
        if (fresh) goStart(fresh);
        else goLibrary();
      },
      onCancel: goLibrary,
    }),
  );
}

function goStart(target: WordSet): void {
  play?.destroy();
  play = null;
  set = target;
  const saved = Session.restore(set);
  session = null;
  show(
    startScreen(
      set,
      loadRecords(set.id),
      saved ? { round: saved.round, open: saved.wave.length - saved.cursor } : null,
      (fresh) => {
        if (fresh) {
          Session.clearSaved(set.id);
          session = Session.start(set);
        } else {
          session = saved ?? Session.start(set);
        }
        markPlayed(set.id);
        goBriefing();
      },
      goLibrary,
    ),
  );
}

function goBriefing(): void {
  const s = session!;
  show(
    briefingScreen(set, s.round, s.wave.length, () => {
      // Im synchronen Click-Handler: iOS gibt Tastatur, Audio und Sprachausgabe
      // nur hier frei.
      audio.unlock();
      speech.unlock();
      goPlay();
    }),
  );
}

function goPlay(): void {
  const s = session!;
  if (!play) {
    play = new PlayScreen(s, { onWaveEnd: goWaveEnd, onFinish: goFinish }, soundToggle());
  } else {
    play.render();
  }
  show(play.root);
  play.focusInput();     // synchron, noch im Gesture-Kontext des Briefing-Taps
  // Erst jetzt hat das Plakat eine Höhe. Vorher misst fitWord() an einem
  // losgelösten Knoten und lässt das Wort ungeskaliert.
  play.refit();
  audio.roundStart();
}

function goWaveEnd(): void {
  const s = session!;
  const { perfect } = s.closeWave();
  if (perfect) audio.perfectRound();
  else audio.roundComplete();

  announce(`Abschnitt beendet. ${s.solvedCount} von ${s.totalCount} sitzen.`);

  show(
    roundEndScreen(s, () => {
      if (s.hasNextWave) s.advanceWave();
      else s.advanceRound();
      // Alles synchron im Click-Handler, damit der Fokus die Tastatur offen hält.
      goPlay();
    }),
  );
}

function goFinish(): void {
  const s = session!;
  s.closeWave();
  s.closeSession();
  audio.sessionComplete();
  Session.clearSaved(set.id);

  const { records, beaten } = saveRecords(set.id, {
    score: s.score,
    rounds: s.round,
    streak: s.bestCombo,
  });
  announce(
    `Geschafft. ${s.totalCount} von ${s.totalCount}. ` +
      `${s.round} ${s.round === 1 ? 'Runde' : 'Runden'} gebraucht.`,
  );

  show(
    sessionEndScreen(
      s,
      records,
      beaten,
      (onlyShaky: boolean) => {
        const ids = onlyShaky ? s.shaky.map((w) => w.id) : undefined;
        session = Session.start(set, ids);
        play?.destroy();
        play = null;
        goBriefing();
      },
      () => goStart(set),
    ),
  );
}

// --------------------------------------------------------------------- Start

installViewport(() => play?.refit());
goHome();

// Android-Zurück verlässt nicht die Session, sondern führt zum Startscreen.
history.pushState({ screen: 'app' }, '');
window.addEventListener('popstate', () => {
  history.pushState({ screen: 'app' }, '');
  if (session) goStart(set);
});
