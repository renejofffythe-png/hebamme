import './styles/tokens.css';
import './styles/print.css';
import './styles/components.css';

import unit1 from '../data/unit1.json';
import { installViewport } from './viewport';
import { audio } from './audio';
import { Session } from './state';
import { PlayScreen } from './screens/play';
import { startScreen } from './screens/start';
import { briefingScreen } from './screens/briefing';
import { roundEndScreen } from './screens/roundEnd';
import { sessionEndScreen } from './screens/sessionEnd';
import { soundToggle } from './ui';
import { announce } from './dom';
import type { WordSet } from './types';

const set = unit1 as WordSet;
const app = document.getElementById('app')!;

let session: Session | null = null;
let play: PlayScreen | null = null;

function show(node: HTMLElement): void {
  app.replaceChildren(node);
}

// ------------------------------------------------------------------- Screens

function goStart(): void {
  play?.destroy();
  play = null;
  const saved = Session.restore(set);
  session = null;
  show(
    startScreen(
      set,
      saved ? { round: saved.round, open: saved.wave.length - saved.cursor } : null,
      (fresh) => {
        if (fresh) {
          Session.clearSaved();
          session = Session.start(set);
        } else {
          session = saved ?? Session.start(set);
        }
        goBriefing();
      },
    ),
  );
}

function goBriefing(): void {
  const s = session!;
  show(
    briefingScreen(set, s.round, s.wave.length, () => {
      // Im synchronen Click-Handler: iOS gibt Tastatur und Audio nur hier frei.
      audio.unlock();
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
  audio.roundStart();
}

function goWaveEnd(): void {
  const s = session!;
  const perfect = s.wavePerfect();
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
  audio.sessionComplete();
  Session.clearSaved();
  announce(`Geschafft. ${s.totalCount} von ${s.totalCount}. ${s.round} Runden gebraucht.`);

  show(
    sessionEndScreen(
      s,
      (onlyShaky) => {
        const ids = onlyShaky ? s.shaky.map((w) => w.id) : undefined;
        session = Session.start(set, ids);
        play?.destroy();
        play = null;
        goBriefing();
      },
      goStart,
    ),
  );
}

// --------------------------------------------------------------------- Start

installViewport();
goStart();

// Android-Zurück verlässt nicht die Session, sondern führt zum Startscreen.
history.pushState({ screen: 'app' }, '');
window.addEventListener('popstate', () => {
  history.pushState({ screen: 'app' }, '');
  if (session) goStart();
});
