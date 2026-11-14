// Tests des réglages de la partie : niveau, taille de carte, ressources (docs/plan-difficulte.md, étapes 1 à 4).
// Usage : node docs/outils/test-difficulte.mjs .
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(process.argv[2] ?? '.');
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const E = await imp('empires.js');
const D = await imp('difficulty.js');
const { generateCluster, starDistance, isColonisable } = await imp('galaxy.js');
const { DIFFICULTY, MAP_SIZES, RESOURCE_LEVELS, RIVALS, DIPLOMACY, COMBAT, CONFIG } = await imp('config.js');
const { restore, serialize } = await imp('save.js');

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`);
  if (!ok) fails++;
};
const copy = (x) => JSON.parse(JSON.stringify(x));
const fingerprint = (g) => createHash('sha256').update(JSON.stringify({ stars: g.stars, currents: g.currents, homeId: g.homeId })).digest('hex').slice(0, 16);

// Étape 1 : réglages dans config.js.
{
  const order = ['decouverte', 'standard', 'ardu', 'redoutable'];
  check(JSON.stringify(Object.keys(DIFFICULTY.levels)) === JSON.stringify(order) && DIFFICULTY.default === 'standard', 'quatre niveaux, Standard par défaut');
  const keys = JSON.stringify(Object.keys(DIFFICULTY.levels.standard).sort());
  check(order.every((k) => JSON.stringify(Object.keys(DIFFICULTY.levels[k]).filter((x) => x !== 'imposed').sort()) === keys), 'chaque niveau a les mêmes leviers');
  const std = DIFFICULTY.levels.standard;
  const ones = ['growth', 'power', 'maxExtraRange', 'warChancePerDay', 'proximityPerColony', 'stockPerDay', 'margin', 'rivalColonyDefense'];
  check(ones.every((k) => std[k] === 1), 'Standard : multiplicateurs à 1');
  check(std.graceDays === DIPLOMACY.graceDays && std.fleetEvery === COMBAT.fleetEvery && std.maxFleets === COMBAT.maxFleets && std.fleetSizeMax === COMBAT.fleetSize.max, 'Standard : valeurs égales aux réglages actuels');
  check(std.smarter === 0 && !std.rivalCanWin && !DIFFICULTY.levels.decouverte.rivalCanWin && DIFFICULTY.levels.ardu.rivalCanWin && DIFFICULTY.levels.redoutable.rivalCanWin, 'un rival ne gagne qu\'en Ardu et Redoutable');
  const rising = (k) => order.every((l, i) => i === 0 || DIFFICULTY.levels[l][k] >= DIFFICULTY.levels[order[i - 1]][k]);
  check(['growth', 'power', 'maxExtraRange', 'warChancePerDay', 'stockPerDay', 'margin', 'maxFleets', 'fleetSizeMax', 'smarter'].every(rising), 'les leviers montent avec le niveau');
  check(order.every((l, i) => i === 0 || DIFFICULTY.levels[l].graceDays < DIFFICULTY.levels[order[i - 1]].graceDays), 'le délai de grâce raccourcit avec le niveau');
  check(JSON.stringify(Object.keys(MAP_SIZES.sizes)) === '["petite","moyenne","grande"]' && MAP_SIZES.default === 'moyenne', 'trois tailles de carte, moyenne par défaut');
  const m = MAP_SIZES.sizes;
  check(m.petite.starCount === 90 && m.moyenne.starCount === 140 && m.grande.starCount === 200, 'tailles : 90 / 140 / 200 systèmes');
  check(m.moyenne.clusterRadius === 100 && m.moyenne.ruinCount === 9 && m.moyenne.extraCurrents === 8, 'carte moyenne : réglages d\'avant');
  check(m.petite.clusterRadius < m.moyenne.clusterRadius && m.grande.clusterRadius > m.moyenne.clusterRadius && m.petite.ruinCount < 9 && m.grande.ruinCount > 9, 'rayon et ruines suivent la taille');
  const r = RESOURCE_LEVELS.levels;
  check(RESOURCE_LEVELS.default === 'normales' && r.rares.deposits === 0.7 && r.normales.deposits === 1 && r.abondantes.deposits === 1.3 && r.normales.waterFuel === 1, 'ressources : × 0,7 / × 1 / × 1,3');
  check(CONFIG.starCount === undefined && CONFIG.clusterRadius === undefined, 'la taille de l\'amas n\'est plus dans CONFIG');
}

// Validation et contraintes de Redoutable.
{
  const def = D.gameSettings();
  check(def.difficulty === 'standard' && def.mapSize === 'moyenne' && def.resourceLevel === 'normales' && def.rivals === RIVALS.default, 'réglages par défaut : Standard, moyenne, normales, 4 adversaires');
  const bad = D.gameSettings({ difficulty: 'facile', mapSize: 'enorme', resourceLevel: 42, rivals: 12 });
  check(JSON.stringify(bad) === JSON.stringify(def), 'valeurs inconnues refusées (valeurs par défaut)');
  const proto = D.gameSettings({ difficulty: 'constructor', mapSize: '__proto__', resourceLevel: 'toString' });
  check(proto.difficulty === 'standard' && proto.mapSize === 'moyenne' && proto.resourceLevel === 'normales', 'noms hérités (constructor, __proto__) refusés');
  const ok = D.gameSettings({ difficulty: 'ardu', mapSize: 'grande', resourceLevel: 'abondantes', rivals: 5 });
  check(ok.difficulty === 'ardu' && ok.mapSize === 'grande' && ok.resourceLevel === 'abondantes' && ok.rivals === 5, 'Ardu : réglages libres gardés');
  const red = D.gameSettings({ difficulty: 'redoutable', mapSize: 'grande', resourceLevel: 'abondantes', rivals: 3 });
  check(red.mapSize === 'petite' && red.rivals === 7 && red.resourceLevel === 'rares', 'Redoutable : petite carte, 7 adversaires, ressources rares imposés');
  check(red.rivals === RIVALS.max && D.validMapSize(red.mapSize) === red.mapSize && D.validResourceLevel(red.resourceLevel) === red.resourceLevel, 'les réglages imposés sont valides');
  check(Object.keys(D.imposedSettings('standard')).length === 0 && D.imposedSettings('redoutable').rivals === 7, 'seul Redoutable impose des réglages');
  const game = G.createGame(42, 'vaskhar', 4, { difficulty: 'redoutable', mapSize: 'grande', resourceLevel: 'abondantes' });
  check(game.difficulty === 'redoutable' && game.mapSize === 'petite' && game.resourceLevel === 'rares' && game.rivals === 7, 'createGame applique les contraintes de Redoutable');
  check(game.stars.length === 90 && game.empires.length === 7, 'partie Redoutable : 90 systèmes et 7 empires');
  const plain = G.createGame(42, 'vaskhar', 4);
  check(plain.difficulty === 'standard' && plain.mapSize === 'moyenne' && plain.resourceLevel === 'normales' && plain.clusterRadius === 100, 'createGame sans réglages : Standard, moyenne, normales');
}

// Sauvegarde.
{
  const game = G.createGame(7, 'synodes', 5, { difficulty: 'ardu', mapSize: 'grande', resourceLevel: 'abondantes' });
  const data = copy(serialize(game));
  check(data.difficulty === 'ardu' && data.mapSize === 'grande' && data.resourceLevel === 'abondantes', 'les réglages sont enregistrés');
  const back = restore(copy(data));
  check(back.difficulty === 'ardu' && back.mapSize === 'grande' && back.resourceLevel === 'abondantes' && back.rivals === 5, 'aller-retour des réglages');
  check(fingerprint(back) === fingerprint(game) && back.stars.length === 200, 'même amas après rechargement (grande carte)');

  const oldGame = G.createGame(42, 'vaskhar', 4);
  const old = copy(serialize(oldGame));
  delete old.difficulty;
  delete old.mapSize;
  delete old.resourceLevel;
  const loaded = restore(old);
  check(loaded.difficulty === 'standard' && loaded.mapSize === 'moyenne' && loaded.resourceLevel === 'normales', 'ancienne sauvegarde : Standard, moyenne, normales');
  check(fingerprint(loaded) === fingerprint(oldGame), 'ancienne sauvegarde : même amas qu\'avant');

  const odd = copy(serialize(oldGame));
  Object.assign(odd, { difficulty: 'impossible', mapSize: 'moyenne', resourceLevel: ['rares'] });
  const oddGame = restore(odd);
  check(oddGame.difficulty === 'standard' && oddGame.resourceLevel === 'normales', 'valeurs invalides refusées au chargement (Standard, normales)');

  // Une taille qui ne correspond pas à l'amas enregistré : la sauvegarde est refusée, sans plantage plus loin.
  const small = copy(serialize(G.createGame(42, 'vaskhar', 4, { mapSize: 'petite' })));
  small.mapSize = 'taille-inconnue';
  let refused = false;
  try {
    restore(small);
  } catch {
    refused = true;
  }
  check(refused, 'amas de taille différente de la sauvegarde : refusée');
  const red = restore(copy(serialize(G.createGame(42, 'vaskhar', 7, { difficulty: 'redoutable' }))));
  check(red.difficulty === 'redoutable' && red.mapSize === 'petite' && red.rivals === 7 && red.stars.length === 90, 'partie Redoutable rechargée');
}

// Étape 2 : génération. Carte moyenne et ressources normales = l'amas d'avant ces réglages (empreintes relevées avant le changement).
{
  const before = { '42-vaskhar-4': 'd5f9e34dbe2473c1', '7-sans-espece-4': 'd608263a19bd2ada', '123456-ashkari-7': 'ddb82f15c1d4543b' };
  for (const [key, print] of Object.entries(before)) {
    const [seed, species, rivals] = [Number(key.split('-')[0]), key.split('-').slice(1, -1).join('-'), Number(key.split('-').at(-1))];
    check(fingerprint(generateCluster(seed, species, rivals)) === print, `graine ${seed} : amas identique à avant (sans réglages)`);
    check(fingerprint(generateCluster(seed, species, rivals, { mapSize: 'moyenne', resourceLevel: 'normales' })) === print, `graine ${seed} : amas identique à avant (moyenne, normales)`);
  }
  check(fingerprint(G.createGame(42, 'vaskhar', 4, { difficulty: 'redoutable' })) !== fingerprint(G.createGame(42, 'vaskhar', 4)), 'autres réglages : autre amas');
  check(fingerprint(generateCluster(42, 'vaskhar', 4, { mapSize: 'petite' })) === fingerprint(generateCluster(42, 'vaskhar', 4, { mapSize: 'petite' })), 'même graine et mêmes réglages : même amas');

  for (const [size, def] of Object.entries(MAP_SIZES.sizes)) {
    const seeds = [1, 42, 777, 2024];
    const clusters = seeds.map((s) => generateCluster(s, 'vaskhar', 4, { mapSize: size }));
    check(clusters.every((c) => c.stars.length === def.starCount), `carte ${size} : ${def.starCount} systèmes`);
    check(clusters.every((c) => c.stars.filter((s) => s.hasRuins).length === def.ruinCount), `carte ${size} : ${def.ruinCount} ruines`);
    check(clusters.every((c) => c.stars.every((s) => Math.hypot(s.pos.x, s.pos.z) < def.clusterRadius * 1.6)), `carte ${size} : étoiles dans le rayon de l'amas`);
  }

  // Richesse moyenne par niveau de ressources (même graine : mêmes étoiles, seuls les gisements changent).
  const stats = (level) => {
    let dep = 0;
    let wf = 0;
    let n = 0;
    const velarine = [];
    const layout = [];
    for (const seed of [1, 42, 777, 2024, 31337]) {
      const c = generateCluster(seed, 'vaskhar', 4, { resourceLevel: level });
      layout.push(c.stars.map((s) => [s.pos, s.planets.length, s.hasRuins, s.rival]));
      for (const s of c.stars) for (const p of s.planets) {
        dep += p.deposits.minerais + p.deposits.energie + p.deposits.biomasse;
        wf += p.deposits.eau + p.deposits.deuterium;
        velarine.push(p.deposits.velarine);
        n++;
      }
    }
    return { dep: dep / n, wf: wf / n, velarine: JSON.stringify(velarine), layout: JSON.stringify(layout) };
  };
  const [rares, normales, abondantes] = ['rares', 'normales', 'abondantes'].map(stats);
  const f = (x) => x.toFixed(2);
  check(abondantes.dep > normales.dep && normales.dep > rares.dep, `gisements : rares ${f(rares.dep)} < normales ${f(normales.dep)} < abondantes ${f(abondantes.dep)}`);
  check(abondantes.wf > normales.wf && normales.wf > rares.wf, `eau et deutérium : rares ${f(rares.wf)} < normales ${f(normales.wf)} < abondantes ${f(abondantes.wf)}`);
  check(rares.velarine === normales.velarine && abondantes.velarine === normales.velarine, 'la Vélarine ne dépend pas des ressources');
  check(rares.layout === normales.layout && abondantes.layout === normales.layout, 'étoiles, planètes, ruines et rivaux ne dépendent pas des ressources');
}

