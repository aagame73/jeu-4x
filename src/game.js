// État de la partie et règles : vaisseaux, exploration, colonies, chantiers spatiaux.
// Le temps est continu et compté en jours ; la partie avance en temps réel, avec une pause.
//   Niveau 0 : inconnu (invisible)
//   Niveau 1 : lueur repérée
//   Niveau 2 : système survolé (seules les grosses planètes sont vues)
//   Niveau 3 : système analysé (toutes les planètes et leurs gisements sont connus)
//
// Début de partie : l'Arche, un vaisseau colonie aux moteurs de saut cassés, arrive dans un
// système. Le joueur l'analyse, choisit une planète et y pose la colonie ; il construit ensuite
// un spatioport, des sondes (qui s'usent), un dock spatial, des défenses, des vaisseaux colonie.
import { CONFIG } from './config.js';
import { generateCluster, starDistance, STAR_TYPES } from './galaxy.js';
import { SHIP_NAMES, SHIP_ACCENTS } from './ships.js';
import { generateSurface, hexDistance } from './surface.js';
import { tickColony, colonyReport, SHIPYARD, canAfford, RESOURCE_LABELS } from './economy.js';
import { TECHS, hasTech, bindResearch, markTech, techCost } from './research.js';
import { SPECIES, DEFAULT_SPECIES, RIVALS, DIPLOMACY } from './config.js';
import { tickCombat } from './combat.js';
import { applyDeal, breakTreaties, declareWar, describeOffer, evaluateDeal, tickConvoys, tickDiplomacy } from './diplomacy.js';
import { line } from './dialogues.js';
import { createEmpires, tickEmpires, revealEmpires, rivalColonyAt, newContacts } from './empires.js';
import { bindSpecies, speciesBonus, speciesHabitat, hostilePenalty, currentSpecies, normalizeRivals, rivalInfo } from './species.js';

export const LEVEL_LABELS = ['Inconnu', 'Lueur repérée', 'Système survolé', 'Système analysé'];

export const STARTING_RESOURCES = { minerais: 80, alliages: 10, biomasse: 40, eau: 30, deuterium: 20, velarine: 0, artefacts: 0 };
const FUEL_PER_LIGHT_YEAR = 1 / 6; // deutérium brûlé par année-lumière (moitié moins sur un courant)

// lifespan : durée de vie en jours (null = sans limite) ; speed : facteur de vitesse.
// size : petit, moyen, grand, gigantesque ; attack / defense : valeurs de base (vaisseaux de guerre).
export const SHIP_KINDS = {
  arche: { label: 'Arche', prefix: 'Arche', registry: 'ARC', size: 'gigantesque', speed: 0, lifespan: null, attack: 0, defense: 20, analyse: true, found: true, population: 4 },
  sonde: { label: 'Sonde', prefix: 'Sonde', registry: 'SX', size: 'petit', speed: 1, lifespan: 180, attack: 0, defense: 1, analyse: true, found: false },
  corvette: { label: 'Corvette', prefix: 'Corvette', registry: 'CO', size: 'petit', speed: 1.2, lifespan: 240, attack: 2, defense: 2, warship: true },
  fregate: { label: 'Frégate', prefix: 'Frégate', registry: 'FR', size: 'moyen', speed: 1, lifespan: 300, attack: 5, defense: 5, warship: true },
  colonie: { label: 'Vaisseau colonie', prefix: 'Colonie', registry: 'CV', size: 'moyen', speed: 0.6, lifespan: 300, attack: 0, defense: 3, analyse: false, found: true, population: 2 },
  croiseur: { label: 'Croiseur', prefix: 'Croiseur', registry: 'CR', size: 'grand', speed: 0.8, lifespan: 400, attack: 10, defense: 12, warship: true },
  transport: { label: 'Transport colonial', prefix: 'Transport', registry: 'TC', size: 'grand', speed: 0.5, lifespan: 400, attack: 0, defense: 6, analyse: false, found: true, population: 5 },
  cuirasse: { label: 'Cuirassé', prefix: 'Cuirassé', registry: 'CU', size: 'gigantesque', speed: 0.6, lifespan: 500, attack: 22, defense: 25, warship: true },
};

export const SIZE_LABELS = { petit: 'Petit', moyen: 'Moyen', grand: 'Grand', gigantesque: 'Gigantesque' };
const SIZE_FUEL = { petit: 1, moyen: 1.5, grand: 2, gigantesque: 3 }; // deutérium brûlé selon la taille

