// Interface HTML par-dessus la vue 3D : barre du haut, sondes, fiche du système, journal.
import { CONFIG } from './config.js';
import { STAR_TYPES, PLANET_TYPES, PLANET_SIZES, starDistance } from './galaxy.js';
import { LEVEL_LABELS, canReach, canAnalyse, starLabel, stats, currentDay, daysLeft, visiblePlanets } from './game.js';

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
      <div class="clock">
        <button class="pause" data-action="toggle-pause" title="Pause (Espace)"></button>
        ${CONFIG.speeds.map((x, i) => `<button class="speed" data-action="speed" data-id="${i}" title="Vitesse x${x}">x${x}</button>`).join('')}
      </div>
    </header>
    <aside class="probes panel"><h2>Sondes</h2><div id="probes"></div></aside>
    <aside class="info panel" id="info"></aside>
    <section class="journal panel"><h2>Journal de bord</h2><div id="journal"></div></section>
    <div class="help">Espace : pause · + / − : vitesse · Clic : sélectionner · Double-clic : centrer · Glisser : pivoter · Clic droit : déplacer · Molette : zoom · 1 à ${CONFIG.probeCount} : choisir une sonde</div>
  `;
  const $ = (id) => root.querySelector(`#${id}`);

  root.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const el = e.target.closest('[data-action]');
    if (!el) return;
    el.blur(); // sinon la touche Espace réactiverait le bouton
    const { action, id } = el.dataset;
    if (action === 'rename') startRename(Number(id));
    else if (action === 'focus-probe') actions.onFocusProbe(Number(id));
    else if (action === 'toggle-pause') actions.onTogglePause();
    else if (action === 'speed') actions.onSetSpeed(Number(id));
    else if (action === 'select-probe') actions.onSelectProbe(Number(id));
    else if (action === 'send') actions.onSend();
    else if (action === 'analyse') actions.onAnalyse();
    else if (action === 'focus') actions.onFocusStar(Number(id));
  });

  function renderStats() {
    const s = stats(game);
    $('stats').innerHTML = `
      <span>Jour <b>${currentDay(game)}</b></span>
      <span>Systèmes visités <b>${s.explored}</b> / ${s.total}</span>
      <span>Analysés <b>${s.analysed}</b></span>
      <span>Lueurs <b>${s.seen - s.explored}</b></span>
      <span class="muted">Graine ${game.seed}</span>`;
  }

  function probeStatus(probe) {
    if (probe.state === 'travel') return `En route vers ${starLabel(game.stars[probe.toId])} · ${plural(daysLeft(probe), 'jour')}`;
    if (probe.state === 'analyse') return `Analyse de ${game.stars[probe.starId].name} · ${plural(daysLeft(probe), 'jour')}`;
    return `En attente à ${game.stars[probe.starId].name}`;
  }

  // Mise à jour en place (sans recréer les boutons) : la liste change chaque jour
  // et un bouton recréé pendant un clic ferait perdre ce clic.
  $('probes').innerHTML = game.probes
    .map(
      (p) => `
      <div class="probe" role="button" tabindex="0" data-action="select-probe" data-id="${p.id}" style="--ship-accent:${p.accent}">
        <img class="ship-thumb" src="${p.thumbnail}" alt="" />
        <span class="probe-text">
          <span class="probe-name">
            <span class="name-text"></span>
            <button class="icon" data-action="rename" data-id="${p.id}" title="Renommer">✎</button>
            <button class="icon" data-action="focus-probe" data-id="${p.id}" title="Centrer sur ce vaisseau">◎</button>
            <kbd>${p.id + 1}</kbd>
          </span>
          <span class="probe-registry">${p.registry}</span>
          <span class="probe-status"><i class="dot"></i><span class="status-text"></span></span>
        </span>
      </div>`,
    )
    .join('');

  function renderProbes() {
    $('probes').querySelectorAll('.probe').forEach((el, i) => {
      const p = game.probes[i];
      el.className = `probe ${p.state}${p.id === game.selectedProbeId ? ' selected' : ''}`;
      const name = el.querySelector('.name-text');
      if (!name.querySelector('input')) name.textContent = p.name;
      el.querySelector('.status-text').textContent = probeStatus(p);
    });
  }

  // Renommage sur place : Entrée valide, Échap annule.
  function startRename(id) {
    const name = $('probes').querySelectorAll('.name-text')[id];
    if (name.querySelector('input')) return;
    const input = document.createElement('input');
    input.className = 'rename';
    input.maxLength = 24;
    input.value = game.probes[id].name;
    name.replaceChildren(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      input.remove();
      if (save && value) actions.onRenameProbe(id, value);
      else renderProbes();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  }

  function renderClock() {
    const pause = root.querySelector('.pause');
    pause.textContent = game.paused ? '▶ Reprendre' : '❚❚ Pause';
    pause.classList.toggle('paused', game.paused);
    root.querySelectorAll('.speed').forEach((el, i) => el.classList.toggle('active', i === game.speedIndex));
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
      parts.push(`<button class="primary" data-action="analyse">Analyser avec ${probe.name} · ${plural(CONFIG.analyseDays, 'jour')}</button>`);
    }
    const r = canReach(game, probe, star);
    if (r.ok) {
      parts.push(`<button class="primary" data-action="send">Envoyer ${probe.name} · ${plural(r.days, 'jour')}${r.viaCurrent ? ' (courant)' : ''}</button>`);
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
    } else {
      const planets = visiblePlanets(star);
      if (star.level === 3) {
        body = planets.length ? `<h3>${plural(planets.length, 'planète')}</h3>` : '<p class="muted">Aucune planète en orbite.</p>';
      } else {
        const n = planets.length;
        body = `<h3>${n === 0 ? 'Aucune planète détectée' : `${plural(n, 'planète')} ${n > 1 ? 'détectées' : 'détectée'}`}</h3>`;
      }
      body += `<ul class="planets">${planets.map((p) => renderPlanet(p, star.level)).join('')}</ul>`;
      if (star.level === 2) {
        body += '<p class="muted small">D\'autres planètes, plus petites, peuvent échapper au premier survol. Une analyse révèle toutes les planètes et leurs gisements.</p>';
      }
    }
    $('info').innerHTML = header + renderActions(star) + body;
  }

  function renderJournal() {
    $('journal').innerHTML = game.log
      .slice(-30)
      .reverse()
      .map((entry) => `<p class="log log-${entry.kind}"><span class="day">J${entry.day}</span>${entry.text}</p>`)
      .join('');
  }

  // Ce qui change à chaque nouveau jour.
  function renderLive() {
    renderStats();
    renderProbes();
    renderClock();
  }

  function render() {
    renderLive();
    renderInfo();
    renderJournal();
  }

  render();
  return { render, renderLive };
}
