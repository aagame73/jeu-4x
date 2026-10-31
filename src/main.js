import './style.css';
import './styles/bandeau.css';
import './styles/planete.css';
import './styles/infobulles.css';
import './styles/recherche.css';
import './styles/systeme.css';
import './styles/especes.css';
import { CONFIG, SPECIES, DEFAULT_SPECIES } from './config.js';
import { createSpeciesView } from './speciesView.js';
import { createGame, tick, currentDay, sendShip, startAnalysis, selectedShip, foundColony, startShipyard, startResearch } from './game.js';
import { createResearchView } from './researchView.js';
import { createSystemView } from './systemView.js';
import { createGalaxyView } from './scene.js';
import { createUI } from './ui.js';
import { createPlanetView } from './planetView.js';
import { startConstruction, demolish, startUpgrade } from './economy.js';
import { restore, readSlot, writeSlot, takePendingLoad, takeNewGameRequest, newGameAndRestart } from './save.js';
import { createMenu } from './menu.js';
import { installTooltips } from './tooltips.js';

// Au démarrage : une sauvegarde à charger (menu), sinon une nouvelle partie.
// ?graine=1234 dans l'adresse lance directement un amas précis (sans écran d'accueil),
// ?espece=vaskhar saute l'écran de choix de l'espèce.
const params = new URLSearchParams(location.search);
const urlSeed = Number(params.get('graine'));
const pending = takePendingLoad();
const newGameRequest = takeNewGameRequest(); // null, '' (espèce à choisir) ou la clé de l'espèce
const wantsNewGame = newGameRequest !== null;
const chosenSpecies = [newGameRequest, params.get('espece')].find((key) => key && SPECIES[key] && !SPECIES[key].hidden) ?? null;
let game = null;
if (pending) {
  try {
    game = restore(pending);
  } catch {
    game = null;
  }
}
game ??= createGame(urlSeed || Math.floor(Math.random() * 1e6), chosenSpecies ?? DEFAULT_SPECIES);
// L'écran d'accueil propose de continuer la partie enregistrée ; tant que le joueur n'a pas
// choisi, la sauvegarde automatique est suspendue pour ne pas l'écraser.
const showStart = !pending && !wantsNewGame && !urlSeed && !!readSlot('auto');
// Une nouvelle partie sans espèce passe d'abord par l'écran de choix (la page est rechargée ensuite).
const needsSpecies = !pending && !chosenSpecies && !showStart;
let autosave = !showStart && !needsSpecies && !urlSeed; // une partie lancée par ?graine= sert aux tests : elle n'écrase pas la sauvegarde
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
  systemView.update();
  if (researchView.isOpen) researchView.render();
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
    systemView.renderLive();
    if (researchView.isOpen) researchView.renderLive();
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
  onOpenSystem(id) {
    actions.onOpenSystem(id);
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
    returnToSystem = systemView.isOpen ? starId : returnToSystem;
    if (systemView.isOpen) {
      systemView.close();
      document.body.classList.remove('system-open');
    }
    planetView.open(starId, planetIndex, founding ? game.selectedShipId : null);
    view.setActive(false);
    document.body.classList.add('planet-open');
  },
  // Retour : vers la vue du système si la planète a été ouverte depuis elle, sinon vers l'amas.
  onClosePlanet() {
    planetView.close();
    document.body.classList.remove('planet-open');
    if (returnToSystem !== null) {
      const starId = returnToSystem;
      returnToSystem = null;
      actions.onOpenSystem(starId);
    } else {
      view.setActive(true);
    }
  },
  onOpenSystem(starId) {
    if (game.stars[starId].level < 2) return;
    game.selectedStarId = starId;
    systemView.open(starId);
    view.setActive(false);
    document.body.classList.add('system-open');
    refresh();
  },
  onCloseSystem() {
    systemView.close();
    returnToSystem = null;
    view.setActive(true);
    document.body.classList.remove('system-open');
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
  onUpgrade(colony, surface, tile) {
    if (startUpgrade(game, colony, surface, tile)) refresh();
  },
  onShipyard(colony, key) {
    if (startShipyard(game, colony, key)) refresh();
  },
  onOpenMenu() {
    if (researchView.isOpen) actions.onCloseResearch();
    menu.open();
  },
  // L'écran de recherche met la partie en pause, comme le menu.
  onOpenResearch() {
    if (researchView.isOpen) return;
    pausedBeforeResearch = game.paused;
    game.paused = true;
    researchView.open();
    ui.renderLive();
  },
  onCloseResearch() {
    if (!researchView.isOpen) return;
    researchView.close();
    game.paused = pausedBeforeResearch;
    ui.renderLive();
  },
  onStartResearch(key) {
    if (startResearch(game, key)) refresh();
  },
  onToggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  },
};
const ui = createUI(document.getElementById('ui'), game, actions);
const planetView = createPlanetView(document.getElementById('planet-view'), game, actions);
const researchView = createResearchView(document.getElementById('research'), game, actions);
const systemView = createSystemView(document.getElementById('system-view'), game, actions);
let returnToSystem = null; // système à rouvrir en quittant la vue d'une planète
let pausedBeforeResearch = true;

// Le menu met la partie en pause et rétablit l'état d'avant à sa fermeture.
let pausedBeforeMenu = true;
const menu = createMenu(document.getElementById('menu'), game, {
  onOpen() {
    pausedBeforeMenu = game.paused;
    game.paused = true;
    ui.renderLive();
  },
  onClose() {
    game.paused = pausedBeforeMenu;
    ui.renderLive();
  },
  onNewGame() {
    menu.close();
    speciesView.open(); // depuis l'accueil
  },
});
const speciesView = createSpeciesView(document.getElementById('species'), {
  onChoose(key) {
    if (urlSeed) location.search = `?graine=${urlSeed}&espece=${key}`;
    else newGameAndRestart(key);
  },
  onBack: showStart ? () => menu.open(true) : null,
});
installTooltips();
if (showStart) menu.open(true);
else if (needsSpecies) speciesView.open();

// Dernière sauvegarde automatique quand on quitte ou cache la page.
const saveOnLeave = () => autosave && writeSlot('auto', game);
window.addEventListener('pagehide', saveOnLeave);
document.addEventListener('visibilitychange', () => document.hidden && saveOnLeave());

// En développement seulement : accès à la partie depuis la console du navigateur, pour tester.
if (import.meta.env.DEV) window.jeu = { game, actions, refresh, tick };

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return; // saisie d'un nom en cours
  if (speciesView.isOpen) return;
  if (menu.isOpen) {
    if (e.key === 'Escape' && !document.getElementById('menu').classList.contains('start')) menu.close();
    return;
  }
  if (researchView.isOpen && (e.key === 'Escape' || e.code === 'KeyR')) {
    actions.onCloseResearch();
  } else if (e.key === 'Escape') {
    if (planetView.isOpen) actions.onClosePlanet();
    else if (systemView.isOpen) actions.onCloseSystem();
    else menu.open();
  } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    actions.onOpenResearch();
  } else if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    actions.onToggleFullscreen();
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
