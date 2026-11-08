// Empires rivaux simulés (voir docs/plan-rivaux-ia.md) : ils s'étendent dans l'amas sans bâtir
// sur les hexagones. Réglages dans config.js (RIVAL_AI). Diplomatie : diplomacy.js ; pas encore de combat.
import { DIPLOMACY, RIVAL_AI, SPECIES } from './config.js';
import { startRelation, startStocks, treatyForbids } from './diplomacy.js';
import { starDistance } from './galaxy.js';
import { TECHS } from './research.js';
import { createRng } from './rng.js';
import { habitatFor } from './species.js';

// Un empire par monde natal rival ; seul le monde natal existe au départ.
export function createEmpires(stars) {
  return stars
    .filter((star) => star.rival)
    .map((star) => {
      const empire = {
        species: star.rival,
        homeId: star.id,
        colonies: [{ starId: star.id, planetIndex: star.planets.findIndex((p) => p.inhabitedBy === star.rival), known: false }],
        points: 0,
        power: 0,
        nextTry: 0,
        met: false,
        relation: startRelation(star.rival),
        extraTechs: [], // technologies reçues du joueur
        nextTechTrade: 0,
        nextMapTrade: 0,
        treaties: { frontieres: 0, ruines: 0 },
        nextProposal: 0, // 0 : fixé au premier contact
        war: false,
        warSince: 0,
        truceUntil: 0,
      };
      empire.stocks = startStocks(empire);
      return empire;
    });
}

const growthOf = (empire, day) => {
  const style = RIVAL_AI.styles[empire.species];
  return style.lateDay !== undefined && day >= style.lateDay ? style.lateGrowth : style.growth;
};

const colonyCost = (empire) => RIVAL_AI.baseCost * (1 + RIVAL_AI.costGrowth * (empire.colonies.length - 1));

const reach = (empire) => RIVAL_AI.startRange + Math.min(RIVAL_AI.maxExtraRange, empire.power);

export function rivalColonyAt(game, starId, planetIndex) {
  for (const empire of game.empires) {
    const colony = empire.colonies.find((c) => c.starId === starId && c.planetIndex === planetIndex);
    if (colony) return { empire, colony };
  }
  return null;
}

// Planètes à ruines encore libres : ni à un empire, ni au joueur.
function freeRuins(game, taken) {
  let count = 0;
  for (const star of game.stars) {
    star.planets.forEach((planet, index) => {
      if (planet.ruins && !taken.has(`${star.id}-${index}`) && !game.colonies.some((c) => c.starId === star.id && c.planetIndex === index)) count++;
    });
  }
  return count;
}

// La meilleure planète à portée, ou null. Le tirage ne dépend que de la graine et de l'état de
// l'empire : une partie rechargée continue de la même façon, sans enregistrer de générateur.
function chooseTarget(game, empire) {
  const style = RIVAL_AI.styles[empire.species];
  const rng = createRng((game.seed ^ Math.imul(empire.homeId + 1, 0x9e3779b1) ^ Math.imul(empire.colonies.length, 0x51ed270b)) >>> 0);
  const own = empire.colonies.map((c) => game.stars[c.starId]);
  const others = game.empires.filter((e) => e !== empire).flatMap((e) => e.colonies.map((c) => game.stars[c.starId]));
  const range = reach(empire);
  const playerStars = new Set(game.colonies.map((c) => c.starId));
  const taken = new Set(game.empires.flatMap((e) => e.colonies.map((c) => `${c.starId}-${c.planetIndex}`)));
  const ruinsLeft = freeRuins(game, taken);
  const hostileAllowed = empire.power >= RIVAL_AI.hostilePower;
  let best = null;
  for (const star of game.stars) {
    const noise = star.planets.map(() => rng.next() * RIVAL_AI.scoreNoise); // même tirage quelle que soit la portée
    if (star.id === game.homeId || playerStars.has(star.id)) continue;
    const distance = Math.min(...own.map((s) => starDistance(s, star)));
    if (distance > range) continue;
    const frontier = others.some((s) => starDistance(s, star) <= range) ? style.frontier : 0;
    star.planets.forEach((planet, index) => {
      if (!planet.size || planet.inhabitedBy || taken.has(`${star.id}-${index}`)) return;
      if (planet.ruins && ruinsLeft <= RIVAL_AI.keepFreeRuins) return;
      const habitat = habitatFor(SPECIES[empire.species], planet);
      if (habitat === 'hostile' && !hostileAllowed) return;
      if (treatyForbids(game, empire, star, planet)) return;
      const deposits = Object.entries(style.deposits).reduce((sum, [res, weight]) => sum + weight * (planet.deposits[res] ?? 0), 0);
      const score =
        RIVAL_AI.habitatScore[habitat ?? 'neutral'] + RIVAL_AI.sizeScore[planet.size] + deposits + (planet.ruins ? style.ruins : 0) + frontier -
        distance * RIVAL_AI.distancePenalty + noise[index];
      if (!best || score > best.score) best = { score, starId: star.id, planetIndex: index };
    });
  }
  return best;
}

