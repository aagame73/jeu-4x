// Conseiller : le portrait animé de l'espèce lit à voix haute (lettre à lettre) les nouvelles
// entrées du journal. Le journal complet reste accessible sous le portrait.
import { createAlienPortrait } from './aliens.js';
import { currentSpecies } from './species.js';

const LETTERS_PER_SECOND = 45;
const PAUSE_AFTER_MS = 1400; // temps de lecture avant le message suivant
const MAX_QUEUE = 4; // au-delà, les plus anciens sont sautés (ils restent dans le journal)

export function createAdvisor(root, game, speciesKey) {
  const bubble = root.querySelector('#advisor-bubble');
  const queueInfo = root.querySelector('#advisor-queue');
  const portrait = createAlienPortrait(root.querySelector('.advisor-portrait'), speciesKey);
  root.style.setProperty('--sp', currentSpecies().accent);

  // En début de partie, il lit l'arrivée de l'Arche ; sinon il répète la dernière nouvelle.
  let seen = game.time < 1 ? 0 : Math.max(0, game.log.length - 1);
  const queue = [];
  let entry = null;
  let shown = 0;
  let timer = null;

  function draw() {
    const typing = shown < entry.text.length;
    bubble.className = `advisor-bubble log-${entry.kind}`;
    bubble.innerHTML = `<span class="day">J${entry.day}</span>`;
    bubble.append(entry.text.slice(0, shown));
    if (typing) bubble.insertAdjacentHTML('beforeend', '<i class="caret"></i>');
    queueInfo.textContent = queue.length ? `+ ${queue.length} message${queue.length > 1 ? 's' : ''}` : '';
  }

  function next() {
    clearTimeout(timer);
    entry = queue.shift();
    if (!entry) {
      portrait.setSpeaking(false);
      return;
    }
    shown = 0;
    portrait.setSpeaking(true);
    type();
  }

  function type() {
    shown = Math.min(entry.text.length, shown + 1);
    draw();
    if (shown < entry.text.length) {
      // Petite pause sur la ponctuation, comme une respiration.
      const pause = /[.,:;!?]/.test(entry.text[shown - 1]) ? 6 : 1;
      timer = setTimeout(type, (1000 / LETTERS_PER_SECOND) * pause);
    } else {
      portrait.setSpeaking(false);
      timer = setTimeout(next, PAUSE_AFTER_MS);
    }
  }

  // Un clic sur la bulle termine la phrase en cours (ou passe à la suivante).
  bubble.addEventListener('click', () => {
    if (!entry) return;
    clearTimeout(timer);
    if (shown < entry.text.length) {
      shown = entry.text.length;
      draw();
      portrait.setSpeaking(false);
      timer = setTimeout(next, PAUSE_AFTER_MS);
    } else next();
  });

  function update() {
    if (game.log.length <= seen) return;
    queue.push(...game.log.slice(seen));
    seen = game.log.length;
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    if (!entry) next();
    else draw();
  }

  update();
  return { update };
}
