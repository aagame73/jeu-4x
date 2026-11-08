// Combat (voir docs/plan-combat.md) : résolution automatique, jour après jour, quand deux camps
// ennemis se trouvent dans le même système. Réglages dans config.js (COMBAT).
import { COMBAT, SPECIES } from './config.js';
import { starDistance } from './galaxy.js';
import { SHIP_KINDS, colonyDefense, getSurface, removeShip, shipStats } from './game.js';
import { createRng } from './rng.js';
import { rivalInfo, speciesHabitat } from './species.js';
import { changeRelation } from './diplomacy.js';
import { RESOURCE_LABELS } from './economy.js';

// Une unité : { attack, defense, damage } (vaisseau, flotte ou défense de colonie). Elle tombe quand
// ses dégâts atteignent sa résistance.
export const toughness = (unit) => unit.defense * COMBAT.hpPerDefense;
export const alive = (unit) => unit.damage < toughness(unit);

// Dégâts d'un camp pour une journée, avec une part de hasard.
function volley(units, rng) {
  const total = units.filter(alive).reduce((sum, u) => sum + u.attack, 0);
  return total * (1 - COMBAT.spread + rng.next() * 2 * COMBAT.spread);
}

// Les dégâts frappent d'abord l'unité la plus abîmée, puis la suivante : on achève avant de disperser.
function absorb(units, amount) {
  let left = amount;
  const targets = units.filter(alive).sort((a, b) => toughness(a) - a.damage - (toughness(b) - b.damage));
  for (const unit of targets) {
    if (left <= 0) break;
    const room = toughness(unit) - unit.damage;
    const hit = Math.min(room, left);
    unit.damage += hit;
    left -= hit;
  }
}

// Une journée de combat entre deux camps (tableaux d'unités, modifiés sur place). Les deux camps
// tirent en même temps. Renvoie les unités tombées ce jour-là.
export function fightDay(sideA, sideB, rng) {
  const before = new Set([...sideA, ...sideB].filter(alive));
  const toB = volley(sideA, rng);
  const toA = volley(sideB, rng);
  absorb(sideB, toB);
  absorb(sideA, toA);
  return [...before].filter((u) => !alive(u));
}

// Combat complet, pour les tests et l'équilibrage : jusqu'à ce qu'un camp tombe ou que le temps passe.
export function fightToEnd(sideA, sideB, rng, maxDays = COMBAT.maxBattleDays) {
  let days = 0;
  while (days < maxDays && sideA.some(alive) && sideB.some(alive)) {
    fightDay(sideA, sideB, rng);
    days++;
  }
  const a = sideA.some(alive);
  const b = sideB.some(alive);
  return { days, winner: a && !b ? 'A' : b && !a ? 'B' : null };
}

// --- Guerre dans l'amas -----------------------------------------------------------------
// game.fleets : { id, species, ships: [{ kind, damage }], starId, fromId, toId, distance, progress, state }.
// Les vaisseaux du joueur gardent leurs dégâts dans ship.damage ; les colonies dans colony.damage.

const atWar = (game, species) => game.empires.some((e) => e.species === species && e.war);
const empireOf = (game, species) => game.empires.find((e) => e.species === species);

// Statistiques d'un vaisseau rival : base × puissance de l'empire × bonus de l'espèce.
function rivalShipUnit(game, fleet, ship) {
  const empire = empireOf(game, fleet.species);
  const def = SHIP_KINDS[ship.kind];
  const bonuses = SPECIES[fleet.species].bonuses;
  const k = 1 + empire.power * COMBAT.powerBonus;
  return {
    attack: def.attack * k * (bonuses.shipAttack ?? 1),
    defense: def.defense * k * (bonuses.shipDefense ?? 1),
    damage: ship.damage,
    ref: ship,
    fleet,
  };
}

