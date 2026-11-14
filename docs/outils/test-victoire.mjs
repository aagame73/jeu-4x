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
function setup(seed = 42, settings) {
  const game = settings ? G.createGame(seed, 'vaskhar', 4, settings) : G.createGame(seed, 'vaskhar', 4);
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

// Étape 6 du plan de difficulté : victoire d'un rival, seulement en Ardu et Redoutable.
{
  const { DIFFICULTY } = await imp('config.js');
  // Partie au niveau voulu (réglages imposés en Redoutable), avec la colonie du joueur ; grow donne à un rival des systèmes libres jusqu'à la part voulue.
  const levelGame = (difficulty) => setup(42, { difficulty });
  const grow = (game, empire, share) => {
    const stars = V.colonizableStars(game);
    const mine = V.playerStars(game);
    const taken = new Set(game.empires.flatMap((e) => e.colonies.map((c) => c.starId)));
    const need = Math.ceil(share * stars.length);
    for (const star of stars) {
      if (new Set(empire.colonies.map((c) => c.starId)).size >= need) break;
      if (mine.has(star.id) || taken.has(star.id)) continue;
      empire.colonies.push({ starId: star.id, planetIndex: star.planets.findIndex((pl) => pl.size), known: false });
      taken.add(star.id);
    }
  };
  for (const level of ['decouverte', 'standard']) {
    const label = DIFFICULTY.levels[level].label;
    const game = levelGame(level);
    grow(game, game.empires[0], 0.6);
    check(V.rivalGoal(game) === null && V.endState(game) === null, `${label} : un rival à 60 % ne gagne pas`);
    game.empires[0].met = true;
    check(V.newRivalWarnings(game).length === 0 && V.leadingKnownRival(game) === null, `${label} : ni avertissement ni rival au compteur`);
  }
  {
    const game = setup();
    delete game.difficulty;
    grow(game, game.empires[0], 0.6);
    check(V.endState(game) === null, 'partie sans niveau (ancienne) : Standard, un rival ne gagne pas');
  }
  for (const level of ['ardu', 'redoutable']) {
    const label = DIFFICULTY.levels[level].label;
    const goal = DIFFICULTY.levels[level].rivalShare;
    const game = levelGame(level);
    const rival = game.empires[0];
    check(V.rivalGoal(game) === goal && goal > 0 && goal < VICTORY.share, `${label} : seuil d'un rival lu dans DIFFICULTY (${Math.round(goal * 100)} %)`);
    // Sous le seuil d'avertissement : rien. Au-dessus, rival pas encore rencontré : prévenu sans son nom, pas au compteur.
    grow(game, rival, goal * VICTORY.rivalWarning * 0.9);
    rival.met = true;
    check(V.newRivalWarnings(game).length === 0, `${label} : sous ${Math.round(VICTORY.rivalWarning * 100)} % du seuil, pas d'avertissement`);
    rival.met = false;
    grow(game, rival, goal * VICTORY.rivalWarning + 0.01);
    const unknown = V.newRivalWarnings(game);
    check(unknown.length === 1 && unknown[0].known === false && V.leadingKnownRival(game) === null, `${label} : rival inconnu, prévenu sans son nom, absent du compteur`);
    check(V.rivalLabel(rival.species, false) === 'un empire inconnu', `${label} : rival inconnu nommé « un empire inconnu »`);
    game.rivalWarnings = []; // on reprend avec le rival rencontré
    rival.met = true;
    const lead = V.leadingKnownRival(game);
    check(lead?.empire === rival && lead.goal === goal && lead.share >= goal * VICTORY.rivalWarning, `${label} : compteur, plus grand rival connu (${Math.floor((lead?.share ?? 0) * 100)} % sur ${Math.round(goal * 100)} %)`);
    const before = game.log.length;
    G.tick(game, 1);
    const warned = game.log.slice(before).filter((l) => l.text.startsWith('Attention'));
    check(warned.length === 1 && game.rivalWarnings.includes(rival.species), `${label} : avertissement au journal (« ${warned[0]?.text} »)`);
    G.tick(game, 1);
    check(game.log.filter((l) => l.text.startsWith('Attention')).length === 1, `${label} : avertissement donné une seule fois`);
    const back = restore(copy(serialize(game)));
    check(back.rivalWarnings.length === 1 && back.rivalWarnings[0] === rival.species && V.newRivalWarnings(back).length === 0, `${label} : avertissements gardés dans la sauvegarde`);
    const old = copy(serialize(game));
    delete old.rivalWarnings;
    check(restore(old).rivalWarnings.length === 0, `${label} : ancienne sauvegarde, aucun avertissement`);
    old.rivalWarnings = ['inconnue', 42, rival.species, rival.species];
    check(JSON.stringify(restore(old).rivalWarnings) === JSON.stringify([rival.species]), `${label} : avertissements inconnus ou en double ignorés`);
    // Sous le seuil : pas de fin ; au seuil : défaite.
    check(V.endState(game) === null, `${label} : sous le seuil, pas de fin`);
    grow(game, rival, goal);
    const end = V.checkEnd(game);
    check(end?.result === 'defaite' && end.reason === 'rival-domine' && end.species === rival.species, `${label} : au seuil, défaite « rival-domine » (${rival.species})`);
    check(game.paused && game.ended === end, `${label} : partie finie et en pause`);
    const saved = restore(copy(serialize(game)));
    check(saved.ended?.reason === 'rival-domine' && saved.ended.species === rival.species && saved.ended.day === end.day, `${label} : fin « rival-domine » gardée dans la sauvegarde`);
    const odd = copy(serialize(game));
    odd.ended = { result: 'defaite', reason: 'rival-domine', day: 3, species: 'inconnue' };
    const fixed = restore(odd).ended;
    check(fixed?.reason === 'rival-domine' && fixed.species === undefined, `${label} : espèce inconnue ignorée, la fin reste valide`);
    odd.ended = { result: 'victoire', reason: 'rival-domine' };
    check(restore(odd).ended === null, `${label} : « rival-domine » n'est pas une victoire`);
  }
  // Annonce au journal et nom de l'empire.
  {
    const game = levelGame('ardu');
    const rival = game.empires[0];
    grow(game, rival, DIFFICULTY.levels.ardu.rivalShare);
    G.tick(game, 1);
    check(game.ended?.reason === 'rival-domine' && game.log.at(-1).text === `Défaite : ${V.rivalLabel(rival.species, rival.met)} domine l'amas.`, `tick : défaite annoncée (« ${game.log.at(-1).text} »)`);
    check(V.empireName('orrhaides', true) === 'Le Concordat orrhaïde' && V.empireName('vaskhar') === "l'Hégémonie vaskhar" && V.empireName('ashkari') === 'la Caravane ashkari', "articles : le Concordat, l'Hégémonie, la Caravane");
    check(V.empireName('inconnue', true) === 'Un empire rival', 'espèce inconnue : « Un empire rival »');
  }
  // Le joueur atteint sa victoire le même jour qu'un rival son seuil : la victoire du joueur passe avant.
  {
    const game = levelGame('redoutable');
    const stars = V.colonizableStars(game);
    const mine = V.playerStars(game);
    const need = Math.ceil(stars.length * VICTORY.share);
    for (const star of stars) {
      if (mine.size >= need) break;
      if (!mine.has(star.id)) {
        fakeColony(game, star);
        mine.add(star.id);
      }
    }
    // Systèmes partagés : le rival compte aussi les siens.
    const rival = game.empires[0];
    for (const star of stars.slice(0, Math.ceil(stars.length * DIFFICULTY.levels.redoutable.rivalShare))) rival.colonies.push({ starId: star.id, planetIndex: 0, known: false });
    check(V.rivalShares(game)[0].share >= V.rivalGoal(game), 'joueur et rival à leur seuil le même jour');
    const end = V.checkEnd(game);
    check(end?.result === 'victoire' && end.reason === 'expansion', 'la victoire du joueur passe avant celle du rival');
  }
  // Sans colonie mais avec un vaisseau colonie : un rival au seuil gagne quand même.
  {
    const game = levelGame('ardu');
    game.colonies = [];
    game.ships.push({ id: 999, kind: 'colonie', name: 'Colonie 1', starId: 0, state: 'idle' });
    grow(game, game.empires[0], DIFFICULTY.levels.ardu.rivalShare);
    check(V.endState(game)?.reason === 'rival-domine', 'sans colonie (vaisseau colonie restant) : un rival au seuil gagne');
  }
}

// Défaite par un rival jamais rencontré : « un empire inconnu », gardé dans la sauvegarde ; ancienne sauvegarde : nommé.
{
  check(V.validEnded({ result: 'defaite', reason: 'rival-domine', species: 'thrennes', known: false, day: 9 }).known === false, 'défaite par un rival inconnu gardée inconnue au chargement');
  check(V.validEnded({ result: 'defaite', reason: 'rival-domine', species: 'thrennes', day: 9 }).known === true, 'ancienne sauvegarde : le rival qui domine est nommé');
  check(V.rivalLabel('thrennes', false, true) === 'Un empire inconnu' && V.rivalLabel('thrennes', true) === V.empireName('thrennes'), "nom du rival selon qu'il a été rencontré");
}

console.log(fails ? `\n${fails} échec(s).` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
