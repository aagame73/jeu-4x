// Tests de l'étape 5 : nombre d'adversaires, espèce des rivaux, sauvegardes.
// Usage : node docs/outils/test-etape5.mjs .
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const S = await imp('species.js');
const { RIVALS, DEFAULT_SPECIES, SPECIES } = await imp('config.js');
const { restore, serialize } = await imp('save.js');

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`);
  if (!ok) fails++;
};
const SEEDS = [1, 42, 77, 1234, 99991];
const COUNTS = [3, 4, 5, 6, 7];
const rivalsOf = (game) => game.stars.filter((s) => s.rival).map((s) => [s.id, s.rival]).sort((a, b) => a[0] - b[0]);
const speciesKeys = S.playableSpecies();
// L'amas sans les marques de rivaux : doit être le même quels que soient l'espèce et le nombre.
const clusterPrint = (game) => JSON.stringify({
  home: game.homeId,
  currents: game.currents,
  stars: game.stars.map(({ rival, planets, ...s }) => ({ ...s, planets: planets.map(({ inhabitedBy, ...p }) => p) })),
});
const roundTrip = (game) => restore(JSON.parse(JSON.stringify(serialize(game))));

// Identité.
{
  let ok = true;
  let bad = '';
  for (const seed of SEEDS) for (const species of speciesKeys) for (const n of COUNTS) {
    const game = G.createGame(seed, species, n);
    const rivals = rivalsOf(game);
    const keys = rivals.map(([, k]) => k);
    const fine = rivals.length === n && new Set(keys).size === n && !keys.includes(species)
      && keys.every((k) => SPECIES[k] && !SPECIES[k].hidden && SPECIES[k].empire)
      && !rivals.some(([id]) => id === game.homeId)
      && JSON.stringify(rivals) === JSON.stringify(rivalsOf(G.createGame(seed, species, n)));
    if (!fine) { ok = false; bad = `${seed}/${species}/${n}`; }
  }
  check(ok, `N rivaux distincts, jamais l'espèce du joueur ni l'étoile de départ, même résultat pour une même graine ${bad}`);
}

// Nombre : les premiers restent les mêmes ; l'amas ne change pas.
{
  let prefix = true;
  let print = true;
  for (const seed of SEEDS) {
    const reference = clusterPrint(G.createGame(seed));
    for (const species of [...speciesKeys, DEFAULT_SPECIES]) {
      const big = new Map(rivalsOf(G.createGame(seed, species, 7)));
      for (const n of COUNTS) {
        const game = G.createGame(seed, species, n);
        if (!rivalsOf(game).every(([id, k]) => big.get(id) === k)) prefix = false;
        if (clusterPrint(game) !== reference) print = false;
      }
    }
  }
  check(prefix, 'les rivaux restent les mêmes quand le nombre augmente');
  check(print, 'étoiles, planètes et courants identiques quels que soient espèce et nombre');
}

// Valeurs invalides.
for (const bad of [0, 2, 8, 2.5, 'cinq', '5', null, undefined, NaN]) {
  check(G.createGame(42, 'vaskhar', bad).rivals === RIVALS.default, `valeur invalide ${String(bad)} → ${RIVALS.default} rivaux`);
}

// Sauvegarde.
for (const n of [3, 4, 7]) {
  const game = G.createGame(42, 'thrennes', n);
  const back = roundTrip(game);
  check(back.rivals === n && JSON.stringify(rivalsOf(back)) === JSON.stringify(rivalsOf(game)), `aller-retour de sauvegarde avec ${n} rivaux`);
}

// Anciennes sauvegardes.
{
  const data = JSON.parse(JSON.stringify(serialize(G.createGame(42, 'thrennes', 4))));
  delete data.rivals;
  const back = restore(data);
  check(back.rivals === 4 && JSON.stringify(rivalsOf(back)) === JSON.stringify(rivalsOf(G.createGame(42, 'thrennes', 4))), 'sauvegarde sans rivals : 4 rivaux aux mêmes étoiles');
  delete data.species;
  const old = restore(data);
  const keys = rivalsOf(old).map(([, k]) => k).sort();
  const inOrder = [...old.stars].filter((s) => s.rival).map((s) => s.rival).sort();
  check(old.species === DEFAULT_SPECIES && JSON.stringify(keys) === JSON.stringify(['keltirr', 'ondesiens', 'synodes', 'vaskhar']), 'sauvegarde sans rivals ni species : les 4 espèces historiques');
  const fresh = G.createGame(42, DEFAULT_SPECIES, 4);
  check(JSON.stringify(rivalsOf(old)) === JSON.stringify(rivalsOf(fresh)) && JSON.stringify(inOrder) === JSON.stringify(keys), 'profil neutre : chaque espèce historique reste sur la même étoile');
  const corrupt = JSON.parse(JSON.stringify(serialize(G.createGame(42, 'thrennes', 6))));
  corrupt.rivals = 99;
  check(restore(corrupt).rivals === 4, 'sauvegarde avec un nombre invalide : 4 rivaux');
}

// Identité cachée avant l'analyse.
{
  const key = 'vaskhar';
  check(S.knownRival({ level: 2 }, key) === null, "rival inconnu avant l'analyse (niveau 2)");
  check(S.knownRival({ level: 3 }, key)?.empire === SPECIES[key].empire, "rival connu après l'analyse (niveau 3)");
  check(S.knownRival({ level: 3 }, null) === null, 'planète sans rival : rien');
}

// Couleurs d'empire : bien distinctes entre elles et des couleurs de l'interface.
{
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const gap = (a, b) => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]));
  const colors = speciesKeys.map((k) => SPECIES[k].empireColor);
  const interfaceColors = ['#cfdcff', '#ffd166', '#7cff9e', '#ff7a8a']; // étiquettes, ruines, joueur, signaux
  const closest = Math.min(...colors.flatMap((c, i) => colors.slice(i + 1).map((d) => gap(c, d))));
  const closestUi = Math.min(...colors.flatMap((c) => interfaceColors.map((d) => gap(c, d))));
  check(closest >= 90, `écart minimal entre empires : ${Math.round(closest)}`);
  check(closestUi >= 60, `écart minimal avec l'interface : ${Math.round(closestUi)}`);
}

