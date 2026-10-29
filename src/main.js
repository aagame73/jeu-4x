import './style.css';
import { CONFIG } from './config.js';
import { createGame, tick, currentDay, sendShip, startAnalysis, selectedShip, foundColony, startShipyard } from './game.js';
import { createGalaxyView } from './scene.js';
import { createUI } from './ui.js';
import { createPlanetView } from './planetView.js';
import { startConstruction, demolish } from './economy.js';
import { restore, readSlot, writeSlot, takePendingLoad, takeNewGameRequest } from './save.js';
import { createMenu } from './menu.js';

// Au démarrage : une sauvegarde à charger (menu), sinon une nouvelle partie.
// ?graine=1234 dans l'adresse lance directement un amas précis (sans écran d'accueil).
const urlSeed = Number(new URLSearchParams(location.search).get('graine'));
const pending = takePendingLoad();
const wantsNewGame = takeNewGameRequest();
let game = null;
if (pending) {
  try {
    game = restore(pending);
  } catch {
    game = null;
  }
}
game ??= createGame(urlSeed || Math.floor(Math.random() * 1e6));
// L'écran d'accueil propose de continuer la partie enregistrée ; tant que le joueur n'a pas
// choisi, la sauvegarde automatique est suspendue pour ne pas l'écraser.
const showStart = !pending && !wantsNewGame && !urlSeed && !!readSlot('auto');
let autosave = !showStart && !urlSeed; // une partie lancée par ?graine= sert aux tests : elle n'écrase pas la sauvegarde
const AUTOSAVE_DAYS = 5;

function selectNextIdleShip() {
  const n = game.ships.length;
  const start = game.ships.findIndex((s) => s.id === game.selectedShipId);
  for (let i = 1; i <= n; i++) {
    const ship = game.ships[(start + i) % n];
    if (ship.state === 'idle') {
      game.selectedShipId = ship.id;
      return;
    }
  }
}

function refresh() {
  view.update();
  ui.render();
  planetView.update();
}

// Le temps avance à chaque image, sauf en pause. L'interface n'est redessinée en entier
// que lorsqu'un événement survient (une entrée de journal) ; sinon, chaque nouveau jour.
function advanceTime(dt) {
  if (game.paused) return;
  const day = currentDay(game);
  const logLength = game.log.length;
  tick(game, (dt * CONFIG.speeds[game.speedIndex]) / CONFIG.secondsPerDay);
  if (game.log.length !== logLength) {
    refresh();
  } else if (currentDay(game) !== day) {
    ui.renderLive();
    planetView.renderLive();
  }
  if (autosave && currentDay(game) !== day && currentDay(game) % AUTOSAVE_DAYS === 0) writeSlot('auto', game);
}

const view = createGalaxyView(document.getElementById('scene'), game, {
  onSelectStar(id) {
    game.selectedStarId = id;
    refresh();
  },
  onSelectShip(id) {
    actions.onSelectShip(id);
  },
  onFrame: advanceTime,
});

const actions = {
  onSelectShip(id) {
    game.selectedShipId = id;
    refresh();
  },
  onSend() {
    if (sendShip(game, selectedShip(game), game.stars[game.selectedStarId])) selectNextIdleShip();
    refresh();
  },
  onAnalyse() {
    startAnalysis(game, selectedShip(game));
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
  onFocusShip(id) {
    game.selectedShipId = id;
    view.focusShip(id);
    refresh();
  },
  onRenameShip(id, name) {
    const ship = game.ships.find((s) => s.id === id);
    if (ship) ship.name = name;
    refresh();
  },
  // founding : la vue s'ouvre pour choisir la case où poser une nouvelle colonie.
  onOpenPlanet(starId, planetIndex, founding = false) {
    planetView.open(starId, planetIndex, founding ? game.selectedShipId : null);
    view.setActive(false);
    document.body.classList.add('planet-open');
  },
  onClosePlanet() {
    planetView.close();
    view.setActive(true);
    document.body.classList.remove('planet-open');
  },
  onFoundColony(shipId, starId, planetIndex, tileIndex) {
    const ship = game.ships.find((s) => s.id === shipId);
    if (!foundColony(game, ship, starId, planetIndex, tileIndex)) return;
    refresh();
    planetView.open(starId, planetIndex, null);
  },
  onBuild(colony, surface, tile, type) {
    if (startConstruction(game, colony, surface, tile, type)) refresh();
  },
  onDemolish(colony, surface, tile) {
    if (demolish(game, colony, surface, tile)) refresh();
  },
  onShipyard(colony, key) {
    if (startShipyard(game, colony, key)) refresh();
  },
  onOpenMenu() {
    menu.open();
  },
};
const ui = createUI(document.getElementById('ui'), game, actions);
const planetView = createPlanetView(document.getElementById('planet-view'), game, actions);

// Le menu met la partie en pause et rétablit l'état d'avant à sa fermeture.
let pausedBeforeMenu = true;
const menu = createMenu(document.getElementById('menu'), game, {
  onOpen() {
    pausedBeforeMenu = game.paused;
    game.paused = true;
    ui.renderLive();
  },
  onClose(fromStart) {
    if (fromStart) {
      autosave = true; // « Nouvelle partie » choisie à l'accueil
      writeSlot('auto', game);
    } else {
      game.paused = pausedBeforeMenu;
    }
    ui.renderLive();
  },
});
if (showStart) menu.open(true);

// Dernière sauvegarde automatique quand on quitte ou cache la page.
const saveOnLeave = () => autosave && writeSlot('auto', game);
window.addEventListener('pagehide', saveOnLeave);
document.addEventListener('visibilitychange', () => document.hidden && saveOnLeave());

// En développement seulement : accès à la partie depuis la console du navigateur, pour tester.
if (import.meta.env.DEV) window.jeu = { game, actions, refresh, tick };

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return; // saisie d'un nom en cours
  if (menu.isOpen) {
    if (e.key === 'Escape' && !document.getElementById('menu').classList.contains('start')) menu.close();
    return;
  }
  if (e.key === 'Escape') {
    if (planetView.isOpen) actions.onClosePlanet();
    else menu.open();
  } else if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) actions.onTogglePause();
  } else if (e.key === '+' || e.code === 'NumpadAdd') {
    actions.onSetSpeed(Math.min(CONFIG.speeds.length - 1, game.speedIndex + 1));
  } else if (e.key === '-' || e.code === 'NumpadSubtract') {
    actions.onSetSpeed(Math.max(0, game.speedIndex - 1));
  } else if (/^Digit[1-9]$/.test(e.code)) {
    const ship = game.ships[Number(e.code.slice(5)) - 1];
    if (ship) actions.onSelectShip(ship.id);
  }
});
