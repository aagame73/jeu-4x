// Interface HTML par-dessus la vue 3D : barre du haut, sondes, fiche du système, journal.
import { CONFIG } from './config.js';
import { STAR_TYPES, PLANET_TYPES, PLANET_SIZES, starDistance } from './galaxy.js';
import { LEVEL_LABELS, canReach, canAnalyse, starLabel, stats, currentDay, daysLeft, visiblePlanets, getSurface, colonyOn, selectedShip, SHIP_KINDS, lifespan, foundingProblem } from './game.js';
import { renderShipThumbnails } from './ships.js';
import { colonyReport } from './economy.js';
import { ICONS } from './icons.js';
import { TECHS, techCost } from './research.js';
import { createAdvisor } from './advisor.js';
import { currentSpecies, speciesHabitat } from './species.js';
// Accès tolérant aux règles écrites en parallèle (SIZE_LABELS, shipStats peuvent manquer).
import * as rules from './game.js';

const RESOURCES = [
  ['minerais', 'Minerais'],
  ['energie', 'Énergie'],
  ['biomasse', 'Biomasse'],
  ['velarine', 'Vélarine'],
  ['eau', 'Eau'],
  ['deuterium', 'Deutérium'],
];

// Cartouches du bandeau du haut, dans l'ordre d'affichage (les artefacts n'ont pas de variation par jour).
const STOCKS = [
  ['minerais', 'Minerais'],
  ['alliages', 'Alliages'],
  ['biomasse', 'Biomasse'],
  ['eau', 'Eau'],
  ['deuterium', 'Deutérium'],
  ['velarine', 'Vélarine'],
  ['artefacts', 'Artefacts'],
];

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