function rivalColonyUnit(game, empire, colony) {
  const { base, perPower, home } = COMBAT.rivalColonyDefense;
  const defense = (base + perPower * empire.power) * (colony === empire.colonies[0] ? home : 1);
  return { attack: defense * COMBAT.colonyAttack, defense, damage: Number.isFinite(colony.damage) ? colony.damage : 0, ref: colony, empire };
}

function playerColonyUnit(game, colony) {
  const defense = colonyDefense(game, colony);
  return defense > 0 ? { attack: defense * COMBAT.colonyAttack, defense, damage: Number.isFinite(colony.damage) ? colony.damage : 0, ref: colony } : null;
}

// Nouvelle flotte d'un empire en guerre : depuis sa colonie la plus proche du joueur, payée en alliages.
function buildFleet(game, empire) {
  const targets = game.colonies.map((c) => game.stars[c.starId]);
  if (!targets.length) return null;
  let best = null;
  for (const colony of empire.colonies) {
    const from = game.stars[colony.starId];
    for (const to of targets) {
      const d = starDistance(from, to);
      if (!best || d < best.d) best = { d, from };
    }
  }
  const kind = COMBAT.fleetKinds.find(([power]) => empire.power >= power)[1];
  const { base, perPower, max } = COMBAT.fleetSize;
  const wanted = Math.min(max, Math.floor(base + perPower * empire.power));
  const count = Math.min(wanted, Math.floor(empire.stocks.alliages / COMBAT.shipCost[kind]));
  if (count < 1) return null;
  empire.stocks.alliages -= count * COMBAT.shipCost[kind];
  const fleet = {
    id: game.nextFleetId++,
    species: empire.species,
    ships: Array.from({ length: count }, () => ({ kind, damage: 0 })),
    starId: best.from.id,
    fromId: null,
    toId: null,
    distance: 0,
    progress: 0,
    state: 'idle',
  };
  game.fleets.push(fleet);
  return fleet;
}

// Une flotte au repos choisit la colonie du joueur la plus proche et s'y rend.
function moveFleet(game, fleet) {
  if (fleet.state === 'travel') {
    fleet.progress += COMBAT.fleetSpeed;
    if (fleet.progress >= fleet.distance) Object.assign(fleet, { state: 'idle', starId: fleet.toId, fromId: null, toId: null, progress: 0, distance: 0 });
    return;
  }
  if (game.colonies.some((c) => c.starId === fleet.starId)) return; // déjà au siège
  const here = game.stars[fleet.starId];
  const target = game.colonies.map((c) => game.stars[c.starId]).sort((a, b) => starDistance(here, a) - starDistance(here, b))[0];
  if (!target) return;
  Object.assign(fleet, { state: 'travel', fromId: here.id, toId: target.id, distance: Math.max(1, starDistance(here, target)), progress: 0 });
}

// Prise d'une colonie du joueur : elle passe à l'empire, avec ses bâtiments, et pourra être reprise.
function captureFromPlayer(game, colony, species) {
  game.colonies = game.colonies.filter((c) => c !== colony);
  const { damage, siegeDays, ...kept } = colony;
  empireOf(game, species).colonies.push({ starId: colony.starId, planetIndex: colony.planetIndex, known: true, damage: 0, captured: kept });
  game.stars[colony.starId].planets[colony.planetIndex].inhabitedBy = species;
}

// Prise d'une colonie rivale par le joueur : on retrouve la sienne si elle avait été perdue, sinon
// on installe une petite colonie autour d'un centre.
function captureFromEmpire(game, empire, entry) {
  empire.colonies = empire.colonies.filter((c) => c !== entry);
  const planet = game.stars[entry.starId].planets[entry.planetIndex];
  planet.inhabitedBy = null;
  if (entry.captured?.starId === entry.starId && entry.captured?.planetIndex === entry.planetIndex) {
    game.colonies.push({ ...entry.captured, damage: 0, siegeDays: 0 });
    return 'retaken';
  }
  const surface = getSurface(game, entry.starId, entry.planetIndex);
  const tile = surface.tiles.find((t) => t.building?.type === 'centre') ?? surface.tiles.find((t) => t.terrain !== 'ocean' && !t.building);
  if (tile) {
    tile.terrain = 'plaine';
    tile.building = { type: 'centre', done: true };
  }
  game.colonies.push({
    starId: entry.starId,
    planetIndex: entry.planetIndex,
    name: planet.name,
    population: COMBAT.capturePopulation,
    habitat: speciesHabitat(planet),
    growth: 0,
    construction: null,
    shipyard: null,
    famine: false,
    orbital: { dock: false, defense: 0, ecope: false },
    thirst: false,
  });
  return 'captured';
}

