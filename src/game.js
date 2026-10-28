// État de la partie et règles d'exploration : sondes, temps qui s'écoule, niveaux de connaissance.
// Le temps est continu et compté en jours ; la partie avance en temps réel, avec une pause.
//   Niveau 0 : inconnu (invisible)
//   Niveau 1 : lueur repérée
//   Niveau 2 : système survolé (une sonde est passée, seules les grosses planètes sont vues)
//   Niveau 3 : système analysé (toutes les planètes et leurs gisements sont connus)
import { CONFIG } from './config.js';
import { generateCluster, starDistance, STAR_TYPES } from './galaxy.js';
import { SHIP_NAMES, SHIP_ACCENTS } from './ships.js';

export const LEVEL_LABELS = ['Inconnu', 'Lueur repérée', 'Système survolé', 'Système analysé'];

export function createGame(seed) {
  const galaxy = generateCluster(seed);
  const game = {
    seed,
    time: 0, // en jours
    speedIndex: 0,
    paused: true,
    stars: galaxy.stars,
    currents: galaxy.currents,
    homeId: galaxy.homeId,
    probes: [],
    log: [],
    selectedStarId: galaxy.homeId,
    selectedProbeId: 0,
  };
  // Chaque sonde a son propre vaisseau (forme tirée de sa graine), son nom et sa couleur.
  for (let i = 0; i < CONFIG.probeCount; i++) {
    const shipName = SHIP_NAMES[(seed + i) % SHIP_NAMES.length];
    game.probes.push({
      id: i,
      name: `Sonde ${shipName}`,
      shipSeed: seed * 7919 + i * 104729,
      accent: SHIP_ACCENTS[i % SHIP_ACCENTS.length],
      registry: `SX-${String((seed * 13 + i * 271) % 1000).padStart(3, '0')}`,
      starId: game.homeId,
      state: 'idle',
      toId: null,
      fromId: null,
      distance: 0,
      speed: 0,
      progress: 0,
      daysLeft: 0,
    });
  }
  const home = game.stars[game.homeId];
  home.level = 3;
  sense(game, home);
  revealCurrents(game, home, false);
  addLog(game, `Vos ${CONFIG.probeCount} sondes attendent en orbite de ${home.name}, votre monde d'origine.`);
  return game;
}

export const currentDay = (game) => Math.floor(game.time) + 1;

// Jours restants avant la fin du voyage ou de l'analyse, arrondis au jour supérieur.
export function daysLeft(probe) {
  if (probe.state === 'travel') return Math.max(1, Math.ceil((probe.distance - probe.progress) / probe.speed));
  if (probe.state === 'analyse') return Math.max(1, Math.ceil(probe.daysLeft));
  return 0;
}

// Avancement de 0 à 1 (voyage ou analyse), pour l'affichage.
export function probeProgress(probe) {
  if (probe.state === 'travel') return Math.min(1, probe.progress / probe.distance);
  if (probe.state === 'analyse') return 1 - probe.daysLeft / CONFIG.analyseDays;
  return 0;
}

export function starLabel(star) {
  return star.level >= 2 ? star.name : 'une lueur inconnue';
}

function addLog(game, text, kind = 'info') {
  game.log.push({ day: currentDay(game), text, kind });
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

// Peut-on envoyer cette sonde vers cette étoile ? Renvoie { ok, days, speed, distance, viaCurrent } ou { ok: false, reason }.
export function canReach(game, probe, star) {
  if (probe.state !== 'idle') return { ok: false, reason: `${probe.name} est occupée.` };
  if (star.level < 1) return { ok: false, reason: 'Étoile inconnue.' };
  if (probe.starId === star.id) return { ok: false, reason: `${probe.name} est déjà ici.` };
  const distance = starDistance(game.stars[probe.starId], star);
  const viaCurrent = !!currentBetween(game, probe.starId, star.id);
  if (!viaCurrent && distance > CONFIG.jumpRange) {
    return { ok: false, reason: `Hors de portée de ${probe.name} : ${Math.round(distance)} al (portée ${CONFIG.jumpRange} al).` };
  }
  const speed = CONFIG.probeSpeed * (viaCurrent ? CONFIG.currentSpeedFactor : 1);
  return { ok: true, distance, speed, days: Math.max(1, Math.ceil(distance / speed)), viaCurrent };
}

export function reachableStars(game, probe) {
  return game.stars.filter((s) => canReach(game, probe, s).ok);
}

export function sendProbe(game, probe, star) {
  const r = canReach(game, probe, star);
  if (!r.ok) return false;
  Object.assign(probe, { state: 'travel', fromId: probe.starId, toId: star.id, distance: r.distance, speed: r.speed, progress: 0 });
  addLog(game, `${probe.name} part vers ${starLabel(star)} (${plural(r.days, 'jour')}${r.viaCurrent ? ', par le courant' : ''}).`);
  return true;
}

export function canAnalyse(probe, star) {
  return probe.state === 'idle' && probe.starId === star.id && star.level === 2;
}

export function startAnalysis(game, probe) {
  const star = game.stars[probe.starId];
  if (!canAnalyse(probe, star)) return false;
  Object.assign(probe, { state: 'analyse', daysLeft: CONFIG.analyseDays });
  addLog(game, `${probe.name} commence l'analyse de ${star.name}.`);
  return true;
}

// Fait avancer le temps de `days` jours. Renvoie true si un événement a eu lieu
// (arrivée, fin d'analyse) ou si un nouveau jour a commencé.
export function tick(game, days) {
  const dayBefore = currentDay(game);
  game.time += days;
  let changed = currentDay(game) !== dayBefore;
  for (const probe of game.probes) {
    if (probe.state === 'travel') {
      probe.progress += probe.speed * days;
      if (probe.progress >= probe.distance) {
        arrive(game, probe);
        changed = true;
      }
    } else if (probe.state === 'analyse') {
      probe.daysLeft -= days;
      if (probe.daysLeft <= 0) {
        completeAnalysis(game, probe);
        changed = true;
      }
    }
  }
  return changed;
}

// Au premier passage, une sonde ne repère que les grosses planètes (géantes gazeuses,
// grandes planètes, et une moyenne sur deux) ; l'analyse révèle toutes les autres.
function isDetectable(planet, index) {
  return planet.type === 'gazeuse' || planet.size === 'grande' || (planet.size === 'moyenne' && index % 2 === 0);
}

export function visiblePlanets(star) {
  if (star.level >= 3) return star.planets;
  if (star.level < 2) return [];
  const detected = star.planets.filter(isDetectable);
  return detected.length || star.planets.length === 0 ? detected : [star.planets[0]];
}

function arrive(game, probe) {
  const star = game.stars[probe.toId];
  Object.assign(probe, { starId: star.id, state: 'idle', fromId: null, toId: null });
  if (star.level < 2) {
    star.level = 2;
    const n = visiblePlanets(star).length;
    const found = n === 0 ? 'aucune planète détectée' : `${plural(n, 'planète')} ${n > 1 ? 'détectées' : 'détectée'}`;
    addLog(game, `${probe.name} atteint ${star.name} (${STAR_TYPES[star.type].label.toLowerCase()}) : ${found}.`, 'discovery');
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
  const hidden = star.planets.length - visiblePlanets(star).length;
  star.level = 3;
  probe.state = 'idle';
  const parts = [`Analyse de ${star.name} terminée.`];
  if (hidden > 0) parts.push(hidden > 1 ? `${hidden} planètes cachées découvertes.` : '1 planète cachée découverte.');
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
