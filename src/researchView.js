// Écran de recherche (touche R) : arbre des technologies en 7 branches et 4 paliers.
// Une branche à la fois : onglets en haut (icône, acquises / total), puis ses 4 paliers en rangées.
// open/close ne gèrent que l'affichage ; main.js met la partie en pause pendant l'écran.
import * as rules from './game.js';
import { BRANCHES, TECHS, techCost } from './research.js';
import { ICONS } from './icons.js';

const fmt = (x) => Math.floor(x).toLocaleString('fr-FR');
const fmt1 = (x) => (Math.round(x * 10) / 10).toLocaleString('fr-FR');
const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
const TIERS = [1, 2, 3, 4];
const branchOf = (key) => BRANCHES.find((b) => b.key === TECHS[key]?.branch);
const branchKeys = (branch) => Object.keys(TECHS).filter((k) => TECHS[k].branch === branch);

// Les règles (game.js) sont écrites en parallèle : chaque appel a une solution de repli.
function research(game) {
  const r = game.research ?? {};
  return { current: r.current ?? null, progress: r.progress ?? 0, done: r.done ?? [], bank: r.bank ?? 0 };
}
function status(game, key) {
  if (typeof rules.researchStatus === 'function') return rules.researchStatus(game, key);
  const r = research(game);
  if (r.done.includes(key)) return 'done';
  if (r.current === key) return 'current';
  return TECHS[key].requires.every((k) => r.done.includes(k)) ? 'available' : 'locked';
}
function problem(game, key) {
  if (typeof rules.researchProblem === 'function') return rules.researchProblem(game, key);
  const need = TECHS[key].artefacts ?? 0;
  if (need > (game.resources?.artefacts ?? 0)) return `Il faut ${plural(need, 'artefact')} des Veilleurs pour lancer cette recherche.`;
  return null;
}
function perDay(game) {
  if (typeof rules.researchPerDay === 'function') return rules.researchPerDay(game) ?? 0;
  return 0;
}