// Caractéristiques d'un vaisseau, bonus de recherche compris.
export function shipStats(game, ship) {
  const def = SHIP_KINDS[ship.kind];
  const speedBonus = (hasTech('moteurs-ameliores') ? 1.3 : 1) * (hasTech('moteurs-fusion') ? 1.3 : 1) * (hasTech('propulsion-velarine') ? 1.4 : 1);
  const attackBonus = (hasTech('lasers') ? 1.3 : 1) * (hasTech('torpilles-plasma') ? 1.3 : 1) * (hasTech('lance-gravite') ? 1.5 : 1);
  const defenseBonus =
    (hasTech('boucliers-deflecteurs') ? 1.25 : 1) * (hasTech('alliages-composites') ? 1.25 : 1) * (hasTech('blindage-veilleurs') ? 1.5 : 1);
  const fuelFactor =
    SIZE_FUEL[def.size] * (hasTech('injecteurs') ? 0.75 : 1) * (hasTech('recyclage-deuterium') ? 0.75 : 1) * speciesBonus('fuel');
  return {
    attack: Math.round(def.attack * attackBonus * speciesBonus('shipAttack')),
    defense: Math.round(def.defense * defenseBonus * speciesBonus('shipDefense')),
    speed: CONFIG.probeSpeed * def.speed * speedBonus * speciesBonus('shipSpeed'),
    lifespan: lifespan(game, ship),
    fuelFactor,
  };
}

// species : clé dans SPECIES (config.js) ; une clé inconnue retombe sur le profil neutre.
// rivals : nombre d'empires rivaux (RIVALS dans config.js).
export function createGame(seed, species = DEFAULT_SPECIES, rivals = RIVALS.default) {
  const playerSpecies = SPECIES[species] ? species : DEFAULT_SPECIES;
  const rivalCount = normalizeRivals(rivals);
  const galaxy = generateCluster(seed, playerSpecies, rivalCount);
  const game = {
    seed,
    species: playerSpecies,
    rivals: rivalCount,
    time: 0, // en jours
    speedIndex: 0,
    paused: true,
    stars: galaxy.stars,
    currents: galaxy.currents,
    homeId: galaxy.homeId,
    ships: [],
    nextShipId: 0,
    log: [],
    selectedStarId: galaxy.homeId,
    selectedShipId: null,
    resources: { ...STARTING_RESOURCES }, // la cargaison de l'Arche
    lore: 0, // fragments d'histoire des Veilleurs déjà révélés
    upgrades: { moteurs: false, blindage: false }, // posées par les technologies
    research: { current: null, progress: 0, done: [], bank: 0, partial: {}, paid: [] },
    surfaces: new Map(), // surfaces générées à la demande, clé "étoile-planète"
    colonies: [],
    empires: createEmpires(galaxy.stars),
    contacts: [], // espèces à présenter à l'écran (premier contact), non enregistré
    convoys: [], // matières reçues par échange, en route
    fleets: [], // flottes de guerre des rivaux
    nextFleetId: 0,
    proposals: [], // propositions des rivaux en attente de réponse
    nextConvoyId: 0,
  };
  bindResearch(game.research);
  const home = game.stars[game.homeId];
  home.level = 2;
  sense(game, home);
  revealCurrents(game, home, false);
  bindSpecies(game.species);
  const arche = addShip(game, 'arche', home.id);
  if (SPECIES[game.species].arkName) arche.name = SPECIES[game.species].arkName;
  game.selectedShipId = arche.id;
  addLog(game, `L'${arche.name} sort de l'hyperespace en catastrophe dans le système ${home.name}. Ses moteurs de saut sont hors service : il faudra s'installer ici.`, 'alert');
  addLog(game, 'Analysez le système avec l\'Arche, puis choisissez la planète où fonder la colonie.');
  return game;
}

// --- Vaisseaux -------------------------------------------------------------------------

export const selectedShip = (game) => game.ships.find((s) => s.id === game.selectedShipId) ?? null;

function addShip(game, kind, starId) {
  const id = game.nextShipId++;
  const def = SHIP_KINDS[kind];
  let base = SHIP_NAMES[(game.seed + id * 3) % SHIP_NAMES.length];
  let name = `${def.prefix} ${base}`;
  for (let n = 2; game.ships.some((s) => s.name === name); n++) name = `${def.prefix} ${base} ${n}`;
  const ship = {
    id,
    kind,
    name,
    shipSeed: (game.seed * 7919 + id * 104729) >>> 0,
    accent: kind === 'arche' ? '#ffffff' : SHIP_ACCENTS[id % SHIP_ACCENTS.length],
    registry: `${def.registry}-${String((game.seed * 13 + id * 271) % 1000).padStart(3, '0')}`,
    starId,
    state: 'idle',
    toId: null,
    fromId: null,
    distance: 0,
    speed: 0,
    progress: 0,
    daysLeft: 0,
    age: 0,
    worn: false,
  };
  game.ships.push(ship);
  return ship;
}

