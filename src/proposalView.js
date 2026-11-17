// Fenêtre d'une proposition d'un empire rival (docs/plan-jouabilite.md, E) : elle s'ouvre au centre
// de l'écran dès qu'une proposition arrive, avec le portrait du rival, sa réplique et l'offre.
// Le jeu est en pause tant qu'elle est ouverte. Accepter signe l'échange (signDeal), Refuser le
// décline ; « Plus tard » la referme sans répondre (elle reste dans la diplomatie jusqu'à expiration).
import { createAlienPortrait } from './aliens.js';
import { rivalInfo } from './species.js';
import { line } from './dialogues.js';
import { describeOffer, dropProposal, pendingProposal } from './diplomacy.js';
import { acceptPeace, refuseProposal, signDeal } from './game.js';
import { REFUSALS } from './diplomacyView.js';

const FADE_MS = 250;

// canShow() : faux tant qu'un autre écran occupe le joueur (premier contact, fin de partie…).
export function createProposalView(game, { canShow, onChange, onOpenDiplomacy }) {
  const seen = new Set(); // propositions déjà montrées pendant cette séance
  let current = null; // { el, portrait, empire, proposal, resumeTo }

  const keyOf = (p) => `${p.species}:${p.expires}`;

  function close(after) {
    if (!current) return;
    const { el, portrait, resumeTo } = current;
    current = null;
    window.removeEventListener('keydown', onKey, true);
    el.classList.remove('visible');
    setTimeout(() => {
      portrait.destroy();
      el.remove();
    }, FADE_MS);
    game.paused = resumeTo;
    onChange();
    after?.();
  }

  // La fenêtre garde le clavier : Échap = plus tard, Entrée = accepter.
  function onKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey || /^(F\d+|Tab)$/.test(e.key)) return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape') close();
    else if (e.key === 'Enter') current?.el.querySelector('[data-pr="accept"]:not(:disabled)')?.click();
  }

  function refusal(text) {
    const box = current.el.querySelector('.pr-reply');
    box.textContent = text;
    box.className = 'pr-reply bad';
  }

  function onClick(e) {
    const action = e.target.closest('[data-pr]')?.dataset.pr;
    if (!action || !current) return;
    const { empire, proposal } = current;
    if (action === 'later') close();
    else if (action === 'diplomacy') close(() => onOpenDiplomacy(empire.species));
    else if (action === 'refuse') {
      refuseProposal(game, empire);
      close();
    } else if (action === 'accept') {
      if (!pendingProposal(game, empire)) return close(); // expirée entre-temps
      if (proposal.peace) {
        acceptPeace(game, empire);
        return close();
      }
      // Même chemin que dans la diplomatie : on signe l'offre, puis on retire la proposition.
      const result = signDeal(game, empire, proposal.offer);
      if (result.ok) {
        dropProposal(game, empire.species);
        close();
      } else {
        refusal(REFUSALS[result.reason] ?? "L'échange n'est plus possible.");
        current.el.querySelector('[data-pr="accept"]').disabled = true;
      }
    }
  }

  function show(empire, proposal) {
    const rival = rivalInfo(empire.species);
    const days = Math.max(0, Math.ceil(proposal.expires - game.time));
    const el = document.createElement('div');
    el.className = 'proposal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `Proposition : ${rival.empire}`);
    el.style.setProperty('--empire', rival.accent);
    const quote = line(empire.species, proposal.peace ? 'offrePaix' : 'proposition');
    // describeOffer : « ce que vous donnez contre ce que vous recevez ».
    const [give, get] = proposal.peace ? [] : describeOffer(proposal.offer).split(' contre ');
    const what = proposal.peace
      ? '<p class="pr-offer">Ils proposent <b>la paix, sans condition</b> (trêve aussitôt signée).</p>'
      : `<p class="pr-offer">Vous donnez : <b>${give}</b></p><p class="pr-offer">Vous recevez : <b class="get">${get}</b></p>`;
    el.innerHTML = `
      <div class="pr-box panel">
        <canvas class="pr-portrait"></canvas>
        <div class="pr-text">
          <span class="pr-kicker">${proposal.peace ? 'Offre de paix' : "Proposition d'échange"}</span>
          <strong>${rival.empire}</strong>
          <p class="pr-quote">« ${quote} »</p>
          ${what}
          <p class="pr-hint muted small">Offre valable ${days} jour${days > 1 ? 's' : ''}. Le jeu est en pause.</p>
          <p class="pr-reply"></p>
          <div class="pr-actions">
            <button class="primary" data-pr="accept">Accepter</button>
            <button data-pr="refuse">Refuser</button>
            <button data-pr="diplomacy" title="Ouvrir la diplomatie avec cet empire">Diplomatie</button>
            <button data-pr="later" title="Fermer sans répondre (Échap) : l'offre reste valable">Plus tard</button>
          </div>
        </div>
      </div>`;
    document.body.append(el);
    el.addEventListener('click', onClick);
    const portrait = createAlienPortrait(el.querySelector('.pr-portrait'), empire.species);
    current = { el, portrait, empire, proposal, resumeTo: game.paused };
    game.paused = true;
    window.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => el.classList.add('visible'));
    portrait.setSpeaking(true);
    setTimeout(() => portrait.setSpeaking(false), 2200);
    onChange();
  }

  // Appelé à chaque rafraîchissement : montre la plus ancienne proposition pas encore vue.
  function update() {
    if (current) return;
    try {
      if (!canShow()) return;
    } catch {
      return; // au démarrage, certains écrans ne sont pas encore créés
    }
    for (const proposal of game.proposals) {
      if (seen.has(keyOf(proposal))) continue;
      const empire = game.empires.find((e) => e.species === proposal.species);
      if (!empire || !pendingProposal(game, empire)) continue;
      seen.add(keyOf(proposal));
      show(empire, proposal);
      return;
    }
  }

  return {
    update,
    get isOpen() {
      return !!current;
    },
  };
}
