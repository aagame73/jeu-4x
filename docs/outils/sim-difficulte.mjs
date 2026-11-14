// Effet du niveau de difficulté sur les rivaux (docs/plan-difficulte.md, étape 3). Usage : node docs/outils/sim-difficulte.mjs . [jours]
// Étape 6 : node docs/outils/sim-difficulte.mjs . seuil [jours] : jour où le plus grand rival (sans joueur) atteint chaque
// seuil candidat de victoire d'un rival, en Ardu (carte moyenne, 4 puis 7 rivaux) et en Redoutable (réglages imposés).
// Pour chaque niveau, sur le même amas (carte moyenne, 4 rivaux ; seul game.difficulty change), puis Redoutable avec ses
// réglages imposés (petite carte, 7 rivaux, ressources rares) :
// - expansion : empires seuls (tickEmpires), part des systèmes colonisables tenue par le plus grand rival ;
// - guerre : partie complète (tick) avec une colonie du joueur qui ne fait rien, tous les rivaux rencontrés et tenus
//   hostiles ; la colonie est imprenable et chaque flotte arrivée chez elle est détruite, pour mesurer le rythme des flottes :
//   jour de la première déclaration de guerre, flottes et vaisseaux lancés.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const SEUIL = process.argv[3] === 'seuil';
const DAYS = Number(process.argv[SEUIL ? 4 : 3]) || (SEUIL ? 40000 : 3000);
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const E = await imp('empires.js');
const { colonizableStars } = await imp('victory.js');
const { DIFFICULTY } = await imp('config.js');
const SEEDS = [1, 42, 77, 1234, 5150, 9001];
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');

// Partie de test : amas Standard (ou réglages imposés), puis niveau choisi.
function newGame(seed, level, imposed) {
  const game = imposed ? G.createGame(seed, 'vaskhar', 7, { difficulty: level }) : G.createGame(seed, 'vaskhar', 4);
  game.difficulty = level;
  return game;
}

function largestShare(game) {
  const counted = new Set(colonizableStars(game).map((s) => s.id));
  const best = Math.max(...game.empires.map((e) => new Set(e.colonies.map((c) => c.starId).filter((id) => counted.has(id))).size));
  return best / counted.size;
}

function expansion(seed, level, imposed) {
  const game = newGame(seed, level, imposed);
  for (let d = 1; d <= DAYS; d++) {
    game.time = d;
    E.tickEmpires(game, 1);
  }
  return largestShare(game);
}

function war(seed, level, imposed) {
  const game = newGame(seed, level, imposed);
  const arche = game.ships[0];
  const home = game.stars[arche.starId];
  home.level = 3;
  const index = home.planets.findIndex((p) => p.size && !p.inhabitedBy);
  const surface = G.getSurface(game, home.id, index);
  G.foundColony(game, arche, home.id, index, surface.tiles.findIndex((t) => t.terrain !== 'ocean' && !t.building && !['minerais', 'velarine'].includes(t.deposit?.resource)));
  for (const e of game.empires) e.met = true;
  const playerStars = new Set(game.colonies.map((c) => c.starId));
  let firstWar = null;
  let ships = 0;
  let seen = 0;
  for (let d = 0; d < DAYS && !game.ended; d++) {
    for (const e of game.empires) e.relation = Math.min(e.relation, -90);
    G.tick(game, 1);
    if (firstWar === null && game.empires.some((e) => e.war)) firstWar = game.time;
    for (const fleet of game.fleets) if (fleet.id >= seen) ships += fleet.ships.length;
    seen = game.nextFleetId;
    for (const colony of game.colonies) Object.assign(colony, { siegeDays: 0, damage: 0 });
    game.fleets = game.fleets.filter((fl) => !(fl.state === 'idle' && playerStars.has(fl.starId)));
  }
  return { firstWar, fleets: game.nextFleetId, ships, ended: game.ended };
}

