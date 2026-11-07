// Diplomatie (voir docs/plan-diplomatie.md) : note de chaque empire envers le joueur et attitude.
// Réglages dans config.js (DIPLOMACY). Seuls les empires rencontrés réagissent à ce que fait le joueur.
import { DIPLOMACY } from './config.js';
import { starDistance } from './galaxy.js';

export const startRelation = (species) => DIPLOMACY.startRelation[species];

// La note est arrondie : les seuils de config.js sont des entiers.
export function attitudeOf(relation) {
  const note = Math.round(relation);
  return DIPLOMACY.attitudes.find((a) => note >= a.min);
}

// Espèces rivales d'une espèce (table fixe, dans les deux sens).
export function rivalsOf(species) {
  return DIPLOMACY.rivalries.flatMap(([a, b]) => (a === species ? [b] : b === species ? [a] : []));
}

export function changeRelation(empire, amount) {
  empire.relation = Math.max(-100, Math.min(100, empire.relation + amount));
}

// Colonies du joueur proches du territoire de cet empire.
function nearColonies(game, empire) {
  const own = empire.colonies.map((c) => game.stars[c.starId]);
  return game.colonies.filter((colony) => {
    const star = game.stars[colony.starId];
    return own.some((s) => starDistance(s, star) <= DIPLOMACY.proximityRange);
  }).length;
}

// Un jour entier de relations : la note revient vers sa valeur de départ, et baisse si le joueur est trop près.
function relationDay(game) {
  for (const empire of game.empires) {
    if (!empire.met) continue;
    const pressure = Math.min(DIPLOMACY.proximityMax, nearColonies(game, empire) * DIPLOMACY.proximityPerColony);
    changeRelation(empire, (startRelation(empire.species) - empire.relation) * DIPLOMACY.returnPerDay - pressure);
  }
}

// Calculé par jour entier, pour donner le même résultat quelle que soit la vitesse du jeu.
export function tickRelations(game, days) {
  const steps = Math.floor(game.time) - Math.floor(game.time - days);
  for (let i = 0; i < steps; i++) relationDay(game);
}

// Une fouille de ruines plaît ou déplaît selon l'espèce.
export function reactToDig(game) {
  for (const empire of game.empires) {
    if (empire.met) changeRelation(empire, DIPLOMACY.digReaction[empire.species] ?? 0);
  }
}