export function removeShip(game, ship) {
  game.ships = game.ships.filter((s) => s !== ship);
  if (game.selectedShipId === ship.id) game.selectedShipId = game.ships[0]?.id ?? null;
}

export function lifespan(game, ship) {
  const base = SHIP_KINDS[ship.kind].lifespan;
  return base === null ? null : base * (game.upgrades.blindage || hasTech('coques-renforcees') ? 1.5 : 1) * speciesBonus('shipLifespan');
}

export const currentDay = (game) => Math.floor(game.time) + 1;

// Jours restants avant la fin du voyage ou de l'analyse, arrondis au jour supérieur.
export function daysLeft(ship) {
  if (ship.state === 'travel') return Math.max(1, Math.ceil((ship.distance - ship.progress) / ship.speed));
  if (ship.state === 'analyse') return Math.max(1, Math.ceil(ship.daysLeft));
  return 0;
}

// Avancement de 0 à 1 (voyage ou analyse), pour l'affichage.
export function shipProgress(ship) {
  if (ship.state === 'travel') return Math.min(1, ship.progress / ship.distance);
  if (ship.state === 'analyse') return 1 - ship.daysLeft / CONFIG.analyseDays;
  return 0;
}

export function starLabel(star) {
  return star.level >= 2 ? star.name : 'une lueur inconnue';
}

function addLog(game, text, kind = 'info') {
  game.log.push({ day: currentDay(game), text, kind });
}

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Les capteurs d'un vaisseau repèrent les étoiles proches sous forme de lueurs.
function sense(game, star) {
  let count = 0;
  for (const s of game.stars) {
    if (s.level === 0 && starDistance(s, star) <= CONFIG.sensorRange + (hasTech('cartographie') ? 8 : 0)) {
      s.level = 1;
      count++;
    }
  }
  return count;
}

function revealCurrents(game, star, log = true) {
  for (const c of game.currents) {
    if (c.known || (c.a !== star.id && c.b !== star.id)) continue;
    c.known = true;
    const other = game.stars[c.a === star.id ? c.b : c.a];
    if (other.level === 0) other.level = 1;
    if (log) addLog(game, `Un courant gravitationnel relie ${star.name} à ${starLabel(other)}.`, 'discovery');
  }
}

export function currentBetween(game, a, b) {
  return game.currents.find((c) => c.known && ((c.a === a && c.b === b) || (c.a === b && c.b === a)));
}

// Peut-on envoyer ce vaisseau vers cette étoile ? Renvoie { ok, days, speed, distance, viaCurrent } ou { ok: false, reason }.
export function canReach(game, ship, star) {
  if (!ship) return { ok: false, reason: 'Aucun vaisseau sélectionné.' };
  const def = SHIP_KINDS[ship.kind];
  if (ship.state !== 'idle') return { ok: false, reason: `${ship.name} est occupé.` };
  if (star.level < 1) return { ok: false, reason: 'Étoile inconnue.' };
  if (ship.starId === star.id) return { ok: false, reason: `${ship.name} est déjà ici.` };
  if (!def.speed) return { ok: false, reason: `Les moteurs de saut de l'${ship.name} sont hors service.` };
  const distance = starDistance(game.stars[ship.starId], star);
  const viaCurrent = !!currentBetween(game, ship.starId, star.id);
  if (!viaCurrent && distance > jumpRange()) {
    return { ok: false, reason: `Hors de portée : ${Math.round(distance)} al (portée ${jumpRange()} al).` };
  }
  const stats = shipStats(game, ship);
  const speed = stats.speed * (viaCurrent ? CONFIG.currentSpeedFactor : 1);
  const fuel = Math.max(1, Math.ceil(distance * FUEL_PER_LIGHT_YEAR * stats.fuelFactor * (viaCurrent ? 0.5 : 1)));
  if ((game.resources.deuterium ?? 0) < fuel) return { ok: false, reason: `Pas assez de deutérium (${fuel} nécessaires).` };
  return { ok: true, distance, speed, fuel, days: Math.max(1, Math.ceil(distance / speed)), viaCurrent };
}

// La portée de saut grandit avec la recherche.
export const jumpRange = () => (hasTech('propulsion-velarine') ? 50 : hasTech('saut-long') ? 40 : hasTech('saut-moyen') ? 30 : CONFIG.jumpRange);

export function reachableStars(game, ship) {
  return game.stars.filter((s) => canReach(game, ship, s).ok);
}

