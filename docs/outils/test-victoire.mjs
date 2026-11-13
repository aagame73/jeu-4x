// Tests de la victoire et de la fin de partie (docs/plan-victoire.md). Usage : node docs/outils/test-victoire.mjs .
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const V = await imp('victory.js');
const { VICTORY } = await imp('config.js');
const { restore, serialize } = await imp('save.js');

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`);
  if (!ok) fails++;
};
const copy = (x) => JSON.parse(JSON.stringify(x));

// Une partie avec une vraie colonie fondée par l'Arche.
function setup(seed = 42) {
  const game = G.createGame(seed, 'vaskhar', 4);
  const arche = game.ships[0];
  const home = game.stars[arche.starId];
  home.level = 3;
  const index = home.planets.findIndex((p) => p.size && !p.inhabitedBy);
  const surface = G.getSurface(game, home.id, index);
  const tile = surface.tiles.findIndex((t) => t.terrain !== 'ocean' && !t.building && !['minerais', 'velarine'].includes(t.deposit?.resource));
  G.foundColony(game, arche, home.id, index, tile);
  return game;
}
// Colonie factice dans un système (pour compter les systèmes, sans passer par tick).
const fakeColony = (game, star) => game.colonies.push({ starId: star.id, planetIndex: star.planets.findIndex((p) => p.size), name: 'test' });

// Début de partie : rien n'est fini.
{
  const game = G.createGame(42, 'vaskhar', 4);
  check(V.endState(game) === null, 'début de partie (Arche, aucune colonie) : pas de fin');
  const p = V.progress(game);
  check(p.total > 0 && p.total <= game.stars.length && p.owned === 0 && p.share === 0, `systèmes colonisables comptés (${p.total} sur ${game.stars.length})`);
  check(V.colonizableStars(game).every((s) => s.planets.some((pl) => pl.size)), 'seuls les systèmes avec une planète colonisable comptent');
  check(p.rivalsLeft === 4 && p.rivalsTotal === 4 && p.goal === VICTORY.share, '4 rivaux en vie, objectif lu dans config.js');
}

// Colonie fondée : pas de fin, part d'un système.
{
  const game = setup();
  check(game.colonies.length === 1 && V.endState(game) === null, 'une colonie : partie en cours');
  check(V.progress(game).owned === 1, 'le système de la colonie compte pour le joueur');
  // Deux colonies dans le même système ne comptent qu'une fois.
  fakeColony(game, game.stars[game.colonies[0].starId]);
  check(V.progress(game).owned === 1, 'un système compte une seule fois');
}

// Victoire par expansion, juste à l'objectif.
{
  const game = setup();
  const stars = V.colonizableStars(game);
  const need = Math.ceil(stars.length * VICTORY.share);
  const mine = V.playerStars(game);
  for (const star of stars) {
    if (mine.size >= need - 1) break;
    if (!mine.has(star.id)) {
      fakeColony(game, star);
      mine.add(star.id);
    }
  }
  check(V.endState(game) === null, `juste sous l'objectif (${V.progress(game).owned}/${stars.length}) : pas de victoire`);
  // Un système partagé avec un rival compte pour le joueur.
  const shared = stars.find((s) => !mine.has(s.id) && s.rival);
  fakeColony(game, shared ?? stars.find((s) => !mine.has(s.id)));
  const end = V.checkEnd(game);
  check(end?.result === 'victoire' && end.reason === 'expansion', `à l'objectif : victoire par expansion${shared ? ' (système partagé avec un rival compté)' : ''}`);
  check(game.paused && game.ended === end && end.day >= 1, 'la fin est figée et la partie mise en pause');
  check(V.checkEnd(game) === null, 'la fin ne se déclare qu\'une fois');
}

// Victoire par élimination.
{
  const game = setup();
  for (const e of game.empires) e.colonies = [];
  const end = V.endState(game);
  check(end?.result === 'victoire' && end.reason === 'elimination', 'plus aucun empire en vie : victoire par élimination');
  game.empires[0].colonies.push({ starId: game.empires[0].homeId, planetIndex: 0, known: false });
  check(V.endState(game) === null, 'un empire encore en vie : pas de victoire');
}

// Défaite.
{
  const game = setup();
  game.colonies = [];
  game.ships.push({ id: 999, kind: 'colonie', name: 'Colonie 1', starId: 0, state: 'idle' });
  check(V.endState(game) === null, 'plus de colonie mais un vaisseau colonie : pas encore perdu');
  game.ships = game.ships.filter((s) => !G.SHIP_KINDS[s.kind].found);
  const end = V.endState(game);
  check(end?.result === 'defaite' && end.reason === 'tout-perdu', 'plus de colonie ni de vaisseau colonie : défaite');
}

// Par tick : la fin est annoncée une fois, puis le temps s'arrête.
{
  const game = setup();
  game.ships = game.ships.filter((s) => !G.SHIP_KINDS[s.kind].found);
  game.colonies = [];
  const before = game.log.length;
  G.tick(game, 1);
  check(game.ended?.result === 'defaite', 'tick : défaite détectée');
  check(game.log.length === before + 1 && game.log.at(-1).text.startsWith('Défaite'), 'tick : défaite annoncée au journal');
  const t = game.time;
  check(G.tick(game, 10) === false && game.time === t, 'partie finie : le temps ne s\'écoule plus');
}

