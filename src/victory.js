// Victoire et fin de partie (voir docs/plan-victoire.md). Règles seulement : l'affichage est ailleurs.
// Victoire : tes colonies occupent VICTORY.share des systèmes colonisables (expansion), ou plus
// aucun empire rival n'existe (élimination). Défaite : plus aucune colonie, ni Arche ni vaisseau
// capable d'en fonder une. En Ardu et Redoutable seulement, un rival gagne (défaite du joueur) quand il occupe la part
// des systèmes colonisables fixée par le niveau (DIFFICULTY.rivalShare, docs/plan-difficulte.md, étape 6). Perdre son
// monde natal n'est pas une défaite à lui seul.
import { SPECIES, VICTORY } from './config.js';
import { SHIP_KINDS, currentDay } from './game.js';
import { lever } from './difficulty.js';
import { rivalInfo } from './species.js';

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

// Seuil de victoire d'un rival au niveau de la partie (part des systèmes colonisables), ou null s'il ne peut pas gagner
// (Découverte, Standard, ancienne partie sans niveau).
export const rivalGoal = (game) => (lever(game, 'rivalCanWin') && lever(game, 'rivalShare')) || null;

// Part des systèmes colonisables occupée par chaque empire en vie, la plus grande d'abord : [{ empire, owned, share }].
export function rivalShares(game) {
  const counted = new Set(colonizableStars(game).map((s) => s.id));
  return aliveEmpires(game)
    .map((empire) => {
      const owned = new Set(empire.colonies.map((c) => c.starId).filter((id) => counted.has(id))).size;
      return { empire, owned, share: counted.size ? owned / counted.size : 0 };
    })
    .sort((a, b) => b.share - a.share);
}

// Le plus grand rival déjà rencontré ({ empire, owned, share, goal }), seulement si un rival peut gagner ; sinon null.
export function leadingKnownRival(game) {
  const goal = rivalGoal(game);
  const first = goal && rivalShares(game).find((r) => r.empire.met);
  return first ? { ...first, goal } : null;
}

// Nom de l'empire avec son article : « le Concordat orrhaïde », « l'Hégémonie vaskhar ». Majuscule : capital = true.
const FEMININE = new Set(['Hégémonie', 'Confluence', 'Ligue', 'Archive', 'Caravane']);
export function empireName(species, capital = false) {
  const title = SPECIES[species] ? rivalInfo(species).empire : 'un empire rival';
  const first = title.split(' ')[0];
  const article = !SPECIES[species] ? '' : /^[aeiouyhéèêâîôûAEIOUYHÉ]/.test(first) ? "l'" : FEMININE.has(first) ? 'la ' : 'le ';
  const name = article + title;
  return capital ? name[0].toUpperCase() + name.slice(1) : name;
}

// La partie est-elle finie ? Renvoie { result, reason } (et species pour un rival qui domine) ou null.
// La défaite « tout perdu » passe avant : sans colonie, la part des systèmes est nulle de toute façon.
// Si le joueur atteint sa victoire le même jour qu'un rival son seuil, la victoire du joueur passe avant :
// elle est testée d'abord.
export function endState(game) {
  const canFound = game.ships.some((s) => SHIP_KINDS[s.kind].found);
  if (!game.colonies.length && !canFound) return { result: 'defaite', reason: 'tout-perdu' };
  if (game.colonies.length) {
    const p = progress(game);
    if (p.share >= p.goal) return { result: 'victoire', reason: 'expansion' };
    if (p.rivalsTotal > 0 && p.rivalsLeft === 0) return { result: 'victoire', reason: 'elimination' };
  }
  // Un rival domine l'amas (Ardu, Redoutable), même s'il n'a pas encore été rencontré.
  const goal = rivalGoal(game);
  const top = goal && rivalShares(game)[0];
  if (top && top.share >= goal) return { result: 'defaite', reason: 'rival-domine', species: top.empire.species };
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

// Rivaux connus qui approchent de leur seuil (VICTORY.rivalWarning de celui-ci) pour la première fois : le conseiller
// prévient une seule fois par empire (espèces notées dans game.rivalWarnings, gardé dans la sauvegarde).
export function newRivalWarnings(game) {
  const goal = rivalGoal(game);
  if (!goal) return [];
  if (!Array.isArray(game.rivalWarnings)) game.rivalWarnings = [];
  const warned = rivalShares(game).filter((r) => r.empire.met && r.share >= goal * VICTORY.rivalWarning && !game.rivalWarnings.includes(r.empire.species));
  game.rivalWarnings.push(...warned.map((r) => r.empire.species));
  return warned.map((r) => ({ ...r, goal }));
}

// Avertissements lus dans une sauvegarde : des espèces connues seulement ; ancienne sauvegarde : aucun.
export const validRivalWarnings = (saved) => (Array.isArray(saved) ? [...new Set(saved.filter((k) => typeof k === 'string' && Object.hasOwn(SPECIES, k)))] : []);

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
  const reasons = { victoire: ['expansion', 'elimination'], defaite: ['tout-perdu', 'rival-domine'] };
  if (!reasons[saved.result]?.includes(saved.reason)) return null;
  const ended = { result: saved.result, reason: saved.reason, day: Number.isFinite(saved.day) ? saved.day : 0 };
  // Rival qui domine : son espèce, si elle est connue (sinon l'écran dit « un empire rival »).
  if (saved.reason === 'rival-domine' && typeof saved.species === 'string' && Object.hasOwn(SPECIES, saved.species)) ended.species = saved.species;
  return ended;
}
