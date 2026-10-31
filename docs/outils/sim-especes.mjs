// Simulation de 200 jours, même graine et même stratégie automatique, pour chaque espèce.
// Usage : node sim-especes.mjs <racine du projet> [graine] [neutraliser-milieu 0|1]
import { pathToFileURL } from 'node:url';

const root = process.argv[2];
const SEED = Number(process.argv[3] ?? 42);
const NEUTRAL_HABITAT = (process.argv[4] ?? '1') === '1';
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const E = await imp('economy.js');
const R = await imp('research.js');
const { SPECIES } = await imp('config.js');
const S = await imp('species.js');
const { PLANET_TYPES } = await imp('galaxy.js');

const DAYS = 200;
const W = { minerais: 1, alliages: 2, biomasse: 0.3, eau: 0.3, deuterium: 0.7, energie: 0.5, recherche: 1.5 };
const ORDER = ['puits', 'laboratoire', 'fonderie', 'puits', 'laboratoire', 'pompe', 'puits', 'laboratoire', 'centrale'];

function weighted(gains) {
  return Object.entries(W).reduce((sum, [res, w]) => sum + w * Math.max(0, gains[res] ?? 0), 0);
}

// Production brute du jour : sommes positives de chaque case (la consommation dépend des choix du bot).
function gross(report) {
  const g = {};
  for (const out of report.perTile.values()) for (const [res, v] of Object.entries(out)) if (v > 0) g[res] = (g[res] ?? 0) + v;
  return g;
}

let currentSeed = SEED;
let currentPick = 0;
function runSeed(species, seed, pick = 0) {
  currentSeed = seed;
  currentPick = pick;
  const r = run(species);
  currentPick = 0;
  currentSeed = SEED;
  return r;
}

function run(species, script = null) {
  const log = [];
  let cursor = 0;
  const game = G.createGame(currentSeed, species);
  const arche = game.ships[0];
  const home = game.stars[arche.starId];
  G.startAnalysis(game, arche);
  while (home.level < 3) G.tick(game, 1);
  // Même planète pour tous : la plus grande colonisable, puis la première.
  const sizes = { petite: 1, moyenne: 2, grande: 3 };
  const candidates = home.planets
    .map((p, i) => [p, i])
    .filter(([p]) => p.size && !p.inhabitedBy)
    .sort((a, b) => sizes[b[0].size] - sizes[a[0].size] || a[1] - b[1]);
  // Milieu réel : comme un joueur, on évite l'hostile et on pèse taille, biomasse et milieu favorable.
  const value = (p) => (S.speciesHabitat(p) === 'hostile' ? 0 : 1) * sizes[p.size] * (1 + PLANET_TYPES[p.type].dep.biomasse / 2) * (S.speciesHabitat(p) === 'favored' ? 1.5 : 1);
  const index = NEUTRAL_HABITAT
    ? (candidates[currentPick] ?? candidates[0])[1]
    : [...candidates].sort((a, b) => value(b[0]) - value(a[0]))[0][1];
  const planet = home.planets[index];
  const surface = G.getSurface(game, home.id, index);
  const tileIndex = surface.tiles.findIndex((t) => t.terrain !== 'ocean' && !t.building && !['minerais', 'velarine'].includes(t.deposit?.resource));
  if (!G.foundColony(game, arche, home.id, index, tileIndex)) throw new Error('fondation impossible');
  const colony = game.colonies[0];
  const habitat = colony.habitat;
  if (NEUTRAL_HABITAT) {
    colony.habitat = null;
    colony.population = 4;
  }
  let step = 0;
  let cumul = 0;
  let firstProbe = null;
  const startDay = Math.floor(game.time);
  for (let d = 0; d < DAYS; d++) {
    const report = E.colonyReport(colony, surface);
    if (script) {
      // Rejoue la même suite d'actions que la partie de référence, chacune dès que possible.
      if (!game.research.current) {
        const next = script.research.find((k) => !R.hasTech(k) && !G.researchProblem(game, k));
        if (next) G.startResearch(game, next);
      }
      const a = script.builds[cursor];
      if (a && !colony.construction) {
        const tile = surface.tiles[a.tile];
        const ok = a.upgrade ? E.startUpgrade(game, colony, surface, tile) : E.startConstruction(game, colony, surface, tile, a.type);
        if (ok) cursor++;
        else if (a.upgrade ? E.upgradeProblem(game, colony, surface, tile) !== 'Pas assez de ressources.' && tile.building : E.buildProblem(tile, a.type, surface)) cursor++; // devenue impossible : on saute
      }
    } else {
    // Recherche : la technologie disponible la moins chère.
    if (!game.research.current) {
      const next = Object.keys(R.TECHS)
        .filter((k) => G.researchStatus(game, k) === 'available' && !G.researchProblem(game, k))
        .sort((a, b) => R.techCost(R.TECHS[a]) - R.techCost(R.TECHS[b]))[0];
      if (next && G.startResearch(game, next)) log.push({ research: next });
    }
    if (!colony.construction) {
      const energyNet = report.energyProd - report.energyUse;
      const need =
        report.housing - colony.population <= 0 ? 'foyer'
        : energyNet < 1 ? 'solaire'
        : report.perDay.biomasse < 0.5 ? 'serre'
        : report.perDay.eau < 0.5 ? 'pompe'
        : ORDER[step % ORDER.length];
      const candidates = [need, ...(need === 'solaire' ? ['centrale'] : need === 'serre' ? ['ferme'] : need === 'pompe' ? ['captage'] : [])];
      let started = false;
      for (const type of candidates) {
        const def = E.BUILDINGS[type];
        if (!def || !E.canAfford(game.resources, def.cost)) continue;
        // Case : celle qui rapporte le plus (les terrains favoris de l'espèce ressortent d'eux-mêmes).
        let best = null;
        for (const tile of surface.tiles) {
          if (E.buildProblem(tile, type, surface)) continue;
          const g = E.previewBuilding(colony, surface, tile, type);
          const v = weighted(g) + (g.housing ?? 0) * 3 + (g.energie ?? 0);
          if (!best || v > best.v) best = { tile, v };
        }
        if (best && E.startConstruction(game, colony, surface, best.tile, type)) {
          log.push({ tile: best.tile.index, type });
          started = true;
          if (type === need && need === ORDER[step % ORDER.length]) step++;
          break;
        }
      }
      // Rien à construire : on améliore le bâtiment le plus rentable possible.
      if (!started) {
        if (need === ORDER[step % ORDER.length]) step++;
        for (const tile of surface.tiles) {
          if (tile.building?.done && !E.upgradeProblem(game, colony, surface, tile) && E.startUpgrade(game, colony, surface, tile)) {
            log.push({ tile: tile.index, upgrade: true });
            break;
          }
        }
      }
    }
    }
    if (firstProbe === null && R.hasTech('moteurs-saut') && surface.tiles.some((t) => t.building?.type === 'spatioport' && t.building.done)) firstProbe = d;
    G.tick(game, 1);
    cumul += weighted(gross(E.colonyReport(colony, surface)));
  }
  const end = E.colonyReport(colony, surface);
  const built = surface.tiles.filter((t) => t.building?.done);
  return {
    species,
    label: SPECIES[species].label,
    planet: `${planet.name} (${planet.type})`,
    habitat: habitat ?? 'neutre',
    day: Math.floor(game.time) - startDay,
    population: colony.population,
    perDay: end.perDay,
    energy: end.energyProd - end.energyUse,
    techs: game.research.done.length,
    buildings: built.length,
    levels: built.reduce((s, t) => s + (t.building.level ?? 1), 0),
    cumul,
    script: { research: log.filter((a) => a.research).map((a) => a.research), builds: log.filter((a) => !a.research) },
  };
}

