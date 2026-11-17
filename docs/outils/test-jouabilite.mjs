// Tests du premier lot de jouabilité (docs/plan-jouabilite.md, B et G) : pause des bâtiments,
// arrêt automatique de la fonderie, alertes de pénurie, analyse proposée avec la sonde non sélectionnée.
// Usage : node docs/outils/test-jouabilite.mjs .
import { pathToFileURL } from 'node:url';
const root = process.argv[2];
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const E = await imp('economy.js');

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`);
  if (!ok) fails++;
};
const run = (game, days) => {
  for (let d = 0; d < days * 4; d++) {
    game.paused = false;
    G.tick(game, 0.25);
  }
};

// Une colonie avec un puits et une fonderie, sur une partie neuve.
const game = G.createGame(42);
game.tutorial = { on: false, step: 0 };
const arche = game.ships[0];
const star = game.stars[arche.starId];
G.startAnalysis(game, arche);
run(game, 20);
const planetIndex = star.planets.findIndex((p, i) => G.foundingProblem(game, arche, star.id, i) == null);
const surface = G.getSurface(game, star.id, planetIndex >= 0 ? planetIndex : 0);
const centreTile = surface.tiles.find((t) => t.terrain !== 'ocean' && !t.deposit);
G.foundColony(game, arche, star.id, planetIndex >= 0 ? planetIndex : 0, centreTile.index);
const colony = game.colonies[0];
check(!!colony, 'colonie fondée');

const free = surface.tiles.filter((t) => !t.building && !t.deposit && ['desert', 'plaine', 'volcanique'].includes(t.terrain));
const foundry = free[0];
foundry.building = { type: 'fonderie', done: true };
const report = () => E.colonyReport(colony, surface);
const withFoundry = report().perDay.minerais;

// Pause manuelle
check(E.isPausable('fonderie') && !E.isPausable('foyer') && !E.isPausable('centre'), 'fonderie pausable ; foyer et centre non');
E.togglePause(game, colony, surface, foundry);
check(foundry.building.paused && report().perDay.minerais > withFoundry, 'fonderie en pause : elle ne consomme plus de minerais');
E.togglePause(game, colony, surface, foundry);
check(!foundry.building.paused && Math.abs(report().perDay.minerais - withFoundry) < 1e-9, 'reprise : consommation rétablie');

// Arrêt automatique sous FOUNDRY_STOP, reprise à FOUNDRY_RESUME
game.resources.minerais = E.FOUNDRY_STOP - 1;
game.log.length = 0;
run(game, 1);
check(foundry.building.starved, `fonderie arrêtée sous ${E.FOUNDRY_STOP} minerais`);
check(game.log.some((l) => l.text.includes("fonderie") && l.kind === 'alert'), 'le conseiller annonce l\'arrêt de la fonderie');
game.resources.minerais = E.FOUNDRY_RESUME + 5;
run(game, 1);
check(!foundry.building.starved, `fonderie repartie à ${E.FOUNDRY_RESUME} minerais`);

// Pénurie : alerte une seule fois, avec la cause
foundry.building.paused = false;
game.resources.biomasse = 0;
colony.population = 40; // les colons mangent plus que la production
game.log.length = 0;
run(game, 3);
const alerts = game.log.filter((l) => l.text.startsWith('Plus de biomasse'));
check(alerts.length === 1, `alerte « Plus de biomasse » donnée une fois (${alerts.length})`);

// Analyse : proposée avec une sonde présente même si un autre vaisseau est sélectionné
const target = game.stars.find((s) => s.level === 2) ?? game.stars.find((s) => s.id !== star.id);
target.level = 2;
const probe = { id: 900, kind: 'sonde', name: 'Sonde Test', state: 'idle', starId: target.id, age: 0 };
const corvette = { id: 901, kind: 'corvette', name: 'Corvette Test', state: 'idle', starId: target.id, age: 0 };
game.ships.push(probe, corvette);
game.selectedShipId = corvette.id;
check(!G.canAnalyse(corvette, target) && G.analyserAt(game, target) === probe, 'analyse trouvée avec la sonde, corvette sélectionnée');

console.log(fails ? `\n${fails} échec(s)` : '\nTout est bon.');
process.exit(fails ? 1 : 0);
