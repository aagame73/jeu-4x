// Tests du tutoriel (src/tutorial.js) : une partie jouée pas à pas, de l'analyse à l'envoi d'une sonde,
// avec les vraies règles (analyse, fondation, chantiers, recherche, chantier spatial, envoi).
// Usage : node docs/outils/test-tutoriel.mjs .
import { pathToFileURL } from 'node:url';
const root = process.argv[2];
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const E = await imp('economy.js');
const T = await imp('tutorial.js');
const D = await imp('dialogues.js');
const { restore, serialize } = await imp('save.js');
const { SPECIES } = await imp('config.js');

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`);
  if (!ok) fails++;
};

// Textes : un par objectif (et la fin) pour chaque profil jouable, plus le profil neutre.
const keys = [...T.TUTORIAL_STEPS.map((s) => s.key), 'fin'];
const profiles = [...Object.keys(SPECIES).filter((k) => !SPECIES[k].hidden || k === 'sans-espece')];
check(profiles.every((p) => keys.every((k) => D.TUTORIAL[p]?.[k])), `répliques complètes : ${profiles.length} profils × ${keys.length}`);

// Joue jusqu'à ce que `cond` soit vraie (le tutoriel met en pause : on relance à chaque fois).
function runUntil(game, cond, maxDays = 400) {
  for (let d = 0; d < maxDays * 4 && !cond(); d++) {
    game.paused = false;
    G.tick(game, 0.25);
    T.updateTutorial(game);
  }
  return cond();
}

const game = G.createGame(7, 'ashkari');
game.resources.minerais = 5000;
game.resources.alliages = 5000;
T.initTutorial(game);
T.announceStep(game);
const step = () => T.currentStep(game)?.key ?? 'fini';
check(step() === 'analyser' && game.log.at(-1).kind === 'tuto', 'objectif 1 annoncé par le conseiller');

const arche = game.ships[0];
const home = game.stars[arche.starId];
G.startAnalysis(game, arche);
T.updateTutorial(game);
check(step() === 'temps' && game.paused, 'analyse lancée → objectif « laisser passer le temps », jeu en pause');
check(game.log.at(-1).text.startsWith(D.TUTORIAL.ashkari.temps), 'réplique dans la voix de l\'espèce (Ashkari)');

check(runUntil(game, () => step() === 'colonie'), 'analyse terminée → objectif « fonder la colonie »');

const index = home.planets.findIndex((p) => p.size && !p.inhabitedBy);
const surface = G.getSurface(game, home.id, index);
const tileIndex = surface.tiles.findIndex((t) => ['plaine', 'desert'].includes(t.terrain) && !t.deposit);
G.foundColony(game, arche, home.id, index, tileIndex);
T.updateTutorial(game);
check(step() === 'laboratoire', 'colonie fondée → objectif « laboratoire »');

const colony = game.colonies[0];
colony.population = 20;
const free = (terrains) => surface.tiles.find((t) => terrains.includes(t.terrain) && !t.building && !E.buildProblem(t, 'laboratoire', surface, true));
const labTile = free(['plaine', 'desert', 'foret']);
check(E.startConstruction(game, colony, surface, labTile, 'laboratoire') !== false, 'laboratoire mis en chantier');
T.updateTutorial(game);
check(step() === 'metallurgie', 'laboratoire → objectif « Métallurgie »');

check(runUntil(game, () => labTile.building.done), 'laboratoire terminé');
G.startResearch(game, 'metallurgie');
T.updateTutorial(game);
check(step() === 'orbitale', 'Métallurgie lancée → objectif « Mécanique orbitale »');
runUntil(game, () => game.research.done.includes('metallurgie'));
G.startResearch(game, 'mecanique-orbitale');
check(runUntil(game, () => step() === 'spatioport'), 'Mécanique orbitale acquise → objectif « spatioport »');

const portTile = surface.tiles.find((t) => ['plaine', 'desert'].includes(t.terrain) && !t.building && !E.buildProblem(t, 'spatioport', surface));
check(!!portTile && E.startConstruction(game, colony, surface, portTile, 'spatioport') !== false, 'spatioport mis en chantier');
T.updateTutorial(game);
check(step() === 'saut', 'spatioport → objectif « Moteurs de saut »');
G.startResearch(game, 'moteurs-saut');
check(runUntil(game, () => step() === 'sonde'), 'Moteurs de saut acquis et spatioport terminé → objectif « sonde »');

// Sauvegarde : le tutoriel reprend où il en était.
const copy = restore(JSON.parse(JSON.stringify(serialize(game))));
check(copy.tutorial?.on && copy.tutorial.step === game.tutorial.step, 'tutoriel enregistré avec la partie');

check(G.startShipyard(game, colony, 'sonde') !== false, 'sonde commandée au chantier spatial');
check(runUntil(game, () => step() === 'envoyer'), 'sonde construite → objectif « envoyer »');
const probe = game.ships.find((s) => s.kind === 'sonde');
const target = G.reachableStars(game, probe)[0];
check(!!target && G.sendShip(game, probe, target), 'sonde envoyée');
T.updateTutorial(game);
check(!T.tutorialActive(game) && game.log.at(-1).text.startsWith(D.TUTORIAL.ashkari.fin), 'tutoriel terminé, message de fin');

// Passer, masquer, relancer.
const g2 = G.createGame(7, 'thrennes');
T.initTutorial(g2);
T.skipStep(g2);
check(T.currentStep(g2)?.key === 'temps', '« Passer » mène à l\'objectif suivant');
T.hideTutorial(g2);
check(!T.tutorialActive(g2) && !T.updateTutorial(g2), '« Masquer » arrête le tutoriel');
T.restartTutorial(g2);
check(T.currentStep(g2)?.key === 'analyser', 'relance : reprend au premier objectif non atteint');
const g3 = G.createGame(7, 'thrennes');
T.initTutorial(g3, false);
check(!T.tutorialActive(g3), 'tutoriel désactivé si on le décoche');

console.log(fails ? `\n${fails} échec(s).` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
