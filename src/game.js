// État de la partie et règles d'exploration : sondes, tours, niveaux de connaissance.
//   Niveau 0 : inconnu (invisible)
//   Niveau 1 : lueur repérée
//   Niveau 2 : planètes repérées (une sonde est passée)
//   Niveau 3 : composition connue (une sonde a analysé le système)
import { CONFIG } from './config.js';
import { generateCluster, starDistance, STAR_TYPES } from './galaxy.js';

export const LEVEL_LABELS = ['Inconnu', 'Lueur repérée', 'Planètes repérées', 'Composition connue'];

export function createGame(seed) {
  const galaxy = generateCluster(seed);
  const game = {
    seed,
    turn: 1,
    stars: galaxy.stars,
    currents: galaxy.currents,
    homeId: galaxy.homeId,
    probes: [],
    log: [],
    selectedStarId: galaxy.homeId,
    selectedProbeId: 0,
  };
  for (let i = 0; i < CONFIG.probeCount; i++) {
    game.probes.push({ id: i, name: `Sonde ${i + 1}`, starId: game.homeId, state: 'idle', toId: null, fromId: null, totalTurns: 0, turnsLeft: 0 });
  }
  const home = game.stars[game.homeId];
  home.level = 3;
  sense(game, home);
  revealCurrents(game, home, false);
  addLog(game, `Vos ${CONFIG.probeCount} sondes attendent en orbite de ${home.name}, votre monde d'origine.`);
  return game;
}

export function starLabel(star) {
  return star.level >= 2 ? star.name : 'une lueur inconnue';
}

function addLog(game, text, kind = 'info') {
  game.log.push({ turn: game.turn, text, kind });
}

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Une sonde repère les étoiles proches sous forme de lueurs.
function sense(game, star) {
  let count = 0;
  for (const s of game.stars) {
    if (s.level === 0 && starDistance(s, star) <= CONFIG.sensorRange) {
      s.level = 1;
      count++;
    }
  }
  return count;
}

function revealCurrents(game, star, log = true) {
  for (const c of game.currents) {
    if (c.known || (c.a !== star.id && c.b !== star.id)) continue;
    c.known = true;
    const other = game.stars[c.a === star.id ? c.b : c.a];
    if (other.level === 0) other.level = 1;
    if (log) addLog(game, `Un courant gravitationnel relie ${star.name} à ${starLabel(other)}.`, 'discovery');
  }
}

export function currentBetween(game, a, b) {
  return game.currents.find((c) => c.known && ((c.a === a && c.b === b) || (c.a === b && c.b === a)));
}

// Peut-on envoyer cette sonde vers cette étoile ? Renvoie { ok, turns, viaCurrent } ou { ok: false, reason }.
export function canReach(game, probe, star) {
  if (probe.state !== 'idle') return { ok: false, reason: `${probe.name} est occupée.` };
  if (star.level < 1) return { ok: false, reason: 'Étoile inconnue.' };
  if (probe.starId === star.id) return { ok: false, reason: `${probe.name} est déjà ici.` };
  if (currentBetween(game, probe.starId, star.id)) return { ok: true, turns: 1, viaCurrent: true };
  const d = starDistance(game.stars[probe.starId], star);
  if (d > CONFIG.jumpRange) {
    return { ok: false, reason: `Hors de portée de ${probe.name} : ${Math.round(d)} al (portée ${CONFIG.jumpRange} al).` };
  }
  return { ok: true, turns: Math.max(1, Math.ceil(d / CONFIG.probeSpeed)), viaCurrent: false };
}

export function reachableStars(game, probe) {
  return game.stars.filter((s) => canReach(game, probe, s).ok);
}

export function sendProbe(game, probe, star) {
  const r = canReach(game, probe, star);
  if (!r.ok) return false;
  Object.assign(probe, { state: 'travel', fromId: probe.starId, toId: star.id, totalTurns: r.turns, turnsLeft: r.turns });
  addLog(game, `${probe.name} part vers ${starLabel(star)} (${plural(r.turns, 'tour')}${r.viaCurrent ? ', par le courant' : ''}).`);
  return true;
}

export function canAnalyse(probe, star) {
  return probe.state === 'idle' && probe.starId === star.id && star.level === 2;
}

export function startAnalysis(game, probe) {
  const star = game.stars[probe.starId];
  if (!canAnalyse(probe, star)) return false;
  Object.assign(probe, { state: 'analyse', totalTurns: CONFIG.analyseTurns, turnsLeft: CONFIG.analyseTurns });
  addLog(game, `${probe.name} commence l'analyse de ${star.name}.`);
  return true;
}

export function endTurn(game) {
  game.turn++;
  for (const probe of game.probes) {
    if (probe.state === 'idle') continue;
    probe.turnsLeft--;
    if (probe.turnsLeft > 0) continue;
    if (probe.state === 'travel') arrive(game, probe);
    else completeAnalysis(game, probe);
  }
}

function arrive(game, probe) {
  const star = game.stars[probe.toId];
  Object.assign(probe, { starId: star.id, state: 'idle', fromId: null, toId: null });
  if (star.level < 2) {
    star.level = 2;
    const n = star.planets.length;
    addLog(game, `${probe.name} atteint ${star.name} (${STAR_TYPES[star.type].label.toLowerCase()}) : ${n === 0 ? 'aucune planète' : plural(n, 'planète')}.`, 'discovery');
    if (star.rival) addLog(game, `Des signaux artificiels émanent de ${star.name}. Une autre espèce vit ici.`, 'alert');
  } else {
    addLog(game, `${probe.name} arrive à ${star.name}.`);
  }
  const seen = sense(game, star);
  if (seen > 0) addLog(game, `${seen} ${seen > 1 ? 'nouvelles lueurs' : 'nouvelle lueur'} autour de ${star.name}.`);
  revealCurrents(game, star);
}

function completeAnalysis(game, probe) {
  const star = game.stars[probe.starId];
  star.level = 3;
  probe.state = 'idle';
  const parts = [`Analyse de ${star.name} terminée.`];
  const ruins = star.planets.filter((p) => p.ruins);
  const velarine = star.planets.filter((p) => p.deposits.velarine > 0);
  const rich = star.planets.filter((p) => ['minerais', 'energie', 'biomasse'].some((r) => p.deposits[r] === 3));
  if (star.rival) parts.push(`C'est le monde natal des ${star.rival}.`);
  if (ruins.length) parts.push(`Ruines des Veilleurs sur ${ruins.map((p) => p.name).join(', ')} !`);
  if (velarine.length) parts.push(`Vélarine sur ${velarine.map((p) => p.name).join(', ')}.`);
  if (rich.length) parts.push(`Gisement riche sur ${rich.map((p) => p.name).join(', ')}.`);
  if (parts.length === 1) parts.push('Rien de remarquable.');
  addLog(game, parts.join(' '), ruins.length || velarine.length ? 'discovery' : 'info');
}

export function stats(game) {
  return {
    seen: game.stars.filter((s) => s.level >= 1).length,
    explored: game.stars.filter((s) => s.level >= 2).length,
    analysed: game.stars.filter((s) => s.level === 3).length,
    total: game.stars.length,
  };
}