const keys = ['sans-espece', ...S.playableSpecies()];
const f = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
if (NEUTRAL_HABITAT) {
const reference = run('sans-espece');
const replay = keys.map((k) => run(k, reference.script));
console.log(`A. Suite d'actions identique (celle des Colons sur la graine ${SEED}), milieu ${NEUTRAL_HABITAT ? 'neutralisé' : 'réel'} — ${reference.planet}`);
console.log('| Espèce | Population | Minerais/j | Alliages/j | Biomasse/j | Eau/j | Deutérium/j | Énergie nette | Recherche/j | Technologies | Score vs neutre |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of replay) {
  const p = r.perDay;
  console.log(`| ${r.label} | ${r.population} | ${f(p.minerais)} | ${f(p.alliages)} | ${f(p.biomasse)} | ${f(p.eau)} | ${f(p.deuterium)} | ${f(r.energy)} | ${f(p.recherche)} | ${r.techs} | ${Math.round((r.cumul / replay[0].cumul) * 100)} % |`);
}
}
const SEEDS = Array.from({ length: 20 }, (_, i) => SEED + i * 7);
// Chaque graine est jouée sur chacune des (au plus 3) planètes colonisables du système de départ.
const runs = SEEDS.flatMap((seed) => {
  const g = G.createGame(seed);
  const n = Math.min(3, g.stars[g.ships[0].starId].planets.filter((p) => p.size && !p.inhabitedBy).length);
  return Array.from({ length: n }, (_, pick) => keys.map((k) => runSeed(k, seed, pick)));
});
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
const pct = (x) => `${Math.round(x * 100)} %`;
console.log(`\nB. Bot adaptatif : ${SEEDS.length} graines × planètes du système de départ = ${runs.length} parties par espèce. Médianes ; « vs espèces » = rapport à la moyenne des 8 espèces dans la même partie.`);
console.log('| Espèce | vs neutre (médiane) | vs espèces (médiane) | 1er quartile | 3e quartile | Population moyenne | Technologies moyennes |');
console.log('|---|---|---|---|---|---|---|');
keys.forEach((k, i) => {
  const vsNeutral = runs.map((row) => row[i].cumul / row[0].cumul);
  const vsSpecies = runs.map((row) => row[i].cumul / (row.slice(1).reduce((a, r) => a + r.cumul, 0) / (row.length - 1)));
  const sorted = [...vsSpecies].sort((a, b) => a - b);
  const q = (t) => sorted[Math.floor(t * (sorted.length - 1))];
  const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  console.log(`| ${SPECIES[k].label} | ${pct(median(vsNeutral))} | ${pct(median(vsSpecies))} | ${pct(q(0.25))} | ${pct(q(0.75))} | ${f(avg(runs.map((row) => row[i].population)))} | ${f(avg(runs.map((row) => row[i].techs)))} |`);
});
