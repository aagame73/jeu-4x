// Victoire et fin de partie (voir docs/plan-victoire.md). Règles seulement : l'affichage est ailleurs.
// Victoire : tes colonies occupent VICTORY.share des systèmes colonisables (expansion), ou plus
// aucun empire rival n'existe (élimination). Défaite : plus aucune colonie, ni Arche ni vaisseau
// capable d'en fonder une. Aucun rival ne gagne pour l'instant (à revoir avec la difficulté).
import { VICTORY } from './config.js';
import { SHIP_KINDS, currentDay } from './game.js';

// Systèmes qui comptent : ceux qui ont au moins une planète où une colonie est possible.
export function colonizableStars(game) {
  return game.stars.filter((star) => star.planets.some((p) => p.size));
}

// Systèmes où le joueur a au moins une colonie (un système partagé avec un rival compte pour lui).
export function playerStars(game) {
  return new Set(game.colonies.map((c) => c.starId));
}

// Empires rivaux encore en vie : il leur reste au moins une colonie.
export const aliveEmpires = (game) => game.empires.filter((e) => e.colonies.length > 0);

// Où en est le joueur : part des systèmes (0 à 1), objectif, empires restants.
export function progress(game) {
  const counted = colonizableStars(game);
  const mine = playerStars(game);
  const owned = counted.filter((s) => mine.has(s.id)).length;
  return {
    owned,
    total: counted.length,
    share: counted.length ? owned / counted.length : 0,
    goal: VICTORY.share,
    rivalsLeft: aliveEmpires(game).length,
    rivalsTotal: game.empires.length,
  };
}

// La partie est-elle finie ? Renvoie { result, reason } ou null. La défaite passe avant : sans
// colonie, la part des systèmes est nulle de toute façon.
export function endState(game) {
  const canFound = game.ships.some((s) => SHIP_KINDS[s.kind].found);
  if (!game.colonies.length && !canFound) return { result: 'defaite', reason: 'tout-perdu' };
  if (!game.colonies.length) return null;
  const p = progress(game);
  if (p.share >= p.goal) return { result: 'victoire', reason: 'expansion' };
  if (p.rivalsTotal > 0 && p.rivalsLeft === 0) return { result: 'victoire', reason: 'elimination' };
  return null;
}

// Étapes de l'expansion franchies pour la première fois (le conseiller les annonce une seule fois).
export function newMilestones(game) {
  if (!game.colonies.length || game.milestones.length >= VICTORY.milestones.length) return [];
  const { share } = progress(game);
  const reached = VICTORY.milestones.filter((m) => share >= m && !game.milestones.includes(m));
  game.milestones.push(...reached);
  return reached;
}

// Étapes lues dans une sauvegarde : seulement celles de config.js.
export const validMilestones = (saved) => (Array.isArray(saved) ? VICTORY.milestones.filter((m) => saved.includes(m)) : []);

// Appelé après chaque avancée du temps : fige la fin de partie une seule fois.
export function checkEnd(game) {
  if (game.ended) return null;
  const end = endState(game);
  if (!end) return null;
  game.ended = { ...end, day: currentDay(game) };
  game.paused = true;
  return game.ended;
}

// Bilan des combats, pour l'écran de fin : compté à partir des événements de combat.js.
export const emptyRecord = () => ({ fleetsDestroyed: 0, coloniesTaken: 0, coloniesLost: 0, shipsLost: 0 });
const RECORDED = { 'fleet-lost': 'fleetsDestroyed', 'colony-won': 'coloniesTaken', 'colony-lost': 'coloniesLost', 'ship-lost': 'shipsLost' };
export function recordEvent(game, event) {
  const key = RECORDED[event.type];
  if (key) game.record[key]++;
}
export function validRecord(saved) {
  const record = emptyRecord();
  for (const key of Object.keys(record)) if (Number.isInteger(saved?.[key]) && saved[key] >= 0) record[key] = saved[key];
  return record;
}

// Valeur lue dans une sauvegarde : une fin de partie bien formée, ou null.
export function validEnded(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const reasons = { victoire: ['expansion', 'elimination'], defaite: ['tout-perdu'] };
  if (!reasons[saved.result]?.includes(saved.reason)) return null;
  return { result: saved.result, reason: saved.reason, day: Number.isFinite(saved.day) ? saved.day : 0 };
}
