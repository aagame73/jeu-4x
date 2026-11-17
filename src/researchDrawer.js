// Tiroir latéral de la recherche (docs/plan-jouabilite.md, A5) : bouton « Recherche » ou touche R.
// Il montre la recherche en cours, la file d'attente et ce qu'on peut chercher maintenant, sans
// arrêter le temps ni cacher la carte. « Arbre complet » ouvre l'écran des 7 branches.
import { BRANCHES, TECHS, techCost } from './research.js';
import { RESEARCH } from './config.js';
import { ICONS } from './icons.js';
import { researchStatus, researchProblem, researchPerDay } from './game.js';

const fmt = (n) => Math.floor(n).toLocaleString('fr-FR');
const branchOf = (key) => BRANCHES.find((b) => b.key === TECHS[key].branch);

export function createResearchDrawer(root, game, actions) {
  root.hidden = true;
  let signature = '';

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-rd]');
    if (!el) return;
    el.blur();
    const { rd: action, key } = el.dataset;
    if (action === 'close') close();
    else if (action === 'tree') {
      close();
      actions.onOpenResearchTree();
    } else if (action === 'start' && key) {
      if (game.research.current) actions.onQueueResearch(key);
      else actions.onStartResearch(key);
      render();
    } else if (action === 'unqueue' && key) {
      actions.onUnqueueResearch(key);
      render();
    }
  });

  const available = () =>
    Object.keys(TECHS)
      .filter((k) => researchStatus(game, k) === 'available')
      .sort((a, b) => TECHS[a].tier - TECHS[b].tier || techCost(TECHS[a]) - techCost(TECHS[b]));

  const computeSignature = () =>
    [game.research.current, ...(game.research.queue ?? []), ...available().map((k) => `${k}${researchProblem(game, k) ? '!' : ''}`), game.resources.artefacts ?? 0].join(',');

  function item(key, extra) {
    const tech = TECHS[key];
    const b = branchOf(key);
    return `
      <li class="rd-item rs-b-${b.key}" data-key="${key}">
        <div class="rd-line"><i class="rd-dot" title="${b.label}"></i><b>${tech.label}</b><span class="rd-cost">${fmt(techCost(tech))} pts${tech.artefacts ? ` + ${tech.artefacts}${ICONS.artefacts}` : ''}</span></div>
        <div class="rd-unlocks">${tech.unlocks}</div>
        ${extra}
      </li>`;
  }

  function render() {
    signature = computeSignature();
    const r = game.research;
    const queue = r.queue ?? [];
    const busy = !!r.current;
    const full = busy && queue.length >= RESEARCH.queueSize;
    const current = r.current
      ? item(r.current, '<div class="rd-progress"><span class="rs-bar"><i></i></span><small class="rd-eta"></small></div>')
      : '<li class="rd-none">Aucune recherche en cours : les points de recherche sont perdus. Choisissez-en une ci-dessous.</li>';
    const queued = queue.length
      ? queue.map((k, i) => item(k, `<div class="rd-actions"><small>n° ${i + 1}</small><button data-rd="unqueue" data-key="${k}">Retirer</button></div>`)).join('')
      : '<li class="rd-empty muted small">Vide : ajoutez des recherches pour qu’elles s’enchaînent seules.</li>';
    const open = available()
      .map((k) => {
        const why = researchProblem(game, k) ?? (full ? `File d'attente pleine (${RESEARCH.queueSize}).` : null);
        const button = why
          ? `<small class="rd-why">${why}</small>`
          : `<button class="primary" data-rd="start" data-key="${k}">${ICONS.recherche}${busy ? 'Mettre en file' : 'Rechercher'}</button>`;
        return item(k, `<div class="rd-actions">${button}</div>`);
      })
      .join('');
    root.innerHTML = `
      <aside class="research-drawer panel" aria-label="Recherche">
        <header class="rd-head">
          <h2>${ICONS.recherche}Recherche</h2>
          <span class="rd-rate" title="Points de recherche par jour (laboratoires)"><b class="rd-perday"></b>/jour</span>
          <button class="rd-close" data-rd="close" title="Fermer (R ou Échap)" aria-label="Fermer">✕</button>
        </header>
        <div class="rd-body">
          <h3>En cours</h3>
          <ul class="rd-list">${current}</ul>
          <h3>File d'attente <small>${queue.length} / ${RESEARCH.queueSize}</small></h3>
          <ul class="rd-list">${queued}</ul>
          <h3>Disponibles maintenant</h3>
          <ul class="rd-list">${open || '<li class="rd-empty muted small">Rien pour l’instant.</li>'}</ul>
        </div>
        <button class="rd-tree" data-rd="tree">Voir l'arbre complet des 7 branches</button>
      </aside>`;
    renderLive();
  }

  // Chaque jour : chiffres et barre seulement ; tout est redessiné si les choix possibles ont changé.
  function renderLive() {
    if (root.hidden) return;
    if (computeSignature() !== signature) return render();
    const rate = researchPerDay(game);
    root.querySelector('.rd-perday').textContent = `+${rate.toFixed(1).replace('.', ',')}`;
    const r = game.research;
    if (!r.current) return;
    const cost = techCost(TECHS[r.current]);
    root.querySelector('.rd-progress .rs-bar i').style.width = `${Math.min(100, (r.progress / cost) * 100).toFixed(1)}%`;
    const left = Math.max(0, cost - r.progress);
    root.querySelector('.rd-eta').textContent = `${fmt(r.progress)} / ${fmt(cost)} pts${rate > 0 ? ` · ≈ ${Math.ceil(left / rate)} jours` : ' · aucun laboratoire'}`;
  }

  function open() {
    root.hidden = false;
    render();
  }
  function close() {
    root.hidden = true;
  }

  return {
    get isOpen() {
      return !root.hidden;
    },
    open,
    close,
    toggle: () => (root.hidden ? open() : close()),
    renderLive,
  };
}
