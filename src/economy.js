// Économie des colonies : bâtiments, production par jour, énergie, main-d'œuvre, chantiers.
// Les minerais, la biomasse et la Vélarine s'accumulent dans un stock commun ;
// l'énergie ne se stocke pas : chaque colonie doit produire ce qu'elle consomme.
import { neighbors } from './surface.js';

export const RESOURCE_LABELS = { minerais: 'Minerais', energie: 'Énergie', biomasse: 'Biomasse', velarine: 'Vélarine' };

// « gisement de minerais », « gisement d'énergie »…
export const depositName = (resource) => {
  const label = resource === 'velarine' ? 'Vélarine' : RESOURCE_LABELS[resource].toLowerCase(); // nom propre
  return `gisement ${/^[aeiouéèAEIOUÉÈ]/.test(label) ? "d'" : 'de '}${label}`;
};

const DEPLETION_PER_DAY = 0.004; // un puits perd 0,4 % de rendement par jour d'exploitation…
const YIELD_FLOOR = 0.4; // …jusqu'à un plancher de 40 %
const FOOD_PER_COLONIST = 0.2; // biomasse consommée par colon et par jour
const GROWTH_DAYS = 12; // jours pour qu'un nouveau colon s'installe

// terrains : où l'on peut bâtir ; deposit : gisement obligatoire ; workers : colons requis ;
// energy : consommation ; output(tile, near) : production de base, adjacences comprises.
export const BUILDINGS = {
  centre: {
    label: 'Centre colonial',
    desc: 'Cœur de la colonie : loge 4 colons et produit un peu de tout.',
    buildable: false,
    housing: 4,
    workers: 0,
    output: () => ({ minerais: 1, energie: 2, biomasse: 2 }),
  },
  foyer: {
    label: "Foyer d'habitat",
    desc: '+2 places de population.',
    terrains: ['plaine', 'desert', 'foret'],
    cost: { minerais: 20 },
    days: 8,
    housing: 2,
    workers: 0,
  },
  puits: {
    label: 'Puits de forage',
    desc: "Extrait les minerais d'un gisement. +25 % par gisement de minerais voisin, +20 % par fonderie voisine. Le rendement baisse lentement jusqu'à 40 %.",
    deposit: 'minerais',
    cost: { minerais: 25 },
    days: 10,
    workers: 1,
    energy: 1,
    output: (tile, near) => {
      const veins = near.filter((n) => n.deposit?.resource === 'minerais').length;
      const foundries = near.filter((n) => isActive(n, 'fonderie')).length;
      return { minerais: (1 + tile.deposit.richness) * (1 + 0.25 * veins) * (1 + 0.2 * foundries) * tile.yield };
    },
  },
  fonderie: {
    label: 'Fonderie',
    desc: '+20 % aux puits de forage voisins. Pollue : -1 biomasse aux serres et fermes voisines.',
    terrains: ['volcanique', 'desert'],
    cost: { minerais: 35 },
    days: 12,
    workers: 1,
    energy: 2,
  },
  centrale: {
    label: 'Centrale géothermique',
    desc: "+4 énergie sur volcanique (+2 ailleurs), +1 par case volcanique voisine, + la richesse d'un gisement d'énergie.",
    terrains: ['volcanique', 'desert', 'plaine', 'glace', 'toxique'],
    cost: { minerais: 30 },
    days: 10,
    workers: 1,
    output: (tile, near) => ({
      energie: (tile.terrain === 'volcanique' ? 4 : 2) + near.filter((n) => n.terrain === 'volcanique').length + depositBonus(tile, 'energie'),
    }),
  },
  solaire: {
    label: 'Champ photovoltaïque',
    desc: "+2 énergie, +1 sur désert ou sur un gisement d'énergie. -1 par puits ou fonderie voisin (ombre).",
    terrains: ['desert', 'plaine'],
    cost: { minerais: 15 },
    days: 6,
    workers: 1,
    output: (tile, near) => ({
      energie: Math.max(0, 2 + (tile.terrain === 'desert' ? 1 : 0) + (tile.deposit?.resource === 'energie' ? 1 : 0) - near.filter((n) => isActive(n, 'puits') || isActive(n, 'fonderie')).length),
    }),
  },
  serre: {
    label: 'Serre-dôme',
    desc: '+3 biomasse, +1 par serre voisine (max +2), + la richesse d\'un gisement de biomasse.',
    terrains: ['plaine', 'glace'],
    cost: { minerais: 20 },
    days: 8,
    workers: 1,
    energy: 1,
    output: (tile, near) => ({
      biomasse: Math.max(0, 3 + Math.min(2, near.filter((n) => isActive(n, 'serre')).length) + depositBonus(tile, 'biomasse') - pollution(near)),
    }),
  },
  ferme: {
    label: 'Ferme pélagique',
    desc: "+3 biomasse, +1 par case d'océan libre voisine (max +2), + la richesse d'un gisement de biomasse.",
    terrains: ['ocean'],
    cost: { minerais: 25 },
    days: 10,
    workers: 1,
    output: (tile, near) => ({
      biomasse: Math.max(0, 3 + Math.min(2, near.filter((n) => n.terrain === 'ocean' && !n.building).length) + depositBonus(tile, 'biomasse') - pollution(near)),
    }),
  },
  spatioport: {
    label: 'Spatioport',
    desc: "Relie la surface à l'orbite : ouvre le chantier spatial (sondes, dock, défenses). Un seul par planète.",
    terrains: ['plaine', 'desert'],
    unique: true,
    cost: { minerais: 40 },
    days: 12,
    workers: 1,
    energy: 1,
  },
  siphon: {
    label: 'Siphon à Vélarine',
    desc: 'Extrait lentement la Vélarine, la matière exotique que toutes les espèces se disputent.',
    deposit: 'velarine',
    cost: { minerais: 40 },
    days: 15,
    workers: 1,
    energy: 2,
    output: (tile) => ({ velarine: 0.15 * tile.deposit.richness * tile.yield }),
  },
};

