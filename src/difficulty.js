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

// Nom des réglages dans l'adresse : ?niveau=ardu&carte=grande&ressources=abondantes&rivaux=5.
const URL_NAMES = { difficulty: 'niveau', mapSize: 'carte', resourceLevel: 'ressources', rivals: 'rivaux' };

// Réglages lus dans l'adresse (URLSearchParams) ; absents ou inconnus : valeurs par défaut.
export function settingsFromParams(params) {
  const get = (key) => params.get(URL_NAMES[key]) ?? undefined;
  return gameSettings({ difficulty: get('difficulty'), mapSize: get('mapSize'), resourceLevel: get('resourceLevel'), rivals: Number(get('rivals')) });
}

// Réglages écrits pour l'adresse, dans le même format.
export function settingsQuery(settings) {
  const s = gameSettings(settings);
  return Object.entries(URL_NAMES)
    .map(([key, name]) => `${name}=${s[key]}`)
    .join('&');
}

// Rappel lisible des réglages (bilan de fin) : « Ardu · carte grande · ressources rares · 5 adversaires ».
export function settingsLabel({ difficulty, mapSize, resourceLevel, rivals }) {
  const n = normalizeRivals(rivals);
  return [
    difficultyLevel(difficulty).label,
    `carte ${mapSettings(mapSize).label.toLowerCase()}`,
    `ressources ${resourceSettings(resourceLevel).label.toLowerCase()}`,
    `${n} adversaire${n > 1 ? 's' : ''}`,
  ].join(' · ');
}

// Levier des rivaux au niveau de la partie (étape 3) : un multiplicateur (growth, power, margin…) ou une valeur
// (graceDays, fleetEvery, maxFleets, fleetSizeMax). Sans niveau (ancienne partie, tests), c'est Standard : le jeu d'avant.
export const lever = (game, key) => difficultyLevel(game?.difficulty)[key];
