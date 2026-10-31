// Économie des colonies : bâtiments, production par jour, énergie, main-d'œuvre, chantiers.
// Minerais, alliages, biomasse, eau, deutérium, Vélarine et artefacts s'accumulent dans un
// stock commun ; l'énergie ne se stocke pas : chaque colonie doit produire ce qu'elle consomme.
import { neighbors } from './surface.js';
import { hasTech } from './research.js';
import { productionFactor, growthFactor, speciesBonus, speciesExtra } from './species.js';

export const RESOURCE_LABELS = {
  minerais: 'Minerais',
  energie: 'Énergie',
  biomasse: 'Biomasse',
  velarine: 'Vélarine',
  alliages: 'Alliages',
  deuterium: 'Deutérium',
  eau: 'Eau',
  artefacts: 'Artefacts',
  recherche: 'Recherche',
};

// Ressources qui varient chaque jour (les artefacts se trouvent un par un, l'énergie ne se stocke pas).
export const FLOW_RESOURCES = ['minerais', 'alliages', 'biomasse', 'eau', 'deuterium', 'velarine'];

// « gisement de minerais », « gisement d'énergie »…
export const depositName = (resource) => {
  const label = resource === 'velarine' ? 'Vélarine' : RESOURCE_LABELS[resource].toLowerCase(); // nom propre
  return `gisement ${/^[aeiouéèAEIOUÉÈ]/.test(label) ? "d'" : 'de '}${label}`;
};

const DEPLETION_PER_DAY = 0.004; // un puits perd 0,4 % de rendement par jour d'exploitation…
// Niveaux des bâtiments (1 à 4, débloqués par la recherche) : la production et les consommations
// sont multipliées ; l'énergie consommée augmente moins vite.
export const LEVEL_BONUS = [1, 1.5, 2, 2.5];
export const maxLevel = () => 1 + ['automatisation', 'robotique', 'nanofabrication'].filter(hasTech).length;
const levelOf = (tile) => tile.building?.level ?? 1;

const yieldFloor = () => (hasTech('foreuse-croute') ? 0.55 : 0.4); // …jusqu'à un plancher de 40 % (55 % avec la foreuse de croûte)
const FOOD_PER_COLONIST = 0.2; // biomasse consommée par colon et par jour
const WATER_PER_COLONIST = 0.1; // eau bue par colon et par jour
const DIG_DAYS = 25; // jours de fouille pour trouver un artefact (moitié moins avec le lexique des Veilleurs)
const ARTIFACTS_PER_RUIN = 3;
const ECOPE_PER_DAY = 3; // deutérium puisé par une écope gazeuse

// Fragments d'histoire des Veilleurs, révélés un par un par les artefacts.
const LORE = [
  "Une plaque gravée montre l'amas vu de très loin, relié par des fils de lumière.",
  "Un cylindre chante doucement quand on l'approche d'une étoile.",
  "Une carte stellaire où un seul système est barré d'un trait noir.",
  "Des glyphes répètent le même mot, encore et encore : « veiller ».",
  "Un cristal garde l'empreinte d'une main à six doigts.",
  "Le dernier message d'une balise : « Ils reviennent quand la lumière s'éteint. »",
  "Les plans d'un vaisseau sans moteur, seulement des voiles immenses.",
  "Une tablette égrène un compte à rebours. Il reste très peu de chiffres.",
];
const GROWTH_DAYS = 12; // jours pour qu'un nouveau colon s'installe

