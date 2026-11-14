// Réglages de la partie (docs/plan-difficulte.md) : niveau de difficulté, taille de carte, abondance des ressources
// et nombre d'adversaires. Ils se choisissent au début et ne changent plus. Une valeur inconnue est remplacée par la
// valeur par défaut (Standard, carte moyenne, ressources normales, 4 adversaires).
import { DIFFICULTY, MAP_SIZES, RESOURCE_LEVELS } from './config.js';
import { normalizeRivals } from './species.js';

const known = (table, key) => typeof key === 'string' && Object.hasOwn(table, key);

export const validDifficulty = (key) => (known(DIFFICULTY.levels, key) ? key : DIFFICULTY.default);
export const validMapSize = (key) => (known(MAP_SIZES.sizes, key) ? key : MAP_SIZES.default);
export const validResourceLevel = (key) => (known(RESOURCE_LEVELS.levels, key) ? key : RESOURCE_LEVELS.default);

// Réglages complets et valides, contraintes du niveau appliquées (en Redoutable : petite carte, 7 adversaires, ressources rares).
export function gameSettings({ difficulty, mapSize, resourceLevel, rivals } = {}) {
  const settings = {
    difficulty: validDifficulty(difficulty),
    mapSize: validMapSize(mapSize),
    resourceLevel: validResourceLevel(resourceLevel),
    rivals: normalizeRivals(rivals),
  };
  return { ...settings, ...imposedSettings(settings.difficulty) };
}

// Réglages imposés par un niveau ({} si aucun) : l'écran de nouvelle partie les grisera.
export const imposedSettings = (difficulty) => DIFFICULTY.levels[validDifficulty(difficulty)].imposed ?? {};

export const difficultyLevel = (key) => DIFFICULTY.levels[validDifficulty(key)];
export const mapSettings = (key) => MAP_SIZES.sizes[validMapSize(key)];
export const resourceSettings = (key) => RESOURCE_LEVELS.levels[validResourceLevel(key)];

// Levier des rivaux au niveau de la partie (étape 3) : un multiplicateur (growth, power, margin…) ou une valeur
// (graceDays, fleetEvery, maxFleets, fleetSizeMax). Sans niveau (ancienne partie, tests), c'est Standard : le jeu d'avant.
export const lever = (game, key) => difficultyLevel(game?.difficulty)[key];