// Petite carte et 7 rivaux : tous placés, assez loin les uns des autres, et ils s'étendent.
{
  for (const seed of [1, 2, 3, 42, 777, 2024, 31337, 99]) {
    const game = G.createGame(seed, 'vaskhar', 7, { difficulty: 'redoutable' });
    const homes = [game.stars[game.homeId], ...game.empires.map((e) => game.stars[e.colonies[0].starId])];
    let minDist = Infinity;
    for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) minDist = Math.min(minDist, starDistance(homes[i], homes[j]));
    const placed = game.empires.length === 7 && new Set(homes.map((s) => s.id)).size === 8 && homes.slice(1).every((s) => s.rival && s.planets.some((p) => isColonisable(p) && p.inhabitedBy === s.rival));
    const room = game.stars.filter((s) => s.planets.some(isColonisable) && starDistance(s, homes[0]) <= CONFIG.jumpRange && homes.every((o) => starDistance(s, o) >= starDistance(s, homes[0]))).length;
    for (let d = 0; d < 2000; d++) {
      game.time += 1;
      E.tickEmpires(game, 1);
    }
    const grown = game.empires.every((e) => e.colonies.length >= 5);
    check(placed && minDist >= 1.5 * CONFIG.jumpRange && room >= 5 && grown, `graine ${seed}, petite carte, 7 rivaux : placés (écart ${minDist.toFixed(0)} al), ${room} systèmes près du joueur, ${game.empires.map((e) => e.colonies.length).join('/')} colonies au jour 2 000`);
  }
}