function isActive(tile, type) {
  return tile.building?.type === type && tile.building.done;
}

function depositBonus(tile, resource) {
  return tile.deposit?.resource === resource ? tile.deposit.richness : 0;
}

function pollution(near) {
  return near.filter((n) => isActive(n, 'fonderie')).length;
}

// Peut-on bâtir ce type ici ? Renvoie une raison si non.
export function buildProblem(tile, type, surface) {
  const def = BUILDINGS[type];
  if (tile.building) return 'Case déjà occupée.';
  if (def.unique && surface.tiles.some((t) => t.building?.type === type)) return 'Un seul par planète.';
  if (def.deposit) return tile.deposit?.resource === def.deposit ? null : `Demande un ${depositName(def.deposit)}.`;
  if (!def.terrains.includes(tile.terrain)) return 'Terrain inadapté.';
  if (tile.deposit && ['minerais', 'velarine'].includes(tile.deposit.resource)) return 'Case réservée à son gisement.';
  return null;
}

export function buildableTypes(tile, surface) {
  return Object.keys(BUILDINGS).filter((type) => BUILDINGS[type].buildable !== false && !buildProblem(tile, type, surface));
}

// Chantier spatial : vaisseaux, structures orbitales et améliorations, un à la fois par colonie.
// requires : 'spatioport' (bâtiment de surface) ou 'dock' (structure orbitale).
export const SHIPYARD = {
  sonde: { label: 'Sonde', kind: 'ship', requires: 'spatioport', cost: { minerais: 30 }, days: 10, desc: 'Explore les systèmes voisins. Durée de vie : 180 jours.' },
  dock: { label: 'Dock spatial', kind: 'orbital', requires: 'spatioport', cost: { minerais: 90 }, days: 20, desc: 'Construit les vaisseaux colonie et améliore toute la flotte.' },
  defense: { label: 'Anneau de défense', kind: 'orbital', requires: 'spatioport', cost: { minerais: 60 }, days: 15, desc: "Protège la colonie en cas d'attaque (3 au maximum)." },
  colonie: { label: 'Vaisseau colonie', kind: 'ship', requires: 'dock', cost: { minerais: 100, biomasse: 30 }, days: 25, desc: 'Fonde une nouvelle colonie dans un système analysé. Emporte 2 colons.' },
  moteurs: { label: 'Moteurs améliorés', kind: 'upgrade', requires: 'dock', cost: { minerais: 60 }, days: 15, desc: '+30 % de vitesse pour tous les vaisseaux.' },
  blindage: { label: 'Coques renforcées', kind: 'upgrade', requires: 'dock', cost: { minerais: 50 }, days: 12, desc: '+50 % de durée de vie pour tous les vaisseaux.' },
};

