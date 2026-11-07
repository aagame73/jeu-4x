// Tests de la diplomatie (docs/plan-diplomatie.md). Usage : node docs/outils/test-diplomatie.mjs .
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const D = await imp('diplomacy.js');
const S = await imp('species.js');
const { DIPLOMACY, SPECIES } = await imp('config.js');
const { restore, serialize } = await imp('save.js');

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`);
  if (!ok) fails++;
};
const copy = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// Attitudes et table des rivalités.
{
  const label = (r) => D.attitudeOf(r).label;
  check(label(100) === 'Allié' && label(60) === 'Allié' && label(59) === 'Amical' && label(20) === 'Amical', 'seuils Allié et Amical');
  check(label(19) === 'Neutre' && label(-19) === 'Neutre' && label(-20) === 'Méfiant' && label(-59) === 'Méfiant' && label(-60) === 'Hostile' && label(-100) === 'Hostile', 'seuils Neutre, Méfiant et Hostile');
  check(label(19.4) === 'Neutre' && label(19.6) === 'Amical' && label(-19.4) === 'Neutre' && label(-19.6) === 'Méfiant', 'une note non entière est arrondie');
  let holes = 0;
  for (let r = -100; r <= 100; r += 0.01) if (!D.attitudeOf(r)) holes++;
  check(holes === 0, 'aucune note sans attitude');
  check(S.playableSpecies().every((k) => typeof D.startRelation(k) === 'number'), 'chaque espèce a une note de départ');
  check(DIPLOMACY.rivalries.flat().every((k) => SPECIES[k] && !SPECIES[k].hidden), 'la table des rivalités ne cite que des espèces jouables');
  check(D.rivalsOf('vaskhar').sort().join() === 'liseurs,ondesiens', 'rivaux des Vaskhar : Ondésiens et Liseurs');
  check(D.rivalsOf('ondesiens').join() === 'vaskhar', 'une rivalité vaut dans les deux sens');
}

// Départ, bornes, rencontre.
{
  const game = G.createGame(42, 'synodes', 7);
  check(game.empires.every((e) => e.relation === D.startRelation(e.species)), 'note de départ selon le style');
  const e = game.empires[0];
  D.changeRelation(e, 500);
  check(e.relation === 100, 'note bornée à 100');
  D.changeRelation(e, -500);
  check(e.relation === -100, 'note bornée à -100');
  e.relation = D.startRelation(e.species);

  const before = e.relation;
  game.colonies.push({ starId: game.stars[e.homeId].id, planetIndex: 0 });
  D.reactToDig(game);
  for (let d = 0; d < 300; d++) {
    game.time += 1;
    D.tickRelations(game, 1);
  }
  check(e.relation === before, 'un empire non rencontré ne réagit pas');
  game.colonies.length = 0;
}

// Fouilles selon l'espèce.
{
  const game = G.createGame(42, 'vaskhar', 7);
  game.empires.forEach((e) => (e.met = true));
  const before = new Map(game.empires.map((e) => [e.species, e.relation]));
  D.reactToDig(game);
  const delta = (k) => game.empires.find((e) => e.species === k).relation - before.get(k);
  check(delta('ondesiens') < 0 && delta('orrhaides') < 0, 'fouille : Ondésiens et Orrhaïdes mécontents');
  check(delta('synodes') > 0 && delta('liseurs') > 0, 'fouille : Synodes et Liseurs intéressés');
}

// Évolution sur 2 000 jours, et indépendance à la vitesse du jeu.
function run(step, days = 2000, withColony = true) {
  const game = G.createGame(42, 'vaskhar', 4);
  const e = game.empires[0];
  e.met = true;
  e.relation = 80;
  if (withColony) game.colonies.push({ starId: e.homeId, planetIndex: 0 });
  for (let t = 0; t < days; t += step) {
    game.time += step;
    D.tickRelations(game, step);
  }
  return e;
}
{
  const calm = run(1, 2000, false);
  check(near(calm.relation, D.startRelation(calm.species), 0.5), `sans contact, retour à la note de départ (${calm.relation.toFixed(1)})`);
  const pressed = run(1);
  check(pressed.relation < D.startRelation(pressed.species) - 1, `colonie du joueur à proximité : note plus basse (${pressed.relation.toFixed(1)})`);
  check(near(run(1).relation, run(0.25).relation) && near(run(1).relation, run(4).relation), 'même résultat aux pas de 0,25, 1 et 4 jours');
}

// Sauvegardes.
{
  const game = G.createGame(42, 'vaskhar', 5);
  game.empires[0].relation = -37.5;
  const back = restore(copy(serialize(game)));
  check(back.empires[0].relation === -37.5, 'la note survit à la sauvegarde');
  const noField = copy(serialize(game));
  noField.empires.forEach((e) => delete e.relation);
  check(restore(noField).empires.every((e) => e.relation === D.startRelation(e.species)), 'sauvegarde sans note : note de départ');
  const noEmpires = copy(serialize(game));
  delete noEmpires.empires;
  check(restore(noEmpires).empires.every((e) => e.relation === D.startRelation(e.species)), 'sauvegarde sans empires : note de départ');
  for (const bad of ['x', null, NaN, 9999, -9999]) {
    const data = copy(serialize(game));
    data.empires[0].relation = bad;
    const r = restore(data).empires[0].relation;
    check(Number.isFinite(r) && r >= -100 && r <= 100, `note invalide (${String(bad)}) : remplacée (${r})`);
  }
}

// Le jeu complet appelle bien les relations.
{
  const game = G.createGame(42, 'vaskhar', 4);
  const e = game.empires[0];
  e.met = true;
  e.relation = 80;
  for (let d = 0; d < 50; d++) G.tick(game, 1);
  check(e.relation < 80, 'tick fait évoluer les notes');
}

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