// terrains : où l'on peut bâtir ; deposit : gisement obligatoire ; tech : technologie nécessaire ;
// workers : colons requis ; energy : consommation ; output(tile, near) : production, adjacences comprises.
export const BUILDINGS = {
  centre: {
    label: 'Centre colonial',
    desc: 'Cœur de la colonie : loge 4 colons et produit un peu de tout.',
    buildable: false,
    upgradable: false,
    housing: 4,
    workers: 0,
    output: () => ({ minerais: 1, energie: 2, biomasse: 2, eau: 1, recherche: 1 }),
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
    tech: 'metallurgie',
    desc: 'Fond 2 minerais en 1 alliage par jour. +20 % aux puits de forage voisins. Pollue : -1 biomasse aux serres et fermes voisines.',
    terrains: ['volcanique', 'desert', 'plaine'],
    cost: { minerais: 35 },
    days: 12,
    workers: 1,
    energy: 2,
    output: () => ({ alliages: 1, minerais: -2 }),
  },
  centrale: {
    label: 'Centrale géothermique',
    desc: "+4 énergie sur volcanique (+2 ailleurs), +1 par case volcanique voisine, + la richesse d'un gisement d'énergie.",
    terrains: ['volcanique', 'desert', 'plaine', 'glace', 'toxique'],
    cost: { minerais: 30 },
    days: 10,
    workers: 1,
    output: (tile, near) => ({
      energie:
        (tile.terrain === 'volcanique' ? 4 : 2) +
        near.filter((n) => n.terrain === 'volcanique').length +
        depositBonus(tile, 'energie') +
        (hasTech('reseau-electrique') ? 1 : 0) +
        (hasTech('fusion-compacte') ? 1 : 0) +
        (hasTech('reacteur-velarine') ? 2 : 0),
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
      energie: Math.max(
        0,
        2 + (tile.terrain === 'desert' ? 1 : 0) + (tile.deposit?.resource === 'energie' ? 1 : 0) + (hasTech('reseau-electrique') ? 1 : 0) - near.filter((n) => isActive(n, 'puits') || isActive(n, 'fonderie')).length,
      ),
    }),
  },
  serre: {
    label: 'Serre-dôme',
    desc: "+3 biomasse, +1 par serre voisine (max +2), + la richesse d'un gisement de biomasse. Boit 1 eau par jour : sans eau, elle produit moitié moins.",
    terrains: ['plaine', 'glace'],
    cost: { minerais: 20 },
    days: 8,
    workers: 1,
    energy: 1,
    output: (tile, near, colony) => ({
      biomasse:
        Math.max(0, 3 + (hasTech('hydroponie') ? 1 : 0) + Math.min(2, near.filter((n) => isActive(n, 'serre')).length) + depositBonus(tile, 'biomasse') - pollution(near)) *
        (colony?.thirst ? 0.5 : 1),
      eau: -1,
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
    tech: 'mecanique-orbitale',
    upgradable: false,
    desc: "Relie la surface à l'orbite : ouvre le chantier spatial (sondes, dock, défenses). Un seul par planète.",
    terrains: ['plaine', 'desert'],
    unique: true,
    cost: { minerais: 40 },
    days: 12,
    workers: 1,
    energy: 1,
  },
  captage: {
    label: "Captage d'eau",
    desc: "+2 eau (+3 sur la glace), + la richesse d'un gisement d'eau.",
    terrains: ['ocean', 'marais', 'glace'],
    cost: { minerais: 15 },
    days: 6,
    workers: 1,
    output: (tile) => ({ eau: (tile.terrain === 'glace' ? 3 : 2) + depositBonus(tile, 'eau') }),
  },
  pompe: {
    label: 'Pompe à deutérium',
    tech: 'chimie-deuterium',
    desc: "+1 deutérium, + la richesse d'un gisement de deutérium. Le deutérium fait voler les vaisseaux.",
    terrains: ['ocean', 'glace'],
    cost: { minerais: 25 },
    days: 10,
    workers: 1,
    energy: 1,
    output: (tile) => ({ deuterium: 1 + depositBonus(tile, 'deuterium') }),
  },
  laboratoire: {
    label: 'Laboratoire de recherche',
    desc: '+3 recherche, +2 par case de ruines voisine, +1 par laboratoire voisin.',
    terrains: ['plaine', 'desert', 'foret'],
    cost: { minerais: 25 },
    days: 8,
    workers: 1,
    energy: 1,
    output: (tile, near) => ({ recherche: 3 + 2 * near.filter((n) => n.terrain === 'ruines').length + near.filter((n) => isActive(n, 'laboratoire')).length }),
  },
  fouille: {
    label: 'Fouille archéologique',
    tech: 'fouilles',
    upgradable: false,
    desc: `Fouille les ruines des Veilleurs : un artefact tous les ${DIG_DAYS} jours, ${ARTIFACTS_PER_RUIN} par ruine.`,
    terrains: ['ruines'],
    cost: { minerais: 20 },
    days: 8,
    workers: 1,
  },
  batterie: {
    label: 'Batterie planétaire',
    desc: 'Tourelle de défense : +5 de défense de la colonie par niveau.',
    tech: 'batteries-planetaires',
    terrains: ['plaine', 'desert', 'glace', 'volcanique'],
    cost: { minerais: 30, alliages: 15 },
    days: 10,
    workers: 1,
    energy: 1,
  },
  siphon: {
    label: 'Siphon à Vélarine',
    tech: 'stabilisation-velarine',
    desc: 'Extrait lentement la Vélarine, la matière exotique que toutes les espèces se disputent.',
    deposit: 'velarine',
    cost: { minerais: 40, alliages: 10 },
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

// Peut-on bâtir ce type ici ? Renvoie une raison si non (ignoreTech : sans tenir compte de la recherche).
export function buildProblem(tile, type, surface, ignoreTech = false) {
  const def = BUILDINGS[type];
  if (!ignoreTech && def.tech && !hasTech(def.tech)) return 'Recherche nécessaire.';
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

// Bâtiments possibles sur cette case, mais qui attendent une technologie.
export function lockedTypes(tile, surface) {
  return Object.keys(BUILDINGS)
    .filter((type) => BUILDINGS[type].tech && !hasTech(BUILDINGS[type].tech) && !buildProblem(tile, type, surface, true))
    .map((type) => ({ type, tech: BUILDINGS[type].tech }));
}

// Chantier spatial : vaisseaux et structures orbitales, un à la fois par colonie.
// requires : 'spatioport' (bâtiment de surface) ou 'dock' (structure orbitale) ; tech : recherche nécessaire.
export const SHIPYARD = {
  corvette: { label: 'Corvette', kind: 'ship', category: 'guerre', size: 'petit', requires: 'spatioport', tech: ['moteurs-saut', 'canons-masse'], cost: { minerais: 30, alliages: 15 }, days: 12, desc: 'Petit vaisseau de guerre rapide. Attaque 2, défense 2.' },
  fregate: { label: 'Frégate', kind: 'ship', category: 'guerre', size: 'moyen', requires: 'dock', tech: ['coques-moyennes', 'canons-masse'], cost: { minerais: 50, alliages: 30 }, days: 18, desc: 'Vaisseau de guerre polyvalent. Attaque 5, défense 5.' },
  croiseur: { label: 'Croiseur', kind: 'ship', category: 'guerre', size: 'grand', requires: 'dock', tech: ['coques-lourdes', 'lasers'], cost: { minerais: 90, alliages: 60, velarine: 2 }, days: 26, desc: 'Grand vaisseau de ligne. Attaque 10, défense 12.' },
  cuirasse: { label: 'Cuirassé', kind: 'ship', category: 'guerre', size: 'gigantesque', requires: 'dock', tech: ['coques-titanesques', 'torpilles-plasma'], cost: { minerais: 160, alliages: 120, velarine: 6 }, days: 40, desc: 'Forteresse volante. Attaque 22, défense 25.' },
  transport: { label: 'Transport colonial', kind: 'ship', category: 'civil', size: 'grand', requires: 'dock', tech: ['coques-lourdes', 'habitats-scelles'], cost: { minerais: 120, alliages: 50, biomasse: 60, eau: 40 }, days: 35, desc: 'Fonde une colonie avec 5 colons.' },
  sonde: { label: 'Sonde', kind: 'ship', category: 'civil', size: 'petit', requires: 'spatioport', tech: 'moteurs-saut', cost: { minerais: 20, alliages: 5 }, days: 10, desc: 'Explore les systèmes voisins. Durée de vie : 180 jours.' },
  dock: { label: 'Dock spatial', kind: 'orbital', category: 'orbital', requires: 'spatioport', tech: 'ingenierie-orbitale', cost: { minerais: 60, alliages: 30 }, days: 20, desc: 'Construit les vaisseaux colonie et améliore toute la flotte.' },
  defense: { label: 'Anneau de défense', kind: 'orbital', category: 'orbital', requires: 'spatioport', tech: 'boucliers', cost: { minerais: 40, alliages: 20 }, days: 15, desc: "Protège la colonie en cas d'attaque (3 au maximum)." },
  ecope: { label: 'Écope gazeuse', kind: 'orbital', category: 'orbital', requires: 'dock', tech: 'ecope', cost: { minerais: 50, alliages: 20 }, days: 15, desc: `Puise le deutérium d'une géante gazeuse du système : +${ECOPE_PER_DAY} deutérium par jour.` },
  colonie: { label: 'Vaisseau colonie', kind: 'ship', category: 'civil', size: 'moyen', requires: 'dock', tech: ['coques-moyennes', 'habitats-scelles'], cost: { minerais: 80, alliages: 25, biomasse: 30, eau: 20 }, days: 25, desc: 'Fonde une nouvelle colonie dans un système analysé. Emporte 2 colons.' },
};

// Bilan d'une colonie pour un jour : production, énergie, main-d'œuvre.
export function colonyReport(colony, surface) {
  const built = surface.tiles.filter((t) => t.building?.done);
  let housing = 0;
  let workers = 0;
  let energyUse = 0;
  let energyProd = 0;
  const raw = [];
  const adapted = hasTech('biospheres-adaptatives');
  for (const tile of built) {
    const def = BUILDINGS[tile.building.type];
    const level = levelOf(tile);
    const bonus = LEVEL_BONUS[level - 1] * (hasTech('ingenierie-veilleurs') ? 1.1 : 1);
    const homeBonus = tile.building.type === 'foyer' ? (hasTech('foyers-modulaires') ? 1 : 0) + (hasTech('arcologies') ? 2 : 0) : 0;
    housing += ((def.housing || 0) + homeBonus) * (def.upgradable === false ? 1 : level);
    workers += def.workers || 0;
    energyUse += (def.energy || 0) * (1 + 0.25 * (level - 1));
    const base = def.output ? def.output(tile, neighbors(surface, tile), colony) : {};
    const out = Object.fromEntries(
      Object.entries(base).map(([res, v]) => [res, v * (v > 0 ? bonus * productionFactor(res, tile.terrain, colony.habitat, adapted) : LEVEL_BONUS[level - 1])]),
    );
    energyProd += out.energie || 0;
    raw.push({ tile, def, out });
  }
  // Pas assez de colons : tout tourne au ralenti. Pas assez d'énergie : les consommateurs aussi.
  const staffing = workers > 0 ? Math.min(1, colony.population / workers) : 1;
  const energyAvailable = energyProd * staffing;
  const power = energyUse > 0 ? Math.min(1, energyAvailable / energyUse) : 1;

  // Sur une planète favorable à son espèce, la colonie est adaptée : elle consomme moitié moins.
  const needs = colony.habitat === 'favored' ? 0.5 : 1;
  const perDay = { minerais: 0, alliages: 0, biomasse: -colony.population * FOOD_PER_COLONIST * needs, eau: -colony.population * WATER_PER_COLONIST * needs, deuterium: 0, velarine: 0, recherche: 0 };
  if (colony.orbital?.ecope) perDay.deuterium += ECOPE_PER_DAY * productionFactor('deuterium', null, colony.habitat, adapted);
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
  const gains = Object.fromEntries([...FLOW_RESOURCES, 'recherche'].map((res) => [res, after.perDay[res] - before.perDay[res]]));
  return {
    ...gains,
    energie: after.energyProd - after.energyUse - (before.energyProd - before.energyUse),
    housing: after.housing - before.housing,
    workers: after.workers - before.workers,
  };
}

// --- Amélioration d'un bâtiment (niveau suivant) ---
export const upgradeCost = (type, level) =>
  Object.fromEntries(Object.entries(BUILDINGS[type].cost).map(([res, n]) => [res, n * (level + 1)]));
export const upgradeDays = (type, level) => Math.ceil(BUILDINGS[type].days * 0.6 * (level + 1));

export function upgradeProblem(game, colony, surface, tile) {
  const b = tile.building;
  if (!b || !b.done) return 'Aucun bâtiment terminé ici.';
  const def = BUILDINGS[b.type];
  if (def.upgradable === false) return 'Ce bâtiment ne s\'améliore pas.';
  const level = levelOf(tile);
  if (level >= 4) return 'Niveau maximal atteint.';
  if (level >= maxLevel()) return `Recherche nécessaire : ${LEVEL_TECH_LABELS[level - 1]}.`;
  if (colony.construction) return 'Un chantier est déjà en cours.';
  if (!canAfford(game.resources, upgradeCost(b.type, level))) return 'Ressources insuffisantes.';
  return null;
}
const LEVEL_TECH_LABELS = ['Automatisation', 'Robotique', 'Nanofabrication'];

export function previewUpgrade(colony, surface, tile) {
  const before = colonyReport(colony, surface);
  tile.building.level = levelOf(tile) + 1;
  const after = colonyReport(colony, surface);
  tile.building.level -= 1;
  const gains = Object.fromEntries([...FLOW_RESOURCES, 'recherche'].map((res) => [res, after.perDay[res] - before.perDay[res]]));
  return {
    ...gains,
    energie: after.energyProd - after.energyUse - (before.energyProd - before.energyUse),
    housing: after.housing - before.housing,
    workers: 0,
  };
}

// Le bâtiment continue de produire à son ancien niveau pendant les travaux.
export function startUpgrade(game, colony, surface, tile) {
  if (upgradeProblem(game, colony, surface, tile)) return false;
  const level = levelOf(tile);
  for (const [res, n] of Object.entries(upgradeCost(tile.building.type, level))) game.resources[res] -= n;
  colony.construction = { tileIndex: tile.index, type: tile.building.type, daysLeft: upgradeDays(tile.building.type, level), upgrade: true, toLevel: level + 1 };
  return true;
}

export function canAfford(resources, cost) {
  return Object.entries(cost).every(([res, n]) => (resources[res] ?? 0) >= n);
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
  // Une fonderie sans minerais ne coule rien : on ne crée pas d'alliages à partir de rien.
  if (game.resources.minerais <= 0 && report.perDay.minerais < 0) report.perDay.alliages = Math.min(0, report.perDay.alliages);
  for (const res of FLOW_RESOURCES) {
    game.resources[res] = Math.max(0, (game.resources[res] ?? 0) + report.perDay[res] * days);
  }

  // Fouilles : un artefact des Veilleurs tous les DIG_DAYS jours, tant que la ruine en cache.
  for (const tile of surface.tiles) {
    const b = tile.building;
    if (b?.type !== 'fouille' || !b.done) continue;
    b.left ??= ARTIFACTS_PER_RUIN;
    b.dig ??= 0;
    if (b.left <= 0) continue;
    b.dig += (days / (DIG_DAYS / (hasTech('lexique') ? 2 : 1))) * report.staffing * speciesBonus('digSpeed');
    if (b.dig >= 1) {
      b.dig = 0;
      b.left--;
      game.resources.artefacts = (game.resources.artefacts ?? 0) + 1 + speciesExtra('digArtefacts');
      const fragment = LORE[(game.lore ?? 0) % LORE.length];
      game.lore = (game.lore ?? 0) + 1;
      events.push(`Fouille sur ${colony.name} : un artefact des Veilleurs ! ${fragment}`);
      if (b.left === 0) events.push(`Les ruines de ${colony.name} ont livré tous leurs secrets.`);
    }
  }

  for (const tile of surface.tiles) {
    if (tile.deposit && tile.building?.done && BUILDINGS[tile.building.type].deposit) {
      tile.yield = Math.max(yieldFloor(), tile.yield - DEPLETION_PER_DAY * days * report.staffing * report.power);
    }
  }

  if (colony.construction) {
    colony.construction.daysLeft -= days;
    if (colony.construction.daysLeft <= 0) {
      const c = colony.construction;
      const tile = surface.tiles[c.tileIndex];
      if (c.upgrade) {
        tile.building.level = c.toLevel;
        events.push(`Amélioration terminée sur ${colony.name} : ${BUILDINGS[tile.building.type].label} niveau ${c.toLevel}.`);
      } else {
        tile.building.done = true;
        events.push(`Construction terminée sur ${colony.name} : ${BUILDINGS[tile.building.type].label}.`);
      }
      colony.construction = null;
    }
  }

  const thirsty = (game.resources.eau ?? 0) <= 0;
  if (thirsty && !colony.thirst) events.push(`Pénurie d'eau sur ${colony.name} : la population ne grandit plus et les serres ralentissent.`);
  colony.thirst = thirsty;
  if (game.resources.biomasse <= 0) {
    if (!colony.famine) events.push(`Famine sur ${colony.name} : la biomasse est épuisée, la population ne grandit plus.`);
    colony.famine = true;
  } else if (thirsty) {
    colony.famine = false;
  } else {
    colony.famine = false;
    if (colony.population < report.housing) {
      colony.growth += (days / GROWTH_DAYS) * growthFactor(colony.habitat, hasTech('biospheres-adaptatives'));
      if (colony.growth >= 1) {
        colony.growth = 0;
        colony.population++;
        events.push(`Un nouveau colon s'installe sur ${colony.name} (${colony.population} colons).`);
      }
    }
  }
  return events;
}
