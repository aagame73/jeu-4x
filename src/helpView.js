// Écran d'aide (bouton « ? » du bandeau, touche H) : commandes, premiers pas avec l'avancement
// du tutoriel, conditions de victoire ; il permet de relancer le tutoriel.
import { TUTORIAL_STEPS, tutorialActive } from './tutorial.js';

const KEYS = [
  ['Espace', 'Pause / reprise'],
  ['+ / −', 'Vitesse du temps (×1, ×2, ×4)'],
  ['R', 'Recherche'],
  ['D', 'Diplomatie'],
  ['H', 'Cette aide'],
  ['F', 'Plein écran'],
  ['Échap', 'Menu (sauvegarder, charger) ou retour'],
  ['1 à 9', 'Choisir un vaisseau'],
  ['Clic', 'Sélectionner'],
  ['Double-clic', 'Centrer la vue ; sur une étoile : voir son système'],
  ['Glisser', 'Faire pivoter la vue'],
  ['Clic droit + glisser', 'Déplacer la vue'],
  ['Molette', 'Zoom'],
];

export function createHelpView(root, game, { onOpen, onClose, onRestartTutorial }) {
  root.hidden = true;

  function render() {
    const t = game.tutorial ?? { on: false, step: 0 };
    const steps = TUTORIAL_STEPS.map((s, i) => {
      const state = s.done(game) || i < t.step ? 'done' : tutorialActive(game) && i === t.step ? 'current' : '';
      return `<li class="${state}"><b>${s.title}</b><span>${s.how}</span></li>`;
    }).join('');
    root.innerHTML = `
      <div class="help-view panel" role="dialog" aria-label="Aide">
        <div class="menu-head"><h2>Aide</h2><button data-help="close" title="Fermer (H ou Échap)">✕</button></div>
        <div class="help-cols">
          <section>
            <h3>Premiers pas</h3>
            <ol class="help-steps">${steps}</ol>
            <div class="menu-row">
              <button class="primary" data-help="restart">${tutorialActive(game) ? 'Reprendre le tutoriel' : 'Relancer le tutoriel'}</button>
            </div>
          </section>
          <section>
            <h3>Commandes</h3>
            <table class="help-keys">${KEYS.map(([k, v]) => `<tr><th><kbd>${k}</kbd></th><td>${v}</td></tr>`).join('')}</table>
            <h3>Gagner</h3>
            <p class="small">Occupez 80 % des systèmes colonisables, ou faites disparaître tous les empires rivaux. La partie est perdue s'il ne vous reste ni colonie, ni vaisseau pour en fonder une.</p>
            <p class="small muted">Le conseiller, en bas à gauche, lit les nouvelles ; le bouton « Journal » les garde toutes.</p>
          </section>
        </div>
      </div>`;
  }

  root.addEventListener('click', (e) => {
    if (e.target === root) return close(); // clic en dehors du panneau
    const action = e.target.closest('[data-help]')?.dataset.help;
    if (action === 'close') close();
    else if (action === 'restart') {
      close();
      onRestartTutorial();
    }
  });

  function open() {
    render();
    root.hidden = false;
    onOpen();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    onClose();
  }

  return {
    get isOpen() {
      return !root.hidden;
    },
    open,
    close,
    toggle: () => (root.hidden ? open() : close()),
  };
}
