// Écran de fin de partie (docs/plan-victoire.md, étape 4) : victoire ou défaite, bilan, puis
// « Nouvelle partie » ou le menu (charger une autre sauvegarde). La partie finie ne reprend pas :
// l'écran revient tant qu'elle est chargée. L'animation de fond vient de endingFx.js.
import { createAlienPortrait } from './aliens.js';
import { startEndingFx } from './endingFx.js';
import { currentSpecies } from './species.js';
import { progress } from './victory.js';

const REASONS = {
  expansion: 'Vos colonies occupent la plus grande partie de l\'amas.',
  elimination: 'Plus aucun empire rival ne vous dispute l\'amas.',
  'tout-perdu': "Vous n'avez plus aucune colonie, ni de vaisseau pour en fonder une.",
};

const plural = (n, one, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

// Bilan de la partie, tel qu'il s'affiche.
export function endSummary(game) {
  const p = progress(game);
  const r = game.record;
  return [
    ['Durée', plural(game.ended?.day ?? Math.floor(game.time) + 1, 'jour')],
    ['Systèmes tenus', `${p.owned} sur ${p.total} (${Math.floor(p.share * 100)} %)`],
    ['Colonies', String(game.colonies.length)],
    ['Technologies', String(game.research?.done?.length ?? 0)],
    ['Empires disparus', `${p.rivalsTotal - p.rivalsLeft} sur ${p.rivalsTotal}`],
    ['Flottes ennemies détruites', String(r.fleetsDestroyed)],
    ['Colonies prises', String(r.coloniesTaken)],
    ['Colonies perdues', String(r.coloniesLost)],
    ['Vaisseaux perdus au combat', String(r.shipsLost)],
  ];
}

// onNewGame : nouvelle partie ; onMenu : ouvrir le menu (charger, importer). isBusy : un autre écran
// plein (menu, cinématique) est ouvert, l'écran de fin attend.
export function createEndView(game, { onNewGame, onMenu, isBusy }) {
  let current = null;

  function close() {
    if (!current) return;
    current.stopFx();
    current.portrait.destroy();
    current.el.remove();
    window.removeEventListener('keydown', onKey, true);
    current = null;
  }

  // L'écran garde le clavier : Échap ouvre le menu, Tab reste sur ses boutons, Entrée et Espace les
  // activent ; rien ne passe aux raccourcis du jeu dessous.
  function onKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey || /^(F\d+|Alt|Control|Shift|Meta)$/.test(e.key)) return;
    e.stopImmediatePropagation();
    if (e.key === 'Enter' || e.key === ' ') return; // le bouton qui a le focus reçoit son clic
    if (e.key === 'Tab') {
      e.preventDefault();
      const buttons = [...current.el.querySelectorAll('button')];
      const i = buttons.indexOf(document.activeElement);
      buttons[(i + (e.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
      return;
    }
    e.preventDefault();
    if (e.key === 'Escape' && !e.repeat) {
      close();
      onMenu();
    }
  }

  function show() {
    const { result, reason } = game.ended;
    const species = currentSpecies();
    const won = result === 'victoire';
    const el = document.createElement('div');
    el.className = `ending ${won ? 'won' : 'lost'}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', won ? 'Victoire' : 'Défaite');
    el.style.setProperty('--sp', species.accent);
    el.innerHTML = `
      <canvas class="ending-fx"></canvas>
      <div class="ending-stage">
        <canvas class="ending-portrait"></canvas>
        <div class="ending-text">
          <span class="ending-kicker">${won ? 'Victoire' : 'Défaite'}</span>
          <strong>${species.label}</strong>
          <p class="ending-reason">${REASONS[reason]}</p>
          <dl class="ending-summary">${endSummary(game)
            .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
            .join('')}</dl>
          <div class="ending-actions">
            <button class="primary" data-end="new">Nouvelle partie</button>
            <button data-end="menu">Menu (charger une partie)</button>
          </div>
        </div>
      </div>`;
    document.body.append(el);
    const portrait = createAlienPortrait(el.querySelector('.ending-portrait'), game.species);
    const stopFx = startEndingFx(el.querySelector('.ending-fx'), game.species, result);
    el.addEventListener('click', (e) => {
      const action = e.target.closest('[data-end]')?.dataset.end;
      if (action === 'new') onNewGame();
      else if (action === 'menu') {
        close();
        onMenu();
      }
    });
    window.addEventListener('keydown', onKey, true);
    current = { el, portrait, stopFx };
    requestAnimationFrame(() => el.classList.add('visible'));
    // Le focus va sur « Menu » : un appui sur Entrée au moment de la fin ne relance pas de partie.
    el.querySelector('[data-end="menu"]').focus();
  }

  return {
    // À chaque rafraîchissement : la partie finie montre son écran, dès que rien d'autre ne le couvre.
    update() {
      if (!game.ended || current || isBusy()) return;
      game.paused = true;
      show();
    },
    get isOpen() {
      return !!current;
    },
  };
}