export function createUI(root, game, actions) {
  root.innerHTML = `
    <header class="topbar panel">
      <div class="title" title="Amas inexploré : prototype"><span class="game-name">Amas<br>inexploré</span></div>
      <div class="stats" id="stats"></div>
      <button class="menu-btn fs-btn" data-action="fullscreen" title="Plein écran (F)" aria-label="Plein écran">${ICONS.pleinEcran}</button>
      <button class="menu-btn rs-btn" data-action="research" title="Recherche (R)">${ICONS.recherche}<span class="rs-btn-label">Recherche</span><span class="rs-meter"><i></i></span><i class="rs-dot"></i></button>
      <button class="menu-btn icon-only" data-action="menu" title="Menu : sauvegarder, charger (Échap)" aria-label="Menu">${ICONS.menu}</button>
      <div class="clock">
        <button class="pause" data-action="toggle-pause" title="Pause (Espace)"></button>
        ${CONFIG.speeds.map((x, i) => `<button class="speed" data-action="speed" data-id="${i}" title="Vitesse x${x}">${ICONS[`vitesse${x}`] ?? ''}x${x}</button>`).join('')}
      </div>
    </header>
    <aside class="probes panel"><h2>Flotte</h2><div id="probes"></div></aside>
    <aside class="info panel" id="info"></aside>
    <section class="advisor panel" id="advisor">
      <canvas class="advisor-portrait"></canvas>
      <div class="advisor-body">
        <div class="advisor-head"><span class="advisor-name">Conseiller · ${currentSpecies().label}</span><button data-action="journal" title="Toutes les nouvelles">Journal</button></div>
        <div class="advisor-bubble" id="advisor-bubble" title="Clic : passer"></div>
        <div class="advisor-queue" id="advisor-queue"></div>
      </div>
      <div class="advisor-history" id="journal" hidden></div>
    </section>
    <div class="help">Espace : pause · R : recherche · F : plein écran · + / − : vitesse · Clic : sélectionner · Double-clic : centrer · Glisser : pivoter · Clic droit : déplacer · Molette : zoom · 1 à 9 : choisir un vaisseau · Graine ${game.seed}</div>
  `;
  const $ = (id) => root.querySelector(`#${id}`);

  // L'icône du bouton plein écran suit l'état réel (la touche Échap du navigateur en sort aussi).
  document.addEventListener('fullscreenchange', () => {
    const full = !!document.fullscreenElement;
    const button = root.querySelector('.fs-btn');
    button.innerHTML = full ? ICONS.quitterPleinEcran : ICONS.pleinEcran;
    button.title = full ? 'Quitter le plein écran (F)' : 'Plein écran (F)';
  });

  root.addEventListener('click', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const el = e.target.closest('[data-action]');
    if (!el) return;
    el.blur(); // sinon la touche Espace réactiverait le bouton
    const { action, id } = el.dataset;
    if (action === 'menu') actions.onOpenMenu();
    else if (action === 'research') actions.onOpenResearch?.();
    else if (action === 'fullscreen') actions.onToggleFullscreen();
    else if (action === 'journal') $('journal').hidden = !$('journal').hidden;
    else if (action === 'rename') startRename(Number(id));
    else if (action === 'focus-ship') actions.onFocusShip(Number(id));
    else if (action === 'found') actions.onOpenPlanet(Number(el.dataset.star), Number(el.dataset.planet), true);
    else if (action === 'toggle-pause') actions.onTogglePause();
    else if (action === 'speed') actions.onSetSpeed(Number(id));
    else if (action === 'select-ship') actions.onSelectShip(Number(id));
    else if (action === 'send') actions.onSend();
    else if (action === 'analyse') actions.onAnalyse();
    else if (action === 'focus') actions.onFocusStar(Number(id));
    else if (action === 'open-system') actions.onOpenSystem(Number(id));
    else if (action === 'open-planet') actions.onOpenPlanet(Number(el.dataset.star), Number(el.dataset.planet));
  });

  // Stock commun et variation par jour, toutes colonies confondues.
  function renderStats() {
    const s = stats(game);
    const perDay = { minerais: 0, alliages: 0, biomasse: 0, eau: 0, deuterium: 0, velarine: 0 };
    for (const colony of game.colonies) {
      const report = colonyReport(colony, getSurface(game, colony.starId, colony.planetIndex));
      for (const res in perDay) perDay[res] += report.perDay?.[res] ?? 0;
    }
    const rate = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(1).replace('.', ',')}/j`;
    // Petite jauge sous une valeur (ratio entre 0 et 1).
    const gauge = (ratio) => `<span class="gauge"><span style="width:${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%"></span></span>`;
    // Ressource compacte : icône néon colorée, stock, variation par jour en petit dessous, jauge fine
    // (relative à un plafond qui recule : stock / (stock + 200)). Le nom n'apparaît qu'en infobulle.
    const stock = (res, label) => {
      const value = Math.floor(game.resources?.[res] ?? 0);
      if (res === 'artefacts') {
        return `<span class="res res-${res}" title="${label} : objets anciens découverts">${ICONS[res]}<span class="res-body">
          <b>${value}</b><small class="flat">pièces</small></span></span>`;
      }
      const day = perDay[res] ?? 0;
      const flat = Math.abs(day) < 0.05;
      return `<span class="res res-${res}" title="${label} : stock commun et variation par jour">${ICONS[res]}<span class="res-body">
        <b>${value}</b><small class="${day < 0 ? 'down' : flat ? 'flat' : ''}">${rate(day)}</small>
        ${gauge(value / (value + 200))}</span></span>`;
    };
    // Compteur compact : icône et valeur (le libellé est dans l'infobulle).
    const counter = (cls, iconName, value, title, extra = '') =>
      `<span class="counter ${cls}" title="${title}">${ICONS[iconName]}<span class="counter-body"><b>${value}</b>${extra}</span></span>`;
    $('stats').innerHTML = `
      ${STOCKS.map(([res, label]) => stock(res, label)).join('')}
      <span class="sep"></span>
      ${counter('day', 'calendrier', String(currentDay(game)).padStart(3, '0'), 'Jour de la partie')}
      ${counter('systems', 'systemes', `${s.explored}<small>/${s.total}</small>`, `Systèmes visités (dont analysés : ${s.analysed})`, gauge(s.explored / Math.max(1, s.total)))}
      ${counter('glows', 'lueurs', s.seen - s.explored, 'Lueurs repérées mais pas encore visitées')}`;
    renderResearchButton();
  }

  // Bouton « Recherche » : barre fine du projet en cours, ou point or s'il n'y en a pas.
  function renderResearchButton() {
    const button = root.querySelector('.rs-btn');
    const r = game.research ?? {};
    const tech = r.current ? TECHS[r.current] : null;
    const progress = Math.floor(r.progress ?? 0);
    const tip = tech
      ? `Recherche : ${tech.label} — ${progress} / ${techCost(tech)} points`
      : 'Aucune recherche en cours : cliquez pour choisir';
    // Les info-bulles du jeu déplacent title dans data-tip au survol.
    if (button.hasAttribute('data-tip')) button.dataset.tip = tip;
    else button.title = tip;
    button.classList.toggle('idle', !tech);
    button.querySelector('.rs-meter i').style.width = tech ? `${Math.min(100, (progress / techCost(tech)) * 100).toFixed(1)}%` : '0%';
  }

  function shipStatus(ship) {
    if (ship.state === 'travel') return `En route vers ${starLabel(game.stars[ship.toId])} · ${plural(daysLeft(ship), 'jour')}`;
    if (ship.state === 'analyse') return `Analyse de ${game.stars[ship.starId].name} · ${plural(daysLeft(ship), 'jour')}`;
    return `En attente à ${game.stars[ship.starId].name}`;
  }

  // La liste n'est reconstruite que lorsqu'un vaisseau apparaît ou disparaît ; sinon elle est
  // mise à jour sur place (un bouton recréé pendant un clic ferait perdre ce clic).
  let fleetKey = null;
  // Pastilles d'une carte de vaisseau : taille, puis attaque / défense pour un vaisseau de guerre
  function shipTags(ship) {
    const kind = SHIP_KINDS[ship.kind] ?? {};
    const tags = [];
    if (kind.size) {
      const label = rules.SIZE_LABELS?.[kind.size] ?? kind.size;
      tags.push(`<span class="ship-tag size size-${kind.size}" title="Taille : ${label}">${ICONS.taille}${label}</span>`);
    }
    if (kind.warship) {
      tags.push(`<span class="ship-tag atk" title="Attaque (avec les bonus de recherche)">${ICONS.attaque}<b class="atk-value"></b></span>`);
      tags.push(`<span class="ship-tag def" title="Défense (avec les bonus de recherche)">${ICONS.defense}<b class="def-value"></b></span>`);
    }
    return tags.length ? `<span class="ship-tags">${tags.join('')}</span>` : '';
  }
  function combatStats(ship) {
    const kind = SHIP_KINDS[ship.kind] ?? {};
    const s = typeof rules.shipStats === 'function' ? rules.shipStats(game, ship) : null;
    return { attack: s?.attack ?? kind.attack ?? 0, defense: s?.defense ?? kind.defense ?? 0 };
  }
  const statText = (x) => (Math.round(x * 10) / 10).toLocaleString('fr-FR');

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
          ${shipTags(ship)}
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
      const atk = el.querySelector('.atk-value');
      if (atk) {
        const c = combatStats(ship);
        atk.textContent = statText(c.attack);
        el.querySelector('.def-value').textContent = statText(c.defense);
      }
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
    // Bouton compact : icône seule, l'action est donnée par l'infobulle
    const label = game.paused ? 'Reprendre' : 'Pause';
    const html = game.paused ? ICONS.lecture : ICONS.pause;
    if (pause.dataset.state !== label) {
      pause.dataset.state = label;
      pause.innerHTML = html;
      pause.title = `${label} (Espace)`;
      pause.setAttribute('aria-label', label);
    }
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
      const deposits = RESOURCES.filter(([key]) => (planet.deposits?.[key] ?? 0) > 0)
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
      const milieu = speciesHabitat(planet);
      const sp = currentSpecies().label;
      if (milieu === 'favored') body += `<div class="badge favored" title="Colons adaptés : +1 colon au départ, croissance +25 %, biomasse et eau consommées −50 %">Milieu favorable aux ${sp}</div>`;
      else if (milieu === 'hostile') body += `<div class="badge hostile" title="Colonie possible avec Adaptation xénobiologique (l'Arche peut s'y poser) : croissance −50 %, 1 colon de moins, production −15 %">Milieu hostile aux ${sp}</div>`;
      if (!foundingProblem(game, selectedShip(game), star.id, index)) {
        body += `<button class="primary surface-btn" data-action="found" data-star="${star.id}" data-planet="${index}">Fonder une colonie ici</button> `;
      }
      const label = colonyOn(game, star.id, index) ? 'Gérer la colonie' : 'Voir la surface';
      body += `<button class="surface-btn" data-action="open-planet" data-star="${star.id}" data-planet="${index}">${label}</button>`;
    }
    const moon = planet.moonOf !== undefined;
    return `
      <li class="planet planet-${planet.type}${moon ? ' moon' : ''}">
        <div class="planet-head"><i class="planet-dot"></i><b>${planet.name}</b><span class="muted">${moon ? `Lune · ${type.label}` : type.label}</span></div>
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
        // Coût en deutérium (si les règles le fournissent) : nombre suivi de l'icône
        const fuel = r.fuel != null ? ` · <span class="fuel" title="Deutérium consommé">${r.fuel}${ICONS.deuterium}</span>` : '';
        parts.push(`<button class="primary" data-action="send">Envoyer ${ship.name} · ${plural(r.days, 'jour')}${r.viaCurrent ? ' (courant)' : ''}${fuel}</button>`);
      } else if (!(ship.starId === star.id && ship.state === 'idle')) {
        parts.push(`<p class="muted small">${r.reason}</p>`);
      }
    }
    if (star.level >= 2) parts.push(`<button data-action="open-system" data-id="${star.id}">Voir le système</button>`);
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
      // Chaque lune est rangée juste sous sa planète.
      const visible = visiblePlanets(star);
      const planets = visible
        .filter((p) => p.moonOf === undefined)
        .flatMap((p) => [p, ...visible.filter((m) => m.moonOf === star.planets.indexOf(p))]);
      const moons = visible.filter((p) => p.moonOf !== undefined).length;
      if (star.level === 3) {
        body = planets.length
          ? `<h3>${plural(planets.length - moons, 'planète')}${moons ? ` · ${plural(moons, 'lune')}` : ''}</h3>`
          : '<p class="muted">Aucune planète en orbite.</p>';
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

  const advisor = createAdvisor($('advisor'), game, game.species);

  function renderJournal() {
    advisor.update();
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
