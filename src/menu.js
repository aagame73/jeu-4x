// Menu du jeu (Échap) et écran d'accueil : sauvegarder, charger, exporter, importer, nouvelle partie.
import { SLOTS, readSlot, writeSlot, summary, loadAndRestart, newGameAndRestart, exportFile, importFile } from './save.js';
import { currentDay } from './game.js';

const SLOT_LABELS = { auto: 'Sauvegarde automatique', slot1: 'Emplacement 1', slot2: 'Emplacement 2', slot3: 'Emplacement 3' };

function describe(data) {
  if (!data) return '<span class="muted">vide</span>';
  const s = summary(data);
  return `Jour ${s.day} · ${s.colonies} colonie${s.colonies > 1 ? 's' : ''} · ${s.ships} vaisseau${s.ships > 1 ? 'x' : ''}<br><span class="muted small">enregistrée le ${s.savedAt}</span>`;
}

export function createMenu(root, game, { onOpen, onClose, onNewGame }) {
  root.innerHTML = `
    <div class="menu panel" role="dialog" aria-label="Menu">
      <div id="menu-body"></div>
      <p class="menu-status muted small" id="menu-status"></p>
      <input type="file" accept=".json,application/json" id="menu-file" hidden />
    </div>`;
  root.hidden = true;
  const $ = (id) => root.querySelector(`#${id}`);
  let mode = 'menu';

  const status = (text) => ($('menu-status').textContent = text);

  function slotRows(withSave, slots = SLOTS) {
    return slots.map((slot) => {
      const data = readSlot(slot);
      const canSave = withSave && slot !== 'auto';
      return `
        <div class="slot-row">
          <div><b>${SLOT_LABELS[slot]}</b><div class="small">${describe(data)}</div></div>
          <div class="slot-actions">
            ${canSave ? `<button data-menu="save" data-slot="${slot}">Sauvegarder</button>` : ''}
            ${data ? `<button class="primary" data-menu="load" data-slot="${slot}">Charger</button>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function render() {
    if (mode === 'start') {
      const auto = readSlot('auto');
      $('menu-body').innerHTML = `
        <h1 class="menu-title">Amas inexploré</h1>
        <p class="muted">Une partie est en cours sur cet ordinateur.</p>
        <div class="start-actions">
          <button class="primary big" data-menu="load" data-slot="auto">Continuer<span class="small">${describe(auto)}</span></button>
          <button class="big" data-menu="new-start">Nouvelle partie</button>
        </div>
        ${SLOTS.slice(1).some(readSlot) ? `<h3>Autres sauvegardes</h3>${slotRows(false, SLOTS.slice(1).filter(readSlot))}` : ''}
        <div class="menu-row"><button data-menu="import">Importer un fichier…</button></div>`;
      return;
    }
    $('menu-body').innerHTML = `
      <div class="menu-head"><h2>Menu</h2><button data-menu="close" title="Reprendre (Échap)">✕</button></div>
      <p class="small">Partie en cours : <b>jour ${currentDay(game)}</b> · graine ${game.seed}. Sauvegarde automatique tous les 5 jours.</p>
      <h3>Sauvegardes</h3>
      ${slotRows(true)}
      <h3>Fichier</h3>
      <div class="menu-row">
        <button data-menu="export">Exporter la partie</button>
        <button data-menu="import">Importer un fichier…</button>
      </div>
      <h3>Partie</h3>
      <div class="menu-row">
        <button class="primary" data-menu="close">Reprendre</button>
        <button data-menu="new">Nouvelle partie</button>
      </div>`;
  }

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-menu]');
    if (!el) return;
    const { menu: action, slot } = el.dataset;
    if (action === 'close') close();
    else if (action === 'save') {
      if (readSlot(slot) && !confirm(`Remplacer la sauvegarde « ${SLOT_LABELS[slot]} » ?`)) return;
      status(writeSlot(slot, game) ? `Partie enregistrée dans « ${SLOT_LABELS[slot]} ».` : 'Impossible d\'enregistrer : le stockage du navigateur est indisponible.');
      render();
    } else if (action === 'load') {
      if (mode === 'menu' && !confirm('Charger cette sauvegarde ? La progression non enregistrée sera perdue.')) return;
      loadAndRestart(readSlot(slot));
    } else if (action === 'export') {
      exportFile(game);
      status('Fichier de sauvegarde téléchargé.');
    } else if (action === 'import') {
      $('menu-file').click();
    } else if (action === 'new') {
      if (confirm('Commencer une nouvelle partie ? La progression non enregistrée sera perdue.')) newGameAndRestart();
    } else if (action === 'new-start') {
      onNewGame();
    }
  });

  $('menu-file').addEventListener('change', () => {
    const file = $('menu-file').files[0];
    $('menu-file').value = '';
    if (!file) return;
    importFile(file)
      .then((data) => loadAndRestart(data))
      .catch(() => status('Ce fichier n\'est pas une sauvegarde valide.'));
  });

  function open(asStart = false) {
    mode = asStart ? 'start' : 'menu';
    status('');
    render();
    root.hidden = false;
    root.classList.toggle('start', asStart);
    onOpen(asStart);
  }

  function close() {
    const wasStart = mode === 'start';
    root.hidden = true;
    onClose(wasStart);
  }

  return {
    get isOpen() {
      return !root.hidden;
    },
    open,
    close,
  };
}