// Une journée de combat dans un système, s'il y a lieu. Renvoie les événements à annoncer.
function battleDay(game, starId, rng) {
  const star = game.stars[starId];
  const events = [];
  const ships = game.ships.filter((s) => s.starId === starId && s.state !== 'travel');
  const warships = ships.filter((s) => SHIP_KINDS[s.kind].warship);
  const colony = game.colonies.find((c) => c.starId === starId);
  const fleets = game.fleets.filter((f) => f.starId === starId && f.state === 'idle');
  const enemyColonies = game.empires
    .filter((e) => e.war)
    .flatMap((e) => e.colonies.filter((c) => c.starId === starId).map((c) => ({ empire: e, colony: c })));
  const fighting = (fleets.length && (ships.length || colony)) || (warships.length && enemyColonies.length);
  if (!fighting) return events;

  const player = ships.map((ship) => {
    const s = shipStats(game, ship);
    return { attack: s.attack, defense: Math.max(1, s.defense), damage: Number.isFinite(ship.damage) ? ship.damage : 0, ref: ship, ship: true };
  });
  const colonyUnit = colony && playerColonyUnit(game, colony);
  if (colonyUnit) player.push(colonyUnit);
  const enemy = fleets.flatMap((f) => f.ships.map((ship) => rivalShipUnit(game, f, ship)));
  // Les colonies rivales ne combattent que si des vaisseaux de guerre du joueur sont là.
  if (warships.length) for (const { empire, colony: c } of enemyColonies) enemy.push(rivalColonyUnit(game, empire, c));

  fightDay(player, enemy, rng);

  // Vaisseaux du joueur.
  for (const u of player.filter((x) => x.ship)) {
    u.ref.damage = u.damage;
    u.ref.age += COMBAT.wearPerBattleDay;
    if (!alive(u)) {
      removeShip(game, u.ref);
      events.push({ text: `${u.ref.name} est détruit au combat dans le système ${star.name}.`, type: 'ship-lost' });
    }
  }
  // Vaisseaux rivaux.
  for (const u of enemy.filter((x) => x.fleet)) {
    u.ref.damage = u.damage;
    if (!alive(u)) u.fleet.ships = u.fleet.ships.filter((s) => s !== u.ref);
  }
  for (const fleet of fleets) {
    if (fleet.ships.length) continue;
    game.fleets = game.fleets.filter((f) => f !== fleet);
    events.push({ text: `Une flotte des ${rivalInfo(fleet.species).label} est anéantie dans le système ${star.name}.`, kind: 'discovery', type: 'fleet-lost', species: fleet.species });
  }
  // Colonie du joueur assiégée.
  const besiegers = game.fleets.filter((f) => f.starId === starId && f.state === 'idle');
  if (colony) {
    if (colonyUnit) colony.damage = colonyUnit.damage;
    colony.siegeDays = besiegers.length ? (colony.siegeDays ?? 0) + 1 : 0;
    const fallen = colonyUnit ? !alive(colonyUnit) : colony.siegeDays >= COMBAT.captureDays;
    if (besiegers.length && fallen) {
      captureFromPlayer(game, colony, besiegers[0].species);
      events.push({ text: `${colony.name} est tombée aux mains des ${rivalInfo(besiegers[0].species).label} !`, type: 'colony-lost', species: besiegers[0].species });
    }
  }
  // Colonies rivales assiégées par le joueur (les mondes natals ne se prennent pas).
  const stillWarships = game.ships.some((s) => s.starId === starId && s.state !== 'travel' && SHIP_KINDS[s.kind].warship);
  for (const u of enemy.filter((x) => x.empire)) {
    u.ref.damage = u.damage;
    if (alive(u) || !stillWarships || u.ref === u.empire.colonies[0]) continue;
    const how = captureFromEmpire(game, u.empire, u.ref);
    const name = star.planets[u.ref.planetIndex].name;
    const label = rivalInfo(u.empire.species).label;
    events.push({ text: how === 'retaken' ? `Vous reprenez ${name} aux ${label} !` : `Vous prenez ${name} aux ${label} !`, kind: 'discovery', type: 'colony-won', species: u.empire.species });
  }
  return events;
}

