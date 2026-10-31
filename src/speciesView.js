// Écran de choix de l'espèce, entre « Nouvelle partie » et l'arrivée de l'Arche.
import { SPECIES } from './config.js';
import { playableSpecies } from './species.js';
import { PLANET_TYPES } from './galaxy.js';
import { TERRAINS } from './surface.js';
import { createAlienPortrait } from './aliens.js';
import { renderShipThumbnails } from './ships.js';

// Aperçu de la flotte de chaque espèce, rendu une fois par espèce.
const FLEET = [['arche', 'Arche'], ['sonde', 'Sonde'], ['colonie', 'Colonie'], ['corvette', 'Corvette']];
const fleetCache = new Map();
function fleetImages(key) {
  if (!fleetCache.has(key)) {
    const s = SPECIES[key];
    fleetCache.set(key, renderShipThumbnails(FLEET.map(([kind], i) => ({ seed: 7 + i * 13, accent: s.accent, registry: '', kind })), 120, 72, s.shipStyle));
  }
  return fleetCache.get(key);
}

const habitatLabel = (type) => (type === 'lune' ? 'Lunes habitables' : PLANET_TYPES[type]?.label ?? type);

// onChoose(clé) lance la partie ; onBack (facultatif) revient à l'écran d'accueil.
export function createSpeciesView(root, { onChoose, onBack }) {
  let portraits = [];
  let selected = null;

  function card(key) {
    const s = SPECIES[key];
    return `
      <button class="sp-card" data-species="${key}" style="--sp:${s.accent}">
        <canvas class="sp-portrait"></canvas>
        <span class="sp-name">${s.label}</span>
        <span class="sp-traits"><span class="sp-plus">▲ ${s.strength}</span><span class="sp-minus">▼ ${s.weakness}</span></span>
      </button>`;
  }

  function details(key) {
    const s = SPECIES[key];
    return `
      <div class="sp-detail" style="--sp:${s.accent}">
        <canvas class="sp-portrait big"></canvas>
        <div class="sp-detail-text">
          <h2>${s.label}</h2>
          <p class="sp-lore">${s.lore}</p>
          <p><span class="sp-plus">▲ Force : ${s.strength}</span><br><span class="sp-minus">▼ Faiblesse : ${s.weakness}</span></p>
          <p class="small">Milieu de prédilection : <b>${s.habitat.favored.map(habitatLabel).join(', ')}</b> · hostile : ${s.habitat.hostile.map(habitatLabel).join(', ')}<br>
          Terrains favoris (+25 %) : ${s.favoredTerrains.map((t) => TERRAINS[t]?.label ?? t).join(', ')}</p>
          <p class="small muted">Vaisseau colonie : ${s.arkName}</p>
          <div class="sp-fleet">${fleetImages(key).map((url, i) => `<figure><img src="${url}" alt="" /><figcaption>${FLEET[i][1]}</figcaption></figure>`).join('')}</div>
        </div>
      </div>`;
  }

  function stopPortraits() {
    portraits.forEach((p) => p.destroy());
    portraits = [];
  }

  function render() {
    stopPortraits();
    const keys = playableSpecies();
    root.innerHTML = `
      <div class="species panel" role="dialog" aria-label="Choix de l'espèce">
        <h1 class="menu-title">Choisissez votre espèce</h1>
        <p class="muted">L'Arche emporte une seule espèce. Chacune a une force et une faiblesse ; aucune n'est meilleure que les autres.</p>
        <div class="sp-grid">${keys.map(card).join('')}</div>
        <div id="sp-detail">${selected ? details(selected) : '<p class="muted sp-hint">Cliquez sur une espèce pour la découvrir.</p>'}</div>
        <div class="menu-row sp-actions">
          ${onBack ? '<button data-sp="back">Retour</button>' : ''}
          <button class="primary big" data-sp="start" ${selected ? '' : 'disabled'}>Lancer l'Arche${selected ? `<span class="small">${SPECIES[selected].label}</span>` : ''}</button>
        </div>
      </div>`;
    root.querySelectorAll('.sp-card').forEach((el) => {
      el.classList.toggle('selected', el.dataset.species === selected);
      portraits.push(createAlienPortrait(el.querySelector('canvas'), el.dataset.species));
    });
    const big = root.querySelector('.sp-portrait.big');
    if (big) {
      const portrait = createAlienPortrait(big, selected);
      portrait.setSpeaking(true);
      setTimeout(() => portrait.setSpeaking(false), 2200); // l'espèce se présente
      portraits.push(portrait);
    }
  }

  root.addEventListener('click', (e) => {
    const cardEl = e.target.closest('[data-species]');
    if (cardEl) {
      selected = cardEl.dataset.species;
      render();
      return;
    }
    const action = e.target.closest('[data-sp]')?.dataset.sp;
    if (action === 'start' && selected) {
      stopPortraits();
      onChoose(selected);
    } else if (action === 'back') close();
  });

  function open() {
    selected = null;
    root.hidden = false;
    render();
  }

  function close() {
    stopPortraits();
    root.hidden = true;
    onBack?.();
  }

  return {
    get isOpen() {
      return !root.hidden;
    },
    open,
  };
}
