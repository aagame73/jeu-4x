// Surface des planètes : un plateau d'hexagones (coordonnées axiales q, r) avec des terrains,
// des gisements et parfois des ruines. Rayon 2, 3 ou 4 selon la taille : 19, 37 ou 61 cases.
import { createRng } from './rng.js';

export const TERRAINS = {
  plaine: { label: 'Plaine', color: '#8fb35a', height: 0.34 },
  foret: { label: 'Forêt', color: '#3f7a3a', height: 0.38 },
  marais: { label: 'Marais', color: '#5d6b3c', height: 0.26 },
  desert: { label: 'Désert', color: '#d6b26a', height: 0.34 },
  glace: { label: 'Glace', color: '#dce8f2', height: 0.44 },
  ocean: { label: 'Océan', color: '#2a5f94', height: 0.12 },
  volcanique: { label: 'Volcanique', color: '#4a3832', height: 0.5 },
  toxique: { label: 'Toxique', color: '#9fae3a', height: 0.3 },
  ruines: { label: 'Ruines des Veilleurs', color: '#8a8478', height: 0.4 },
};

const TERRAIN_MIX = {
  tempere: [['plaine', 3], ['foret', 3], ['ocean', 2], ['marais', 1], ['desert', 1], ['volcanique', 0.6]],
  oceanique: [['ocean', 6], ['marais', 2], ['plaine', 2], ['volcanique', 0.5]],
  marecageuse: [['marais', 5], ['foret', 3], ['ocean', 2]],
  desertique: [['desert', 6], ['plaine', 2], ['volcanique', 1]],
  volcanique: [['volcanique', 5], ['desert', 3]],
  toxique: [['toxique', 6], ['desert', 2], ['volcanique', 1]],
  glacee: [['glace', 6], ['plaine', 1], ['desert', 1], ['volcanique', 0.6]],
};

// Terrains où chaque gisement peut apparaître, par ordre de préférence.
const DEPOSIT_TERRAINS = {
  minerais: ['volcanique', 'desert', 'glace', 'toxique', 'plaine', 'foret'],
  energie: ['volcanique', 'desert', 'toxique', 'plaine', 'glace'],
  biomasse: ['foret', 'marais', 'plaine', 'ocean'],
  velarine: ['ruines', 'volcanique', 'toxique', 'desert', 'glace', 'plaine'],
  eau: ['glace', 'ocean', 'marais', 'plaine'],
  deuterium: ['ocean', 'glace', 'marais'],
};

export const SURFACE_RADIUS = { petite: 2, moyenne: 3, grande: 4 };
export const HEX_DIRECTIONS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export const hexKey = (q, r) => `${q},${r}`;
export const hexDistance = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

export function neighbors(surface, tile) {
  return HEX_DIRECTIONS.map(([dq, dr]) => surface.byKey.get(hexKey(tile.q + dq, tile.r + dr))).filter(Boolean);
}

export function generateSurface(seed, planet) {
  const rng = createRng(seed);
  const radius = SURFACE_RADIUS[planet.size];
  const tiles = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      tiles.push({ index: tiles.length, q, r, terrain: rng.weighted(TERRAIN_MIX[planet.type]), deposit: null, building: null, yield: 1 });
    }
  }
  const surface = { radius, tiles, byKey: new Map(tiles.map((t) => [hexKey(t.q, t.r), t])) };

  // Deux passes de lissage : les terrains se regroupent en régions.
  for (let pass = 0; pass < 2; pass++) {
    const next = tiles.map((t) => {
      if (!rng.chance(0.45)) return t.terrain;
      const counts = {};
      for (const n of neighbors(surface, t)) counts[n.terrain] = (counts[n.terrain] || 0) + 1;
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? t.terrain;
    });
    tiles.forEach((t, i) => (t.terrain = next[i]));
  }

  if (planet.ruins) {
    for (const t of rng.shuffle(tiles.filter((t) => t.terrain !== 'ocean')).slice(0, rng.int(1, 2))) t.terrain = 'ruines';
  }

  // Un niveau de gisement planétaire = une case de gisement ; richesse de 1 à 3.
  for (const [resource, level] of Object.entries(planet.deposits)) {
    for (let i = 0; i < level; i++) {
      const free = tiles.filter((t) => !t.deposit && DEPOSIT_TERRAINS[resource].includes(t.terrain));
      if (!free.length) break;
      const best = Math.min(...free.map((t) => DEPOSIT_TERRAINS[resource].indexOf(t.terrain)));
      const pool = rng.chance(0.7) ? free.filter((t) => DEPOSIT_TERRAINS[resource].indexOf(t.terrain) === best) : free;
      rng.pick(pool).deposit = { resource, richness: Math.max(1, Math.min(3, level + rng.int(-1, 1))) };
    }
  }
  return surface;
}
