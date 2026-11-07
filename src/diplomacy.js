// Diplomatie (voir docs/plan-diplomatie.md) : note de chaque empire envers le joueur et attitude.
// Réglages dans config.js (DIPLOMACY). Seuls les empires rencontrés réagissent à ce que fait le joueur.
import { DIPLOMACY, SPECIES } from './config.js';
import { starDistance } from './galaxy.js';
import { TECHS } from './research.js';

export const startRelation = (species) => DIPLOMACY.startRelation[species];

// La note est arrondie : les seuils de config.js sont des entiers.
export function attitudeOf(relation) {
  const note = Math.round(relation);
  return DIPLOMACY.attitudes.find((a) => note >= a.min);
}

// Espèces rivales d'une espèce (table fixe, dans les deux sens).
export function rivalsOf(species) {
  return DIPLOMACY.rivalries.flatMap(([a, b]) => (a === species ? [b] : b === species ? [a] : []));
}

export function changeRelation(empire, amount) {
  empire.relation = Math.max(-100, Math.min(100, empire.relation + amount));
}

// Colonies du joueur proches du territoire de cet empire.
function nearColonies(game, empire) {
  const own = empire.colonies.map((c) => game.stars[c.starId]);
  return game.colonies.filter((colony) => {
    const star = game.stars[colony.starId];
    return own.some((s) => starDistance(s, star) <= DIPLOMACY.proximityRange);
  }).length;
}

// Plafond d'un stock : il grandit avec l'empire.
const stockCap = (empire, res) => DIPLOMACY.stockCap[res] * empire.colonies.length;

export function startStocks(empire) {
  return Object.fromEntries(Object.keys(DIPLOMACY.stockCap).map((res) => [res, res === 'artefacts' ? 0 : stockCap(empire, res) * DIPLOMACY.stockStart]));
}

function stockDay(game, empire) {
  const bonuses = SPECIES[empire.species].bonuses;
  const ruins = empire.colonies.filter((c) => game.stars[c.starId].planets[c.planetIndex].ruins).length;
  for (const res of Object.keys(DIPLOMACY.stockCap)) {
    const producers = res === 'artefacts' ? ruins : empire.colonies.length;
    const gain = DIPLOMACY.stockPerDay[res] * (bonuses[res] ?? 1) * producers;
    empire.stocks[res] = Math.min(stockCap(empire, res), empire.stocks[res] + gain);
  }
}

// Technologies d'un empire, déduites de sa puissance : d'abord les paliers bas, puis ses branches
// préférées. Celles qui coûtent des artefacts restent au joueur, qui fouille les ruines.
export function rivalTechs(empire) {
  const branches = DIPLOMACY.techBranches[empire.species];
  const rank = (tech) => {
    const i = branches.indexOf(tech.branch);
    return i < 0 ? branches.length : i;
  };
  const tierCap = DIPLOMACY.techTierPower.filter((power) => empire.power >= power).length;
  const known = new Set();
  let budget = Math.floor(empire.power * DIPLOMACY.techPerPower);
  while (budget > 0) {
    const next = Object.entries(TECHS)
      .filter(([key, t]) => !known.has(key) && !t.artefacts && t.tier <= tierCap && t.requires.every((r) => known.has(r)))
      .sort(([, a], [, b]) => a.tier - b.tier || rank(a) - rank(b) || a.cost - b.cost)[0];
    if (!next) break;
    known.add(next[0]);
    budget--;
  }
  return [...known];
}

// Un jour entier : les stocks montent chez tous ; chez les empires rencontrés, la note revient vers
// sa valeur de départ et baisse si le joueur est trop près.
function diplomacyDay(game) {
  for (const empire of game.empires) {
    stockDay(game, empire);
    if (!empire.met) continue;
    const pressure = Math.min(DIPLOMACY.proximityMax, nearColonies(game, empire) * DIPLOMACY.proximityPerColony);
    changeRelation(empire, (startRelation(empire.species) - empire.relation) * DIPLOMACY.returnPerDay - pressure);
  }
}

// Calculé par jour entier, pour donner le même résultat quelle que soit la vitesse du jeu.
export function tickDiplomacy(game, days) {
  const steps = Math.floor(game.time) - Math.floor(game.time - days);
  for (let i = 0; i < steps; i++) diplomacyDay(game);
}

// Une fouille de ruines plaît ou déplaît selon l'espèce.
export function reactToDig(game) {
  for (const empire of game.empires) {
    if (empire.met) changeRelation(empire, DIPLOMACY.digReaction[empire.species] ?? 0);
  }
}
