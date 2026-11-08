// Chances de victoire selon le rapport de forces, sur des milliers de combats simulés.
// Usage : node docs/outils/sim-combat.mjs .
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const C = await imp('combat.js');
const { createRng } = await imp('rng.js');
const { SHIP_KINDS } = await imp('game.js');

const unit = (kind) => ({ attack: SHIP_KINDS[kind].attack, defense: SHIP_KINDS[kind].defense, damage: 0 });
const fleet = (spec) => Object.entries(spec).flatMap(([kind, n]) => Array.from({ length: n }, () => unit(kind)));
// Puissance d'une flotte : attaque totale × défense totale (l'une tue, l'autre encaisse).
const power = (units) => units.reduce((s, u) => s + u.attack, 0) * units.reduce((s, u) => s + u.defense, 0);
const N = 2000;

const duels = [
  ['1 corvette', { corvette: 1 }, '1 corvette', { corvette: 1 }],
  ['2 corvettes', { corvette: 2 }, '1 corvette', { corvette: 1 }],
  ['1 frégate', { fregate: 1 }, '2 corvettes', { corvette: 2 }],
  ['1 frégate', { fregate: 1 }, '3 corvettes', { corvette: 3 }],
  ['1 croiseur', { croiseur: 1 }, '2 frégates', { fregate: 2 }],
  ['1 cuirassé', { cuirasse: 1 }, '2 croiseurs', { croiseur: 2 }],
  ['3 frégates', { fregate: 3 }, '1 croiseur + 1 frégate', { croiseur: 1, fregate: 1 }],
];
console.log('Camp A | Camp B | rapport de puissance A/B | victoire A | victoire B | sans vainqueur | durée moyenne (jours) | pertes moyennes de A');
for (const [nameA, a, nameB, b] of duels) {
  let winA = 0;
  let winB = 0;
  let days = 0;
  let lostA = 0;
  for (let i = 0; i < N; i++) {
    const A = fleet(a);
    const B = fleet(b);
    const r = C.fightToEnd(A, B, createRng(i * 7919 + 13));
    if (r.winner === 'A') winA++;
    if (r.winner === 'B') winB++;
    days += r.days;
    lostA += A.filter((u) => !C.alive(u)).length;
  }
  const pct = (x) => `${Math.round((100 * x) / N)} %`;
  console.log(`${nameA} | ${nameB} | ${(power(fleet(a)) / power(fleet(b))).toFixed(2)} | ${pct(winA)} | ${pct(winB)} | ${pct(N - winA - winB)} | ${(days / N).toFixed(1)} | ${(lostA / N).toFixed(2)}`);
}
