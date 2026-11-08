// Diplomatie (voir docs/plan-diplomatie.md) : note de chaque empire envers le joueur et attitude.
// Réglages dans config.js (DIPLOMACY). Seuls les empires rencontrés réagissent à ce que fait le joueur.
import { DIPLOMACY, SPECIES } from './config.js';
import { starDistance } from './galaxy.js';
import { TECHS } from './research.js';
import { RESOURCE_LABELS } from './economy.js';
import { createRng } from './rng.js';

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

// --- Traités ----------------------------------------------------------------------------
// empire.treaties[clé] : jour d'expiration (0 si aucun).

export const treatyActive = (game, empire, key) => empire.treaties[key] > game.time;

const nearPlayer = (game, star, range) => game.colonies.some((c) => starDistance(game.stars[c.starId], star) <= range);

// Cet empire s'est-il engagé à ne pas prendre cette planète ?
export function treatyForbids(game, empire, star, planet) {
  if (treatyActive(game, empire, 'frontieres') && nearPlayer(game, star, DIPLOMACY.treaties.frontieres.range)) return true;
  return planet.ruins && treatyActive(game, empire, 'ruines') && nearPlayer(game, star, DIPLOMACY.treaties.ruines.range);
}

// Empires avec qui une colonie dans ce système romprait le traité de frontières. Seules comptent
// leurs colonies que le joueur connaît : on ne rompt pas sans le savoir.
export function treatyConflicts(game, starId) {
  const star = game.stars[starId];
  const range = DIPLOMACY.treaties.frontieres.range;
  return game.empires.filter(
    (empire) =>
      treatyActive(game, empire, 'frontieres') &&
      empire.colonies.some((c) => game.stars[c.starId].planets[c.planetIndex].inhabitedBy && starDistance(game.stars[c.starId], star) <= range),
  );
}

// Rompt les traités de frontières touchés par une nouvelle colonie ; renvoie les empires concernés.
export function breakTreaties(game, starId) {
  const broken = treatyConflicts(game, starId);
  for (const empire of broken) {
    empire.treaties.frontieres = 0;
    changeRelation(empire, -DIPLOMACY.treatyBreakPenalty);
  }
  return broken;
}

// --- Guerre et paix -----------------------------------------------------------------------

export const peaceValue = (empire) => DIPLOMACY.peaceValue + DIPLOMACY.peaceValuePerPower * empire.power;

// Quantité minimale d'une matière pour acheter la paix à cet empire (selon sa rareté chez lui).
export function peacePrice(empire, res) {
  const needed = peaceValue(empire) * DIPLOMACY.warMargin;
  let low = 1;
  let high = 1;
  while (materialValue(empire, res, high, true) < needed && high < 1e6) high *= 2;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (materialValue(empire, res, mid, true) >= needed) high = mid;
    else low = mid + 1;
  }
  return low;
}

// La guerre rompt les traités et annule les propositions ; déclarée par le joueur, elle plaît
// aux rivaux de cet empire (même à ceux qu'il n'a pas rencontrés).
export function declareWar(game, empire, byPlayer) {
  empire.war = true;
  empire.warSince = game.time;
  for (const key of Object.keys(DIPLOMACY.treaties)) empire.treaties[key] = 0;
  dropProposal(game, empire.species);
  empire.relation = Math.min(empire.relation, DIPLOMACY.warRelation);
  if (byPlayer) {
    const rivals = rivalsOf(empire.species);
    for (const other of game.empires) if (rivals.includes(other.species)) changeRelation(other, DIPLOMACY.warRivalGain);
  }
}

function makePeace(game, empire) {
  empire.war = false;
  game.fleets = game.fleets.filter((f) => f.species !== empire.species); // les flottes rentrent chez elles
  empire.truceUntil = game.time + DIPLOMACY.truceDays;
  empire.relation = Math.max(empire.relation, DIPLOMACY.peaceRelation);
}

// Un rival hostile peut déclarer la guerre : jamais avant le délai de grâce ni pendant une trêve.
function warDay(game, empire, events) {
  if (empire.war || game.time < DIPLOMACY.graceDays || game.time < empire.truceUntil) return;
  if (attitudeOf(empire.relation).key !== 'hostile') return;
  const rng = createRng((game.seed ^ Math.imul(empire.homeId + 1, 0x7f4a7c15) ^ Math.imul(Math.floor(game.time), 0x165667b1)) >>> 0);
  if (rng.next() >= DIPLOMACY.warChancePerDay * (DIPLOMACY.warStyle[empire.species] ?? 1)) return;
  declareWar(game, empire, false);
  events.push({ type: 'war', empire });
}

