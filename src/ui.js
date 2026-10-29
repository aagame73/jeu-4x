// Interface HTML par-dessus la vue 3D : barre du haut, sondes, fiche du système, journal.
import { CONFIG } from './config.js';
import { STAR_TYPES, PLANET_TYPES, PLANET_SIZES, starDistance } from './galaxy.js';
import { LEVEL_LABELS, canReach, canAnalyse, starLabel, stats, currentDay, daysLeft, visiblePlanets, getSurface, colonyOn, selectedShip, SHIP_KINDS, lifespan, foundingProblem } from './game.js';
import { renderShipThumbnails } from './ships.js';
import { colonyReport } from './economy.js';

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
      <button class="menu-btn" data-action="menu" title="Menu : sauvegarder, charger (Échap)">☰ Menu</button>
      <div class="clock">
        <button class="pause" data-action="toggle-pause" title="Pause (Espace)"></button>
        ${CONFIG.speeds.map((x, i) => `<button class="speed" data-action="speed" data-id="${i}" title="Vitesse x${x}">x${x}</button>`).join('')}
      </div>
    </header>
    <aside class="probes panel"><h2>Flotte</h2><div id="probes"></div></aside>
    <aside class="info panel" id="info"></aside>
    <section class="journal panel"><h2>Journal de bord</h2><div id="journal"></div></section>
    <div class="help">Espace : pause · + / − : vitesse · Clic : sélectionner · Double-clic : centrer · Glisser : pivoter · Clic droit : déplacer · Molette : zoom · 1 à 9 : choisir un vaisseau · Graine ${game.seed}</div>
  `;
  const $ = (id) => root.querySelector(`#${id}`);

  root.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const el = e.target.closest('[data-action]');
    if (!el) return;
    el.blur(); // sinon la touche Espace réactiverait le bouton
    const { action, id } = el.dataset;
    if (action === 'menu') actions.onOpenMenu();
    else if (action === 'rename') startRename(Number(id));
    else if (action === 'focus-ship') actions.onFocusShip(Number(id));
    else if (action === 'found') actions.onOpenPlanet(Number(el.dataset.star), Number(el.dataset.planet), true);
    else if (action === 'toggle-pause') actions.onTogglePause();
    else if (action === 'speed') actions.onSetSpeed(Number(id));
    else if (action === 'select-ship') actions.onSelectShip(Number(id));
    else if (action === 'send') actions.onSend();
    else if (action === 'analyse') actions.onAnalyse();
    else if (action === 'focus') actions.onFocusStar(Number(id));
    else if (action === 'open-planet') actions.onOpenPlanet(Number(el.dataset.star), Number(el.dataset.planet));
  });

  // Stock commun et variation par jour, toutes colonies confondues.
  function renderStats() {
    const s = stats(game);
    const perDay = { minerais: 0, biomasse: 0, velarine: 0 };
    for (const colony of game.colonies) {
      const report = colonyReport(colony, getSurface(game, colony.starId, colony.planetIndex));
      for (const res in perDay) perDay[res] += report.perDay[res];
    }
    const rate = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(1).replace('.', ',')}/j`;
    const stock = (res, label) =>
      `<span class="res res-${res}" title="${label}"><i></i><b>${Math.floor(game.resources[res])}</b><small class="${perDay[res] < 0 ? 'down' : ''}">${rate(perDay[res])}</small></span>`;
    $('stats').innerHTML = `
      ${stock('minerais', 'Minerais')}${stock('biomasse', 'Biomasse')}${stock('velarine', 'Vélarine')}
      <span class="sep"></span>
      <span>Jour <b>${currentDay(game)}</b></span>
      <span title="Systèmes visités (dont analysés : ${s.analysed})">Systèmes <b>${s.explored}</b> / ${s.total}</span>
      <span>Lueurs <b>${s.seen - s.explored}</b></span>`;
  }

  function shipStatus(ship) {
    if (ship.state === 'travel') return `En route vers ${starLabel(game.stars[ship.toId])} · ${plural(daysLeft(ship), 'jour')}`;
    if (ship.state === 'analyse') return `Analyse de ${game.stars[ship.starId].name} · ${plural(daysLeft(ship), 'jour')}`;
    return `En attente à ${game.stars[ship.starId].name}`;
  }

  // La liste n'est reconstruite que lorsqu'un vaisseau apparaît ou disparaît ; sinon elle est
  // mise à jour sur place (un bouton recréé pendant un clic ferait perdre ce clic).
  let fleetKey = null;
  function buildFleet() {
    for (const ship of game.ships) {
      ship.thumbnail ??= renderShipThumbnails([{ seed: ship.shipSeed, accent: ship.accent, registry: ship.registry, kind: ship.kind }])[0];
    }
    if (!game.ships.length) {
      $('probes').innerHTML = '<p class="muted small">Aucun vaisseau. Construisez un spatioport sur une colonie pour lancer des sondes.</p>';
      return;
    }
    $('probes').innerHTML = game.ships
      .map(
        (ship, i) => `
      <div class="probe" role="button" tabindex="0" data-action="select-ship" data-id="${ship.id}" style="--ship-accent:${ship.accent}">
        <img class="ship-thumb" src="${ship.thumbnail}" alt="" />
        <span class="probe-text">
          <span class="probe-name">
            <span class="name-text"></span>
            <button class="icon" data-action="rename" data-id="${ship.id}" title="Renommer">✎</button>
            <button class="icon" data-action="focus-ship" data-id="${ship.id}" title="Centrer sur ce vaisseau">◎</button>
            ${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}
          </span>
          <span class="probe-registry">${SHIP_KINDS[ship.kind].label} · ${ship.registry}</span>
          <span class="probe-status"><i class="dot"></i><span class="status-text"></span></span>
          ${SHIP_KINDS[ship.kind].lifespan ? '<span class="wear" title="Usure"><i></i></span>' : ''}
        </span>
      </div>`,
      )
      .join('');
  }

  function renderProbes() {
    const key = game.ships.map((s) => s.id).join(',');
    if (key !== fleetKey) {
      fleetKey = key;
      buildFleet();
    }
    $('probes').querySelectorAll('.probe').forEach((el) => {
      const ship = game.ships.find((s) => s.id === Number(el.dataset.id));
      if (!ship) return;
      el.className = `probe ${ship.state}${ship.id === game.selectedShipId ? ' selected' : ''}`;
      const name = el.querySelector('.name-text');
      if (!name.querySelector('input')) name.textContent = ship.name;
      el.querySelector('.status-text').textContent = shipStatus(ship);
      const wear = el.querySelector('.wear i');
      if (wear) {
        const used = Math.min(1, ship.age / lifespan(game, ship));
        wear.style.width = `${Math.round((1 - used) * 100)}%`;
        wear.classList.toggle('low', used >= 0.85);
      }
    });
  }

  // Renommage sur place : Entrée valide, Échap annule.
  function startRename(id) {
    const name = $('probes').querySelector(`.probe[data-id="${id}"] .name-text`);
    const ship = game.ships.find((s) => s.id === id);
    if (!name || !ship || name.querySelector('input')) return;
    const input = document.createElement('input');
    input.className = 'rename';
    input.maxLength = 24;
    input.value = ship.name;
    name.replaceChildren(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (save) => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      input.remove();
      if (save && value) actions.onRenameShip(id, value);
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

  function renderPlanet(star, planet, level) {
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
    if (planet.size) {
      const index = star.planets.indexOf(planet);
      if (!foundingProblem(game, selectedShip(game), star.id, index)) {
        body += `<button class="primary surface-btn" data-action="found" data-star="${star.id}" data-planet="${index}">Fonder une colonie ici</button> `;
      }
      const label = colonyOn(game, star.id, index) ? 'Gérer la colonie' : 'Voir la surface';
      body += `<button class="surface-btn" data-action="open-planet" data-star="${star.id}" data-planet="${index}">${label}</button>`;
    }
    return `
      <li class="planet planet-${planet.type}">
        <div class="planet-head"><i class="planet-dot"></i><b>${planet.name}</b><span class="muted">${type.label}</span></div>
        <div class="muted small">${size}</div>
        ${body}
      </li>`;
  }

  function renderActions(star) {
    const ship = selectedShip(game);
    const parts = [];
    if (!ship) {
      parts.push('<p class="muted small">Aucun vaisseau sélectionné.</p>');
    } else {
      if (canAnalyse(ship, star)) {
        parts.push(`<button class="primary" data-action="analyse">Analyser avec ${ship.name} · ${plural(CONFIG.analyseDays, 'jour')}</button>`);
      }
      const r = canReach(game, ship, star);
      if (r.ok) {
        parts.push(`<button class="primary" data-action="send">Envoyer ${ship.name} · ${plural(r.days, 'jour')}${r.viaCurrent ? ' (courant)' : ''}</button>`);
      } else if (!(ship.starId === star.id && ship.state === 'idle')) {
        parts.push(`<p class="muted small">${r.reason}</p>`);
      }
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
      body += `<ul class="planets">${planets.map((p) => renderPlanet(star, p, star.level)).join('')}</ul>`;
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