export function sendShip(game, ship, star) {
  const r = canReach(game, ship, star);
  if (!r.ok) return false;
  game.resources.deuterium -= r.fuel;
  Object.assign(ship, { state: 'travel', fromId: ship.starId, toId: star.id, distance: r.distance, speed: r.speed, progress: 0 });
  addLog(game, `${ship.name} part vers ${starLabel(star)} (${plural(r.days, 'jour')}${r.viaCurrent ? ', par le courant' : ''}).`);
  return true;
}

export function canAnalyse(ship, star) {
  return !!ship && SHIP_KINDS[ship.kind].analyse && ship.state === 'idle' && ship.starId === star.id && star.level === 2;
}

export function startAnalysis(game, ship) {
  const star = game.stars[ship.starId];
  if (!canAnalyse(ship, star)) return false;
  Object.assign(ship, { state: 'analyse', daysLeft: CONFIG.analyseDays });
  addLog(game, `${ship.name} commence l'analyse de ${star.name}.`);
  return true;
}

// --- Colonies ----------------------------------------------------------------------------

export function getSurface(game, starId, planetIndex) {
  const key = `${starId}-${planetIndex}`;
  if (!game.surfaces.has(key)) {
    const seed = (game.seed * 1000003 + starId * 9176 + planetIndex * 131) >>> 0;
    game.surfaces.set(key, generateSurface(seed, game.stars[starId].planets[planetIndex]));
  }
  return game.surfaces.get(key);
}

export function colonyOn(game, starId, planetIndex) {
  return game.colonies.find((c) => c.starId === starId && c.planetIndex === planetIndex) ?? null;
}

// Ce vaisseau peut-il fonder une colonie sur cette planète ? Renvoie une raison si non.
export function foundingProblem(game, ship, starId, planetIndex) {
  if (!ship || !SHIP_KINDS[ship.kind].found) return 'Il faut une Arche ou un vaisseau colonie.';
  const star = game.stars[starId];
  const planet = star.planets[planetIndex];
  if (ship.starId !== starId || ship.state !== 'idle') return `${ship.name} doit être en attente dans ce système.`;
  if (star.level < 3) return "Analysez d'abord le système.";
  if (!planet.size) return 'Cette planète ne se colonise pas.';
  const occupant = planet.inhabitedBy ?? rivalColonyAt(game, starId, planetIndex)?.empire.species;
  if (occupant) {
    const rival = rivalInfo(occupant);
    return `Planète habitée par les ${rival.label} (${rival.empire}).`;
  }
  if (colonyOn(game, starId, planetIndex)) return 'Une colonie existe déjà ici.';
  // L'Arche peut toujours se poser (ses moteurs sont cassés) ; les autres attendent la recherche.
  if (speciesHabitat(planet) === 'hostile' && ship.kind !== 'arche' && !hasTech('adaptation-xenobiologique')) {
    return `Milieu hostile aux ${currentSpecies().label} : recherchez Adaptation xénobiologique.`;
  }
  return null;
}

// Colons au départ : +1 sur une planète favorable, 1 de moins sur une planète hostile (minimum 1).
function foundingPopulation(ship, habitat) {
  const base = SHIP_KINDS[ship.kind].population;
  if (habitat === 'favored') return base + 1;
  if (habitat === 'hostile') return Math.max(1, base - hostilePenalty(hasTech('biospheres-adaptatives')).colonists);
  return base;
}

export function foundColony(game, ship, starId, planetIndex, tileIndex) {
  if (foundingProblem(game, ship, starId, planetIndex)) return false;
  const surface = getSurface(game, starId, planetIndex);
  const tile = surface.tiles[tileIndex];
  if (!tile || tile.terrain === 'ocean' || tile.building || tile.deposit?.resource === 'minerais' || tile.deposit?.resource === 'velarine') return false;
  const planet = game.stars[starId].planets[planetIndex];
  const first = ship.kind === 'arche'; // la toute première colonie, même après avoir tout perdu
  for (const empire of breakTreaties(game, starId)) {
    addLog(game, `Traité de frontières rompu avec les ${rivalInfo(empire.species).label}. « ${line(empire.species, 'rupture')} »`, 'alert');
  }
  const habitat = speciesHabitat(planet);
  tile.terrain = 'plaine';
  tile.building = { type: 'centre', done: true };
  // Pour la première colonie, les scanners de l'Arche repèrent toujours un filon de minerais.
  if (first && !surface.tiles.some((t) => t.deposit?.resource === 'minerais')) {
    const spot = surface.tiles
      .filter((t) => !t.building && !t.deposit && t.terrain !== 'ocean')
      .sort((a, b) => hexDistance(a, tile) - hexDistance(b, tile))[1];
    if (spot) spot.deposit = { resource: 'minerais', richness: 2 };
  }
  game.colonies.push({
    starId,
    planetIndex,
    name: planet.name,
    population: foundingPopulation(ship, habitat),
    habitat, // 'favored', 'hostile' ou null pour l'espèce de la partie
    growth: 0,
    construction: null,
    shipyard: null,
    famine: false,
    orbital: { dock: false, defense: 0, ecope: false },
    thirst: false,
  });
  addLog(
    game,
    ship.kind === 'arche'
      ? `L'${ship.name} se pose sur ${planet.name}. Elle devient le centre de votre première colonie.`
      : `${ship.name} fonde une nouvelle colonie sur ${planet.name}.`,
    'discovery',
  );
  if (first) addLog(game, 'Construisez un laboratoire pour faire avancer la recherche (touche R) : moteurs de saut, spatioport, fonderie…');
  removeShip(game, ship);
  return true;
}

