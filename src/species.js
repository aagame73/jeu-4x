// Espèce de la partie en cours : bonus et milieu de prédilection (une seule partie par page,
// comme research.js). Les données sont dans config.js (SPECIES).
import { SPECIES, DEFAULT_SPECIES, RIVALS } from './config.js';

let current = SPECIES[DEFAULT_SPECIES];

export function bindSpecies(key) {
  current = SPECIES[key] ?? SPECIES[DEFAULT_SPECIES];
}

export const currentSpecies = () => current;

// Multiplicateur de l'espèce pour un axe (1 si l'espèce n'a ni force ni faiblesse dessus).
export const speciesBonus = (key) => current.bonuses[key] ?? 1;

// 'favored', 'hostile' ou null pour une planète (une lune habitable compte aussi comme 'lune').
export function speciesHabitat(planet) {
  const types = [planet.type, ...(planet.moonOf !== undefined ? ['lune'] : [])];
  if (types.some((t) => current.habitat.favored.includes(t))) return 'favored';
  if (types.some((t) => current.habitat.hostile.includes(t))) return 'hostile';
  return null;
}

// Les cases de ces terrains produisent +25 % pour l'espèce.
export const isFavoredTerrain = (terrain) => current.favoredTerrains.includes(terrain);

// Bonus additifs (0 par défaut), ex. digArtefacts.
export const speciesExtra = (key) => current.bonuses[key] ?? 0;

const TERRAIN_BONUS = 0.25;
const FACTOR_MIN = 0.5;
const FACTOR_MAX = 1.5;

// Malus d'une colonie sur une planète hostile ; `adapted` = Biosphères adaptatives acquises.
export const hostilePenalty = (adapted) =>
  adapted ? { growth: 0.75, production: 0.05, colonists: 0 } : { growth: 0.5, production: 0.15, colonists: 1 };

// Facteur d'espèce d'une production positive : les bonus s'additionnent (ressource, terrain favori,
// malus hostile) puis le total est borné entre 0,5 et 1,5 (voir docs/plan-especes.md § 11.3).
export function productionFactor(resource, terrain, habitat, adapted = false) {
  let f = speciesBonus(resource) - 1;
  if (terrain && isFavoredTerrain(terrain)) f += TERRAIN_BONUS;
  if (habitat === 'hostile') f -= hostilePenalty(adapted).production;
  return Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, 1 + f));
}

// Vitesse de croissance de la population d'une colonie.
export function growthFactor(habitat, adapted = false) {
  const milieu = habitat === 'favored' ? 1.25 : habitat === 'hostile' ? hostilePenalty(adapted).growth : 1;
  return speciesBonus('growth') * milieu;
}

// Espèces proposées à l'écran de choix (sans le profil neutre des anciennes parties).
export const playableSpecies = () => Object.entries(SPECIES).filter(([, s]) => !s.hidden).map(([key]) => key);

// Nombre de rivaux valide ; toute autre valeur (fichier modifié, adresse) retombe sur le défaut.
export const normalizeRivals = (n) => (Number.isInteger(n) && n >= RIVALS.min && n <= RIVALS.max ? n : RIVALS.default);

// Identité d'un empire rival, à partir de la clé dans star.rival et planet.inhabitedBy.
export function rivalInfo(key) {
  const { label, empire, empireColor } = SPECIES[key];
  return { label, empire, accent: empireColor };
}

// L'identité d'un rival reste inconnue jusqu'à l'analyse de son système (« Signaux artificiels » avant).
export const knownRival = (star, key) => (key && star.level >= 3 ? rivalInfo(key) : null);
