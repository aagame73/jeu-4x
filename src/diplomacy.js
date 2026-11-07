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
  const known = new Set(empire.extraTechs);
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

// --- Échanges ---------------------------------------------------------------------------
// Une offre : { give: { resources: { minerais: 10 }, techs: [clé], map: false }, get: { ... } }.
// give : ce que le joueur donne ; get : ce qu'il reçoit.

const resourcesOf = (side) => Object.entries(side.resources ?? {});
const isEmpty = (side) => !resourcesOf(side).length && !side.techs?.length && !side.map;

// Rareté chez l'empire : une matière dont il a peu vaut plus cher pour lui.
function materialValue(empire, res, amount) {
  const fill = Math.min(1, empire.stocks[res] / stockCap(empire, res));
  return amount * DIPLOMACY.values[res] * (1.5 - fill);
}

const techValue = (key) => TECHS[key].cost * DIPLOMACY.techValue;

const unknownColonies = (empire) => empire.colonies.filter((c) => !c.known).length;

function sideValue(game, empire, side, playerGives) {
  let total = resourcesOf(side).reduce((sum, [res, amount]) => sum + materialValue(empire, res, amount), 0);
  total += (side.techs ?? []).reduce((sum, key) => sum + techValue(key), 0);
  if (side.map) total += DIPLOMACY.mapValuePerColony * (playerGives ? game.colonies.length : unknownColonies(empire));
  return total;
}

const validAmount = (amount) => Number.isInteger(amount) && amount > 0;
const tradableTech = (key) => TECHS[key] && !TECHS[key].artefacts && TECHS[key].tier < DIPLOMACY.closedTier;

// Ce qui rend l'offre impossible, quel que soit son prix.
function dealProblem(game, empire, offer) {
  if (!empire.met) return 'unknown';
  if (isEmpty(offer.give) || isEmpty(offer.get)) return 'nothing-free';
  if (attitudeOf(empire.relation).key === 'hostile') return 'hostile';
  for (const side of [offer.give, offer.get]) {
    for (const [res, amount] of resourcesOf(side)) {
      if (!(res in DIPLOMACY.values) || !validAmount(amount)) return 'invalid';
    }
  }
  for (const [res, amount] of resourcesOf(offer.give)) if ((game.resources[res] ?? 0) < amount) return 'player-short';
  for (const [res, amount] of resourcesOf(offer.get)) if (empire.stocks[res] < amount) return 'empire-short';
  const done = game.research.done;
  const known = new Set(rivalTechs(empire));
  const given = offer.give.techs ?? [];
  const taken = offer.get.techs ?? [];
  if ([...given, ...taken].some((key) => !tradableTech(key))) return 'tech-closed';
  if (given.some((key) => !done.includes(key) || known.has(key) || TECHS[key].requires.some((r) => !known.has(r)))) return 'tech-give';
  if (taken.some((key) => !known.has(key) || done.includes(key) || TECHS[key].requires.some((r) => !done.includes(r)))) return 'tech-take';
  if ((given.length || taken.length) && game.time < empire.nextTechTrade) return 'tech-delay';
  if (offer.give.map && (!game.colonies.length || game.time < empire.nextMapTrade)) return 'map-give';
  if (offer.get.map && !unknownColonies(empire)) return 'map-take';
  return null;
}

// Réponse de l'empire : { ok, reason, received, given }.
export function evaluateDeal(game, empire, offer) {
  const problem = dealProblem(game, empire, offer);
  if (problem) return { ok: false, reason: problem, received: 0, given: 0 };
  const received = sideValue(game, empire, offer.give, true);
  const given = sideValue(game, empire, offer.get, false);
  const margin = DIPLOMACY.margin[attitudeOf(empire.relation).key] * (DIPLOMACY.tradeFactor[empire.species] ?? 1);
  return received >= given * margin ? { ok: true, reason: null, received, given } : { ok: false, reason: 'unbalanced', received, given, margin };
}

// Contre-offre simple : l'empire garde l'offre du joueur mais donne moins de matières. Null si impossible.
export function counterOffer(game, empire, offer) {
  const answer = evaluateDeal(game, empire, offer);
  if (answer.reason !== 'unbalanced') return null;
  const get = { ...offer.get, resources: { ...offer.get.resources } };
  const counter = { give: offer.give, get };
  for (const [res] of resourcesOf(offer.get).reverse()) {
    while (get.resources[res] > 0 && !evaluateDeal(game, empire, counter).ok) {
      get.resources[res] -= 1;
      if (get.resources[res] === 0) delete get.resources[res];
    }
    if (isEmpty(get)) return null;
    if (evaluateDeal(game, empire, counter).ok) return counter;
  }
  return null;
}

// Effets communs d'un échange accepté : matières, note, délais. Les technologies reçues sont
// renvoyées à game.js, qui seul sait les appliquer.
export function applyDeal(game, empire, offer, answer) {
  for (const [res, amount] of resourcesOf(offer.give)) {
    game.resources[res] -= amount;
    empire.stocks[res] += amount;
  }
  for (const [res, amount] of resourcesOf(offer.get)) {
    empire.stocks[res] -= amount;
    game.resources[res] = (game.resources[res] ?? 0) + amount;
  }
  const given = offer.give.techs ?? [];
  const taken = offer.get.techs ?? [];
  if (given.length || taken.length) empire.nextTechTrade = game.time + DIPLOMACY.techDelay;
  if (given.length) {
    empire.extraTechs.push(...given);
    empire.power += given.length * DIPLOMACY.soldTechPower;
  }
  if (offer.give.map) empire.nextMapTrade = game.time + DIPLOMACY.mapDelay;
  if (offer.get.map) {
    for (const colony of empire.colonies) {
      colony.known = true;
      const star = game.stars[colony.starId];
      star.level = Math.max(star.level, 2);
      star.planets[colony.planetIndex].inhabitedBy = empire.species;
    }
  }
  // Le partenaire apprécie ; ses rivaux l'apprennent, même ceux que le joueur n'a pas rencontrés.
  const worth = Math.max(answer.received, answer.given);
  changeRelation(empire, Math.min(DIPLOMACY.tradeGainMax, worth * DIPLOMACY.tradeGainPerValue));
  const penalty = Math.min(DIPLOMACY.rivalPenaltyMax, Math.max(DIPLOMACY.rivalPenaltyMin, worth * DIPLOMACY.rivalPenaltyPerValue));
  const rivals = rivalsOf(empire.species);
  for (const other of game.empires) if (rivals.includes(other.species)) changeRelation(other, -penalty);
  return taken;
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
