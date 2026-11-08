// Combat (voir docs/plan-combat.md) : résolution automatique, jour après jour, quand deux camps
// ennemis se trouvent dans le même système. Réglages dans config.js (COMBAT).
import { COMBAT } from './config.js';

// Une unité : { attack, defense, damage } (vaisseau, flotte ou défense de colonie). Elle tombe quand
// ses dégâts atteignent sa résistance.
export const toughness = (unit) => unit.defense * COMBAT.hpPerDefense;
export const alive = (unit) => unit.damage < toughness(unit);

// Dégâts d'un camp pour une journée, avec une part de hasard.
function volley(units, rng) {
  const total = units.filter(alive).reduce((sum, u) => sum + u.attack, 0);
  return total * (1 - COMBAT.spread + rng.next() * 2 * COMBAT.spread);
}

// Les dégâts frappent d'abord l'unité la plus abîmée, puis la suivante : on achève avant de disperser.
function absorb(units, amount) {
  let left = amount;
  const targets = units.filter(alive).sort((a, b) => toughness(a) - a.damage - (toughness(b) - b.damage));
  for (const unit of targets) {
    if (left <= 0) break;
    const room = toughness(unit) - unit.damage;
    const hit = Math.min(room, left);
    unit.damage += hit;
    left -= hit;
  }
}

// Une journée de combat entre deux camps (tableaux d'unités, modifiés sur place). Les deux camps
// tirent en même temps. Renvoie les unités tombées ce jour-là.
export function fightDay(sideA, sideB, rng) {
  const before = new Set([...sideA, ...sideB].filter(alive));
  const toB = volley(sideA, rng);
  const toA = volley(sideB, rng);
  absorb(sideB, toB);
  absorb(sideA, toA);
  return [...before].filter((u) => !alive(u));
}

// Combat complet, pour les tests et l'équilibrage : jusqu'à ce qu'un camp tombe ou que le temps passe.
export function fightToEnd(sideA, sideB, rng, maxDays = COMBAT.maxBattleDays) {
  let days = 0;
  while (days < maxDays && sideA.some(alive) && sideB.some(alive)) {
    fightDay(sideA, sideB, rng);
    days++;
  }
  const a = sideA.some(alive);
  const b = sideB.some(alive);
  return { days, winner: a && !b ? 'A' : b && !a ? 'B' : null };
}
