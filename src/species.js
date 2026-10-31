// Espèce de la partie en cours : bonus et milieu de prédilection (une seule partie par page,
// comme research.js). Les données sont dans config.js (SPECIES).
import { SPECIES, DEFAULT_SPECIES } from './config.js';

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

// Espèces proposées à l'écran de choix (sans le profil neutre des anciennes parties).
export const playableSpecies = () => Object.entries(SPECIES).filter(([, s]) => !s.hidden).map(([key]) => key);
