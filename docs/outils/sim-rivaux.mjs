// Simulation de l'expansion des rivaux, sans le joueur. Usage : node docs/outils/sim-rivaux.mjs . [jours...]
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const marks = process.argv.slice(3).map(Number);
const MARKS = marks.length ? marks : [200, 500, 1000, 2000, 5000];
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const E = await imp('empires.js');
const { SPECIES } = await imp('config.js');
const SEEDS = [1, 42, 77, 1234, 5150, 9001];
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',');

const bySpecies = {};
for (const count of [3, 4, 7]) {
  const rows = MARKS.map(() => ({ colonies: [], occupied: [], nearby: [], ruins: [] }));
  for (const seed of SEEDS) for (const player of ['ondesiens', 'vaskhar']) {
    const game = G.createGame(seed, player, count);
    const home = game.stars[game.homeId];
    const planets = game.stars.flatMap((s) => s.planets.map((p, i) => ({ s, p, i }))).filter((x) => x.p.size);
    const near = planets.filter((x) => Math.hypot(x.s.pos.x - home.pos.x, x.s.pos.y - home.pos.y, x.s.pos.z - home.pos.z) <= 40 && x.s.id !== home.id);
    const ruins = planets.filter((x) => x.p.ruins);
    let m = 0;
    for (let d = 1; d <= MARKS.at(-1); d++) {
      game.time = d;
      E.tickEmpires(game, 1);
      if (d !== MARKS[m]) continue;
      const taken = new Set(game.empires.flatMap((e) => e.colonies.map((c) => `${c.starId}-${c.planetIndex}`)));
      const free = (x) => !taken.has(`${x.s.id}-${x.i}`);
      rows[m].colonies.push(avg(game.empires.map((e) => e.colonies.length)));
      rows[m].occupied.push((100 * taken.size) / planets.length);
      rows[m].nearby.push(near.filter(free).length);
      rows[m].ruins.push(ruins.filter(free).length);
      if (count === 4) for (const e of game.empires) ((bySpecies[e.species] ??= {})[d] ??= []).push(e.colonies.length);
      m++;
    }
  }
  console.log(`\n${count} rivaux : jour | colonies par empire | part de l'amas occupée | planètes libres à moins de 40 al du joueur | planètes à ruines libres (minimum)`);
  MARKS.forEach((d, i) => console.log(`| ${d} | ${f(avg(rows[i].colonies))} | ${Math.round(avg(rows[i].occupied))} % | ${f(avg(rows[i].nearby))} | ${f(avg(rows[i].ruins))} (${Math.min(...rows[i].ruins)}) |`));
}
console.log(`\nColonies par espèce, 4 rivaux, jours ${MARKS.join(' | ')}`);
for (const [k, v] of Object.entries(bySpecies)) console.log(`| ${SPECIES[k].label} | ${MARKS.map((d) => f(avg(v[d] ?? []))).join(' | ')} |`);