// Étape 3 : leviers des rivaux selon le niveau.
const Dp = await imp('diplomacy.js');
const C = await imp('combat.js');
const LEVELS = ['decouverte', 'standard', 'ardu', 'redoutable'];
const hash = (x) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 16);
// Partie avec la colonie de l'Arche fondée ; level : niveau posé après la création (même amas pour tous).
function withColony(seed, level) {
  const game = G.createGame(seed, 'vaskhar', 4);
  if (level) game.difficulty = level;
  const arche = game.ships[0];
  const home = game.stars[arche.starId];
  home.level = 3;
  const index = home.planets.findIndex((p) => p.size && !p.inhabitedBy);
  const surface = G.getSurface(game, home.id, index);
  G.foundColony(game, arche, home.id, index, surface.tiles.findIndex((t) => t.terrain !== 'ocean' && !t.building && !['minerais', 'velarine'].includes(t.deposit?.resource)));
  for (const e of game.empires) e.met = true;
  return game;
}
// Empreintes d'avant l'étape 5 : on retire ce que la paix proposée (tous niveaux, étape 5) a ajouté, le bilan de
// guerre des empires et leurs offres de paix ; tout le reste doit rester identique en Standard.
const beforePeace = (empires) => empires.map(({ warLosses, nextPeaceOffer, ...e }) => e);
// Rivaux tenus hostiles : guerre, flottes, prix de la paix.
function hostileRun(seed, level) {
  const game = withColony(seed, level);
  const peace = [];
  for (let d = 0; d < 2500 && !game.ended; d++) {
    for (const e of game.empires) if (e.species === 'thrennes' || e.species === 'keltirr' || e.relation < 0) e.relation = -90;
    G.tick(game, 1);
    if (d % 500 === 0) peace.push(...game.empires.map((e) => Dp.peacePrice(e, 'minerais', game)));
  }
  return hash({ empires: beforePeace(game.empires), fleets: game.fleets, n: game.nextFleetId, c: game.colonies.length, t: game.time, peace });
}
// Joueur passif : expansion, stocks, notes, propositions.
function peacefulRun(seed, level) {
  const game = withColony(seed, level);
  for (let d = 0; d < 3000 && !game.ended; d++) G.tick(game, 1);
  return hash({ empires: beforePeace(game.empires), proposals: game.proposals.filter((p) => !p.peace), t: game.time });
}
{
  // Empreintes relevées avec le code d'avant l'étape 3.
  const before = { hostile: { 42: 'b4ccc7d238fec5f3', 7: '3162c0b6024669db' }, peaceful: { 42: '932f49a80242f972', 7: '454e4dc3bb196b22' } };
  for (const seed of [42, 7]) {
    check(hostileRun(seed) === before.hostile[seed] && hostileRun(seed, 'standard') === before.hostile[seed], `graine ${seed} : Standard identique à avant (rivaux hostiles, guerre et flottes)`);
    check(peacefulRun(seed) === before.peaceful[seed], `graine ${seed} : Standard identique à avant (expansion, stocks, notes sur 3 000 jours)`);
  }
  check(hostileRun(42, 'ardu') !== before.hostile[42] && peacefulRun(42, 'decouverte') !== before.peaceful[42], 'les autres niveaux changent bien la partie');
}
{
  const byLevel = (fn) => LEVELS.map(fn);
  const ordered = (xs) => xs.every((x, i) => i === 0 || x > xs[i - 1]);
  const show = (xs) => xs.map((x) => (Number.isInteger(x) ? x : x.toFixed(3))).join(' < ');

  // Expansion et puissance.
  const grow = byLevel((level) => {
    const game = G.createGame(42, 'vaskhar', 4);
    game.difficulty = level;
    for (let d = 1; d <= 2000; d++) {
      game.time = d;
      E.tickEmpires(game, 1);
    }
    return { colonies: game.empires.reduce((s, e) => s + e.colonies.length, 0), power: game.empires[0].power };
  });
  check(ordered(grow.map((g) => g.colonies)), `expansion : colonies au jour 2 000 ${show(grow.map((g) => g.colonies))}`);
  check(ordered(grow.map((g) => g.power)), `puissance au jour 2 000 ${show(grow.map((g) => g.power))}`);

  // Portée maximale.
  const reach = byLevel((level) => {
    const game = G.createGame(42, 'vaskhar', 4);
    game.difficulty = level;
    return E.rivalReach(game, { ...game.empires[0], power: 1000 });
  });
  check(ordered(reach) && reach[1] === 50, `portée maximale (al) ${show(reach)}`);

  // Délai de grâce et chance de guerre : rival tenu hostile, premier jour de guerre moyen sur plusieurs graines.
  const firstWar = (seed, level) => {
    const game = G.createGame(seed, 'vaskhar', 7);
    game.difficulty = level;
    const e = game.empires.find((x) => x.species === 'orrhaides') ?? game.empires[0];
    e.met = true;
    for (let d = 0; d < 6000; d++) {
      game.time += 1;
      e.relation = -90;
      if (Dp.tickDiplomacy(game, 1).some((x) => x.type === 'war' && x.empire === e)) return game.time;
    }
    return 6000;
  };
  const wars = byLevel((level) => [1, 42, 77, 1234, 5150].map((s) => firstWar(s, level)));
  check(LEVELS.every((l, i) => wars[i].every((d) => d >= DIFFICULTY.levels[l].graceDays)), 'jamais de guerre avant le délai de grâce du niveau');
  const lateness = wars.map((w, i) => w.reduce((a, b) => a + b, 0) / w.length - DIFFICULTY.levels[LEVELS[i]].graceDays);
  check(ordered(wars.map((w) => -w.reduce((a, b) => a + b, 0))), `guerre plus tôt aux niveaux élevés (jours moyens ${wars.map((w) => Math.round(w.reduce((a, b) => a + b, 0) / w.length)).join(' / ')})`);
  check(lateness[0] > lateness[3], `chance de guerre : attente après le délai de grâce ${Math.round(lateness[0])} j en Découverte, ${Math.round(lateness[3])} j en Redoutable`);

  // Agacement du voisinage : une colonie du joueur (puis dix) près d'un empire à sa note de départ.
  const annoyance = (level, n) => {
    const game = G.createGame(42, 'vaskhar', 4);
    game.difficulty = level;
    const e = game.empires[0];
    e.met = true;
    e.relation = Dp.startRelation(e.species);
    for (let i = 0; i < n; i++) game.colonies.push({ starId: e.colonies[0].starId, planetIndex: 0, name: 'test' });
    game.time = 1;
    Dp.tickDiplomacy(game, 1);
    return Dp.startRelation(e.species) - e.relation;
  };
  const one = byLevel((l) => annoyance(l, 1));
  const ten = byLevel((l) => annoyance(l, 10));
  check(ordered(one), `agacement par colonie proche (points par jour) ${show(one)}`);
  check(ordered(ten) && Math.abs(ten[1] - DIPLOMACY.proximityMax) < 1e-12, `agacement plafonné, plafond selon le niveau ${show(ten)}`);

  // Stocks des rivaux.
  const stock = byLevel((level) => {
    const game = G.createGame(42, 'vaskhar', 4);
    game.difficulty = level;
    const e = game.empires[0];
    e.stocks.minerais = 0;
    game.time = 1;
    Dp.tickDiplomacy(game, 1);
    return e.stocks.minerais;
  });
  check(ordered(stock), `stocks : minerais gagnés en un jour ${show(stock)}`);

  // Défense des colonies rivales : même dégâts, plus de résistance restante.
  const defense = byLevel((level) => {
    const game = G.createGame(42, 'vaskhar', 4);
    game.difficulty = level;
    const e = game.empires[0];
    e.power = 0;
    e.colonies[0].damage = 100;
    return C.rivalColonyHealth(game, e, e.colonies[0]);
  });
  check(ordered(defense), `défense des colonies rivales (résistance restante) ${show(defense)}`);

  // Flottes : taille, intervalle, nombre.
  const fleets = byLevel((level) => {
    const game = withColony(42, level);
    const e = game.empires[0];
    Object.assign(e, { war: true, power: 200, nextFleet: 0, nextSupply: 1e9 });
    e.stocks.alliages = 1e7;
    game.time = 1;
    C.tickCombat(game, 1);
    const first = game.fleets.find((f) => f.species === e.species);
    const every = e.nextFleet - game.time;
    for (let d = 0; d < 20; d++) {
      e.nextFleet = 0;
      game.time += 1;
      C.tickCombat(game, 1);
    }
    return { size: first?.ships.length ?? 0, every, count: game.fleets.filter((f) => f.species === e.species).length };
  });
  check(LEVELS.every((l, i) => fleets[i].size === DIFFICULTY.levels[l].fleetSizeMax), `taille des flottes ${fleets.map((x) => x.size).join(' / ')}`);
  check(LEVELS.every((l, i) => fleets[i].every === DIFFICULTY.levels[l].fleetEvery), `intervalle des flottes ${fleets.map((x) => x.every).join(' / ')} jours`);
  check(LEVELS.every((l, i) => fleets[i].count === DIFFICULTY.levels[l].maxFleets), `flottes en même temps ${fleets.map((x) => x.count).join(' / ')}`);

  // Exigence aux échanges et prix de la paix.
  const deals = byLevel((level) => {
    const game = G.createGame(42, 'vaskhar', 4);
    game.difficulty = level;
    const e = game.empires.find((x) => !DIPLOMACY.tradeFactor[x.species]);
    e.met = true;
    e.relation = 0; // neutre
    const margin = Dp.evaluateDeal(game, e, { give: { resources: { minerais: 10 } }, get: { resources: { biomasse: 5 } } }).margin;
    e.war = true;
    return { margin, peace: Dp.peacePrice(e, 'minerais', game) };
  });
  check(ordered(deals.map((d) => d.margin)), `exigence aux échanges (empire neutre) ${show(deals.map((d) => d.margin))}`);
  check(ordered(deals.map((d) => d.peace)), `prix de la paix (minerais) ${show(deals.map((d) => d.peace))}`);
  {
    const game = G.createGame(42, 'vaskhar', 4);
    const e = game.empires[0];
    check(Dp.peacePrice(e, 'minerais') === Dp.peacePrice(e, 'minerais', game), 'prix de la paix sans partie : celui de Standard');
  }
}
{
  // Ancienne sauvegarde (sans niveau) : elle continue exactement comme une partie Standard.
  const game = withColony(42);
  for (let d = 0; d < 800; d++) G.tick(game, 1);
  const old = copy(serialize(game));
  delete old.difficulty;
  const loaded = restore(old);
  const twin = restore(copy(serialize(game)));
  for (let d = 0; d < 1500; d++) {
    G.tick(loaded, 1);
    G.tick(twin, 1);
  }
  check(loaded.difficulty === 'standard' && hash(loaded.empires) === hash(twin.empires), 'ancienne sauvegarde : rivaux identiques à Standard 1 500 jours plus tard');
  const ardu = restore(copy(serialize(G.createGame(42, 'vaskhar', 4, { difficulty: 'ardu' }))));
  check(ardu.difficulty === 'ardu' && E.rivalReach(ardu, { power: 1000 }) === E.rivalReach({ difficulty: 'ardu' }, { power: 1000 }), 'partie Ardu rechargée : leviers d\'Ardu');
}