// --- Recherche --------------------------------------------------------------------------

export function researchPerDay(game) {
  return game.colonies.reduce((sum, c) => sum + colonyReport(c, getSurface(game, c.starId, c.planetIndex)).perDay.recherche, 0);
}

export function researchStatus(game, key) {
  if (hasTech(key)) return 'done';
  if (game.research.current === key) return 'current';
  return TECHS[key].requires.every(hasTech) ? 'available' : 'locked';
}

export function researchProblem(game, key) {
  const tech = TECHS[key];
  if (hasTech(key)) return 'Déjà acquise.';
  if (game.research.current === key) return 'Recherche en cours.';
  const missing = tech.requires.filter((k) => !hasTech(k));
  if (missing.length) return `Demande : ${missing.map((k) => TECHS[k].label).join(', ')}.`;
  if (tech.artefacts && !game.research.paid.includes(key) && (game.resources.artefacts ?? 0) < tech.artefacts) {
    return `Demande ${tech.artefacts} artefact${tech.artefacts > 1 ? 's' : ''} des Veilleurs.`;
  }
  return null;
}

// Changer de projet garde les points déjà investis dans l'ancien ; les artefacts ne se paient qu'une fois.
export function startResearch(game, key) {
  if (researchProblem(game, key)) return false;
  const r = game.research;
  const tech = TECHS[key];
  if (r.current) r.partial[r.current] = r.progress;
  if (tech.artefacts && !r.paid.includes(key)) {
    game.resources.artefacts -= tech.artefacts;
    r.paid.push(key);
  }
  r.current = key;
  r.progress = (r.partial[key] ?? 0) + r.bank;
  r.bank = 0;
  delete r.partial[key];
  addLog(game, `Recherche lancée : ${tech.label}.`);
  checkResearchDone(game);
  return true;
}

function checkResearchDone(game) {
  const r = game.research;
  const tech = TECHS[r.current];
  if (!tech || r.progress < techCost(tech)) return;
  const key = r.current;
  r.bank = r.progress - techCost(tech); // le surplus n'est pas perdu
  r.current = null;
  r.progress = 0;
  markTech(r, key);
  applyTech(game, key);
  addLog(game, `Recherche terminée : ${tech.label}. ${tech.unlocks}`, 'discovery');
}

// Défense d'une colonie : anneaux de défense et batteries planétaires, renforcés par la recherche.
export function colonyDefense(game, colony) {
  const surface = getSurface(game, colony.starId, colony.planetIndex);
  const batteries = surface.tiles.filter((t) => t.building?.type === 'batterie' && t.building.done).reduce((sum, t) => sum + 5 * (t.building.level ?? 1), 0);
  const rings = colony.orbital.defense * 10 * (hasTech('boucliers-deflecteurs') ? 1.25 : 1);
  return Math.round((rings + batteries) * (hasTech('champ-stase') ? 2 : 1) * speciesBonus('colonyDefense'));
}

function applyTech(game, key) {
  if (key === 'moteurs-ameliores') game.upgrades.moteurs = true;
  if (key === 'coques-renforcees') game.upgrades.blindage = true;
  if (key === 'glyphes') {
    for (const c of game.currents) {
      c.known = true;
      for (const id of [c.a, c.b]) if (game.stars[id].level === 0) game.stars[id].level = 1;
    }
  }
}

function tickResearch(game, days) {
  const points = researchPerDay(game) * days;
  const r = game.research;
  if (!r.current) {
    r.bank += points;
    return;
  }
  r.progress += points;
  checkResearchDone(game);
}

// --- Chantier spatial (sondes, vaisseaux colonie, structures orbitales, améliorations) -----

