// Écran de choix de l'espèce, entre « Nouvelle partie » et l'arrivée de l'Arche.
import { SPECIES, RIVALS, DIFFICULTY, MAP_SIZES, RESOURCE_LEVELS } from './config.js';
import { fond, mondeNatal } from './fonds.js';
import { gameSettings, imposedSettings, difficultyLevel } from './difficulty.js';
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

// onChoose(clé, réglages) lance la partie (réglages : difficulty, mapSize, resourceLevel, rivals, contraintes
// du niveau appliquées) ; onBack (facultatif) revient à l'écran d'accueil.
// Voile sombre sur le monde natal, plus fort pour les images claires (désert blanc des Orrhaïdes).
const MONDE_VOILE = { orrhaides: 0.72, keltirr: 0.6, ashkari: 0.6 };

export function createSpeciesView(root, { onChoose, onBack }) {
  let portraits = [];
  let selected = null;
  let choices = gameSettings(); // réglages choisis par le joueur (sans les contraintes du niveau)
  let tutorial = true; // tutoriel guidé par le conseiller (tutorial.js)
  // Fond fixe (la salle des cryocapsules de l'Arche) : seul le contenu est redessiné, le fond ne clignote pas.
  root.innerHTML = `${fond('arche-interieur.jpg', 0.35)}<div class="sp-body"></div>`;
  const body = root.querySelector('.sp-body');

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
        ${fond(mondeNatal(key), MONDE_VOILE[key] ?? 0.5)}
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

  // Une rangée de boutons : options = [[valeur, texte, infobulle]]. Un réglage imposé par le niveau est grisé.
  function picker(key, label, options, shown, imposed) {
    const buttons = options.map(([value, text, title]) => {
      const on = String(value) === String(shown[key]);
      return `<button data-setting="${key}" data-value="${value}" aria-pressed="${on}" class="${on ? 'selected' : ''}"${title ? ` title="${title}"` : ''}${imposed ? ' disabled' : ''}>${text}</button>`;
    });
    const note = imposed ? `<em class="sp-imposed">imposé en ${difficultyLevel(shown.difficulty).label}</em>` : '';
    return `<div class="sp-setting sp-${key}" role="group" aria-label="${label}"><span class="sp-setting-label">${label}</span>${buttons.join('')}${note}</div>`;
  }

  // Les choix du joueur restent dans « choices » ; l'écran montre les réglages effectifs (imposés en Redoutable).
  // En quittant Redoutable, les choix d'avant reviennent donc d'eux-mêmes.
  function settingsPicker() {
    const shown = gameSettings(choices);
    const imposed = imposedSettings(choices.difficulty);
    const counts = [];
    for (let n = RIVALS.min; n <= RIVALS.max; n++) counts.push([n, String(n)]);
    return `
      ${picker('rivals', 'Adversaires', counts, shown, 'rivals' in imposed)}
      ${picker('difficulty', 'Difficulté', Object.entries(DIFFICULTY.levels).map(([k, l]) => [k, l.label]), shown, false)}
      <p class="sp-hint-level small muted" aria-live="polite">${difficultyLevel(shown.difficulty).hint}</p>
      ${picker('mapSize', 'Taille de carte', Object.entries(MAP_SIZES.sizes).map(([k, m]) => [k, `${m.label} · ${m.starCount}`, `${m.starCount} systèmes`]), shown, 'mapSize' in imposed)}
      ${picker('resourceLevel', 'Ressources', Object.entries(RESOURCE_LEVELS.levels).map(([k, r]) => [k, r.label]), shown, 'resourceLevel' in imposed)}
      <label class="sp-setting sp-tuto"><span class="sp-setting-label">Tutoriel</span><input type="checkbox" data-tuto ${tutorial ? 'checked' : ''} /> Le conseiller guide les premiers pas (jusqu'à la première sonde)</label>`;
  }

  function stopPortraits() {
    portraits.forEach((p) => p.destroy());
    portraits = [];
  }

  function render() {
    stopPortraits();
    const keys = playableSpecies();
    body.innerHTML = `
      <div class="species panel" role="dialog" aria-label="Choix de l'espèce">
        <h1 class="menu-title">Choisissez votre espèce</h1>
        <p class="muted">L'Arche emporte une seule espèce. Chacune a une force et une faiblesse ; aucune n'est meilleure que les autres.</p>
        <div class="sp-grid">${keys.map(card).join('')}</div>
        <div id="sp-detail">${selected ? details(selected) : '<p class="muted sp-hint">Cliquez sur une espèce pour la découvrir.</p>'}</div>
        <div class="sp-settings">${settingsPicker()}</div>
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
    const settingEl = e.target.closest('[data-setting]');
    if (settingEl) {
      const { setting, value } = settingEl.dataset;
      choices[setting] = setting === 'rivals' ? Number(value) : value;
      // Seuls les réglages sont redessinés : les portraits continuent de s'animer. Le focus reste sur le bouton.
      root.querySelector('.sp-settings').innerHTML = settingsPicker();
      root.querySelector(`[data-setting="${setting}"][data-value="${value}"]`)?.focus();
      return;
    }
    const cardEl = e.target.closest('[data-species]');
    if (cardEl) {
      selected = cardEl.dataset.species;
      render();
      return;
    }
    const action = e.target.closest('[data-sp]')?.dataset.sp;
    if (action === 'start' && selected) {
      stopPortraits();
      onChoose(selected, { ...gameSettings(choices), tutorial });
    } else if (action === 'back') close();
  });

  root.addEventListener('change', (e) => {
    if (e.target.matches('[data-tuto]')) tutorial = e.target.checked;
  });

  function open() {
    selected = null;
    choices = gameSettings(); // à chaque ouverture : Standard, carte moyenne, ressources normales, 4 adversaires
    tutorial = true;
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
