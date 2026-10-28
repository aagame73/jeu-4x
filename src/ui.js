// Interface HTML par-dessus la vue 3D : barre du haut, sondes, fiche du système, journal.
import { CONFIG } from './config.js';
import { STAR_TYPES, PLANET_TYPES, PLANET_SIZES, starDistance } from './galaxy.js';
import { LEVEL_LABELS, canReach, canAnalyse, starLabel, stats } from './game.js';

const RESOURCES = [
  ['minerais', 'Minerais'],
  ['energie', 'Énergie'],
  ['biomasse', 'Biomasse'],
  ['velarine', 'Vélarine'],
];

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

export function createUI(root, game, actions) {
  root.innerHTML = `
    <header class="topbar panel">
      <div class="title">Amas inexploré <span class="tag">prototype</span></div>
      <div class="stats" id="stats"></div>
      <button class="primary" data-action="end-turn">Fin du tour <kbd>Espace</kbd></button>
    </header>
    <aside class="probes panel"><h2>Sondes</h2><div id="probes"></div></aside>
    <aside class="info panel" id="info"></aside>
    <section class="journal panel"><h2>Journal de bord</h2><div id="journal"></div></section>
    <div class="help">Clic : sélectionner · Double-clic : centrer · Glisser : pivoter · Clic droit : déplacer · Molette : zoom · 1 à ${CONFIG.probeCount} : choisir une sonde</div>
  `;
  const $ = (id) => root.querySelector(`#${id}`);

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    el.blur(); // sinon la touche Espace réactiverait le bouton
    const { action, id } = el.dataset;
    if (action === 'end-turn') actions.onEndTurn();
    else if (action === 'select-probe') actions.onSelectProbe(Number(id));
    else if (action === 'send') actions.onSend();
    else if (action === 'analyse') actions.onAnalyse();
    else if (action === 'focus') actions.onFocusStar(Number(id));
  });

  function renderStats() {
    const s = stats(game);
    $('stats').innerHTML = `
      <span>Tour <b>${game.turn}</b></span>
      <span>Systèmes visités <b>${s.explored}</b> / ${s.total}</span>
      <span>Analysés <b>${s.analysed}</b></span>
      <span>Lueurs <b>${s.seen - s.explored}</b></span>
      <span class="muted">Graine ${game.seed}</span>`;
  }

  function probeStatus(probe) {
    if (probe.state === 'travel') return `En route vers ${starLabel(game.stars[probe.toId])} · ${plural(probe.turnsLeft, 'tour')}`;
    if (probe.state === 'analyse') return `Analyse de ${game.stars[probe.starId].name} · ${plural(probe.turnsLeft, 'tour')}`;
    return `En attente à ${game.stars[probe.starId].name}`;
  }

  function renderProbes() {
    $('probes').innerHTML = game.probes
      .map(
        (p) => `
        <button class="probe ${p.id === game.selectedProbeId ? 'selected' : ''} ${p.state}" data-action="select-probe" data-id="${p.id}">
          <span class="probe-name"><i class="dot"></i>${p.name}<kbd>${p.id + 1}</kbd></span>
          <span class="probe-status">${probeStatus(p)}</span>
        </button>`,
      )
      .join('');
  }

  function depositBar(value, max = 3) {
    return '<span class="bar">' + Array.from({ length: max }, (_, i) => `<i class="${i < value ? 'on' : ''}"></i>`).join('') + '</span>';
  }

  function renderPlanet(planet, level) {
    const type = PLANET_TYPES[planet.type];
    const size = planet.size ? `${planet.size}, ${PLANET_SIZES[planet.size]} hexagones` : 'non colonisable';
    let body = '';
    if (level === 3) {
      const deposits = RESOURCES.filter(([key]) => planet.deposits[key] > 0)
        .map(([key, label]) => `<span class="deposit ${key}">${label} ${depositBar(planet.deposits[key], key === 'velarine' ? 2 : 3)}</span>`)
        .join('');
      body = `<div class="deposits">${deposits || '<span class="muted">Aucun gisement notable</span>'}</div>`;
      if (planet.ruins) body += '<div class="badge ruins">Ruines des Veilleurs</div>';
      if (planet.inhabitedBy === 'vous') body += '<div class="badge home">Votre monde d\'origine</div>';
      else if (planet.inhabitedBy) body += `<div class="badge rival">Habitée par les ${planet.inhabitedBy}</div>`;
    } else {
      body = '<div class="muted small">Gisements inconnus : analyse nécessaire</div>';
      if (planet.inhabitedBy && planet.inhabitedBy !== 'vous') body += '<div class="badge rival">Signaux artificiels</div>';
    }
    return `
      <li class="planet planet-${planet.type}">
        <div class="planet-head"><i class="planet-dot"></i><b>${planet.name}</b><span class="muted">${type.label}</span></div>
        <div class="muted small">${size}</div>
        ${body}
      </li>`;
  }

  function renderActions(star) {
    const probe = game.probes[game.selectedProbeId];
    const parts = [];
    if (canAnalyse(probe, star)) {
      parts.push(`<button class="primary" data-action="analyse">Analyser avec ${probe.name} · ${plural(CONFIG.analyseTurns, 'tour')}</button>`);
    }
    const r = canReach(game, probe, star);
    if (r.ok) {
      parts.push(`<button class="primary" data-action="send">Envoyer ${probe.name} · ${plural(r.turns, 'tour')}${r.viaCurrent ? ' (courant)' : ''}</button>`);
    } else if (!(probe.starId === star.id && probe.state === 'idle' && parts.length)) {
      parts.push(`<p class="muted small">${r.reason}</p>`);
    }
    parts.push(`<button data-action="focus" data-id="${star.id}">Centrer la vue</button>`);
    return `<div class="actions">${parts.join('')}</div>`;
  }

  function renderInfo() {
    const star = game.stars[game.selectedStarId];
    if (!star || star.level < 1) {
      $('info').innerHTML = '<p class="muted">Cliquez sur une étoile pour voir sa fiche.</p>';
      return;
    }
    const home = game.stars[game.homeId];
    const dots = [1, 2, 3].map((l) => `<i class="${star.level >= l ? 'on' : ''}"></i>`).join('');
    const type = STAR_TYPES[star.type];
    const header = `
      <h2>${star.level >= 2 ? star.name : 'Lueur inconnue'}</h2>
      <div class="knowledge"><span class="dots">${dots}</span>${LEVEL_LABELS[star.level]}</div>
      <div class="muted small">${star.level >= 2 ? type.label : 'Type inconnu'} · ${Math.round(starDistance(star, home))} al de ${home.name}</div>`;

    let body = '';
    if (star.level === 1) {
      body = '<p>Une étoile repérée de loin. Envoyez une sonde pour découvrir ses planètes.</p>';
    } else if (star.planets.length === 0) {
      body = '<p class="muted">Aucune planète en orbite.</p>';
    } else {
      body = `<h3>${plural(star.planets.length, 'planète')}</h3><ul class="planets">${star.planets.map((p) => renderPlanet(p, star.level)).join('')}</ul>`;
      if (star.level === 2) body += '<p class="muted small">Une sonde peut rester ici pour analyser la composition du système.</p>';
    }
    $('info').innerHTML = header + renderActions(star) + body;
  }

  function renderJournal() {
    $('journal').innerHTML = game.log
      .slice(-30)
      .reverse()
      .map((entry) => `<p class="log log-${entry.kind}"><span class="turn">T${entry.turn}</span>${entry.text}</p>`)
      .join('');
  }

  function render() {
    renderStats();
    renderProbes();
    renderInfo();
    renderJournal();
  }

  render();
  return { render };
}