// --- Convois ----------------------------------------------------------------------------
// game.convoys : { id, species, fromId, toId, distance, progress, resources }. Visibles sur la carte ;
// on ne peut ni les attaquer ni les perdre tant que le combat n'existe pas.

function startConvoy(game, empire, resources) {
  const targets = game.colonies.length ? game.colonies.map((c) => game.stars[c.starId]) : [game.stars[game.homeId]];
  let best = null;
  // Seulement depuis une colonie que le joueur connaît (au moins le monde natal) : un convoi ne
  // doit pas trahir l'emplacement d'une colonie cachée.
  const known = empire.colonies.filter((c) => c.starId === empire.homeId || game.stars[c.starId].planets[c.planetIndex].inhabitedBy);
  for (const colony of known) {
    const from = game.stars[colony.starId];
    for (const to of targets) {
      const d = starDistance(from, to);
      if (!best || d < best.d) best = { d, from, to };
    }
  }
  const convoy = {
    id: game.nextConvoyId++,
    species: empire.species,
    fromId: best.from.id,
    toId: best.to.id,
    distance: Math.max(1, best.d),
    progress: 0,
    resources,
  };
  game.convoys.push(convoy);
  return convoy;
}

// Avance les convois ; renvoie ceux qui sont arrivés (leurs matières sont déjà livrées).
export function tickConvoys(game, days) {
  const arrived = [];
  for (const convoy of game.convoys) {
    convoy.progress += DIPLOMACY.convoySpeed * days;
    if (convoy.progress < convoy.distance) continue;
    // Un convoi de ravitaillement livre son empire ; les autres livrent le joueur.
    const empire = convoy.supply ? game.empires.find((e) => e.species === convoy.species) : null;
    for (const [res, amount] of Object.entries(convoy.resources)) {
      if (empire) empire.stocks[res] += amount;
      else if (!convoy.supply) game.resources[res] = (game.resources[res] ?? 0) + amount;
    }
    arrived.push(convoy);
  }
  game.convoys = game.convoys.filter((c) => !arrived.includes(c));
  return arrived;
}

// Convois d'une sauvegarde : ceux qui ne correspondent pas à cette partie sont écartés.
export function validConvoys(game, saved) {
  if (!Array.isArray(saved)) return [];
  const number = (x) => Number.isFinite(x) && x >= 0;
  return saved.filter(
    (c) =>
      c &&
      game.empires.some((e) => e.species === c.species) &&
      game.stars[c.fromId] &&
      game.stars[c.toId] &&
      number(c.distance) &&
      number(c.progress) &&
      Number.isInteger(c.id) &&
      (c.supply === undefined || typeof c.supply === 'boolean') &&
      c.resources &&
      Object.entries(c.resources).every(([res, n]) => Object.hasOwn(DIPLOMACY.values, res) && Number.isInteger(n) && n > 0),
  );
}

// --- Échanges ---------------------------------------------------------------------------
// Une offre : { give: { resources: { minerais: 10 }, techs: [clé], map: false }, get: { ... } }.
// give : ce que le joueur donne ; get : ce qu'il reçoit.

const resourcesOf = (side) => Object.entries(side.resources ?? {});
const isEmpty = (side) => !resourcesOf(side).length && !side.techs?.length && !side.map && !side.treaties?.length && !side.peace;

// Rareté chez l'empire : une matière dont il a peu vaut plus cher pour lui. Le prix suit le stock
// pendant l'échange (prix moyen entre avant et après) : sinon acheter puis revendre rapporterait.
function materialValue(empire, res, amount, empireReceives) {
  const cap = stockCap(empire, res);
  const { full, empty } = DIPLOMACY.scarcity;
  const factor = (stock) => empty - (empty - full) * Math.min(1, Math.max(0, stock / cap));
  const before = empire.stocks[res];
  const after = before + (empireReceives ? amount : -amount);
  return amount * DIPLOMACY.values[res] * ((factor(before) + factor(after)) / 2);
}

const techValue = (key) => TECHS[key].cost * DIPLOMACY.techValue;

const unknownColonies = (empire) => empire.colonies.filter((c) => !c.known).length;

function sideValue(game, empire, side, playerGives) {
  let total = resourcesOf(side).reduce((sum, [res, amount]) => sum + materialValue(empire, res, amount, playerGives), 0);
  total += (side.techs ?? []).reduce((sum, key) => sum + techValue(key), 0);
  if (side.map) total += DIPLOMACY.mapValuePerColony * (playerGives ? game.colonies.length : unknownColonies(empire));
  total += (side.treaties ?? []).reduce((sum, key) => sum + DIPLOMACY.treaties[key].value, 0);
  if (side.peace) total += peaceValue(empire);
  return total;
}