// Convoi de ravitaillement : du monde natal vers la colonie la plus proche du joueur.
function sendSupply(game, empire) {
  if (empire.colonies.length < 2 || !game.colonies.length) return;
  const home = game.stars[empire.homeId];
  const front = empire.colonies
    .slice(1)
    .map((c) => game.stars[c.starId])
    .sort((a, b) => Math.min(...game.colonies.map((c) => starDistance(a, game.stars[c.starId]))) - Math.min(...game.colonies.map((c) => starDistance(b, game.stars[c.starId]))))[0];
  if (front.id === home.id) return;
  const resources = {};
  for (const [res, max] of Object.entries(COMBAT.supplyLoad)) {
    const n = Math.floor(Math.min(max, empire.stocks[res]));
    if (n > 0) {
      resources[res] = n;
      empire.stocks[res] -= n;
    }
  }
  if (!Object.keys(resources).length) return;
  game.convoys.push({ id: game.nextConvoyId++, species: empire.species, fromId: home.id, toId: front.id, distance: Math.max(1, starDistance(home, front)), progress: 0, resources, supply: true });
}

// Position d'un convoi sur sa route.
function convoyPosition(game, convoy) {
  const a = game.stars[convoy.fromId].pos;
  const b = game.stars[convoy.toId].pos;
  const t = Math.min(1, convoy.progress / convoy.distance);
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

// Un vaisseau de guerre du joueur intercepte les convois de ravitaillement ennemis passant près de lui.
function pillageDay(game) {
  const events = [];
  const posts = game.ships.filter((s) => s.state !== 'travel' && SHIP_KINDS[s.kind].warship).map((s) => game.stars[s.starId]);
  if (!posts.length) return events;
  for (const convoy of [...game.convoys]) {
    if (!convoy.supply || !atWar(game, convoy.species)) continue;
    const pos = convoyPosition(game, convoy);
    if (!posts.some((star) => Math.hypot(star.pos.x - pos.x, star.pos.y - pos.y, star.pos.z - pos.z) <= COMBAT.interceptRange)) continue;
    const loot = Object.entries(convoy.resources).map(([res, n]) => [res, Math.floor(n * COMBAT.pillageShare)]).filter(([, n]) => n > 0);
    for (const [res, n] of loot) game.resources[res] = (game.resources[res] ?? 0) + n;
    game.convoys = game.convoys.filter((c) => c !== convoy);
    changeRelation(empireOf(game, convoy.species), -COMBAT.pillageRelation);
    const goods = loot.map(([res, n]) => `${n} ${(RESOURCE_LABELS[res] ?? res).toLowerCase()}`).join(', ') || 'rien';
    events.push({ text: `Convoi de ravitaillement des ${rivalInfo(convoy.species).label} intercepté : butin ${goods}.`, kind: 'discovery', type: 'pillage', species: convoy.species });
  }
  return events;
}

// Un jour entier de guerre : flottes construites et déplacées, ravitaillement, combats, réparations.
function warDay(game) {
  const events = [];
  for (const empire of game.empires) {
    if (!empire.war || game.time < empire.nextSupply) continue;
    empire.nextSupply = game.time + COMBAT.supplyEvery;
    sendSupply(game, empire);
  }
  events.push(...pillageDay(game));
  for (const empire of game.empires) {
    if (!empire.war || game.time < empire.nextFleet) continue;
    empire.nextFleet = game.time + COMBAT.fleetEvery;
    if (game.fleets.filter((f) => f.species === empire.species).length >= COMBAT.maxFleets) continue;
    const fleet = buildFleet(game, empire);
    if (!fleet) continue;
    const n = fleet.ships.length;
    const kind = SHIP_KINDS[fleet.ships[0].kind].label.toLowerCase();
    events.push({ text: `Les ${rivalInfo(empire.species).label} lancent une flotte de guerre (${n} ${kind}${n > 1 ? 's' : ''}).`, type: 'fleet-built', species: empire.species });
  }
  game.fleets = game.fleets.filter((f) => atWar(game, f.species));
  for (const fleet of game.fleets) moveFleet(game, fleet);

  const idleFleetStars = game.fleets.filter((f) => f.state === 'idle').map((f) => f.starId);
  const warshipStars = game.ships.filter((s) => s.state !== 'travel' && SHIP_KINDS[s.kind].warship).map((s) => s.starId);
  const inBattle = new Set();
  for (const starId of new Set([...idleFleetStars, ...warshipStars])) {
    const rng = createRng((game.seed ^ Math.imul(starId + 1, 0x632be5ab) ^ Math.imul(Math.floor(game.time), 0x2545f491)) >>> 0);
    const happened = battleDay(game, starId, rng);
    const contested =
      game.fleets.some((f) => f.starId === starId && f.state === 'idle') &&
      (game.ships.some((s) => s.starId === starId && s.state !== 'travel') || game.colonies.some((c) => c.starId === starId));
    if (happened.length || contested) inBattle.add(starId);
    events.push(...happened);
  }
  game.battles = [...inBattle];
  // Réparations hors combat.
  for (const colony of game.colonies) {
    if (inBattle.has(colony.starId) || !colony.damage) continue;
    const unit = playerColonyUnit(game, colony);
    colony.damage = unit ? Math.max(0, colony.damage - toughness(unit) * COMBAT.regenPerDay) : 0;
  }
  for (const ship of game.ships) {
    if (!ship.damage || inBattle.has(ship.starId) || ship.state === 'travel' || !game.colonies.some((c) => c.starId === ship.starId)) continue;
    ship.damage = Math.max(0, ship.damage - shipStats(game, ship).defense * COMBAT.hpPerDefense * COMBAT.repairPerDay);
  }
  for (const empire of game.empires) {
    for (const colony of empire.colonies) {
      if (!colony.damage || inBattle.has(colony.starId)) continue;
      colony.damage = Math.max(0, colony.damage - toughness(rivalColonyUnit(game, empire, colony)) * COMBAT.regenPerDay);
    }
  }
  return events;
}

// Calculé par jour entier, comme la diplomatie.
export function tickCombat(game, days) {
  const steps = Math.floor(game.time) - Math.floor(game.time - days);
  const events = [];
  for (let i = 0; i < steps; i++) events.push(...warDay(game));
  return events;
}

// Flottes d'une sauvegarde : celles qui ne correspondent pas à cette partie sont écartées.
export function validFleets(game, saved) {
  if (!Array.isArray(saved)) return [];
  const number = (x) => Number.isFinite(x) && x >= 0;
  return saved.filter(
    (f) =>
      f &&
      Number.isInteger(f.id) &&
      game.empires.some((e) => e.species === f.species) &&
      game.stars[f.starId] &&
      ['idle', 'travel'].includes(f.state) &&
      (f.state === 'idle' || (game.stars[f.fromId] && game.stars[f.toId] && number(f.distance) && number(f.progress))) &&
      Array.isArray(f.ships) &&
      f.ships.length > 0 &&
      f.ships.every((s) => SHIP_KINDS[s?.kind]?.warship && number(s.damage)),
  );
}
