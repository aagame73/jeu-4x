// Tests du premier lot de jouabilité (docs/plan-jouabilite.md, B et G) : pause des bâtiments,
// arrêt automatique de la fonderie, alertes de pénurie, analyse proposée avec la sonde non sélectionnée.
// Usage : node docs/outils/test-jouabilite.mjs .
import { pathToFileURL } from 'node:url';
const root = process.argv[2];
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const E = await imp('economy.js');
const R = await imp('research.js');
const { RESEARCH } = await imp('config.js');
const { restore, serialize } = await imp('save.js');

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

// --- Recherche (lot 2) : plus de points mis de côté, file d'attente ---
const lab = free[1];
lab.building = { type: 'laboratoire', done: true };
// Production de base, avant énergie, main-d'œuvre et bonus d'espèce.
const labRate = E.BUILDINGS.laboratoire.output(lab, [], colony).recherche;
check(labRate === RESEARCH.lab, `laboratoire seul : ${labRate} recherche par jour`);
const r = game.research;
r.current = null;
r.queue = [];
r.done = r.done.filter((k) => !['metallurgie', 'cartographie'].includes(k));
R.bindResearch(r);
run(game, 10);
check(r.bank === undefined && !r.current && (r.carry ?? 0) === 0, 'sans projet : aucun point mis de côté');
check(G.queueResearch(game, 'metallurgie') && r.current === 'metallurgie', 'aucun projet : la recherche démarre tout de suite');
check(G.queueResearch(game, 'cartographie') && r.queue[0] === 'cartographie', 'projet en cours : la suivante rejoint la file');
check(!G.queueResearch(game, 'cartographie'), 'pas deux fois la même dans la file');
check(G.researchStatus(game, 'cartographie') === 'queued', 'statut « en file »');
r.progress = R.techCost(R.TECHS.metallurgie) - 0.01;
run(game, 1);
check(R.hasTech('metallurgie') && r.current === 'cartographie' && r.queue.length === 0, 'fin de recherche : la suivante de la file démarre seule');
r.progress = R.techCost(R.TECHS.cartographie) - 0.01;
game.log.length = 0;
run(game, 1);
check(!r.current && game.log.some((l) => l.text.startsWith('Aucune recherche en cours')), 'file vide : le conseiller demande de choisir');
const old = serialize(game);
old.research.bank = 3752;
const back = restore(JSON.parse(JSON.stringify(old)));
check(back.research.bank === undefined && Array.isArray(back.research.queue), 'ancienne sauvegarde : points mis de côté abandonnés');

// Rythme indicatif : jours pour finir chaque palier avec 1, 3 et 6 laboratoires (bonus non comptés).
const tierTotal = [1, 2, 3, 4].map((t) => Object.values(R.TECHS).filter((x) => x.tier === t).reduce((a, x) => a + R.techCost(x), 0));
for (const labs of [1, 3, 6]) {
  const rate = 1 + labs * RESEARCH.lab;
  console.log(`     ${labs} labo(s), ${rate} pts/j : paliers 1 à 4 en ${tierTotal.map((n) => Math.round(n / rate)).join(' / ')} jours`);
}

console.log(fails ? `\n${fails} échec(s)` : '\nTout est bon.');
process.exit(fails ? 1 : 0);
