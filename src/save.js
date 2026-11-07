// Sauvegarde de la partie. L'amas se régénère à l'identique à partir de sa graine :
// on n'enregistre que ce qui a changé (connaissances, vaisseaux, colonies, surfaces bâties…).
import { createGame, getSurface, currentDay, STARTING_RESOURCES } from './game.js';
import { bindResearch, TECHS } from './research.js';
import { DEFAULT_SPECIES, RIVALS } from './config.js';

const VERSION = 1;
const PREFIX = 'amas-inexplore:';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];
const PENDING = `${PREFIX}a-charger`;

export function serialize(game) {
  return {
    version: VERSION,
    savedAt: Date.now(),
    seed: game.seed,
    species: game.species,
    rivals: game.rivals,
    time: game.time,
    speedIndex: game.speedIndex,
    selectedStarId: game.selectedStarId,
    selectedShipId: game.selectedShipId,
    nextShipId: game.nextShipId,
    resources: game.resources,
    lore: game.lore,
    upgrades: game.upgrades,
    research: game.research,
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
  // Une partie d'avant le choix d'espèce reçoit le profil neutre « Colons de l'Arche ».
  // Une partie d'avant le choix du nombre d'adversaires en a toujours eu 4.
  const game = createGame(data.seed, data.species ?? DEFAULT_SPECIES, data.rivals ?? RIVALS.default);
  Object.assign(game, {
    time: data.time,
    speedIndex: data.speedIndex,
    paused: true,
    selectedStarId: data.selectedStarId,
    selectedShipId: data.selectedShipId,
    nextShipId: data.nextShipId,
    // Les sauvegardes d'avant les nouvelles ressources reçoivent les valeurs de départ manquantes.
    resources: { ...STARTING_RESOURCES, ...data.resources },
    lore: data.lore ?? 0,
    upgrades: data.upgrades,
    ships: data.ships,
    colonies: data.colonies.map((c) => ({ ...c, thirst: c.thirst ?? false, orbital: { ecope: false, ...c.orbital } })),
    log: data.log,
  });
  data.stars.forEach((level, i) => (game.stars[i].level = level));
  data.currents.forEach((known, i) => (game.currents[i].known = known));
  for (const [key, tiles] of data.surfaces) {
    const [starId, planetIndex] = key.split('-').map(Number);
    const surface = getSurface(game, starId, planetIndex);
    tiles.forEach((tile, i) => Object.assign(surface.tiles[i], tile));
  }
  game.research = data.research ?? { current: null, progress: 0, done: impliedTechs(game), bank: 0, partial: {}, paid: [] };
  // L'arbre a grandi : une technologie acquise reçoit aussi ses nouveaux prérequis.
  game.research.done = withRequirements(game.research.done.filter((k) => TECHS[k]));
  bindResearch(game.research);
  return game;
}

// Une partie d'avant la recherche reçoit les technologies de ce qu'elle a déjà construit.
function impliedTechs(game) {
  const built = new Set();
  for (const surface of game.surfaces.values()) for (const t of surface.tiles) if (t.building) built.add(t.building.type);
  const techs = new Set();
  const add = (...keys) => keys.forEach((k) => techs.add(k));
  if (built.has('fonderie')) add('metallurgie');
  if (built.has('spatioport')) add('metallurgie', 'mecanique-orbitale');
  if (built.has('pompe')) add('chimie-deuterium');
  if (built.has('fouille')) add('fouilles');
  if (built.has('siphon')) add('reseau-electrique', 'fusion-compacte', 'stabilisation-velarine');
  if (game.ships.some((s) => s.kind === 'sonde') || game.stars.some((s, i) => s.level >= 2 && i !== game.homeId)) add('metallurgie', 'mecanique-orbitale', 'moteurs-saut');
  const colonies = game.colonies;
  if (colonies.some((c) => c.orbital.dock)) add('metallurgie', 'mecanique-orbitale', 'ingenierie-orbitale');
  if (colonies.some((c) => c.orbital.defense)) add('metallurgie', 'mecanique-orbitale', 'reseau-electrique', 'boucliers');
  if (colonies.some((c) => c.orbital.ecope)) add('chimie-deuterium', 'ingenierie-orbitale', 'ecope');
  if (colonies.length > 1 || game.ships.some((s) => s.kind === 'colonie')) add('hydroponie', 'habitats-scelles', 'ingenierie-orbitale');
  if (game.upgrades.moteurs) add('moteurs-saut', 'moteurs-ameliores');
  if (game.upgrades.blindage) add('ingenierie-orbitale', 'coques-renforcees');
  return [...techs];
}

// Ajoute à une liste de technologies tous leurs prérequis.
function withRequirements(keys) {
  const all = new Set();
  const add = (key) => {
    all.add(key);
    TECHS[key].requires.forEach(add);
  };
  keys.forEach(add);
  return [...all];
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

// species : espèce déjà choisie ; sans elle, la page rechargée ouvre l'écran de choix.
export function newGameAndRestart(species = '', rivals = null) {
  try {
    sessionStorage.setItem(`${PREFIX}nouvelle`, species || '?');
    if (rivals !== null) sessionStorage.setItem(`${PREFIX}adversaires`, String(rivals));
  } catch {
    /* sans stockage, la page rechargée démarre de toute façon une nouvelle partie */
  }
  location.href = location.pathname;
}

export function takeRivalsRequest() {
  try {
    const asked = sessionStorage.getItem(`${PREFIX}adversaires`);
    sessionStorage.removeItem(`${PREFIX}adversaires`);
    return asked === null ? null : Number(asked);
  } catch {
    return null;
  }
}

// null : pas de nouvelle partie demandée ; '' : nouvelle partie, espèce à choisir ; sinon la clé de l'espèce.
export function takeNewGameRequest() {
  try {
    const asked = sessionStorage.getItem(`${PREFIX}nouvelle`);
    sessionStorage.removeItem(`${PREFIX}nouvelle`);
    return asked === null ? null : asked === '?' || asked === '1' ? '' : asked;
  } catch {
    return null;
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