// Étape 4 : adresse, demande de nouvelle partie, bilan de fin, menu.
{
  const params = (q) => new URLSearchParams(q);
  const def = D.gameSettings();
  check(JSON.stringify(D.settingsFromParams(params(''))) === JSON.stringify(def), 'adresse sans réglages : valeurs par défaut');
  const read = D.settingsFromParams(params('?graine=42&niveau=ardu&carte=grande&ressources=abondantes&rivaux=6'));
  check(read.difficulty === 'ardu' && read.mapSize === 'grande' && read.resourceLevel === 'abondantes' && read.rivals === 6, '?niveau=ardu&carte=grande&ressources=abondantes&rivaux=6 lus');
  const odd = D.settingsFromParams(params('?niveau=facile&carte=__proto__&ressources=&rivaux=12'));
  check(JSON.stringify(odd) === JSON.stringify(def), 'adresse : valeurs inconnues remplacées par les valeurs par défaut');
  const red = D.settingsFromParams(params('?niveau=redoutable&carte=grande&ressources=abondantes&rivaux=3'));
  check(red.mapSize === 'petite' && red.rivals === 7 && red.resourceLevel === 'rares', '?niveau=redoutable : contraintes appliquées');
  const choice = { difficulty: 'decouverte', mapSize: 'petite', resourceLevel: 'rares', rivals: 3 };
  check(D.settingsQuery(choice) === 'niveau=decouverte&carte=petite&ressources=rares&rivaux=3', 'réglages écrits pour l\'adresse');
  check(JSON.stringify(D.settingsFromParams(params(D.settingsQuery(choice)))) === JSON.stringify(D.gameSettings(choice)), 'aller-retour par l\'adresse');

  // Demande de nouvelle partie par sessionStorage (simulé).
  const store = new Map();
  globalThis.sessionStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  globalThis.location = { pathname: '/', href: '' };
  const S = await imp('save.js');
  S.newGameAndRestart('vaskhar', D.gameSettings({ difficulty: 'ardu', mapSize: 'grande', resourceLevel: 'rares', rivals: 5 }));
  check(S.takeNewGameRequest() === 'vaskhar', 'demande de nouvelle partie : espèce transmise');
  const asked = S.takeSettingsRequest();
  check(asked?.difficulty === 'ardu' && asked.mapSize === 'grande' && asked.resourceLevel === 'rares' && asked.rivals === 5, 'demande de nouvelle partie : réglages transmis');
  check(S.takeSettingsRequest() === null, 'la demande ne sert qu\'une fois');
  S.newGameAndRestart();
  check(S.takeNewGameRequest() === '' && S.takeSettingsRequest() === null, 'nouvelle partie sans réglages (écran de choix)');
  store.set('amas-inexplore:reglages', '{illisible');
  check(S.takeSettingsRequest() === null, 'demande illisible ignorée');
  const game = G.createGame(42, 'vaskhar', asked.rivals, asked);
  check(game.difficulty === 'ardu' && game.mapSize === 'grande' && game.resourceLevel === 'rares' && game.rivals === 5, 'createGame suit la demande');
  delete globalThis.sessionStorage;
  delete globalThis.location;

  // Bilan de fin et menu.
  const { endSummary } = await imp('endView.js');
  const line = endSummary(game).find(([k]) => k === 'Réglages');
  check(line?.[1] === 'Ardu · carte grande · ressources rares · 5 adversaires', `bilan : « ${line?.[1]} »`);
  const redGame = G.createGame(42, 'vaskhar', 4, { difficulty: 'redoutable' });
  check(endSummary(redGame)[0][1] === 'Redoutable · carte petite · ressources rares · 7 adversaires', 'bilan Redoutable : réglages imposés');
  const old = copy(serialize(G.createGame(42, 'vaskhar', 4)));
  delete old.difficulty;
  delete old.mapSize;
  delete old.resourceLevel;
  check(endSummary(restore(old))[0][1] === 'Standard · carte moyenne · ressources normales · 4 adversaires', 'bilan d\'une ancienne sauvegarde : Standard');
  check(S.summary({ ...old, savedAt: 0 }).difficulty === 'Standard' && S.summary({ ...serialize(game), savedAt: 0 }).difficulty === 'Ardu', 'menu : niveau dans la description de la sauvegarde');
  check(Object.values(DIFFICULTY.levels).every((l) => typeof l.hint === 'string' && l.hint.length > 10), 'chaque niveau a sa phrase d\'explication');
}

