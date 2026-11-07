// Stocks et technologies des rivaux au fil du temps, sans le joueur. Usage : node docs/outils/sim-diplomatie.mjs .
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const E = await imp('empires.js');
const D = await imp('diplomacy.js');
const { SPECIES } = await imp('config.js');
const MARKS = [200, 1000, 2000, 5000];
const rows = {};
for (const seed of [1, 42, 77, 1234]) {
  const game = G.createGame(seed, 'ondesiens', 7);
  for (let d = 1; d <= MARKS.at(-1); d++) {
    game.time = d;
    E.tickEmpires(game, 1);
    D.tickDiplomacy(game, 1);
    if (!MARKS.includes(d)) continue;
    for (const e of game.empires) ((rows[e.species] ??= {})[d] ??= []).push({ col: e.colonies.length, min: e.stocks.minerais, all: e.stocks.alliages, vel: e.stocks.velarine, tech: D.rivalTechs(e).length });
  }
}
const avg = (xs, f) => Math.round(xs.reduce((a, x) => a + f(x), 0) / xs.length);
console.log('Espèce | jour | colonies | minerais | alliages | vélarine | technologies');
for (const [k, v] of Object.entries(rows)) for (const d of MARKS) console.log(`${SPECIES[k].label} | ${d} | ${avg(v[d], (x) => x.col)} | ${avg(v[d], (x) => x.min)} | ${avg(v[d], (x) => x.all)} | ${avg(v[d], (x) => x.vel)} | ${avg(v[d], (x) => x.tech)}`);