// Étape 6 : expansion seule jusqu'à DAYS ; arrêt anticipé quand aucun empire n'a fondé de colonie depuis 10 000 jours
// (amas saturé à sa portée). Renvoie le jour où chaque seuil est atteint (null : jamais) et la part finale.
const CANDIDATES = [0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
function domination(seed, level, rivals) {
  const game = level === 'redoutable' ? G.createGame(seed, 'vaskhar', 7, { difficulty: level }) : G.createGame(seed, 'vaskhar', rivals);
  game.difficulty = level;
  const reached = CANDIDATES.map(() => null);
  let last = 0;
  let share = 0;
  for (let d = 1; d <= DAYS && d - last < 10000; d++) {
    game.time = d;
    if (!E.tickEmpires(game, 1).length) continue;
    last = d;
    share = largestShare(game);
    CANDIDATES.forEach((c, i) => {
      if (reached[i] === null && share >= c) reached[i] = d;
    });
  }
  return { reached, share };
}

if (SEUIL) {
  const cases = [['ardu', 4], ['ardu', 7], ['redoutable', 7]];
  console.log(`Seuils de victoire d'un rival : jusqu'au jour ${DAYS}, graines ${SEEDS.join(', ')}. Case : jour moyen (min–max), « n/6 » = graines où le seuil est atteint.`);
  console.log(`| Niveau | ${CANDIDATES.map((c) => `${Math.round(c * 100)} %`).join(' | ')} | part finale |`);
  console.log(`|---|${CANDIDATES.map(() => '---|').join('')}---|`);
  for (const [level, rivals] of cases) {
    const runs = SEEDS.map((s) => domination(s, level, rivals));
    const cells = CANDIDATES.map((_, i) => {
      const days = runs.map((r) => r.reached[i]).filter((x) => x !== null);
      if (!days.length) return 'jamais';
      return `${Math.round(avg(days))} (${Math.min(...days)}–${Math.max(...days)})${days.length < SEEDS.length ? `, ${days.length}/${SEEDS.length}` : ''}`;
    });
    const shares = runs.map((r) => r.share);
    const label = level === 'redoutable' ? 'Redoutable (petite carte, 7 rivaux, ressources rares)' : `Ardu (carte moyenne, ${rivals} rivaux)`;
    console.log(`| ${label} | ${cells.join(' | ')} | ${Math.round(100 * avg(shares))} % (${Math.round(100 * Math.min(...shares))}–${Math.round(100 * Math.max(...shares))}) |`);
  }
  process.exit(0);
}

const rows = [...Object.keys(DIFFICULTY.levels).map((l) => [l, false]), ['redoutable', true]];
console.log(`Jour ${DAYS}, graines ${SEEDS.join(', ')}`);
console.log('| Niveau | plus grand rival (part des systèmes colonisables) | 1re déclaration de guerre (jour moyen, min–max) | flottes lancées | vaisseaux lancés |');
console.log('|---|---|---|---|---|');
for (const [level, imposed] of rows) {
  const shares = SEEDS.map((s) => expansion(s, level, imposed));
  const wars = SEEDS.map((s) => war(s, level, imposed));
  if (wars.some((w) => w.ended)) console.log(`(attention : partie finie avant le jour ${DAYS})`);
  const days = wars.map((w) => w.firstWar).filter((x) => x !== null);
  const label = DIFFICULTY.levels[level].label + (imposed ? ' (petite carte, 7 rivaux, ressources rares)' : '');
  const warText = days.length ? `${Math.round(avg(days))} (${Math.min(...days)}–${Math.max(...days)})${days.length < SEEDS.length ? `, ${SEEDS.length - days.length} sans guerre` : ''}` : 'aucune';
  console.log(`| ${label} | ${Math.round(100 * avg(shares))} % (${Math.round(100 * Math.min(...shares))}–${Math.round(100 * Math.max(...shares))}) | ${warText} | ${f(avg(wars.map((w) => w.fleets)))} | ${f(avg(wars.map((w) => w.ships)))} |`);
}
