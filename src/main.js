import './style.css';
import './styles/bandeau.css';
import './styles/planete.css';
import './styles/infobulles.css';
import './styles/recherche.css';
import './styles/systeme.css';
import './styles/especes.css';
import './styles/diplomatie.css';
import './styles/fonds.css';
import { CONFIG, COMBAT, SPECIES, DEFAULT_SPECIES } from './config.js';
import { createSpeciesView } from './speciesView.js';
import { createGame, tick, currentDay, sendShip, startAnalysis, selectedShip, foundColony, startShipyard, startResearch } from './game.js';
import { createResearchView } from './researchView.js';
import { createDiplomacyView } from './diplomacyView.js';
import { createSystemView } from './systemView.js';
import { createGalaxyView } from './scene.js';
import { createUI } from './ui.js';
import { createContactView } from './contactView.js';
import { createEndView } from './endView.js';
import { playerBattles } from './combat.js';
import { createPlanetView } from './planetView.js';
import { startConstruction, demolish, startUpgrade, togglePause } from './economy.js';
import { restore, readSlot, writeSlot, takePendingLoad, takeNewGameRequest, takeSettingsRequest, newGameAndRestart } from './save.js';
import { settingsFromParams, settingsQuery } from './difficulty.js';
import { createMenu } from './menu.js';
import { createTitleView } from './titleView.js';
import { initTutorial, announceStep, updateTutorial, skipStep, hideTutorial, restartTutorial, applyHalos } from './tutorial.js';
import { createHelpView } from './helpView.js';
import { installTooltips } from './tooltips.js';

// Au démarrage : une sauvegarde à charger (menu), sinon une nouvelle partie.
// ?graine=1234 dans l'adresse lance directement un amas précis (sans écran d'accueil),
// ?espece=vaskhar saute l'écran de choix de l'espèce, ?rivaux=6 fixe le nombre d'adversaires,
// ?niveau=ardu, ?carte=grande et ?ressources=abondantes les autres réglages (difficulty.js).
const params = new URLSearchParams(location.search);
const urlSeed = Number(params.get('graine'));
const pending = takePendingLoad();
const newGameRequest = takeNewGameRequest(); // null, '' (espèce à choisir) ou la clé de l'espèce
const wantsNewGame = newGameRequest !== null;
const chosenSettings = takeSettingsRequest() ?? settingsFromParams(params);
const chosenSpecies = [newGameRequest, params.get('espece')].find((key) => key && SPECIES[key] && !SPECIES[key].hidden) ?? null;
let game = null;
// Sauvegarde illisible : on revient à l'écran d'accueil avec le message, sans rien écraser.
let loadError = null;
if (pending) {
  try {
    game = restore(pending);
  } catch (e) {
    game = null;
    loadError = e.message;
  }
}
game ??= createGame(urlSeed || Math.floor(Math.random() * 1e6), chosenSpecies ?? DEFAULT_SPECIES, chosenSettings.rivals, chosenSettings);
// Tutoriel (tutorial.js) : pour une nouvelle partie lancée depuis l'écran des espèces, sauf s'il a été décoché.
// Pas pour une partie de test (?graine=, ?espece=). Une partie chargée garde son état.
if (!pending) {
  const tutorialOn = !!newGameRequest && !urlSeed && chosenSettings.tutorial !== false;
  initTutorial(game, tutorialOn);
  if (tutorialOn) {
    game.log = game.log.filter((e) => !e.text.startsWith('Analysez le système')); // l'objectif 1 le dit déjà
    announceStep(game);
  }
}
// L'écran d'accueil propose de continuer la partie enregistrée ; tant que le joueur n'a pas
// choisi, la sauvegarde automatique est suspendue pour ne pas l'écraser.
const showStart = !!loadError || (!pending && !wantsNewGame && !urlSeed && !!readSlot('auto'));
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
  updateTutorial(game); // objectif atteint : le suivant est annoncé et le jeu se met en pause
  view.update();
  ui.render();
  contactView.update();
  endView.update();
  planetView.update();
  systemView.update();
  if (researchView.isOpen) researchView.render();
}

