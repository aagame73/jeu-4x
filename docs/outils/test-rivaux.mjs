// Tests des empires rivaux (étapes 1 et 2 de docs/plan-rivaux-ia.md).
// Usage : node docs/outils/test-rivaux.mjs .
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const E = await imp('empires.js');
const S = await imp('species.js');
const { RIVAL_AI, SPECIES } = await imp('config.js');
const { restore, serialize } = await imp('save.js');

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`);
  if (!ok) fails++;
};
const advance = (game, days) => {
  for (let d = 0; d < days; d++) {
    game.time += 1;
    E.tickEmpires(game, 1);
  }
};
const copy = (x) => JSON.parse(JSON.stringify(x));
const coloniesOf = (game) => game.empires.flatMap((e) => e.colonies.map((c) => `${c.starId}-${c.planetIndex}`));

// Étape 1 : état initial et sauvegarde.
{
  const game = G.createGame(42, 'vaskhar', 5);
  check(game.empires.length === 5, '5 rivaux donnent 5 empires');
  check(game.empires.every((e) => e.colonies.length === 1 && game.stars[e.colonies[0].starId].rival === e.species), 'chaque empire démarre avec son seul monde natal');
  check(game.empires.every((e) => RIVAL_AI.styles[e.species] && SPECIES[e.species]), 'chaque espèce rivale a un style');
  check(Object.keys(RIVAL_AI.styles).length === S.playableSpecies().length, 'un style par espèce jouable');

  advance(game, 400);
  const back = restore(copy(serialize(game)));
  check(JSON.stringify(back.empires) === JSON.stringify(game.empires), 'aller-retour de sauvegarde identique');
  advance(game, 300);
  advance(back, 300);
  check(JSON.stringify(back.empires) === JSON.stringify(game.empires), 'une partie rechargée continue exactement de la même façon');

  const old = copy(serialize(G.createGame(42, 'vaskhar', 5)));
  old.time = 900;
  delete old.empires;
  const oldGame = restore(old);
  check(oldGame.empires.length === 5 && oldGame.empires.every((e) => e.colonies.length === 1), 'sauvegarde sans empires : mondes natals seuls');
}

// Sauvegardes invalides : les rivaux repartent de leur monde natal, sans plantage.
{
  const base = () => {
    const game = G.createGame(42, 'vaskhar', 5);
    advance(game, 500);
    return copy(serialize(game));
  };
  const cases = {
    'empires vide': (d) => (d.empires = []),
    'empires texte': (d) => (d.empires = 'x'),
    'espèce inconnue': (d) => (d.empires[0].species = 'inconnue'),
    'points absents': (d) => delete d.empires[0].points,
    'puissance absente': (d) => delete d.empires[0].power,
    'colonies vides': (d) => (d.empires[0].colonies = []),
    'colonies absentes': (d) => delete d.empires[0].colonies,
    'étoile hors bornes': (d) => (d.empires[0].colonies.at(-1).starId = 9999),
    'planète hors bornes': (d) => (d.empires[0].colonies.at(-1).planetIndex = 99),
    'monde natal déplacé': (d) => (d.empires[0].colonies[0].starId = d.empires[1].colonies[0].starId),
  };
  for (const [name, spoil] of Object.entries(cases)) {
    const data = base();
    spoil(data);
    let ok = true;
    try {
      const game = restore(data);
      ok = game.empires.length === 5 && game.empires.every((e) => e.colonies.length === 1 && e.points === 0);
      for (let d = 0; d < 30; d++) G.tick(game, 1);
      ok = ok && game.empires.every((e) => e.colonies.length <= 2);
    } catch {
      ok = false;
    }
    check(ok, `sauvegarde invalide (${name}) : rivaux réinitialisés`);
  }
}

// Fondation refusée même si la colonie rivale n'a pas encore été marquée comme connue.
{
  const game = G.createGame(42, 'vaskhar', 5);
  advance(game, 500);
  const c = game.empires.flatMap((e) => e.colonies.slice(1))[0];
  game.stars[c.starId].level = 3;
  const ship = { id: 92, kind: 'colonie', starId: c.starId, state: 'idle', age: 0, name: 'Colonie test' };
  game.ships.push(ship);
  check(/habitée/.test(G.foundingProblem(game, ship, c.starId, c.planetIndex) ?? ''), 'colonie rivale non marquée : fondation refusée quand même');
  // Un vaisseau stationné voit s'installer un rival : révélation pendant le jeu normal.
  const parked = G.createGame(77, 'vaskhar', 7);
  const stars = parked.stars.filter((s) => s.id !== parked.homeId && s.planets.some((p) => p.size));
  stars.forEach((s, i) => parked.ships.push({ id: 200 + i, kind: 'arche', starId: s.id, state: 'idle', age: 0, name: `T${i}` }));
  for (let d = 0; d < 1000; d++) G.tick(parked, 1);
  const later = parked.empires.flatMap((e) => e.colonies.slice(1));
  check(later.length > 0 && later.every((x) => x.known), 'un vaisseau sur place découvre la colonie dès sa fondation');
}

// Étape 2 : règles d'expansion.
{
  let duplicates = 0;
  let hostileEarly = 0;
  let ruinsTaken = 0;
  let outOfReach = 0;
  let inhabited = 0;
  for (const seed of [1, 42, 77, 1234]) {
    for (const n of [3, 7]) {
      const game = G.createGame(seed, 'ondesiens', n);
      const ruinPlanets = game.stars.flatMap((s) => s.planets.map((p, i) => ({ s, p, i }))).filter((x) => x.p.ruins);
      const isTaken = (x) => !!E.rivalColonyAt(game, x.s.id, x.i);
      const freeAtStart = ruinPlanets.filter((x) => !isTaken(x)).length;
      for (let d = 0; d < 3000; d++) {
        const before = game.empires.map((e) => e.power);
        game.time += 1;
        for (const { empire, colony } of E.tickEmpires(game, 1)) {
          const i = game.empires.indexOf(empire);
          const planet = game.stars[colony.starId].planets[colony.planetIndex];
          if (S.habitatFor(SPECIES[empire.species], planet) === 'hostile' && before[i] < RIVAL_AI.hostilePower) hostileEarly++;
          if (planet.inhabitedBy) inhabited++;
          const range = RIVAL_AI.startRange + Math.min(RIVAL_AI.maxExtraRange, empire.power) + 0.1;
          const own = empire.colonies.slice(0, -1).map((c) => game.stars[c.starId].pos);
          const p = game.stars[colony.starId].pos;
          if (Math.min(...own.map((q) => Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z))) > range) outOfReach++;
        }
      }
      const all = coloniesOf(game);
      duplicates += all.length - new Set(all).size;
      const free = ruinPlanets.filter((x) => !isTaken(x)).length;
      if (free < Math.min(RIVAL_AI.keepFreeRuins, freeAtStart)) ruinsTaken++;
    }
  }
  check(duplicates === 0, 'jamais deux colonies sur la même planète');
  check(hostileEarly === 0, 'pas de milieu hostile avant la puissance requise');
  check(inhabited === 0, 'jamais sur une planète déjà marquée habitée');
  check(outOfReach === 0, 'toujours à portée');
  check(ruinsTaken === 0, `au moins ${RIVAL_AI.keepFreeRuins} planètes à ruines restent libres`);
}

// Le joueur : son système de départ et ses colonies sont à l'abri ; les colonies restent cachées.
{
  const game = G.createGame(42, 'vaskhar', 7);
  const star = game.stars.find((s) => s.id !== game.homeId && !s.rival && s.planets.some((p) => p.size));
  const fake = { starId: star.id, planetIndex: star.planets.findIndex((p) => p.size) }; // seule la règle des empires est testée
  game.colonies.push(fake);
  advance(game, 5000);
  game.colonies.length = 0;
  const stars = game.empires.flatMap((e) => e.colonies.map((c) => c.starId));
  check(!stars.includes(star.id), 'aucune colonie rivale dans un système où le joueur a une colonie');
  check(!stars.includes(game.homeId), 'aucune colonie rivale dans le système de départ');
  const hidden = game.empires.flatMap((e) => e.colonies.slice(1));
  check(hidden.length > 0 && hidden.every((c) => !c.known && !game.stars[c.starId].planets[c.planetIndex].inhabitedBy), 'colonies invisibles tant que personne ne les a visitées');

  const target = hidden[0];
  const planet = game.stars[target.starId].planets[target.planetIndex];
  game.ships.push({ id: 90, kind: 'sonde', name: 'Sonde test', state: 'travel', fromId: game.homeId, toId: target.starId, speed: 1, progress: 0, distance: 0.1, age: 0 });
  G.tick(game, 0.2);
  check(!!planet.inhabitedBy && target.known === true, 'un vaisseau qui arrive découvre la colonie');
  check(game.log.some((l) => JSON.stringify(l).includes('colonie étrangère')), 'le journal le signale');
  const back = restore(copy(serialize(game)));
  check(!!back.stars[target.starId].planets[target.planetIndex].inhabitedBy, 'colonie découverte toujours connue après rechargement');
  const other = hidden.find((c) => c.starId !== target.starId);
  check(!!other && !back.stars[other.starId].planets[other.planetIndex].inhabitedBy, 'les autres restent cachées après rechargement');
  const analyst = { id: 93, kind: 'sonde', starId: target.starId, state: 'idle', age: 0, name: 'Sonde analyse' };
  game.ships.push(analyst);
  game.stars[target.starId].level = 2;
  G.startAnalysis(game, analyst);
  for (let d = 0; d < 60 && game.stars[target.starId].level < 3; d++) G.tick(game, 1);
  const owner = E.rivalColonyAt(game, target.starId, target.planetIndex).empire.species;
  check(game.log.some((l) => JSON.stringify(l).includes(`Colonie des ${SPECIES[owner].label} (${SPECIES[owner].empire})`)), "l'analyse nomme l'empire de la colonie");
  check(S.knownRival(game.stars[target.starId], planet.inhabitedBy)?.empire === SPECIES[owner].empire, 'identité connue une fois le système analysé');
  const colonist = { id: 91, kind: 'colonie', starId: target.starId, state: 'idle', age: 0, name: 'Colonie test' };
  game.ships.push(colonist);
  check(/habitée/.test(G.foundingProblem(game, colonist, target.starId, target.planetIndex) ?? ''), 'planète prise : fondation refusée');
}

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
