// Sauvegarde de la partie. L'amas se régénère à l'identique à partir de sa graine :
// on n'enregistre que ce qui a changé (connaissances, vaisseaux, colonies, surfaces bâties…).
import { createGame, getSurface, currentDay } from './game.js';

const VERSION = 1;
const PREFIX = 'amas-inexplore:';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];
const PENDING = `${PREFIX}a-charger`;

export function serialize(game) {
  return {
    version: VERSION,
    savedAt: Date.now(),
    seed: game.seed,
    time: game.time,
    speedIndex: game.speedIndex,
    selectedStarId: game.selectedStarId,
    selectedShipId: game.selectedShipId,
    nextShipId: game.nextShipId,
    resources: game.resources,
    upgrades: game.upgrades,
    stars: game.stars.map((s) => s.level),
    currents: game.currents.map((c) => c.known),
    ships: game.ships.map(({ thumbnail, ...ship }) => ship),
    colonies: game.colonies,
    surfaces: [...game.surfaces].map(([key, surface]) => [
      key,
      surface.tiles.map(({ terrain, deposit, building, yield: y }) => ({ terrain, deposit, building, yield: y })),
    ]),
    log: game.log.slice(-200),
  };
}

export function restore(data) {
  if (!data || data.version !== VERSION || typeof data.seed !== 'number') throw new Error('Sauvegarde illisible ou d\'une autre version.');
  const game = createGame(data.seed);
  Object.assign(game, {
    time: data.time,
    speedIndex: data.speedIndex,
    paused: true,
    selectedStarId: data.selectedStarId,
    selectedShipId: data.selectedShipId,
    nextShipId: data.nextShipId,
    resources: data.resources,
    upgrades: data.upgrades,
    ships: data.ships,
    colonies: data.colonies,
    log: data.log,
  });
  data.stars.forEach((level, i) => (game.stars[i].level = level));
  data.currents.forEach((known, i) => (game.currents[i].known = known));
  for (const [key, tiles] of data.surfaces) {
    const [starId, planetIndex] = key.split('-').map(Number);
    const surface = getSurface(game, starId, planetIndex);
    tiles.forEach((tile, i) => Object.assign(surface.tiles[i], tile));
  }
  return game;
}

// Résumé affiché dans le menu, sans relire toute la partie.
export function summary(data) {
  return {
    day: Math.floor(data.time) + 1,
    colonies: data.colonies.length,
    ships: data.ships.length,
    savedAt: new Date(data.savedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
    seed: data.seed,
  };
}

// Le stockage du navigateur peut être indisponible (navigation privée, quota) : on ne plante jamais.
function read(key) {
  try {
    const text = localStorage.getItem(PREFIX + key);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export const readSlot = (slot) => read(slot);

export function writeSlot(slot, game) {
  try {
    localStorage.setItem(PREFIX + slot, JSON.stringify(serialize(game)));
    return true;
  } catch {
    return false;
  }
}

// Charger = recharger la page avec la sauvegarde en attente : toutes les vues repartent proprement.
export function loadAndRestart(data) {
  try {
    sessionStorage.setItem(PENDING, JSON.stringify(data));
  } catch {
    return false;
  }
  location.href = location.pathname;
  return true;
}

export function takePendingLoad() {
  try {
    const text = sessionStorage.getItem(PENDING);
    sessionStorage.removeItem(PENDING);
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export function newGameAndRestart() {
  try {
    sessionStorage.setItem(`${PREFIX}nouvelle`, '1');
  } catch {
    /* sans stockage, la page rechargée démarre de toute façon une nouvelle partie */
  }
  location.href = location.pathname;
}

export function takeNewGameRequest() {
  try {
    const asked = sessionStorage.getItem(`${PREFIX}nouvelle`) === '1';
    sessionStorage.removeItem(`${PREFIX}nouvelle`);
    return asked;
  } catch {
    return false;
  }
}

export function exportFile(game) {
  const blob = new Blob([JSON.stringify(serialize(game))], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `amas-inexplore-jour-${currentDay(game)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function importFile(file) {
  return file.text().then((text) => {
    const data = JSON.parse(text);
    restore(data); // vérifie qu'elle se relit avant de recharger la page
    return data;
  });
}