// Le temps avance à chaque image, sauf en pause. L'interface n'est redessinée en entier
// que lorsqu'un événement survient (une entrée de journal) ; sinon, chaque nouveau jour.
function advanceTime(dt) {
  watchBattles();
  if (game.paused) return;
  const day = currentDay(game);
  const logLength = game.log.length;
  // Pendant un combat chez le joueur, le temps est ralenti, quelle que soit la vitesse choisie.
  const speed = slowedByBattle ? COMBAT.battleSpeed : CONFIG.speeds[game.speedIndex];
  tick(game, (dt * speed) / CONFIG.secondsPerDay);
  if (game.log.length !== logLength) {
    refresh();
  } else if (updateTutorial(game)) {
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
  onOpenHelp() {
    helpView.open();
  },
  onTutorialSkip() {
    skipStep(game);
    refresh();
  },
  onTutorialHide() {
    hideTutorial(game);
    refresh();
  },
  onSelectShip(id) {
    game.selectedShipId = id;
    refresh();
  },
  onSend() {
    if (sendShip(game, selectedShip(game), game.stars[game.selectedStarId])) selectNextIdleShip();
    refresh();
  },
  onAnalyse(shipId = null) {
    const ship = shipId !== null ? game.ships.find((s) => s.id === shipId) : selectedShip(game);
    if (!ship) return;
    game.selectedShipId = ship.id;
    startAnalysis(game, ship);
    refresh();
  },
  onTogglePause() {
    if (game.ended) return; // partie terminée : le temps ne repart pas
    game.paused = !game.paused;
    ui.renderLive();
  },
  onSetSpeed(index) {
    if (game.ended) return;
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
    if (!foundColony(game, ship, starId, planetIndex, tileIndex)) {
      refresh(); // un rival a pu prendre la planète entre-temps
      return;
    }
    refresh();
    planetView.open(starId, planetIndex, null);
  },
  onBuild(colony, surface, tile, type) {
    if (startConstruction(game, colony, surface, tile, type)) refresh();
  },
  onDemolish(colony, surface, tile) {
    if (demolish(game, colony, surface, tile)) refresh();
  },
  onToggleBuilding(colony, surface, tile) {
    if (togglePause(game, colony, surface, tile)) refresh();
  },
  onUpgrade(colony, surface, tile) {
    if (startUpgrade(game, colony, surface, tile)) refresh();
  },
  onShipyard(colony, key) {
    if (startShipyard(game, colony, key)) refresh();
  },
  onOpenMenu() {
    if (researchView.isOpen) actions.onCloseResearch();
    if (diplomacyView.isOpen) actions.onCloseDiplomacy();
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
  // Comme la recherche, la diplomatie met la partie en pause.
  onOpenDiplomacy() {
    if (diplomacyView.isOpen || researchView.isOpen) return;
    pausedBeforeDiplomacy = game.paused;
    game.paused = true;
    diplomacyView.open();
    ui.renderLive();
  },
  onCloseDiplomacy() {
    if (!diplomacyView.isOpen) return;
    diplomacyView.close();
    game.paused = pausedBeforeDiplomacy;
    ui.renderLive();
  },
  refresh,
  onStartResearch(key) {
    if (startResearch(game, key)) refresh();
  },
  onToggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  },
};
const ui = createUI(document.getElementById('ui'), game, actions);
const contactView = createContactView(game, () => refresh());
// Fin de partie : l'écran de fin passe après le menu et les cinématiques ; il revient quand ils se ferment.
const endView = createEndView(game, {
  onNewGame: () => newGameAndRestart(),
  onMenu: () => menu.open(),
  isBusy: () => menu.isOpen || speciesView.isOpen || !!document.querySelector('.contact'),
});
const planetView = createPlanetView(document.getElementById('planet-view'), game, actions);
const researchView = createResearchView(document.getElementById('research'), game, actions);
const diplomacyView = createDiplomacyView(document.getElementById('diplomacy'), game, actions);
const systemView = createSystemView(document.getElementById('system-view'), game, actions);
let returnToSystem = null; // système à rouvrir en quittant la vue d'une planète

// Combats chez le joueur : ralenti, et ouverture de la vue du système au début de chaque bataille.
// Si un écran est ouvert (menu, recherche, diplomatie, cinématique), l'ouverture attend qu'il se ferme.
let slowedByBattle = false;
let knownBattles = new Set();
const pendingBattles = new Set();
function watchBattles() {
  const battles = playerBattles(game);
  slowedByBattle = battles.length > 0;
  document.body.classList.toggle('battle-slow', slowedByBattle);
  for (const id of battles) if (!knownBattles.has(id)) pendingBattles.add(id);
  knownBattles = new Set(battles);
  for (const id of pendingBattles) if (!knownBattles.has(id)) pendingBattles.delete(id);
  if (!pendingBattles.size) return;
  // La vue d'une planète compte aussi : on ne coupe pas, par exemple, le choix de la case d'une colonie.
  const busy = menu.isOpen || researchView.isOpen || diplomacyView.isOpen || speciesView.isOpen || planetView.isOpen || document.querySelector('.contact');
  if (busy) return;
  const starId = pendingBattles.values().next().value;
  pendingBattles.clear();
  if (systemView.isOpen && game.selectedStarId === starId) return;
  actions.onOpenSystem(starId);
}
let pausedBeforeResearch = true;
let pausedBeforeDiplomacy = true;

// L'aide (touche H, bouton « ? ») met aussi la partie en pause le temps de la lire.
let pausedBeforeHelp = true;
const helpView = createHelpView(document.getElementById('help'), game, {
  onOpen() {
    pausedBeforeHelp = game.paused;
    game.paused = true;
    ui.renderLive();
  },
  onClose() {
    game.paused = pausedBeforeHelp || !!game.ended;
    ui.renderLive();
  },
  onRestartTutorial() {
    restartTutorial(game);
    game.paused = true;
    refresh();
  },
});

// Le menu met la partie en pause et rétablit l'état d'avant à sa fermeture.
let pausedBeforeMenu = true;
const menu = createMenu(document.getElementById('menu'), game, {
  onOpen() {
    pausedBeforeMenu = game.paused;
    game.paused = true;
    ui.renderLive();
  },
  onClose() {
    game.paused = pausedBeforeMenu || !!game.ended;
    ui.renderLive();
    endView.update();
  },
  onNewGame() {
    menu.close();
    speciesView.open(); // depuis l'accueil
  },
});
const speciesView = createSpeciesView(document.getElementById('species'), {
  onChoose(key, settings) {
    if (urlSeed) location.search = `?graine=${urlSeed}&espece=${key}&${settingsQuery(settings)}`;
    else newGameAndRestart(key, settings);
  },
  onBack: showStart ? () => menu.open(true) : null,
});
installTooltips();
// Tutoriel : halos sur les éléments à utiliser, remis à jour régulièrement (l'interface se redessine souvent).
setInterval(() => applyHalos(game), 300);
if (showStart) menu.open(true);
if (loadError) menu.notice(`Chargement impossible : ${loadError}`);
else if (needsSpecies) speciesView.open();
endView.update(); // une partie finie rechargée rouvre son écran de fin
// Page titre à l'ouverture du jeu, posée sur l'accueil ou le choix d'espèce (pas après
// « Nouvelle partie », ni pour une partie de test lancée par ?graine= ou ?espece=).
const showTitle = !pending && !wantsNewGame && !urlSeed && !chosenSpecies;
if (showTitle) createTitleView(document.getElementById('title')).open();

// Dernière sauvegarde automatique quand on quitte ou cache la page.
const saveOnLeave = () => autosave && writeSlot('auto', game);
window.addEventListener('pagehide', saveOnLeave);
document.addEventListener('visibilitychange', () => document.hidden && saveOnLeave());

// En développement seulement : accès à la partie depuis la console du navigateur, pour tester.
if (import.meta.env.DEV) window.jeu = { game, actions, refresh, tick };

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') return; // saisie en cours (nom, quantité)
  if (speciesView.isOpen) return;
  if (menu.isOpen) {
    if (e.key === 'Escape' && !document.getElementById('menu').classList.contains('start')) menu.close();
    return;
  }
  if (helpView.isOpen) {
    if (e.key === 'Escape' || e.code === 'KeyH') helpView.close();
    return;
  }
  if (e.code === 'KeyH' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (!document.querySelector('.contact') && !document.querySelector('.ending')) helpView.open();
    return;
  }
  if (diplomacyView.isOpen) {
    if (e.key === 'Escape' || e.code === 'KeyD') actions.onCloseDiplomacy();
    return;
  }
  if (researchView.isOpen && (e.key === 'Escape' || e.code === 'KeyR')) {
    actions.onCloseResearch();
  } else if (e.key === 'Escape') {
    const objectives = document.getElementById('objectives');
    if (objectives && !objectives.hidden) objectives.hidden = true; // détail des objectifs d'abord
    else if (planetView.isOpen) actions.onClosePlanet();
    else if (systemView.isOpen) actions.onCloseSystem();
    else menu.open();
  } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    actions.onOpenResearch();
  } else if (e.code === 'KeyD' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    actions.onOpenDiplomacy();
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