const validRelation = (empire) =>
  Number.isFinite(empire.relation) && Math.abs(empire.relation) <= 100 ? empire.relation : startRelation(empire.species);

// Une matière absente ou invalide reprend sa valeur de départ.
const validStocks = (empire) => {
  const start = startStocks(empire);
  return Object.fromEntries(Object.keys(start).map((res) => [res, Number.isFinite(empire.stocks?.[res]) && empire.stocks[res] >= 0 ? empire.stocks[res] : start[res]]));
};

// Empires d'une sauvegarde, s'ils correspondent à cette partie ; sinon null (un fichier modifié
// ne doit ni planter ni fausser la partie : les rivaux repartent alors de leur monde natal).
export function validEmpires(game, saved) {
  if (!Array.isArray(saved) || saved.length !== game.empires.length) return null;
  const number = (x) => Number.isFinite(x) && x >= 0;
  const fine = saved.every((empire, i) => {
    const fresh = game.empires[i];
    if (!empire || empire.species !== fresh.species || empire.homeId !== fresh.homeId) return false;
    if (!number(empire.points) || !number(empire.power) || !Array.isArray(empire.colonies) || !empire.colonies.length) return false;
    if (empire.colonies[0].starId !== fresh.homeId || empire.colonies[0].planetIndex !== fresh.colonies[0].planetIndex) return false;
    return empire.colonies.every((c) => c && typeof c.known === 'boolean' && game.stars[c.starId]?.planets[c.planetIndex]?.size);
  });
  if (!fine) return null;
  return saved.map((empire) => ({
    ...empire,
    nextTry: number(empire.nextTry) ? empire.nextTry : 0, met: empire.met === true, relation: validRelation(empire),
    stocks: validStocks(empire),
    extraTechs: Array.isArray(empire.extraTechs) ? empire.extraTechs.filter((key) => TECHS[key]) : [],
    nextTechTrade: number(empire.nextTechTrade) ? empire.nextTechTrade : 0,
    nextMapTrade: number(empire.nextMapTrade) ? empire.nextMapTrade : 0,
    treaties: { frontieres: number(empire.treaties?.frontieres) ? empire.treaties.frontieres : 0, ruines: number(empire.treaties?.ruines) ? empire.treaties.ruines : 0 },
    nextProposal: number(empire.nextProposal) ? empire.nextProposal : 0,
    war: empire.war === true,
    warSince: number(empire.warSince) ? empire.warSince : 0,
    truceUntil: number(empire.truceUntil) ? empire.truceUntil : 0,
    lastAttitude: DIPLOMACY.attitudes.some((a) => a.key === empire.lastAttitude) ? empire.lastAttitude : undefined,
  }));
}

// Colonies d'un système découvertes par un vaisseau du joueur qui s'y trouve. Renvoie les nouvelles.
export function revealEmpires(game, starId) {
  const found = [];
  for (const empire of game.empires) {
    for (const colony of empire.colonies) {
      if (colony.starId !== starId || colony.known) continue;
      colony.known = true;
      game.stars[starId].planets[colony.planetIndex].inhabitedBy = empire.species;
      found.push({ empire, colony });
    }
  }
  return found;
}

// Empires identifiés pour la première fois : une de leurs planètes connues se trouve dans un système analysé.
export function newContacts(game) {
  const met = game.empires.filter(
    (empire) => !empire.met && empire.colonies.some((c) => game.stars[c.starId].level >= 3 && game.stars[c.starId].planets[c.planetIndex].inhabitedBy),
  );
  for (const empire of met) empire.met = true;
  return met;
}

// Une colonie déjà découverte reste connue après un rechargement.
export function applyKnownColonies(game) {
  for (const empire of game.empires) {
    for (const colony of empire.colonies) {
      if (colony.known) game.stars[colony.starId].planets[colony.planetIndex].inhabitedBy = empire.species;
    }
  }
}

// Avance les empires ; renvoie les colonies fondées (l'appelant décide de ce que voit le joueur).
export function tickEmpires(game, days) {
  const founded = [];
  for (const empire of game.empires) {
    const style = RIVAL_AI.styles[empire.species];
    empire.points += growthOf(empire, game.time) * days;
    empire.power += style.power * days;
    if (empire.points < colonyCost(empire) || game.time < empire.nextTry) continue;
    const target = chooseTarget(game, empire);
    if (!target) {
      empire.nextTry = game.time + RIVAL_AI.retryDays; // les points attendent : la portée augmentera
      continue;
    }
    empire.points -= colonyCost(empire);
    const colony = { starId: target.starId, planetIndex: target.planetIndex, known: false };
    empire.colonies.push(colony);
    founded.push({ empire, colony });
  }
  return founded;
}
