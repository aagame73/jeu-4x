// Tests de l'étape 3 : bonus sur les bons axes, planètes hostiles, profil neutre inchangé.
import { pathToFileURL } from 'node:url';
const root = process.argv[2];
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const E = await imp('economy.js');
const R = await imp('research.js');
const S = await imp('species.js');
const { restore, serialize } = await imp('save.js');

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`);
  if (!ok) fails++;
};
const near = (a, b) => Math.abs(a - b) < 1e-6;

// Une colonie identique (même graine, même planète, même bâtiments) pour deux espèces.
function colonyFor(species, seed = 42) {
  const game = G.createGame(seed, species);
  const arche = game.ships[0];
  const home = game.stars[arche.starId];
  home.level = 3;
  const index = home.planets.findIndex((p) => p.size && !p.inhabitedBy);
  const surface = G.getSurface(game, home.id, index);
  const tileIndex = surface.tiles.findIndex((t) => t.terrain !== 'ocean' && !t.building && !['minerais', 'velarine'].includes(t.deposit?.resource));
  G.foundColony(game, arche, home.id, index, tileIndex);
  const colony = game.colonies[0];
  colony.habitat = null;
  colony.population = 10;
  // Un laboratoire et un puits sur des cases de plaine (favorites pour aucune espèce).
  const lab = surface.tiles.find((t) => !t.building && t.terrain !== 'ocean' && !t.deposit);
  lab.terrain = 'plaine';
  lab.building = { type: 'laboratoire', done: true };
  const mine = surface.tiles.find((t) => !t.building && t.deposit?.resource === 'minerais');
  if (mine) mine.terrain = 'plaine';
  if (mine) mine.building = { type: 'puits', done: true };
  const sol = surface.tiles.find((t) => !t.building && t.terrain !== 'ocean' && !t.deposit);
  sol.terrain = 'plaine';
  sol.building = { type: 'solaire', done: true };
  return { game, colony, surface, lab, mine };
}

// (a) Écarts sur les bons axes, rien d'autre ne change.
const base = colonyFor('sans-espece');
const rb = E.colonyReport(base.colony, base.surface);
for (const [species, axis, factor] of [['synodes', 'recherche', 1.25], ['thrennes', 'recherche', 0.85]]) {
  const c = colonyFor(species);
  const r = E.colonyReport(c.colony, c.surface);
  check(near(r.perTile.get(c.lab.index).recherche, rb.perTile.get(base.lab.index).recherche * factor), `${species} : recherche du laboratoire × ${factor}`);
}
{
  const c = colonyFor('synodes');
  const r = E.colonyReport(c.colony, c.surface);
  if (c.mine) check(near(r.perTile.get(c.mine.index).minerais, rb.perTile.get(base.mine.index).minerais * 0.8), 'synodes : minerais du puits × 0,8');
  check(near(r.energyProd, rb.energyProd), 'synodes : énergie inchangée');
}
{
  const c = colonyFor('orrhaides');
  const r = E.colonyReport(c.colony, c.surface);
  check(near(r.energyProd, rb.energyProd * 1.25), 'orrhaïdes : énergie × 1,25');
  check(near(r.perTile.get(c.lab.index).recherche, rb.perTile.get(base.lab.index).recherche), 'orrhaïdes : recherche inchangée');
}

// Cumul espèce + terrain : additif et plafonné.
S.bindSpecies('vaskhar');
check(near(S.productionFactor('minerais', 'volcanique', null), 1.45), 'vaskhar, minerais sur volcanique : 1 + 0,20 + 0,25 = 1,45');
check(near(S.productionFactor('minerais', 'volcanique', 'hostile'), 1.3), 'vaskhar, minerais sur volcanique, colonie hostile : 1,45 − 0,15 = 1,30');
S.bindSpecies('synodes');
check(near(S.productionFactor('minerais', 'toxique', null), 1.05), 'synodes, minerais sur toxique favori : 1 − 0,20 + 0,25 = 1,05');
check(S.productionFactor('recherche', 'foret', null) <= 1.5, 'plafond 1,5 respecté');

// Vaisseaux, chantier, recherche des Veilleurs.
{
  const kt = G.createGame(42, 'keltirr');
  const probe = { kind: 'sonde', age: 0 };
  const sKT = G.shipStats(kt, probe);
  const neutral = G.createGame(42);
  const sN = G.shipStats(neutral, probe);
  check(near(sKT.speed, sN.speed * 1.25), 'kel-tirr : vitesse × 1,25');
  check(near(sKT.lifespan, sN.lifespan * 0.8), 'kel-tirr : durée de vie × 0,8');
  G.createGame(42, 'keltirr');
  check(G.shipyardDays('sonde') === Math.ceil(10 * 0.85), `kel-tirr : sonde en ${G.shipyardDays('sonde')} jours au lieu de 10`);
  G.createGame(42, 'ashkari');
  check(near(G.shipStats(G.createGame(42, 'ashkari'), probe).fuelFactor, sN.fuelFactor * 0.75), 'ashkari : carburant × 0,75');
  G.createGame(42, 'liseurs');
  check(R.techCost(R.TECHS.fouilles) === Math.ceil(R.TECHS.fouilles.cost * 0.7), `liseurs : Fouilles de base à ${R.techCost(R.TECHS.fouilles)} points`);
  check(R.techCost(R.TECHS.metallurgie) === R.TECHS.metallurgie.cost, 'liseurs : Métallurgie au prix normal');
}

// (c) Planètes hostiles.
{
  let found = null;
  for (let seed = 1; seed < 400 && !found; seed++) {
    const game = G.createGame(seed, 'vaskhar');
    const home = game.stars[game.ships[0].starId];
    const i = home.planets.findIndex((p) => p.size && !p.inhabitedBy && S.speciesHabitat(p) === 'hostile');
    if (i >= 0) found = { game, home, i };
  }
  check(!!found, 'une graine offre une planète hostile aux Vaskhar dans le système de départ');
  if (found) {
    const { game, home, i } = found;
    home.level = 3;
    const arche = game.ships[0];
    const colonist = { id: 99, kind: 'colonie', starId: home.id, state: 'idle', age: 0, name: 'Colonie test' };
    game.ships.push(colonist);
    check(/hostile/.test(G.foundingProblem(game, colonist, home.id, i) ?? ''), `vaisseau colonie refusé : « ${G.foundingProblem(game, colonist, home.id, i)} »`);
    check(G.foundingProblem(game, arche, home.id, i) === null, "l'Arche peut se poser sur la planète hostile");
    R.markTech(game.research, 'adaptation-xenobiologique');
    check(G.foundingProblem(game, colonist, home.id, i) === null, 'vaisseau colonie accepté avec Adaptation xénobiologique');
    const surface = G.getSurface(game, home.id, i);
    const t = surface.tiles.findIndex((x) => x.terrain !== 'ocean' && !x.building && !['minerais', 'velarine'].includes(x.deposit?.resource));
    G.foundColony(game, colonist, home.id, i, t);
    const colony = game.colonies.at(-1);
    check(colony.habitat === 'hostile' && colony.population === 1, `colonie hostile : 1 colon au lieu de 2 (${colony.population})`);
    check(near(S.growthFactor('hostile'), 0.8 * 0.5), 'croissance hostile : × 0,8 (espèce) × 0,5 (milieu)');
    check(near(S.growthFactor('hostile', true), 0.8 * 0.75), 'avec Biosphères adaptatives : × 0,75');
    check(near(S.growthFactor('favored'), 0.8 * 1.25), 'planète favorable : croissance × 1,25');
    // Sauvegarde : le milieu de la colonie est conservé.
    const back = restore(JSON.parse(JSON.stringify(serialize(game))));
    check(back.colonies.at(-1).habitat === 'hostile', 'le milieu de la colonie survit à la sauvegarde');
  }
}

// Colons adaptés : sur une planète favorable, biomasse et eau consommées moitié moins.
{
  const c = colonyFor('vaskhar');
  const neutral = E.colonyReport(c.colony, c.surface);
  c.colony.habitat = 'favored';
  const fav = E.colonyReport(c.colony, c.surface);
  const eat = (r) => r.perDay.biomasse - [...r.perTile.values()].reduce((a, o) => a + (o.biomasse ?? 0), 0);
  check(near(eat(fav), eat(neutral) * 0.5), `planète favorable : consommation de biomasse ${eat(neutral).toFixed(1)} → ${eat(fav).toFixed(1)} par jour`);
}

// Profil neutre : tous les facteurs valent 1.
S.bindSpecies('sans-espece');
check(['minerais', 'energie', 'recherche', 'biomasse'].every((r) => S.productionFactor(r, 'volcanique', undefined) === 1), 'profil neutre : production inchangée');
check(S.growthFactor(undefined) === 1, 'profil neutre : croissance inchangée');

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