// Colonisation.
{
  const game = G.createGame(42, 'vaskhar', 7);
  const star = game.stars.find((s) => s.rival);
  const index = star.planets.findIndex((p) => p.inhabitedBy);
  star.level = 3;
  const ship = { id: 99, kind: 'colonie', starId: star.id, state: 'idle', age: 0, name: 'Colonie test' };
  game.ships.push(ship);
  const message = G.foundingProblem(game, ship, star.id, index) ?? '';
  const { label, empire } = S.rivalInfo(star.rival);
  check(message.includes(label) && message.includes(empire) && !message.includes(`les ${star.rival} `), `planète rivale refusée : « ${message} »`);
  // Analyse du système : le journal nomme l'empire.
  star.level = 2;
  const probe = { ...ship, id: 100, kind: 'sonde', name: 'Sonde test' };
  game.ships.push(probe);
  G.startAnalysis(game, probe);
  for (let d = 0; d < 60 && star.level < 3; d++) G.tick(game, 1);
  check(game.log.some((l) => JSON.stringify(l).includes(`monde natal des ${label} (${empire})`)), `journal d'analyse : monde natal des ${label} (${empire})`);
  // Le dernier rival avec 7 n'existe pas avec 3.
  const three = new Set(rivalsOf(G.createGame(42, 'vaskhar', 3)).map(([id]) => id));
  const extra = rivalsOf(game).map(([id]) => id).find((id) => !three.has(id));
  const small = G.createGame(42, 'vaskhar', 3);
  check(small.stars[extra].rival === null && small.stars[extra].planets.every((p) => !p.inhabitedBy), 'une planète rivale avec 7 reste libre avec 3');
}

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