export function createResearchView(root, game, actions) {
  root.innerHTML = `
    <div class="research panel" role="dialog" aria-label="Recherche">
      <header class="rs-head">
        <h2 class="rs-title">${ICONS.recherche}Recherche</h2>
        <div class="rs-figures">
          <span class="rs-fig" title="Points de recherche : produits chaque jour par les laboratoires">
            <small>Par jour</small><b id="rs-perday"></b>
          </span>
          <span class="rs-fig" title="Points mis de côté : produits sans projet en cours, ils seront versés au prochain projet">
            <small>De côté</small><b id="rs-bank"></b>
          </span>
        </div>
        <div class="rs-project" id="rs-project"></div>
        <button class="rs-close" data-research="close" title="Fermer (Échap ou R)" aria-label="Fermer">✕</button>
      </header>
      <nav class="rs-tabs" id="rs-tabs" role="tablist" aria-label="Branches de recherche"></nav>
      <div class="rs-tree" id="rs-tree" role="tabpanel"></div>
    </div>`;
  root.hidden = true;
  const $ = (id) => root.querySelector(`#${id}`);
  let signature = '';
  let branch = null; // branche affichée (choisie à la première ouverture)

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-research]');
    if (!el) return;
    el.blur?.();
    const { research: action, key } = el.dataset;
    if (action === 'close') actions.onCloseResearch?.();
    else if (action === 'branch' && el.dataset.branch) showBranch(el.dataset.branch, key);
    else if (action === 'start' && key && status(game, key) === 'available' && !problem(game, key)) {
      actions.onStartResearch?.(key);
      render();
    }
  });
  // Clavier : Entrée / Espace sur une carte disponible ; flèches gauche / droite sur les onglets.
  root.addEventListener('keydown', (e) => {
    const el = e.target.closest?.('[data-research]');
    if (el && el.tagName !== 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      el.click();
    } else if (e.target.closest?.('.rs-tab') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      e.stopPropagation();
      const i = BRANCHES.findIndex((b) => b.key === branch);
      const next = BRANCHES[(i + (e.key === 'ArrowRight' ? 1 : BRANCHES.length - 1)) % BRANCHES.length];
      showBranch(next.key);
      root.querySelector(`.rs-tab[data-branch="${next.key}"]`)?.focus();
    }
  });
  // Clic en dehors du panneau : fermer, comme Échap.
  root.addEventListener('mousedown', (e) => {
    if (e.target === root) actions.onCloseResearch?.();
  });

  function showBranch(key, highlight) {
    branch = key;
    render();
    if (highlight) {
      const card = root.querySelector(`.rs-card[data-key="${highlight}"]`);
      card?.scrollIntoView({ block: 'nearest' });
      card?.classList.add('flash');
      setTimeout(() => card?.classList.remove('flash'), 1200);
    }
  }

  // Branche affichée par défaut : celle du projet en cours, sinon la première où une recherche est possible.
  function defaultBranch() {
    const r = research(game);
    if (r.current && TECHS[r.current]) return TECHS[r.current].branch;
    const open = Object.keys(TECHS).find((k) => status(game, k) === 'available' && !problem(game, k));
    return open ? TECHS[open].branch : BRANCHES[0].key;
  }

  // Signature des états : si elle change (technologie acquise, projet changé), on redessine tout.
  const computeSignature = () =>
    Object.keys(TECHS).map((k) => `${status(game, k)}${problem(game, k) ? '!' : ''}`).join('') + (game.resources?.artefacts ?? 0);

  function costHtml(tech) {
    const arte = tech.artefacts
      ? `<span class="rs-arte" title="Artefacts : dépensés au lancement de la recherche">+ ${tech.artefacts}${ICONS.artefacts}</span>`
      : '';
    return `<span class="rs-cost"><b>${fmt(techCost(tech))}</b> pts ${arte}</span>`;
  }

  // Prérequis : ceux d'une autre branche portent le nom de leur branche et y mènent d'un clic.
  function prereqHtml(key, owner) {
    const r = research(game);
    const cls = r.done.includes(key) ? 'ok' : 'missing';
    const label = TECHS[key]?.label ?? key;
    const b = branchOf(key);
    if (!b || b.key === owner) return `<span class="${cls}">${label}</span>`;
    return `<button class="rs-link ${cls} rs-b-${b.key}" data-research="branch" data-branch="${b.key}" data-key="${key}"
        title="Voir dans la branche ${b.label}">${label} <small>(${b.label})</small></button>`;
  }

  function cardHtml(key) {
    const tech = TECHS[key];
    const st = status(game, key);
    const prereqs = tech.requires.length
      ? `<div class="rs-req">Requiert : ${tech.requires.map((k) => prereqHtml(k, tech.branch)).join(', ')}</div>`
      : '';
    let foot = '';
    if (st === 'done') {
      foot = `<div class="rs-foot rs-done">${ICONS.coche}Acquise</div>`;
    } else if (st === 'current') {
      foot = `<div class="rs-foot rs-live">
          <span class="rs-bar"><i style="width:0%"></i></span>
          <span class="rs-count"></span>
        </div>`;
    } else if (st === 'available') {
      const why = problem(game, key);
      foot = why
        ? `<div class="rs-foot"><button class="rs-start" disabled>Rechercher</button></div><div class="rs-why">${why}</div>`
        : `<div class="rs-foot"><button class="rs-start primary" data-research="start" data-key="${key}">${ICONS.recherche}Rechercher</button></div>`;
    } else {
      foot = `<div class="rs-foot rs-lock">${ICONS.cadenas}Prérequis manquants</div>`;
    }
    const clickable = st === 'available' && !problem(game, key);
    return `
      <article class="rs-card ${st}" data-key="${key}" ${clickable ? `data-research="start" role="button" tabindex="0"` : ''}>
        <div class="rs-card-head"><span class="rs-name">${tech.label}</span>${costHtml(tech)}</div>
        <div class="rs-unlocks">${tech.unlocks}</div>
        ${prereqs}
        ${foot}
      </article>`;
  }

  function tabHtml(b) {
    const keys = branchKeys(b.key);
    const done = keys.filter((k) => status(game, k) === 'done').length;
    const current = keys.some((k) => status(game, k) === 'current');
    const open = keys.some((k) => status(game, k) === 'available' && !problem(game, k));
    const marks = `${current ? '<i class="rs-mark current" title="Projet en cours dans cette branche"></i>' : ''}${
      open && !current ? '<i class="rs-mark open" title="Recherche disponible dans cette branche"></i>' : ''}`;
    const selected = b.key === branch;
    return `
      <button class="rs-tab rs-b-${b.key}${selected ? ' selected' : ''}${done === keys.length ? ' complete' : ''}"
          role="tab" aria-selected="${selected}" tabindex="${selected ? 0 : -1}"
          data-research="branch" data-branch="${b.key}" title="${b.label} : ${done} / ${keys.length} acquises">
        ${ICONS[`branche-${b.key}`] ?? ''}
        <span class="rs-tab-label">${b.label}</span>
        <span class="rs-tab-count"><b>${done}</b>/${keys.length}</span>
        ${marks}
        <span class="rs-tab-meter"><i style="width:${keys.length ? (done / keys.length) * 100 : 0}%"></i></span>
      </button>`;
  }

  function render() {
    signature = computeSignature();
    if (!branch || !BRANCHES.some((b) => b.key === branch)) branch = defaultBranch();
    $('rs-tabs').innerHTML = BRANCHES.map(tabHtml).join('');
    const rows = TIERS.map((tier) => {
      const keys = branchKeys(branch).filter((k) => TECHS[k].tier === tier);
      const cards = keys.length ? keys.map(cardHtml).join('') : '<p class="rs-empty">Aucune technologie à ce palier.</p>';
      return `
        <section class="rs-row">
          <div class="rs-tier" title="Palier ${tier}"><small>Palier</small><b>${tier}</b></div>
          <div class="rs-cards">${cards}</div>
        </section>`;
    }).join('');
    const tree = $('rs-tree');
    tree.className = `rs-tree rs-b-${branch}`;
    tree.innerHTML = rows;
    renderLive(true);
  }

  // Chiffres et barres seulement (appelé chaque jour) : les boutons ne sont pas recréés.
  function renderLive(fromRender = false) {
    if (!fromRender && computeSignature() !== signature) {
      render();
      return;
    }
    const r = research(game);
    const rate = perDay(game);
    $('rs-perday').textContent = `+${fmt1(rate)}`;
    $('rs-bank').textContent = fmt(r.bank);

    const tech = r.current ? TECHS[r.current] : null;
    const project = $('rs-project');
    if (!tech) {
      if (project.dataset.mode !== 'none') {
        project.dataset.mode = 'none';
        project.innerHTML = '<span class="rs-none"><i class="rs-glow"></i>Aucune recherche en cours : choisissez une technologie disponible.</span>';
      }
    } else {
      if (project.dataset.mode !== r.current) {
        project.dataset.mode = r.current;
        const b = branchOf(r.current);
        project.innerHTML = `
          <div class="rs-proj-line"><small>Projet en cours</small>
            <button class="rs-proj-name" data-research="branch" data-branch="${tech.branch}" data-key="${r.current}"
              title="Voir dans la branche ${b?.label ?? ''}">${tech.label}</button>
            <span class="rs-proj-eta"></span></div>
          <span class="rs-bar big"><i></i></span>`;
      }
      const ratio = Math.min(1, r.progress / techCost(tech));
      const left = Math.max(0, techCost(tech) - r.progress);
      const eta = rate > 0 ? `≈ ${plural(Math.ceil(left / rate), 'jour')}` : 'aucun laboratoire';
      project.querySelector('.rs-proj-eta').textContent = `${fmt(r.progress)} / ${fmt(techCost(tech))} pts · ${eta}`;
      project.querySelector('.rs-bar i').style.width = `${(ratio * 100).toFixed(1)}%`;
    }

    root.querySelectorAll('.rs-card.current').forEach((card) => {
      const t = TECHS[card.dataset.key];
      const progress = r.current === card.dataset.key ? r.progress : 0;
      card.querySelector('.rs-bar i').style.width = `${Math.min(100, (progress / techCost(t)) * 100).toFixed(1)}%`;
      const left = Math.max(0, techCost(t) - progress);
      card.querySelector('.rs-count').textContent =
        `${fmt(progress)} / ${fmt(techCost(t))}${rate > 0 ? ` · ${plural(Math.ceil(left / rate), 'jour')}` : ''}`;
    });
  }

  function open() {
    render();
    root.hidden = false;
  }

  function close() {
    root.hidden = true;
  }

  return {
    open,
    close,
    get isOpen() {
      return !root.hidden;
    },
    render,
    renderLive: () => renderLive(false),
  };
}