// Une partie normale qui avance ne se termine pas toute seule.
{
  const game = setup(7);
  for (let d = 0; d < 300; d++) G.tick(game, 1);
  check(!game.ended, '300 jours de jeu normal : pas de fin');
}

// Étapes annoncées par le conseiller, une seule fois chacune.
{
  const game = setup();
  const stars = V.colonizableStars(game);
  const mine = V.playerStars(game);
  for (const star of stars) {
    if (mine.size >= Math.ceil(stars.length * 0.55)) break;
    if (!mine.has(star.id)) {
      fakeColony(game, star);
      mine.add(star.id);
    }
  }
  const first = V.newMilestones(game);
  check(first.length === 1 && first[0] === VICTORY.milestones[0], `étape de ${Math.round(VICTORY.milestones[0] * 100)} % franchie`);
  check(V.newMilestones(game).length === 0, "une étape ne s'annonce qu'une fois");
  const back = restore(copy(serialize(game)));
  check(back.milestones.length === 1 && back.milestones[0] === VICTORY.milestones[0], 'étapes gardées dans la sauvegarde');
  const data = copy(serialize(game));
  data.milestones = [0.33, 'x', VICTORY.milestones[1]];
  check(restore(data).milestones.length === 1 && restore(data).milestones[0] === VICTORY.milestones[1], 'étapes inconnues ignorées au chargement');
  delete data.milestones;
  check(restore(data).milestones.length === 0, 'ancienne sauvegarde : aucune étape');
}

// Bilan des combats.
{
  const game = setup();
  for (const type of ['fleet-lost', 'fleet-lost', 'colony-won', 'colony-lost', 'ship-lost', 'pillage']) V.recordEvent(game, { type });
  const r = game.record;
  check(r.fleetsDestroyed === 2 && r.coloniesTaken === 1 && r.coloniesLost === 1 && r.shipsLost === 1, 'bilan compté à partir des événements de combat');
  const back = restore(copy(serialize(game)));
  check(JSON.stringify(back.record) === JSON.stringify(r), 'bilan gardé dans la sauvegarde');
  const data = copy(serialize(game));
  data.record = { fleetsDestroyed: -3, coloniesTaken: 'x', shipsLost: 4 };
  const fixed = restore(data).record;
  check(fixed.fleetsDestroyed === 0 && fixed.coloniesTaken === 0 && fixed.coloniesLost === 0 && fixed.shipsLost === 4, 'valeurs du bilan invalides remises à zéro');
  delete data.record;
  check(Object.values(restore(data).record).every((n) => n === 0), 'ancienne sauvegarde : bilan vide');
}

// Sauvegardes.
{
  const game = setup();
  check(restore(copy(serialize(game))).ended === null, 'aller-retour d\'une partie en cours : pas finie');
  game.ended = { result: 'victoire', reason: 'expansion', day: 1234 };
  const back = restore(copy(serialize(game)));
  check(back.ended?.result === 'victoire' && back.ended.reason === 'expansion' && back.ended.day === 1234, 'aller-retour d\'une partie finie : la fin est gardée');
  const old = copy(serialize(game));
  delete old.ended;
  check(restore(old).ended === null, 'ancienne sauvegarde (sans fin) : partie en cours');
  for (const bad of [{ result: 'victoire', reason: 'tout-perdu' }, { result: 'nul' }, 'victoire', 42]) {
    const data = copy(serialize(game));
    data.ended = bad;
    check(restore(data).ended === null, `fin invalide ignorée (${JSON.stringify(bad)})`);
  }
}

// Animations et répliques de fin : une par espèce (8 jouables et le profil neutre), victoire et défaite.
{
  const { ENDING_SCENES } = await imp('endingFx.js');
  const { ENDINGS } = await imp('dialogues.js');
  const { SPECIES } = await imp('config.js');
  const keys = Object.keys(SPECIES);
  check(keys.every((k) => ENDING_SCENES[k]) && Object.keys(ENDING_SCENES).length === keys.length, `une scène de fin par espèce (${keys.length})`);
  const lines = keys.flatMap((k) => [ENDINGS[k]?.victoire, ENDINGS[k]?.defaite]);
  check(lines.every((l) => typeof l === 'string' && l.length > 20) && new Set(lines).size === lines.length, `${lines.length} répliques de fin, toutes différentes`);
  // Faux canvas : chaque appel de dessin est compté ; on joue 30 secondes de chaque scène.
  let calls = 0;
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : String(k).startsWith('create') ? () => gradient : () => calls++), set: (o, k, v) => ((o[k] = v), true) });
  let worst = 0;
  let errors = 0;
  for (const [key, scene] of Object.entries(ENDING_SCENES)) {
    for (const won of [true, false]) {
      const s = {};
      calls = 0;
      try {
        for (let t = 0; t <= 30; t += 1 / 30) scene({ ctx, w: 1280, h: 720, t, dt: 1 / 30, won, color: SPECIES[key].accent, s });
      } catch (e) {
        errors++;
        console.log(`   ${key} ${won ? 'victoire' : 'défaite'} : ${e.message}`);
      }
      worst = Math.max(worst, calls / 900);
    }
  }
  check(errors === 0, '18 scènes jouées 30 secondes sans erreur');
  check(worst < 3000, `dessin raisonnable (au plus ${Math.round(worst)} appels par image)`);
}

console.log(fails ? `\n${fails} échec(s).` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
