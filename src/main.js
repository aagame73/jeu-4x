import './style.css';
import { createGame, endTurn, sendProbe, startAnalysis } from './game.js';
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

const view = createGalaxyView(document.getElementById('scene'), game, {
  onSelectStar(id) {
    game.selectedStarId = id;
    refresh();
  },
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
  onEndTurn() {
    endTurn(game);
    if (selectedProbe().state !== 'idle') selectNextIdleProbe();
    refresh();
  },
  onFocusStar(id) {
    view.focusStar(id);
  },
};
const ui = createUI(document.getElementById('ui'), game, actions);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    actions.onEndTurn();
  } else if (/^Digit[1-9]$/.test(e.code)) {
    const id = Number(e.code.slice(5)) - 1;
    if (game.probes[id]) actions.onSelectProbe(id);
  }
});
