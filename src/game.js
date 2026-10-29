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
import { tickColony, SHIPYARD, canAfford } from './economy.js';

export const LEVEL_LABELS = ['Inconnu', 'Lueur repérée', 'Système survolé', 'Système analysé'];

// lifespan : durée de vie en jours (null = sans limite) ; speed : facteur de vitesse.
export const SHIP_KINDS = {
  arche: { label: 'Arche', prefix: 'Arche', registry: 'ARC', speed: 0, lifespan: null, analyse: true, found: true, population: 4 },
  sonde: { label: 'Sonde', prefix: 'Sonde', registry: 'SX', speed: 1, lifespan: 180, analyse: true, found: false },
  colonie: { label: 'Vaisseau colonie', prefix: 'Colonie', registry: 'CV', speed: 0.6, lifespan: 300, analyse: false, found: true, population: 2 },
};

export function createGame(seed) {
  const galaxy = generateCluster(seed);
  const game = {
    seed,
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
    resources: { minerais: 80, biomasse: 40, velarine: 0 }, // la cargaison de l'Arche
    upgrades: { moteurs: false, blindage: false },
    surfaces: new Map(), // surfaces générées à la demande, clé "étoile-planète"
    colonies: [],
  };
  const home = game.stars[game.homeId];
  home.level = 2;
  sense(game, home);
  revealCurrents(game, home, false);
  const arche = addShip(game, 'arche', home.id);
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

function removeShip(game, ship) {
  game.ships = game.ships.filter((s) => s !== ship);
  if (game.selectedShipId === ship.id) game.selectedShipId = game.ships[0]?.id ?? null;
}

export function lifespan(game, ship) {
  const base = SHIP_KINDS[ship.kind].lifespan;
  return base === null ? null : base * (game.upgrades.blindage ? 1.5 : 1);
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
    if (s.level === 0 && starDistance(s, star) <= CONFIG.sensorRange) {
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
  if (!viaCurrent && distance > CONFIG.jumpRange) {
    return { ok: false, reason: `Hors de portée : ${Math.round(distance)} al (portée ${CONFIG.jumpRange} al).` };
  }
  const speed = CONFIG.probeSpeed * def.speed * (game.upgrades.moteurs ? 1.3 : 1) * (viaCurrent ? CONFIG.currentSpeedFactor : 1);
  return { ok: true, distance, speed, days: Math.max(1, Math.ceil(distance / speed)), viaCurrent };
}

export function reachableStars(game, ship) {
  return game.stars.filter((s) => canReach(game, ship, s).ok);
}

export function sendShip(game, ship, star) {
  const r = canReach(game, ship, star);
  if (!r.ok) return false;
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
  if (planet.inhabitedBy) return `Planète habitée par les ${planet.inhabitedBy}.`;
  if (colonyOn(game, starId, planetIndex)) return 'Une colonie existe déjà ici.';
  return null;
}

export function foundColony(game, ship, starId, planetIndex, tileIndex) {
  if (foundingProblem(game, ship, starId, planetIndex)) return false;
  const surface = getSurface(game, starId, planetIndex);
  const tile = surface.tiles[tileIndex];
  if (!tile || tile.terrain === 'ocean' || tile.building || tile.deposit?.resource === 'minerais' || tile.deposit?.resource === 'velarine') return false;
  const planet = game.stars[starId].planets[planetIndex];
  const first = game.colonies.length === 0;
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
    population: SHIP_KINDS[ship.kind].population,
    growth: 0,
    construction: null,
    shipyard: null,
    famine: false,
    orbital: { dock: false, defense: 0 },
  });
  addLog(
    game,
    ship.kind === 'arche'
      ? `L'${ship.name} se pose sur ${planet.name}. Elle devient le centre de votre première colonie.`
      : `${ship.name} fonde une nouvelle colonie sur ${planet.name}.`,
    'discovery',
  );
  removeShip(game, ship);
  return true;
}

// --- Chantier spatial (sondes, vaisseaux colonie, structures orbitales, améliorations) -----

export function shipyardProblem(game, colony, key) {
  const order = SHIPYARD[key];
  const surface = getSurface(game, colony.starId, colony.planetIndex);
  const hasSpaceport = surface.tiles.some((t) => t.building?.type === 'spatioport' && t.building.done);
  if (!hasSpaceport) return 'Demande un spatioport.';
  if (order.requires === 'dock' && !colony.orbital.dock) return 'Demande un dock spatial.';
  if (key === 'dock' && colony.orbital.dock) return 'Déjà construit.';
  if (key === 'defense' && colony.orbital.defense >= 3) return 'Maximum atteint (3).';
  if (order.kind === 'upgrade' && game.upgrades[key]) return 'Déjà acquise.';
  if (colony.shipyard) return 'Le chantier spatial est occupé.';
  if (!canAfford(game.resources, order.cost)) return 'Pas assez de ressources.';
  return null;
}

export function startShipyard(game, colony, key) {
  if (shipyardProblem(game, colony, key)) return false;
  const order = SHIPYARD[key];
  for (const [res, n] of Object.entries(order.cost)) game.resources[res] -= n;
  colony.shipyard = { key, daysLeft: order.days };
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

// --- Exploration -----------------------------------------------------------------------

// Au premier passage, on ne repère que les grosses planètes (géantes gazeuses, grandes
// planètes, et une moyenne sur deux) ; l'analyse révèle toutes les autres.
function isDetectable(planet, index) {
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
  if (star.rival) parts.push(`C'est le monde natal des ${star.rival}.`);
  if (ruins.length) parts.push(`Ruines des Veilleurs sur ${ruins.map((p) => p.name).join(', ')} !`);
  if (velarine.length) parts.push(`Vélarine sur ${velarine.map((p) => p.name).join(', ')}.`);
  if (rich.length) parts.push(`Gisement riche sur ${rich.map((p) => p.name).join(', ')}.`);
  if (parts.length === 1) parts.push('Rien de remarquable.');
  addLog(game, parts.join(' '), ruins.length || velarine.length ? 'discovery' : 'info');
  if (ship.kind === 'arche' && game.colonies.length === 0) {
    addLog(game, 'Choisissez maintenant une planète dans la fiche du système, puis la case où poser la colonie.');
  }
}

export function stats(game) {
  return {
    seen: game.stars.filter((s) => s.level >= 1).length,
    explored: game.stars.filter((s) => s.level >= 2).length,
    analysed: game.stars.filter((s) => s.level === 3).length,
    total: game.stars.length,
  };
}