// Étape 5 : rivaux plus malins (points 1 à 3 en Ardu, tous en Redoutable, aucun en Standard) et paix proposée (tous niveaux).
{
  const addWarship = (game, kind, starId) => {
    const ship = { id: game.nextShipId++, kind, name: `${kind} ${game.nextShipId}`, starId, state: 'idle', toId: null, fromId: null, distance: 0, speed: 0, progress: 0, daysLeft: 0, age: 0, worn: false, shipSeed: 1, accent: '#fff', registry: 'T' };
    game.ships.push(ship);
    return ship;
  };
  // Partie en guerre contre le premier empire, sans colonie de l'Arche : colonies du joueur posées à la main.
  // Deux systèmes près de l'empire : a (le plus proche), b (plus loin, dans la marge de choix des cibles).
  const war = (level) => {
    const game = G.createGame(42, 'vaskhar', 4);
    game.difficulty = level;
    const e = game.empires[0];
    e.met = true;
    G.declareWarOn(game, e);
    Object.assign(e, { power: 0, nextFleet: 1e9, nextSupply: 1e9 });
    const home = game.stars[e.homeId];
    const free = game.stars
      .filter((s) => s.id !== home.id && s.id !== game.homeId && !game.empires.some((x) => x.colonies.some((c) => c.starId === s.id)) && s.planets.some((p) => p.size && !p.inhabitedBy))
      .sort((x, y) => starDistance(home, x) - starDistance(home, y));
    const a = free[0];
    const b = free.find((s) => starDistance(home, s) > starDistance(home, a) + 5 && starDistance(home, s) < starDistance(home, a) + COMBAT.smart.targetSlack);
    const colonyAt = (star, defense, population) => {
      const colony = { starId: star.id, planetIndex: star.planets.findIndex((p) => p.size && !p.inhabitedBy), name: star.name, population, habitat: 1, growth: 0, construction: null, shipyard: null, famine: false, orbital: { dock: false, defense, ecope: false }, thirst: false, damage: 0 };
      game.colonies.push(colony);
      return colony;
    };
    game.colonies = [];
    game.time = 1000;
    return { game, e, home, a, b, colonyAt };
  };
  const fleetOf = (game, e, kind, n, starId, extra = {}) => {
    const fleet = { id: game.nextFleetId++, species: e.species, ships: Array.from({ length: n }, () => ({ kind, damage: 0 })), starId, fromId: null, toId: null, distance: 0, progress: 0, state: 'idle', ...extra };
    game.fleets.push(fleet);
    return fleet;
  };
  const day = (game) => {
    game.time += 1;
    return C.tickCombat(game, 1);
  };

  // 1. Cible choisie : une colonie proche bien défendue, une autre plus loin sans défense et plus peuplée.
  const target = (level) => {
    const { game, e, home, a, b, colonyAt } = war(level);
    colonyAt(a, 2, 1);
    colonyAt(b, 0, 5);
    const fleet = fleetOf(game, e, 'croiseur', 6, home.id);
    day(game);
    return { to: fleet.toId, a: a.id, b: b.id };
  };
  const std = target('standard');
  check(std.to === std.a, 'Standard : la flotte vise la colonie la plus proche');
  check(target('decouverte').to === std.a, 'Découverte : la flotte vise la colonie la plus proche');
  const ardu = target('ardu');
  check(ardu.to === ardu.b, 'Ardu : la flotte vise la colonie sans défense et plus peuplée, même plus loin');
  check(target('redoutable').to === ardu.b, 'Redoutable : idem');

  // 2. Flottes groupées : la première attend la seconde, puis elles partent ensemble vers la même cible.
  const group = (level) => {
    const { game, e, a, colonyAt } = war(level);
    colonyAt(a, 0, 1);
    e.stocks.alliages = 1e6;
    e.nextFleet = 0;
    day(game);
    const first = game.fleets.find((f) => f.species === e.species);
    const firstState = first.state;
    e.nextFleet = 0;
    day(game);
    const both = game.fleets.filter((f) => f.species === e.species);
    return { firstState, both };
  };
  const gStd = group('standard');
  check(gStd.firstState === 'travel', 'Standard : chaque flotte part dès qu\'elle est construite');
  const gArdu = group('ardu');
  check(gArdu.firstState === 'idle' && gArdu.both.length === 2, 'Ardu : la première flotte attend la seconde');
  check(gArdu.both.every((f) => f.state === 'travel' && f.toId === gArdu.both[0].toId && f.progress === gArdu.both[0].progress && f.fromId === gArdu.both[0].fromId), 'Ardu : les deux flottes partent ensemble, même route, même jour');
  {
    // Une flotte seule part quand même après groupWaitDays.
    const { game, e, a, colonyAt } = war('ardu');
    colonyAt(a, 0, 1);
    e.stocks.alliages = 1e6;
    e.nextFleet = 0;
    day(game);
    const fleet = game.fleets.find((f) => f.species === e.species);
    e.nextFleet = 1e9; // pas de seconde flotte
    for (let d = 1; d < COMBAT.smart.groupWaitDays; d++) day(game);
    const waited = fleet.state;
    day(game);
    check(waited === 'idle' && fleet.state === 'travel', `Ardu : une flotte seule part après ${COMBAT.smart.groupWaitDays} jours d'attente`);
  }

  // 3. Retraite : une petite flotte face à une colonie bien défendue n'attaque pas ; au siège, elle se replie.
  const retreat = (level) => {
    const { game, e, home, a, colonyAt } = war(level);
    colonyAt(a, 5, 1);
    const waiting = fleetOf(game, e, 'corvette', 2, home.id);
    const besieging = fleetOf(game, e, 'corvette', 2, a.id);
    const events = day(game);
    return { waiting, besieging, events, home, a };
  };
  const rStd = retreat('standard');
  check(rStd.waiting.state === 'travel' && rStd.waiting.toId === rStd.a.id, 'Standard : une flotte faible attaque quand même');
  check(rStd.besieging.state === 'idle' && rStd.besieging.starId === rStd.a.id, 'Standard : une flotte faible reste au siège');
  const rArdu = retreat('ardu');
  check(rArdu.waiting.state === 'idle' && rArdu.waiting.hold === true, 'Ardu : une flotte nettement plus faible n\'attaque pas, elle attend des renforts');
  check(rArdu.besieging.state === 'travel' && rArdu.besieging.toId === rArdu.home.id, 'Ardu : au siège, une flotte nettement plus faible rentre');
  check(rArdu.events.some((x) => x.type === 'fleet-retreat'), 'Ardu : la retraite est annoncée');
  {
    // Avec des renforts, la flotte n'est plus nettement plus faible : elle attaque.
    const { game, e, home, a, colonyAt } = war('ardu');
    colonyAt(a, 5, 1);
    const one = fleetOf(game, e, 'croiseur', 3, home.id, { hold: true, heldSince: 1000 });
    const two = fleetOf(game, e, 'croiseur', 3, home.id, { hold: true, heldSince: 1000 });
    day(game);
    check(one.state === 'travel' && two.state === 'travel' && one.toId === a.id, 'Ardu : réunies, les flottes attaquent la colonie défendue');
  }

  // 4. Guerre opportuniste : un rival méfiant déclare la guerre si le joueur a peu de vaisseaux de guerre ou est déjà en guerre.
  const opportunist = (level, warships, otherWar) => {
    const game = G.createGame(42, 'vaskhar', 4);
    game.difficulty = level;
    const e = game.empires[0];
    e.met = true;
    for (let i = 0; i < warships; i++) addWarship(game, 'fregate', game.homeId);
    if (otherWar) Object.assign(game.empires[1], { war: true });
    game.time = DIFFICULTY.levels[level].graceDays;
    for (let d = 0; d < 6000; d++) {
      game.time += 1;
      e.relation = -40; // méfiant
      if (Dp.tickDiplomacy(game, 1).some((x) => x.type === 'war' && x.empire === e)) return true;
    }
    return false;
  };
  check(Dp.attitudeOf(-40).key === 'mefiant', 'note -40 : méfiant');
  check(!opportunist('standard', 0, false) && !opportunist('ardu', 0, false), 'Standard et Ardu : un rival méfiant ne déclare jamais la guerre');
  check(opportunist('redoutable', 0, false), 'Redoutable : un rival méfiant attaque un joueur sans vaisseau de guerre');
  check(!opportunist('redoutable', DIPLOMACY.opportunism.fewWarships + 1, false), `Redoutable : pas de guerre opportuniste contre ${DIPLOMACY.opportunism.fewWarships + 1} vaisseaux de guerre`);
  check(opportunist('redoutable', DIPLOMACY.opportunism.fewWarships + 1, true), 'Redoutable : guerre opportuniste si le joueur est déjà en guerre contre un autre');

  // 5. Défense du monde natal : le joueur l'assiège, les flottes y retournent.
  const homeDefense = (level) => {
    const { game, e, home, a, colonyAt } = war(level);
    colonyAt(a, 0, 1);
    const fleet = fleetOf(game, e, 'croiseur', 4, a.id);
    addWarship(game, 'cuirasse', home.id);
    const events = day(game);
    return { fleet, events, home };
  };
  const hArdu = homeDefense('ardu');
  check(hArdu.fleet.state === 'idle', 'Ardu : la flotte continue son siège quand le monde natal est attaqué');
  const hStd = homeDefense('standard');
  check(hStd.fleet.state === 'idle', 'Standard : idem');
  const hRed = homeDefense('redoutable');
  check(hRed.fleet.state === 'travel' && hRed.fleet.toId === hRed.home.id, 'Redoutable : la flotte rentre défendre le monde natal');
  check(hRed.events.some((x) => x.type === 'fleet-recall'), 'Redoutable : le rappel est annoncé');

  // Paix proposée par un rival qui perd la guerre (tous niveaux).
  const losing = (level = 'standard') => {
    const game = G.createGame(42, 'vaskhar', 4);
    game.difficulty = level;
    const e = game.empires[0];
    e.met = true;
    game.time = 1000;
    G.declareWarOn(game, e);
    return { game, e };
  };
  const P = DIPLOMACY.peaceOffer;
  const offerDay = (game) => {
    game.time += 1;
    return Dp.tickDiplomacy(game, 1);
  };
  for (const level of LEVELS) {
    const { game, e } = losing(level);
    e.warLosses = { fleets: P.threshold, colonies: 0, taken: 0 };
    let offered = null;
    for (let d = 0; d < P.minDays + 5 && !offered; d++) offered = offerDay(game).find((x) => x.type === 'peace-offer');
    check(offered && game.time - e.warSince >= P.minDays && Dp.pendingProposal(game, e)?.peace, `${level} : ${P.threshold} flottes perdues, l'empire propose la paix après ${P.minDays} jours de guerre`);
  }
  {
    const { game, e } = losing();
    e.warLosses = { fleets: P.threshold - 1, colonies: 0, taken: 0 };
    for (let d = 0; d < P.minDays + 50; d++) offerDay(game);
    check(!game.proposals.length, 'pas assez de pertes : pas d\'offre de paix');
    e.warLosses = { fleets: 2, colonies: 1, taken: 1 };
    offerDay(game);
    check(!game.proposals.length, 'une colonie prise au joueur compense une colonie perdue');
    e.warLosses = { fleets: 1, colonies: 1, taken: 0 };
    offerDay(game);
    check(Dp.pendingProposal(game, e)?.peace, 'une colonie et une flotte perdues : offre de paix');
  }
  {
    const { game, e } = losing();
    for (let d = 0; d < P.daysPerPoint * P.threshold - 1; d++) offerDay(game);
    check(!game.proposals.length, 'une longue guerre sans perte : pas d\'offre avant le seuil de durée');
    offerDay(game);
    check(Dp.pendingProposal(game, e)?.peace, `une guerre de ${P.daysPerPoint * P.threshold} jours suffit à proposer la paix`);
  }
  {
    // Acceptée : la guerre finit, trêve, flottes rentrées, annonce au journal avec la réplique de l'espèce.
    const { game, e } = losing();
    e.warLosses = { fleets: P.threshold, colonies: 0, taken: 0 };
    game.time += P.minDays;
    const events = offerDay(game);
    check(events.some((x) => x.type === 'peace-offer'), 'offre de paix émise');
    game.fleets.push({ id: game.nextFleetId++, species: e.species, ships: [{ kind: 'corvette', damage: 0 }], starId: e.homeId, fromId: null, toId: null, distance: 0, progress: 0, state: 'idle' });
    check(G.acceptPeace(game, e) && !e.war && !game.proposals.length, 'acceptée : la guerre finit, l\'offre disparaît');
    check(e.truceUntil >= game.time + DIPLOMACY.truceDays - 1e-9 && !game.fleets.some((f) => f.species === e.species), 'acceptée : trêve, flottes rentrées');
    const { line } = await imp('dialogues.js');
    check(game.log.some((l) => l.text.includes('Vous acceptez la paix') && l.text.includes(line(e.species, 'paix'))), 'acceptée : annoncée au journal');
    check(!G.acceptPeace(game, e), 'on n\'accepte pas deux fois');
  }
  {
    // Annoncée au journal par game.js (le conseiller la lit), avec la réplique de l'espèce.
    const { game, e } = losing();
    e.warLosses = { fleets: P.threshold, colonies: 0, taken: 0 };
    game.time += P.minDays;
    G.tick(game, 1);
    const { line } = await imp('dialogues.js');
    check(game.log.some((l) => l.text.includes('vous proposent la paix') && l.text.includes(line(e.species, 'offrePaix')) && line(e.species, 'offrePaix').length > 10), 'offre de paix annoncée au journal, avec la réplique de l\'espèce');
    // Refusée : la guerre continue, pas de nouvelle offre avant delay jours.
    const refused = G.refuseProposal(game, e);
    check(refused?.peace && e.war && !game.proposals.length && e.nextPeaceOffer === game.time + P.delay, 'refusée : la guerre continue');
    check(game.log.some((l) => l.text.includes('Vous refusez la paix')), 'refus noté au journal');
    for (let d = 0; d < P.delay - 1; d++) offerDay(game);
    check(!game.proposals.length, `refusée : pas de nouvelle offre pendant ${P.delay} jours`);
    offerDay(game);
    check(Dp.pendingProposal(game, e)?.peace, 'puis l\'empire la propose de nouveau');
  }
  {
    // Expirée : retirée après days jours, annoncée, et pas d'autre offre avant delay jours.
    const { game, e } = losing();
    e.warLosses = { fleets: P.threshold, colonies: 0, taken: 0 };
    game.time += P.minDays;
    offerDay(game);
    let expired = null;
    for (let d = 0; d < P.days + 1 && !expired; d++) expired = offerDay(game).find((x) => x.type === 'expired');
    check(expired?.peace && !game.proposals.length && e.war, `expirée après ${P.days} jours, la guerre continue`);
    check(e.nextPeaceOffer > game.time, 'expirée : nouvelle offre plus tard');
    check(!G.acceptPeace(game, e), 'une offre expirée ne s\'accepte plus');
  }
  {
    // Pas en paix : jamais d'offre de paix hors guerre ; une offre en attente disparaît si la paix se fait autrement.
    const { game, e } = losing();
    e.warLosses = { fleets: 10, colonies: 0, taken: 0 };
    e.war = false;
    for (let d = 0; d < P.minDays + 10; d++) offerDay(game);
    check(!game.proposals.some((p) => p.peace), 'hors guerre : jamais d\'offre de paix');
    e.war = true;
    offerDay(game);
    check(Dp.pendingProposal(game, e)?.peace, 'offre de paix en attente');
    game.resources.minerais = 1e6;
    const price = Dp.peacePrice(e, 'minerais', game);
    check(G.signDeal(game, e, { give: { resources: { minerais: price } }, get: { resources: {}, peace: true } }).ok && !game.proposals.length, 'paix achetée autrement : l\'offre disparaît');
    check(!G.acceptPeace(game, e), 'pas de paix offerte quand on n\'est plus en guerre');
  }
  {
    // Les pertes sont comptées par le combat : flotte anéantie.
    const { game, e, a, colonyAt } = war('standard');
    colonyAt(a, 10, 1);
    fleetOf(game, e, 'corvette', 1, a.id);
    for (let d = 0; d < 30 && game.fleets.length; d++) day(game);
    check(e.warLosses.fleets === 1, 'flotte anéantie comptée dans le bilan de guerre');
  }
  {
    // Sauvegarde : bilan et date de la prochaine offre gardés ; anciennes sauvegardes sans ces champs : valeurs par défaut.
    const { game, e } = losing();
    e.warLosses = { fleets: 2, colonies: 1, taken: 0 };
    e.nextPeaceOffer = 1234;
    game.proposals.push({ species: e.species, offer: { give: { resources: {}, techs: [], map: false }, get: { resources: {}, techs: [], map: false, treaties: [], peace: true } }, expires: 5000, peace: true });
    const back = restore(copy(serialize(game)));
    const be = back.empires[0];
    check(be.warLosses.fleets === 2 && be.warLosses.colonies === 1 && be.nextPeaceOffer === 1234 && Dp.pendingProposal(back, be)?.peace, 'sauvegarde : bilan, délai et offre de paix gardés');
    const old = copy(serialize(game));
    for (const x of old.empires) {
      delete x.warLosses;
      delete x.nextPeaceOffer;
    }
    const oldBack = restore(old);
    check(oldBack.empires.every((x) => JSON.stringify(x.warLosses) === JSON.stringify(Dp.noLosses()) && x.nextPeaceOffer === 0), 'ancienne sauvegarde : bilan à zéro, pas de délai');
  }
}

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