const validAmount = (amount) => Number.isInteger(amount) && amount > 0;
const tradableTech = (key) => TECHS[key] && !TECHS[key].artefacts && TECHS[key].tier < DIPLOMACY.closedTier;

// Ce qui rend l'offre impossible, quel que soit son prix.
function dealProblem(game, empire, offer) {
  if (!empire.met) return 'unknown';
  if (isEmpty(offer.give) || isEmpty(offer.get)) return 'nothing-free';
  // En guerre, seule la paix se négocie ; hors guerre, elle n'a pas de sens.
  const { get } = offer;
  if (empire.war) {
    if (!get.peace) return 'war';
    if (resourcesOf(get).length || get.techs?.length || get.map || get.treaties?.length || offer.give.treaties?.length) return 'war';
  } else {
    if (get.peace || offer.give.peace) return 'invalid';
    if (attitudeOf(empire.relation).key === 'hostile') return 'hostile';
  }
  if (offer.give.peace) return 'invalid';
  for (const side of [offer.give, offer.get]) {
    for (const [res, amount] of resourcesOf(side)) {
      if (!Object.hasOwn(DIPLOMACY.values, res) || !validAmount(amount)) return 'invalid';
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
  if (offer.give.treaties?.length) return 'invalid'; // seul l'empire s'engage contre paiement
  for (const key of offer.get.treaties ?? []) {
    const treaty = DIPLOMACY.treaties[key];
    if (!treaty) return 'invalid';
    if (Math.round(empire.relation) < treaty.minRelation) return 'treaty-attitude';
    if (treatyActive(game, empire, key)) return 'treaty-active';
  }
  return null;
}

// Technologies que le joueur peut vendre à cet empire, ou lui acheter.
export function sellableTechs(game, empire) {
  const known = new Set(rivalTechs(empire));
  return game.research.done.filter((key) => tradableTech(key) && !known.has(key) && TECHS[key].requires.every((r) => known.has(r)));
}

export function buyableTechs(game, empire) {
  const done = game.research.done;
  return rivalTechs(empire).filter((key) => tradableTech(key) && !done.includes(key) && TECHS[key].requires.every((r) => done.includes(r)));
}

// Pourquoi l'empire vous voit ainsi : phrases affichées sur sa fiche.
export function relationReasons(game, empire) {
  const reasons = [];
  const start = startRelation(empire.species);
  if (start > 0) reasons.push('Peuple ouvert aux échanges.');
  else if (start < 0) reasons.push('Peuple méfiant par nature.');
  const near = nearColonies(game, empire);
  if (near) reasons.push(`${near > 1 ? `${near} de vos colonies sont proches` : 'Une de vos colonies est proche'} de son territoire.`);
  if (Object.keys(DIPLOMACY.treaties).some((key) => treatyActive(game, empire, key))) reasons.push('Vous respectez vos accords.');
  const dig = DIPLOMACY.digReaction[empire.species];
  if (dig && game.lore > 0) reasons.push(dig < 0 ? 'Vos fouilles des ruines le mécontentent.' : 'Vos fouilles des ruines l\'intéressent.');
  return reasons;
}

// Réponse de l'empire : { ok, reason, received, given }.
export function evaluateDeal(game, empire, offer) {
  const problem = dealProblem(game, empire, offer);
  if (problem) return { ok: false, reason: problem, received: 0, given: 0 };
  const received = sideValue(game, empire, offer.give, true);
  const given = sideValue(game, empire, offer.get, false);
  const margin = empire.war
    ? DIPLOMACY.warMargin
    : Math.max(DIPLOMACY.marginFloor, DIPLOMACY.margin[attitudeOf(empire.relation).key] * (DIPLOMACY.tradeFactor[empire.species] ?? 1));
  return { ok: received >= given * margin, reason: received >= given * margin ? null : 'unbalanced', received, given, margin };
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

// Effets communs d'un échange accepté : matières, note, délais. Renvoie les technologies reçues
// (game.js seul sait les appliquer) et le convoi parti, s'il y en a un.
export function applyDeal(game, empire, offer, answer) {
  for (const [res, amount] of resourcesOf(offer.give)) {
    game.resources[res] -= amount;
    empire.stocks[res] += amount;
  }
  // Ce que le joueur reçoit voyage par convoi ; ce qu'il donne part tout de suite.
  const shipped = Object.fromEntries(resourcesOf(offer.get));
  for (const [res, amount] of resourcesOf(offer.get)) empire.stocks[res] -= amount;
  const convoy = Object.keys(shipped).length ? startConvoy(game, empire, shipped) : null;
  const given = offer.give.techs ?? [];
  const taken = offer.get.techs ?? [];
  if (given.length || taken.length) empire.nextTechTrade = game.time + DIPLOMACY.techDelay;
  if (given.length) {
    empire.extraTechs.push(...given);
    empire.power += given.length * DIPLOMACY.soldTechPower;
  }
  if (offer.give.map) empire.nextMapTrade = game.time + DIPLOMACY.mapDelay;
  for (const key of offer.get.treaties ?? []) empire.treaties[key] = game.time + DIPLOMACY.treaties[key].days;
  if (offer.get.peace) makePeace(game, empire);
  if (offer.get.map) {
    for (const colony of empire.colonies) {
      colony.known = true;
      const star = game.stars[colony.starId];
      star.level = Math.max(star.level, 2);
      star.planets[colony.planetIndex].inhabitedBy = empire.species;
    }
  }
  // Le partenaire n'apprécie que ce qu'on lui donne en plus du nécessaire ; ses rivaux l'apprennent,
  // même ceux que le joueur n'a pas rencontrés.
  const worth = Math.max(answer.received, answer.given);
  const surplus = Math.max(0, answer.received - answer.given * answer.margin * (1 + DIPLOMACY.generosityMin));
  changeRelation(empire, Math.min(DIPLOMACY.tradeGainMax, surplus * DIPLOMACY.tradeGainPerValue));
  const penalty = Math.min(DIPLOMACY.rivalPenaltyMax, Math.max(DIPLOMACY.rivalPenaltyMin, worth * DIPLOMACY.rivalPenaltyPerValue));
  const rivals = rivalsOf(empire.species);
  for (const other of game.empires) if (rivals.includes(other.species)) changeRelation(other, -penalty);
  return { techs: taken, convoy };
}

// --- Propositions des rivaux -----------------------------------------------------------
// game.proposals : { species, offer, expires }, au plus une par empire.

// Offre que l'empire juge acceptable : il demande au joueur la matière qui lui manque le plus,
// contre celle qu'il a en abondance, au meilleur prix qu'il accepterait lui-même.
function makeProposal(game, empire) {
  const fill = (res) => empire.stocks[res] / stockCap(empire, res);
  const materials = DIPLOMACY.proposalMaterials;
  const wanted = materials
    .filter((res) => (game.resources[res] ?? 0) >= DIPLOMACY.proposalMin / DIPLOMACY.proposalShare) // jamais plus d'une part du stock
    .sort((a, b) => fill(a) - fill(b))[0];
  const offered = materials.filter((res) => res !== wanted && empire.stocks[res] >= 1).sort((a, b) => fill(b) - fill(a))[0];
  if (!wanted || !offered) return null;
  const amount = Math.max(DIPLOMACY.proposalMin, Math.min(DIPLOMACY.proposalMax, Math.round((game.resources[wanted] ?? 0) * DIPLOMACY.proposalShare)));
  const build = (n) => ({ give: { resources: { [wanted]: amount }, techs: [], map: false }, get: { resources: { [offered]: n }, techs: [], map: false, treaties: [] } });
  let low = 0;
  let high = Math.floor(empire.stocks[offered]);
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (evaluateDeal(game, empire, build(mid)).ok) low = mid;
    else high = mid - 1;
  }
  return low > 0 ? build(low) : null;
}

const proposalOf = (game, empire) => game.proposals.find((p) => p.species === empire.species);

// Jour de la prochaine proposition : environ proposalEvery jours plus tard, sans générateur à enregistrer.
function scheduleProposal(game, empire) {
  const rng = createRng((game.seed ^ Math.imul(empire.homeId + 1, 0x2c1b3c6d) ^ Math.floor(game.time)) >>> 0);
  empire.nextProposal = game.time + DIPLOMACY.proposalEvery * (0.75 + rng.next() * 0.5);
}

function proposalDay(game, empire, events) {
  const current = proposalOf(game, empire);
  if (current && game.time >= current.expires) {
    game.proposals = game.proposals.filter((p) => p !== current);
    events.push({ type: 'expired', empire });
  }
  if (!empire.nextProposal) scheduleProposal(game, empire);
  const hostile = attitudeOf(empire.relation).key === 'hostile';
  // Un empire devenu hostile retire sa proposition.
  if ((hostile || empire.war) && proposalOf(game, empire)) {
    game.proposals = game.proposals.filter((p) => p.species !== empire.species);
    events.push({ type: 'expired', empire });
  }
  if (proposalOf(game, empire) || game.time < empire.nextProposal || hostile || empire.war) return;
  const offer = makeProposal(game, empire);
  scheduleProposal(game, empire);
  if (!offer) return;
  const proposal = { species: empire.species, offer, expires: game.time + DIPLOMACY.proposalDays };
  game.proposals.push(proposal);
  events.push({ type: 'proposal', empire, proposal });
}

// Le joueur répond à une proposition : on retire la proposition dans tous les cas.
export function dropProposal(game, species) {
  game.proposals = game.proposals.filter((p) => p.species !== species);
}

// Proposition encore valable (une proposition échue n'est retirée qu'au passage du jour).
export const pendingProposal = (game, empire) => {
  const proposal = proposalOf(game, empire);
  return proposal && game.time < proposal.expires ? proposal : null;
};

// Texte court d'une offre : « 50 minerais contre 30 biomasse ».
export function describeOffer(offer) {
  const side = (s) =>
    [
      ...resourcesOf(s).map(([res, n]) => `${n} ${(RESOURCE_LABELS[res] ?? res).toLowerCase()}`),
      ...(s.techs ?? []).map((k) => TECHS[k].label),
      ...(s.map ? ['une carte'] : []),
      ...(s.treaties ?? []).map((k) => DIPLOMACY.treaties[k].label.toLowerCase()),
      ...(s.peace ? ['la paix'] : []),
    ].join(', ');
  return `${side(offer.give)} contre ${side(offer.get)}`;
}

const validSide = (side) =>
  side &&
  typeof side === 'object' &&
  Object.entries(side.resources ?? {}).every(([res, n]) => Object.hasOwn(DIPLOMACY.values, res) && Number.isInteger(n) && n > 0) &&
  (side.techs ?? []).every((k) => TECHS[k]) &&
  (side.treaties ?? []).every((k) => DIPLOMACY.treaties[k]);

// Propositions d'une sauvegarde : celles qui ne correspondent pas à cette partie sont écartées.
export function validProposals(game, saved) {
  if (!Array.isArray(saved)) return [];
  return saved.filter(
    (p) => p && game.empires.some((e) => e.species === p.species && e.met) && Number.isFinite(p.expires) && validSide(p.offer?.give) && validSide(p.offer?.get),
  );
}

// Un jour entier : les stocks montent chez tous ; chez les empires rencontrés, la note revient vers
// sa valeur de départ et baisse si le joueur est trop près, l'attitude est suivie et des
// propositions arrivent. Renvoie les événements : traités à terme, attitudes, propositions.
function diplomacyDay(game) {
  const ended = [];
  for (const empire of game.empires) {
    stockDay(game, empire);
    for (const key of Object.keys(DIPLOMACY.treaties)) {
      if (!empire.treaties[key]) continue;
      if (treatyActive(game, empire, key)) changeRelation(empire, DIPLOMACY.treatyRespectPerDay);
      else {
        empire.treaties[key] = 0;
        ended.push({ type: 'ended', empire, key });
      }
    }
    if (!empire.met) continue;
    const pressure = Math.min(DIPLOMACY.proximityMax, nearColonies(game, empire) * DIPLOMACY.proximityPerColony);
    changeRelation(empire, (startRelation(empire.species) - empire.relation) * DIPLOMACY.returnPerDay - pressure);
    // Changement d'attitude, quelle qu'en soit la cause (échange, traité, fouilles, voisinage).
    const attitude = attitudeOf(empire.relation);
    const ranks = DIPLOMACY.attitudes.map((a) => a.key);
    if (empire.lastAttitude && empire.lastAttitude !== attitude.key) {
      ended.push({ type: 'attitude', empire, attitude, better: ranks.indexOf(attitude.key) < ranks.indexOf(empire.lastAttitude) });
    }
    empire.lastAttitude = attitude.key;
    warDay(game, empire, ended);
    proposalDay(game, empire, ended);
  }
  return ended;
}

// Calculé par jour entier, pour donner le même résultat quelle que soit la vitesse du jeu.
export function tickDiplomacy(game, days) {
  const steps = Math.floor(game.time) - Math.floor(game.time - days);
  const ended = [];
  for (let i = 0; i < steps; i++) ended.push(...diplomacyDay(game));
  return ended;
}

// Une fouille de ruines plaît ou déplaît selon l'espèce.
export function reactToDig(game) {
  for (const empire of game.empires) {
    if (empire.met) changeRelation(empire, DIPLOMACY.digReaction[empire.species] ?? 0);
  }
}