export function shipyardProblem(game, colony, key) {
  const order = SHIPYARD[key];
  const missing = [order.tech ?? []].flat().filter((k) => !hasTech(k));
  if (missing.length) return `Recherche nécessaire : ${missing.map((k) => TECHS[k].label).join(', ')}.`;
  const surface = getSurface(game, colony.starId, colony.planetIndex);
  const hasSpaceport = surface.tiles.some((t) => t.building?.type === 'spatioport' && t.building.done);
  if (!hasSpaceport) return 'Demande un spatioport.';
  if (order.requires === 'dock' && !colony.orbital.dock) return 'Demande un dock spatial.';
  if (key === 'dock' && colony.orbital.dock) return 'Déjà construit.';
  if (key === 'defense' && colony.orbital.defense >= 3) return 'Maximum atteint (3).';
  if (key === 'ecope' && colony.orbital.ecope) return 'Déjà construite.';
  if (key === 'ecope' && !game.stars[colony.starId].planets.some((p) => p.type === 'gazeuse')) return 'Aucune géante gazeuse dans ce système.';
  if (order.kind === 'upgrade' && game.upgrades[key]) return 'Déjà acquise.';
  if (colony.shipyard) return 'Le chantier spatial est occupé.';
  if (!canAfford(game.resources, order.cost)) return 'Pas assez de ressources.';
  return null;
}

// Durée d'une commande du chantier spatial, bonus d'espèce compris.
export const shipyardDays = (key) => Math.max(1, Math.ceil(SHIPYARD[key].days * speciesBonus('shipyardTime')));

export function startShipyard(game, colony, key) {
  if (shipyardProblem(game, colony, key)) return false;
  const order = SHIPYARD[key];
  for (const [res, n] of Object.entries(order.cost)) game.resources[res] -= n;
  colony.shipyard = { key, daysLeft: shipyardDays(key), total: shipyardDays(key) };
  addLog(game, `Chantier spatial de ${colony.name} : ${order.label} en construction.`);
  return true;
}

function completeShipyard(game, colony) {
  const { key } = colony.shipyard;
  const order = SHIPYARD[key];
  colony.shipyard = null;
  if (order.kind === 'ship') {
    const ship = addShip(game, key, colony.starId);
    if (game.selectedShipId === null) game.selectedShipId = ship.id;
    addLog(game, `${ship.name} quitte le chantier de ${colony.name} et attend vos ordres.`, 'build');
  } else if (key === 'dock') {
    colony.orbital.dock = true;
    addLog(game, `Le dock spatial de ${colony.name} est en service.`, 'build');
  } else if (key === 'ecope') {
    colony.orbital.ecope = true;
    addLog(game, `L'écope gazeuse de ${colony.name} puise son premier deutérium.`, 'build');
  } else if (key === 'defense') {
    colony.orbital.defense++;
    addLog(game, `Anneau de défense n° ${colony.orbital.defense} opérationnel au-dessus de ${colony.name}.`, 'build');
  } else {
    game.upgrades[key] = true;
    addLog(game, `Amélioration terminée : ${order.label}.`, 'build');
  }
}

// --- Le temps --------------------------------------------------------------------------

