// Génération procédurale de l'amas : étoiles, planètes, gisements, ruines et courants.
import { createRng } from './rng.js';
import { createNameGenerator } from './names.js';
import { CONFIG } from './config.js';

export const STAR_TYPES = {
  rouge: { label: 'Naine rouge', color: 0xff7a59, size: 0.8 },
  orange: { label: 'Étoile orange', color: 0xffb066, size: 1.0 },
  jaune: { label: 'Naine jaune', color: 0xffe9a8, size: 1.1 },
  blanche: { label: 'Étoile blanche', color: 0xf2f5ff, size: 1.25 },
  bleue: { label: 'Géante bleue', color: 0x8fb8ff, size: 1.7 },
};
const STAR_WEIGHTS = [['rouge', 40], ['orange', 22], ['jaune', 20], ['blanche', 10], ['bleue', 5]];

// dep : richesse moyenne de chaque ressource (0 à 3) ; velarine : probabilité relative.
export const PLANET_TYPES = {
  tempere: { label: 'Tellurique tempérée', dep: { minerais: 1, energie: 1, biomasse: 2, velarine: 0 } },
  oceanique: { label: 'Océanique', dep: { minerais: 0.5, energie: 0.5, biomasse: 3, velarine: 0 } },
  marecageuse: { label: 'Marécageuse', dep: { minerais: 0.5, energie: 0.5, biomasse: 2.5, velarine: 0 } },
  desertique: { label: 'Désertique', dep: { minerais: 1.5, energie: 2, biomasse: 0.3, velarine: 0.1 } },
  volcanique: { label: 'Volcanique', dep: { minerais: 2.5, energie: 2.5, biomasse: 0, velarine: 0.2 } },
  toxique: { label: 'Toxique', dep: { minerais: 2, energie: 1, biomasse: 0, velarine: 0.3 } },
  glacee: { label: 'Glacée', dep: { minerais: 1, energie: 1, biomasse: 0.3, velarine: 0.1 } },
  gazeuse: { label: 'Géante gazeuse', dep: { minerais: 0, energie: 1.5, biomasse: 0, velarine: 0.6 }, colonisable: false },
  asteroides: { label: "Ceinture d'astéroïdes", dep: { minerais: 3, energie: 0, biomasse: 0, velarine: 0.2 }, colonisable: false },
};

// Nombre d'hexagones de surface selon la taille.
export const PLANET_SIZES = { petite: 19, moyenne: 37, grande: 61 };