// Bilan d'une colonie pour un jour : production, énergie, main-d'œuvre.
export function colonyReport(colony, surface) {
  const built = surface.tiles.filter((t) => t.building?.done);
  let housing = 0;
  let workers = 0;
  let energyUse = 0;
  let energyProd = 0;
  const raw = [];
  for (const tile of built) {
    const def = BUILDINGS[tile.building.type];
    housing += def.housing || 0;
    workers += def.workers || 0;
    energyUse += def.energy || 0;
    const out = def.output ? def.output(tile, neighbors(surface, tile)) : {};
    energyProd += out.energie || 0;
    raw.push({ tile, def, out });
  }
  // Pas assez de colons : tout tourne au ralenti. Pas assez d'énergie : les consommateurs aussi.
  const staffing = workers > 0 ? Math.min(1, colony.population / workers) : 1;
  const energyAvailable = energyProd * staffing;
  const power = energyUse > 0 ? Math.min(1, energyAvailable / energyUse) : 1;

  const perDay = { minerais: 0, biomasse: -colony.population * FOOD_PER_COLONIST, velarine: 0 };
  const perTile = new Map();
  for (const { tile, def, out } of raw) {
    const factor = (def.workers ? staffing : 1) * (def.energy ? power : 1);
    const scaled = {};
    for (const [res, value] of Object.entries(out)) {
      scaled[res] = value * factor;
      if (res !== 'energie') perDay[res] += value * factor;
    }
    perTile.set(tile.index, scaled);
  }
  return { perDay, perTile, housing, workers, staffing, power, energyProd: energyAvailable, energyUse };
}

// Gain d'un bâtiment hypothétique, pour l'afficher avant de construire.
export function previewBuilding(colony, surface, tile, type) {
  const before = colonyReport(colony, surface);
  tile.building = { type, done: true };
  const after = colonyReport(colony, surface);
  tile.building = null;
  return {
    minerais: after.perDay.minerais - before.perDay.minerais,
    biomasse: after.perDay.biomasse - before.perDay.biomasse,
    velarine: after.perDay.velarine - before.perDay.velarine,
    energie: after.energyProd - after.energyUse - (before.energyProd - before.energyUse),
    housing: after.housing - before.housing,
    workers: after.workers - before.workers,
  };
}

export function canAfford(resources, cost) {
  return Object.entries(cost).every(([res, n]) => resources[res] >= n);
}

export function startConstruction(game, colony, surface, tile, type) {
  const def = BUILDINGS[type];
  if (colony.construction || buildProblem(tile, type, surface) || !canAfford(game.resources, def.cost)) return false;
  for (const [res, n] of Object.entries(def.cost)) game.resources[res] -= n;
  tile.building = { type, done: false };
  colony.construction = { tileIndex: tile.index, type, daysLeft: def.days };
  return true;
}

// Démolition : la case est libérée, la moitié du coût est remboursée.
export function demolish(game, colony, surface, tile) {
  if (!tile.building || BUILDINGS[tile.building.type].buildable === false) return false;
  const def = BUILDINGS[tile.building.type];
  for (const [res, n] of Object.entries(def.cost)) game.resources[res] += Math.floor(n / 2);
  if (colony.construction?.tileIndex === tile.index) colony.construction = null;
  tile.building = null;
  return true;
}

// Avance une colonie de `days` jours. Renvoie les messages pour le journal.
export function tickColony(game, colony, surface, days) {
  const events = [];
  const report = colonyReport(colony, surface);
  for (const res of ['minerais', 'biomasse', 'velarine']) {
    game.resources[res] = Math.max(0, game.resources[res] + report.perDay[res] * days);
  }

  for (const tile of surface.tiles) {
    if (tile.deposit && tile.building?.done && BUILDINGS[tile.building.type].deposit) {
      tile.yield = Math.max(YIELD_FLOOR, tile.yield - DEPLETION_PER_DAY * days * report.staffing * report.power);
    }
  }

  if (colony.construction) {
    colony.construction.daysLeft -= days;
    if (colony.construction.daysLeft <= 0) {
      const tile = surface.tiles[colony.construction.tileIndex];
      tile.building.done = true;
      events.push(`Construction terminée sur ${colony.name} : ${BUILDINGS[tile.building.type].label}.`);
      colony.construction = null;
    }
  }

  if (game.resources.biomasse <= 0) {
    if (!colony.famine) events.push(`Famine sur ${colony.name} : la biomasse est épuisée, la population ne grandit plus.`);
    colony.famine = true;
  } else {
    colony.famine = false;
    if (colony.population < report.housing) {
      colony.growth += days / GROWTH_DAYS;
      if (colony.growth >= 1) {
        colony.growth = 0;
        colony.population++;
        events.push(`Un nouveau colon s'installe sur ${colony.name} (${colony.population} colons).`);
      }
    }
  }
  return events;
}