// Fait avancer le temps de `days` jours. Renvoie true si un événement a eu lieu.
export function tick(game, days) {
  game.time += days;
  let changed = false;
  for (const ship of [...game.ships]) {
    if (ship.state === 'travel') {
      ship.progress += ship.speed * days;
      if (ship.progress >= ship.distance) {
        arrive(game, ship);
        changed = true;
      }
    } else if (ship.state === 'analyse') {
      ship.daysLeft -= days;
      if (ship.daysLeft <= 0) {
        completeAnalysis(game, ship);
        changed = true;
      }
    }
    // Usure : les vaisseaux ne sont pas éternels.
    const life = lifespan(game, ship);
    if (life !== null) {
      ship.age += days;
      if (!ship.worn && ship.age >= life * 0.85) {
        ship.worn = true;
        addLog(game, `${ship.name} montre des signes d'usure : il lui reste peu de temps.`, 'alert');
        changed = true;
      }
      if (ship.age >= life) {
        addLog(game, `${ship.name} cesse d'émettre près de ${starLabel(game.stars[ship.starId])}.`, 'alert');
        removeShip(game, ship);
        changed = true;
      }
    }
  }
  for (const { colony } of tickEmpires(game, days)) {
    // Un vaisseau du joueur sur place voit la colonie s'installer.
    if (game.ships.some((s) => s.starId === colony.starId && s.state !== 'travel')) changed = discoverRivals(game, colony.starId) || changed;
  }
  for (const convoy of tickConvoys(game, days)) {
    if (convoy.supply) continue; // ravitaillement ennemi : livré à son empire, le joueur n'en sait rien
    const goods = Object.entries(convoy.resources).map(([res, n]) => `${n} ${(RESOURCE_LABELS[res] ?? res).toLowerCase()}`).join(', ');
    addLog(game, `Convoi des ${rivalInfo(convoy.species).label} arrivé à ${game.stars[convoy.toId].name} : ${goods}.`, 'build');
    changed = true;
  }
  for (const event of tickDiplomacy(game, days)) {
    const { empire } = event;
    const label = rivalInfo(empire.species).label;
    if (event.type === 'ended') addLog(game, `${DIPLOMACY.treaties[event.key].label} avec les ${label} : arrivé à son terme.`, 'info');
    else if (event.type === 'attitude') {
      addLog(game, `Les ${label} vous jugent désormais : ${event.attitude.label.toLowerCase()}. « ${line(empire.species, event.better ? 'plusAmical' : 'plusHostile')} »`, event.better ? 'info' : 'alert');
    } else if (event.type === 'proposal') {
      addLog(game, `Les ${label} proposent ${describeOffer(event.proposal.offer)}. « ${line(empire.species, 'proposition')} » Répondez dans la diplomatie (D).`, 'alert');
    } else if (event.type === 'expired') addLog(game, `La proposition des ${label} a expiré.`, 'info');
    else if (event.type === 'war') addLog(game, `Les ${label} vous déclarent la guerre ! « ${line(empire.species, 'guerre')} »`, 'alert');
    changed = true;
  }
  for (const event of tickCombat(game, days)) {
    // Réplique de l'empire concerné, selon ce qui vient d'arriver.
    const situation = { 'colony-lost': 'victoire', 'fleet-lost': 'defaite', pillage: 'pillage' }[event.type];
    addLog(game, situation && event.species ? `${event.text} « ${line(event.species, situation)} »` : event.text, event.kind ?? 'alert');
    changed = true;
  }
  const logLength = game.log.length;
  tickResearch(game, days);
  if (game.log.length !== logLength) changed = true;
  for (const colony of game.colonies) {
    for (const text of tickColony(game, colony, getSurface(game, colony.starId, colony.planetIndex), days)) {
      addLog(game, text, 'build');
      changed = true;
    }
    if (colony.shipyard) {
      colony.shipyard.daysLeft -= days;
      if (colony.shipyard.daysLeft <= 0) {
        completeShipyard(game, colony);
        changed = true;
      }
    }
  }
  return changed;
}

// --- Échanges ---------------------------------------------------------------------------

// Propose un échange à un empire ; s'il accepte, il prend effet. Renvoie la réponse de l'empire.
export function signDeal(game, empire, offer) {
  const answer = evaluateDeal(game, empire, offer);
  if (!answer.ok) return answer;
  const { techs, convoy } = applyDeal(game, empire, offer, answer);
  for (const key of techs) {
    const r = game.research;
    // L'effort déjà fourni sur cette technologie n'est pas perdu : il part dans les points de côté.
    if (r.current === key) {
      r.bank = (r.bank ?? 0) + r.progress;
      r.current = null;
      r.progress = 0;
    }
    if (r.partial?.[key]) {
      r.bank = (r.bank ?? 0) + r.partial[key];
      delete r.partial[key];
    }
    markTech(r, key);
    applyTech(game, key);
    addLog(game, `Technologie obtenue par échange : ${TECHS[key].label}. ${TECHS[key].unlocks}`, 'discovery');
  }
  const travel = convoy ? ` Un convoi part de ${game.stars[convoy.fromId].name} : arrivée dans ${Math.ceil(convoy.distance / DIPLOMACY.convoySpeed)} jours.` : '';
  if (offer.get.peace) addLog(game, `Paix signée avec les ${rivalInfo(empire.species).label}. Trêve jusqu'au jour ${Math.floor(empire.truceUntil) + 1}. « ${line(empire.species, 'paix')} »`, 'info');
  else addLog(game, `Échange conclu avec les ${rivalInfo(empire.species).label}.${travel}`, 'info');
  return answer;
}

// Le joueur déclare la guerre à un empire rencontré. Renvoie false si c'est impossible.
export function declareWarOn(game, empire) {
  if (!empire.met || empire.war) return false;
  declareWar(game, empire, true);
  addLog(game, `Vous déclarez la guerre aux ${rivalInfo(empire.species).label}. Traités rompus, commerce interrompu.`, 'alert');
  return true;
}

// --- Exploration -----------------------------------------------------------------------