const ORBIT_ZONES = {
  inner: [['volcanique', 4], ['desertique', 3], ['toxique', 2], ['asteroides', 1]],
  middle: [['tempere', 3], ['oceanique', 3], ['marecageuse', 2], ['desertique', 2], ['toxique', 1]],
  outer: [['glacee', 4], ['gazeuse', 4], ['asteroides', 2]],
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const RIVAL_SPECIES = ['Vaskhar', 'Ondésiens', 'Kel-Tirr', 'Synodes'];

export const isColonisable = (planet) => PLANET_TYPES[planet.type].colonisable !== false;

export function dist3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function starDistance(a, b) {
  return dist3(a.pos, b.pos);
}

export function generateCluster(seed) {
  const rng = createRng(seed);
  const names = createNameGenerator(rng);
  const stars = placeStars(rng).map((pos, id) => {
    const star = { id, name: names.next(), type: rng.weighted(STAR_WEIGHTS), pos, planets: [], level: 0, hasRuins: false, rival: null };
    star.planets = generatePlanets(rng, star);
    return star;
  });
  const homeId = chooseHome(stars);
  setupHome(rng, stars[homeId]);
  placeRuins(rng, stars, homeId);
  placeRivals(stars, homeId);
  const currents = createCurrents(rng, stars, homeId);
  addWaterAndFuel(seed, stars, homeId);
  return { seed, stars, currents, homeId };
}

// Eau et deutérium : tirés avec leur propre générateur, après tout le reste, pour que les
// amas déjà générés (et les parties sauvegardées) gardent exactement les mêmes étoiles et planètes.
const WATER_FUEL = {
  tempere: [1.5, 0.5],
  oceanique: [3, 2],
  marecageuse: [2, 1],
  desertique: [0.3, 0],
  volcanique: [0.2, 0.3],
  toxique: [0.5, 0.5],
  glacee: [3, 1.5],
  gazeuse: [0, 3],
  asteroides: [1, 0],
};

function addWaterAndFuel(seed, stars, homeId) {
  const rng = createRng((seed ^ 0x9e3779b9) >>> 0);
  for (const star of stars) {
    for (const planet of star.planets) {
      const [water, fuel] = WATER_FUEL[planet.type];
      const roll = (base) => Math.max(0, Math.min(3, Math.round(base * rng.range(0.4, 1.3) + rng.gauss() * 0.5)));
      planet.deposits.eau = roll(water);
      planet.deposits.deuterium = roll(fuel);
    }
  }
  // Le monde tempéré du système de départ a toujours un peu d'eau.
  const home = stars[homeId].planets.find((p) => p.type === 'tempere');
  if (home) home.deposits.eau = Math.max(1, home.deposits.eau);
}

function placeStars(rng) {
  const R = CONFIG.clusterRadius;
  const clumps = Array.from({ length: 7 }, () => {
    const a = rng.range(0, Math.PI * 2);
    const r = R * 0.75 * Math.sqrt(rng.next());
    return { x: Math.cos(a) * r, y: rng.gauss() * 6, z: Math.sin(a) * r };
  });
  const out = [];
  for (let guard = 0; out.length < CONFIG.starCount && guard < CONFIG.starCount * 60; guard++) {
    let p;
    if (rng.chance(0.3)) {
      const a = rng.range(0, Math.PI * 2);
      const r = R * Math.sqrt(rng.next());
      p = { x: Math.cos(a) * r, y: rng.gauss() * 8, z: Math.sin(a) * r };
    } else {
      const c = rng.pick(clumps);
      p = { x: c.x + rng.gauss() * 14, y: c.y + rng.gauss() * 6, z: c.z + rng.gauss() * 14 };
    }
    if (out.every((q) => dist3(p, q) >= CONFIG.minStarSpacing)) out.push(p);
  }
  return out;
}

function makePlanet(rng, star, index, type) {
  const colonisable = PLANET_TYPES[type].colonisable !== false;
  return {
    name: `${star.name} ${ROMAN[index]}`,
    type,
    size: colonisable ? rng.weighted([['petite', 3], ['moyenne', 4], ['grande', 2]]) : null,
    deposits: rollDeposits(rng, type),
    ruins: false,
    inhabitedBy: null,
  };
}

function rollDeposits(rng, type) {
  const base = PLANET_TYPES[type].dep;
  const deposits = {};
  for (const r of ['minerais', 'energie', 'biomasse']) {
    const v = base[r] * rng.range(0.4, 1.3) + rng.gauss() * 0.5;
    deposits[r] = Math.max(0, Math.min(3, Math.round(v)));
  }
  deposits.velarine = rng.chance(base.velarine * 0.35) ? (rng.chance(0.25) ? 2 : 1) : 0;
  return deposits;
}

function generatePlanets(rng, star) {
  const count = rng.weighted([[0, 1], [1, 2], [2, 3], [3, 4], [4, 4], [5, 3], [6, 2]]);
  const planets = [];
  for (let i = 0; i < count; i++) {
    const f = count === 1 ? 0.5 : i / (count - 1);
    const zone = f < 0.3 ? 'inner' : f < 0.7 ? 'middle' : 'outer';
    planets.push(makePlanet(rng, star, i, rng.weighted(ORBIT_ZONES[zone])));
  }
  return planets;
}

// Le monde d'origine : vers le bord de l'amas, là où les voisins à portée de saut sont nombreux.
function chooseHome(stars) {
  const R = CONFIG.clusterRadius;
  let best = 0;
  let bestScore = -1;
  for (const s of stars) {
    const r = Math.hypot(s.pos.x, s.pos.z);
    if (r < R * 0.55 || r > R * 0.9) continue;
    const score = stars.filter((o) => o !== s && starDistance(o, s) <= CONFIG.jumpRange).length;
    if (score > bestScore) {
      best = s.id;
      bestScore = score;
    }
  }
  return best;
}

function setupHome(rng, star) {
  star.type = 'jaune';
  star.planets = ['volcanique', 'desertique', 'tempere', 'glacee', 'gazeuse'].map((t, i) => makePlanet(rng, star, i, t));
  const home = star.planets[2];
  home.size = 'grande';
  home.deposits.biomasse = Math.max(2, home.deposits.biomasse);
}

function placeRuins(rng, stars, homeId) {
  const candidates = rng.shuffle(stars.filter((s) => s.id !== homeId && s.planets.some(isColonisable)));
  for (const star of candidates.slice(0, CONFIG.ruinCount)) {
    rng.pick(star.planets.filter(isColonisable)).ruins = true;
    star.hasRuins = true;
    // La Vélarine se trouve plus souvent près des ruines.
    for (const p of star.planets) {
      if (p.deposits.velarine === 0 && rng.chance(0.3)) p.deposits.velarine = 1;
    }
  }
}

// Les espèces rivales s'installent le plus loin possible du joueur et les unes des autres.
function placeRivals(stars, homeId) {
  const taken = [stars[homeId]];
  for (const species of RIVAL_SPECIES) {
    let best = null;
    let bestDist = -1;
    for (const s of stars) {
      if (taken.includes(s) || !s.planets.some(isColonisable)) continue;
      const d = Math.min(...taken.map((t) => starDistance(s, t)));
      if (d > bestDist) {
        best = s;
        bestDist = d;
      }
    }
    if (!best) break;
    best.rival = species;
    best.planets.find(isColonisable).inhabitedBy = species;
    taken.push(best);
  }
}

// Les courants gravitationnels relient des étoiles lointaines. Ils garantissent aussi
// que tout l'amas reste accessible avec la portée de saut de départ.
function createCurrents(rng, stars, homeId) {
  const parent = stars.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => (parent[find(a)] = find(b));
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      if (starDistance(stars[i], stars[j]) <= CONFIG.jumpRange) union(i, j);
    }
  }

  const currents = [];
  const addCurrent = (a, b) => {
    currents.push({ id: currents.length, a, b, known: false });
    union(a, b);
  };

  for (;;) {
    const root = find(homeId);
    let bestPair = null;
    let bestDist = Infinity;
    for (const a of stars) {
      if (find(a.id) !== root) continue;
      for (const b of stars) {
        if (find(b.id) === root) continue;
        const d = starDistance(a, b);
        if (d < bestDist) {
          bestDist = d;
          bestPair = [a.id, b.id];
        }
      }
    }
    if (!bestPair) break;
    addCurrent(...bestPair);
  }

  const hasCurrent = (id) => currents.some((c) => c.a === id || c.b === id);
  let added = 0;
  for (let attempt = 0; attempt < 400 && added < CONFIG.extraCurrents; attempt++) {
    const a = rng.pick(stars);
    const b = rng.pick(stars);
    const d = starDistance(a, b);
    if (a === b || d < 35 || d > 75 || hasCurrent(a.id) || hasCurrent(b.id)) continue;
    addCurrent(a.id, b.id);
    added++;
  }
  return currents;
}
