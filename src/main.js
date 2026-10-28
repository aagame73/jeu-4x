import './style.css';
import { CONFIG } from './config.js';
import { createGame, tick, currentDay, sendProbe, startAnalysis } from './game.js';
import { createGalaxyView } from './scene.js';
import { createUI } from './ui.js';

// ?graine=1234 dans l'adresse pour rejouer le même amas.
const seed = Number(new URLSearchParams(location.search).get('graine')) || Math.floor(Math.random() * 1e6);
const game = createGame(seed);

const selectedProbe = () => game.probes[game.selectedProbeId];

function selectNextIdleProbe() {
  const n = game.probes.length;
  for (let i = 1; i <= n; i++) {
    const p = game.probes[(game.selectedProbeId + i) % n];
    if (p.state === 'idle') {
      game.selectedProbeId = p.id;
      return;
    }
  }
}

function refresh() {
  view.update();
  ui.render();
}

// Le temps avance à chaque image, sauf en pause. L'interface n'est redessinée en entier
// que lorsqu'un événement survient (une entrée de journal) ; sinon, seulement l'horloge.
function advanceTime(dt) {
  if (game.paused) return;
  const day = currentDay(game);
  const logLength = game.log.length;
  tick(game, (dt * CONFIG.speeds[game.speedIndex]) / CONFIG.secondsPerDay);
  if (game.log.length !== logLength) {
    refresh();
  } else if (currentDay(game) !== day) {
    ui.renderLive();
  }
}

const view = createGalaxyView(document.getElementById('scene'), game, {
  onSelectStar(id) {
    game.selectedStarId = id;
    refresh();
  },
  onFrame: advanceTime,
});

const actions = {
  onSelectProbe(id) {
    game.selectedProbeId = id;
    refresh();
  },
  onSend() {
    if (sendProbe(game, selectedProbe(), game.stars[game.selectedStarId])) selectNextIdleProbe();
    refresh();
  },
  onAnalyse() {
    if (startAnalysis(game, selectedProbe())) selectNextIdleProbe();
    refresh();
  },
  onTogglePause() {
    game.paused = !game.paused;
    ui.renderLive();
  },
  onSetSpeed(index) {
    game.speedIndex = index;
    game.paused = false;
    ui.renderLive();
  },
  onFocusStar(id) {
    view.focusStar(id);
  },
};
const ui = createUI(document.getElementById('ui'), game, actions);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) actions.onTogglePause();
  } else if (e.key === '+' || e.code === 'NumpadAdd') {
    actions.onSetSpeed(Math.min(CONFIG.speeds.length - 1, game.speedIndex + 1));
  } else if (e.key === '-' || e.code === 'NumpadSubtract') {
    actions.onSetSpeed(Math.max(0, game.speedIndex - 1));
  } else if (/^Digit[1-9]$/.test(e.code)) {
    const id = Number(e.code.slice(5)) - 1;
    if (game.probes[id]) actions.onSelectProbe(id);
  }
});