// Un vaisseau du joueur découvre les colonies rivales de son système. Avant l'analyse, on ne
// sait pas encore de qui il s'agit (l'identité vient avec knownRival).
function discoverRivals(game, starId) {
  const star = game.stars[starId];
  const found = revealEmpires(game, starId);
  if (found.some(({ colony, empire }) => colony.starId !== empire.homeId)) addLog(game, `Une colonie étrangère est installée dans le système ${star.name}.`, 'alert');
  announceContacts(game);
  return found.length > 0;
}

function announceContacts(game) {
  for (const { species } of newContacts(game)) {
    const rival = rivalInfo(species);
    addLog(game, `Premier contact avec les ${rival.label} : ${rival.empire}.`, 'alert');
    game.contacts.push(species);
  }
}

// Au premier passage, on ne repère que les grosses planètes (géantes gazeuses, grandes
// planètes, et une moyenne sur deux) ; l'analyse révèle toutes les autres.
function isDetectable(planet, index) {
  if (planet.moonOf !== undefined) return false; // les lunes ne se voient qu'à l'analyse
  return planet.type === 'gazeuse' || planet.size === 'grande' || (planet.size === 'moyenne' && index % 2 === 0);
}

export function visiblePlanets(star) {
  if (star.level >= 3) return star.planets;
  if (star.level < 2) return [];
  const detected = star.planets.filter(isDetectable);
  return detected.length || star.planets.length === 0 ? detected : [star.planets[0]];
}

function arrive(game, ship) {
  const star = game.stars[ship.toId];
  Object.assign(ship, { starId: star.id, state: 'idle', fromId: null, toId: null });
  if (star.level < 2) {
    star.level = 2;
    const n = visiblePlanets(star).length;
    const found = n === 0 ? 'aucune planète détectée' : `${plural(n, 'planète')} ${n > 1 ? 'détectées' : 'détectée'}`;
    addLog(game, `${ship.name} atteint ${star.name} (${STAR_TYPES[star.type].label.toLowerCase()}) : ${found}.`, 'discovery');
    if (star.rival) addLog(game, `Des signaux artificiels émanent de ${star.name}. Une autre espèce vit ici.`, 'alert');
  } else {
    addLog(game, `${ship.name} arrive à ${star.name}.`);
  }
  const seen = sense(game, star);
  if (seen > 0) addLog(game, `${seen} ${seen > 1 ? 'nouvelles lueurs' : 'nouvelle lueur'} autour de ${star.name}.`);
  revealCurrents(game, star);
  discoverRivals(game, star.id);
}

function completeAnalysis(game, ship) {
  const star = game.stars[ship.starId];
  const hidden = star.planets.length - visiblePlanets(star).length;
  star.level = 3;
  ship.state = 'idle';
  const parts = [`Analyse de ${star.name} terminée.`];
  if (hidden > 0) parts.push(hidden > 1 ? `${hidden} planètes cachées découvertes.` : '1 planète cachée découverte.');
  const ruins = star.planets.filter((p) => p.ruins);
  const velarine = star.planets.filter((p) => p.deposits.velarine > 0);
  const rich = star.planets.filter((p) => ['minerais', 'energie', 'biomasse'].some((r) => p.deposits[r] === 3));
  if (star.rival) {
    const rival = rivalInfo(star.rival);
    parts.push(`C'est le monde natal des ${rival.label} (${rival.empire}).`);
  }
  const settlers = new Set(star.planets.map((p) => p.inhabitedBy).filter((key) => key && key !== star.rival));
  for (const key of settlers) {
    const rival = rivalInfo(key);
    parts.push(`Colonie des ${rival.label} (${rival.empire}) dans ce système.`);
  }
  if (ruins.length) parts.push(`Ruines des Veilleurs sur ${ruins.map((p) => p.name).join(', ')} !`);
  if (velarine.length) parts.push(`Vélarine sur ${velarine.map((p) => p.name).join(', ')}.`);
  if (rich.length) parts.push(`Gisement riche sur ${rich.map((p) => p.name).join(', ')}.`);
  if (parts.length === 1) parts.push('Rien de remarquable.');
  addLog(game, parts.join(' '), ruins.length || velarine.length ? 'discovery' : 'info');
  if (ship.kind === 'arche' && game.colonies.length === 0) {
    addLog(game, 'Choisissez maintenant une planète dans la fiche du système, puis la case où poser la colonie.');
  }
  announceContacts(game);
}

export function stats(game) {
  return {
    seen: game.stars.filter((s) => s.level >= 1).length,
    explored: game.stars.filter((s) => s.level >= 2).length,
    analysed: game.stars.filter((s) => s.level === 3).length,
    total: game.stars.length,
  };
}
