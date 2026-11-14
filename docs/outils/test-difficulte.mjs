// Tests des réglages de la partie : niveau, taille de carte, ressources (docs/plan-difficulte.md, étapes 1 et 2).
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

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
