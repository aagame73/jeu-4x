// Écran de diplomatie (touche D) : les empires rencontrés, leur attitude, et la négociation à deux
// colonnes. Les règles sont dans diplomacy.js ; un échange se signe par signDeal (game.js).
import { createAlienPortrait } from './aliens.js';
import { DIPLOMACY, SPECIES } from './config.js';
import { attitudeOf, peacePrice, buyableTechs, counterOffer, describeOffer, dropProposal, evaluateDeal, pendingProposal, relationReasons, rivalsOf, sellableTechs, treatyActive } from './diplomacy.js';
import { line } from './dialogues.js';
import { RESOURCE_LABELS } from './economy.js';
import { declareWarOn, signDeal } from './game.js';
import { TECHS } from './research.js';
import { rivalInfo } from './species.js';

const MATERIALS = Object.keys(DIPLOMACY.values);

// Raison précise d'un refus, affichée sous la réplique de l'espèce (dialogues.js).
const REFUSALS = {
  'nothing-free': 'Rien n\'est gratuit : chacun doit donner quelque chose.',
  hostile: 'Nous n\'avons rien à vous dire.',
  invalid: 'Cette offre n\'a aucun sens.',
  'player-short': 'Vous n\'avez pas de quoi tenir cette offre.',
  'empire-short': 'Nous n\'avons pas autant à vous céder.',
  'tech-closed': 'Ce savoir-là ne s\'échange pas.',
  'tech-give': 'Cette technologie ne nous est d\'aucune utilité pour l\'instant.',
  'tech-take': 'Vous n\'êtes pas prêts pour ce savoir.',
  'tech-delay': 'Laissez passer du temps avant un nouvel échange de savoir.',
  'map-give': 'Votre carte ne nous apprendrait rien de neuf pour l\'instant.',
  'map-take': 'Nos cartes ne vous apprendraient rien de plus.',
  'treaty-attitude': 'Nous ne vous faisons pas assez confiance pour cela.',
  'treaty-active': 'Cet accord est déjà en vigueur.',
  war: 'Nous sommes en guerre : seule la paix se négocie.',
  unbalanced: 'Votre offre est trop faible.',
};

const emptyOffer = () => ({ give: { resources: {}, techs: [], map: false }, get: { resources: {}, techs: [], map: false, treaties: [], peace: false } });
const metEmpires = (game) => game.empires.filter((e) => e.met);

export function createDiplomacyView(root, game, actions) {
  let selected = null;
  let offer = emptyOffer();
  let reply = null; // { text, ok, counter }
  let confirmWar = false; // la déclaration de guerre se confirme par un second clic
  let listPortraits = [];
  let portrait = null;

  function stopListPortraits() {
    listPortraits.forEach((p) => p.destroy());
    listPortraits = [];
  }

  function stopPortraits() {
    stopListPortraits();
    portrait?.destroy();
    portrait = null;
  }

  function materialRows(side, empire) {
    return MATERIALS.map((res) => {
      const have = side === 'give' ? Math.floor(game.resources[res] ?? 0) : Math.floor(empire.stocks[res]);
      const value = offer[side].resources[res] ?? 0;
      return `<label class="dp-row"><span>${RESOURCE_LABELS[res] ?? res}</span><small>${side === 'give' ? 'Stock' : 'Dispo'} ${have}</small>
        <span class="dp-stepper"><button type="button" data-step="-1" aria-label="Moins" tabindex="-1">−</button><input type="number" min="0" max="${have}" step="1" value="${value}" data-side="${side}" data-res="${res}" aria-label="${RESOURCE_LABELS[res] ?? res}" /><button type="button" data-step="1" aria-label="Plus" tabindex="-1">+</button></span></label>`;
    }).join('');
  }

  function techRows(side, empire) {
    const list = side === 'give' ? sellableTechs(game, empire) : buyableTechs(game, empire);
    if (!list.length) return '<p class="muted small">Aucune technologie à échanger.</p>';
    return list
      .map((key) => `<label class="dp-check"><input type="checkbox" data-side="${side}" data-tech="${key}" ${offer[side].techs.includes(key) ? 'checked' : ''} /><span>${TECHS[key].label}<small>palier ${TECHS[key].tier}</small></span></label>`)
      .join('');
  }

  function treatyRows(empire) {
    return Object.entries(DIPLOMACY.treaties)
      .map(([key, t]) => {
        const active = treatyActive(game, empire, key);
        const need = attitudeOf(t.minRelation).label;
        return `<label class="dp-check"><input type="checkbox" data-treaty="${key}" ${offer.get.treaties.includes(key) ? 'checked' : ''} ${active ? 'disabled' : ''} /><span>${t.label}<small>${active ? 'en cours' : `${t.days} jours · attitude ${need} minimum`}</small></span></label>`;
      })
      .join('');
  }

  function peaceRow(empire) {
    const prices = ['minerais', 'alliages', 'deuterium'].map((res) => `${peacePrice(empire, res)} ${(RESOURCE_LABELS[res] ?? res).toLowerCase()}`).join(', ou ');
    return `<p class="small">En guerre, seule la paix se négocie. Elle s'achète : par exemple ${prices} (ou un mélange).</p>
      <label class="dp-check"><input type="checkbox" data-peace ${offer.get.peace ? 'checked' : ''} /><span>La paix<small>suivie d'une trêve de ${DIPLOMACY.truceDays} jours</small></span></label>`;
  }

  function opinion(empire) {
    const answer = evaluateDeal(game, empire, offer);
    if (answer.ok) return { cls: 'good', text: 'Cette offre devrait lui convenir.' };
    return { cls: answer.reason === 'nothing-free' ? 'idle' : 'bad', text: REFUSALS[answer.reason] };
  }

  function renderOpinion(empire) {
    const el = root.querySelector('#dp-opinion');
    if (!el) return;
    const { cls, text } = opinion(empire);
    el.className = `dp-opinion ${cls}`;
    el.textContent = text;
  }

  function renderDetail() {
    const detail = root.querySelector('#dp-detail');
    const empire = selected;
    if (!empire) return;
    const rival = rivalInfo(empire.species);
    const attitude = attitudeOf(empire.relation);
    const reasons = relationReasons(game, empire);
    const enemies = rivalsOf(empire.species).map((k) => SPECIES[k].label);
    const treaties = Object.keys(DIPLOMACY.treaties).filter((k) => treatyActive(game, empire, k));
    detail.style.setProperty('--empire', rival.accent);
    detail.querySelector('.dp-info').innerHTML = `
      <h3>${rival.empire}</h3>
      <p class="dp-species">${rival.label}</p>
      <p><span class="dp-attitude ${attitude.key}">${attitude.label}</span>${empire.war ? ` <span class="dp-war">En guerre depuis ${Math.max(0, Math.floor(game.time - empire.warSince))} jours</span>` : ''}</p>
      ${!empire.war && game.time < empire.truceUntil ? `<p class="small">Trêve encore ${Math.ceil(empire.truceUntil - game.time)} jours.</p>` : ''}
      ${reasons.length ? `<ul class="dp-reasons">${reasons.map((r) => `<li>${r}</li>`).join('')}</ul>` : ''}
      <p class="small"><b>Rivaux :</b> ${enemies.join(', ') || 'aucun'}. Commercer ici fera baisser votre note auprès d'eux.</p>
      <p class="small"><b>Accords en cours :</b> ${treaties.map((k) => `${DIPLOMACY.treaties[k].label} (encore ${Math.ceil(empire.treaties[k] - game.time)} jours)`).join(', ') || 'aucun'}</p>`;
    detail.querySelector('.dp-deal').innerHTML = `
      ${proposalBox(empire)}
      <div class="dp-columns">
        <section>
          <h4>Vous donnez</h4>
          ${materialRows('give', empire)}
          <div class="dp-extras">
            <div><h5>Technologies</h5>${techRows('give', empire)}</div>
            <div>
              <h5>Cartes</h5>
              <label class="dp-check"><input type="checkbox" data-side="give" data-map ${offer.give.map ? 'checked' : ''} /><span>Votre carte de l'amas</span></label>
            </div>
          </div>
        </section>
        <section>
          <h4>Vous recevez</h4>
          ${empire.war ? peaceRow(empire) : `${materialRows('get', empire)}
          <div class="dp-extras">
            <div><h5>Technologies</h5>${techRows('get', empire)}</div>
            <div>
              <h5>Cartes</h5>
              <label class="dp-check"><input type="checkbox" data-side="get" data-map ${offer.get.map ? 'checked' : ''} /><span>La carte de ses colonies</span></label>
              <h5>Accords</h5>${treatyRows(empire)}
            </div>
          </div>`}
        </section>
      </div>
      <div id="dp-opinion" class="dp-opinion"></div>
      ${reply ? `<div class="dp-reply ${reply.ok === null ? 'greet' : reply.ok ? 'ok' : 'no'}">« ${reply.text} »${reply.detail ? `<small class="dp-why">${reply.detail}</small>` : ''}${reply.counter ? `<div class="dp-counter">Contre-proposition : ${reply.counter.get.resources ? Object.entries(reply.counter.get.resources).map(([res, n]) => `${n} ${(RESOURCE_LABELS[res] ?? res).toLowerCase()}`).join(', ') : ''} <button data-dp="counter">Accepter</button></div>` : ''}</div>` : ''}
      <div class="dp-actions">${empire.war ? '' : `<button class="dp-war-btn${confirmWar ? ' armed' : ''}" data-dp="war">${confirmWar ? `Confirmer : guerre aux ${rivalInfo(empire.species).label}` : 'Déclarer la guerre'}</button>`}<span class="dp-spacer"></span><button data-dp="reset">Vider l'offre</button><button class="primary" data-dp="propose">${empire.war ? 'Proposer la paix' : "Proposer l'échange"}</button></div>`;
    renderOpinion(empire);
  }

  function proposalBox(empire) {
    const proposal = pendingProposal(game, empire);
    if (!proposal) return '';
    const days = Math.max(0, Math.ceil(proposal.expires - game.time));
    return `<div class="dp-proposal"><b>Proposition en attente</b> (encore ${days} jours) : ${describeOffer(proposal.offer)}.
      <span class="dp-proposal-actions"><button data-dp="decline">Refuser</button><button class="primary" data-dp="accept-proposal">Accepter</button></span></div>`;
  }

  function renderList() {
    const list = root.querySelector('#dp-list');
    const empires = metEmpires(game);
    stopListPortraits(); // le grand portrait de l'empire choisi continue de vivre
    list.innerHTML = empires
      .map((e, i) => {
        const r = rivalInfo(e.species);
        const a = attitudeOf(e.relation);
        const waiting = pendingProposal(game, e) ? '<i class="dp-badge" title="Proposition en attente">!</i>' : '';
        return `<button class="dp-card" data-empire="${i}" style="--empire:${r.accent}"><canvas class="dp-mini"></canvas><span><b>${r.empire}</b><small>${r.label}</small><i class="dp-attitude ${a.key}">${a.label}</i></span>${waiting}</button>`;
      })
      .join('');
    list.querySelectorAll('.dp-card').forEach((el, i) => {
      el.classList.toggle('selected', empires[i] === selected);
      listPortraits.push(createAlienPortrait(el.querySelector('canvas'), empires[i].species));
    });
  }

  function select(empire) {
    selected = empire;
    confirmWar = false;
    offer = emptyOffer();
    reply = null;
    root.querySelectorAll('.dp-card').forEach((el) => el.classList.toggle('selected', metEmpires(game)[Number(el.dataset.empire)] === empire));
    portrait?.destroy();
    portrait = null;
    const big = root.querySelector('.dp-portrait');
    if (empire) {
      portrait = createAlienPortrait(big, empire.species);
      root.querySelector('#dp-detail').hidden = false;
    } else root.querySelector('#dp-detail').hidden = true;
    root.querySelector('#dp-none').hidden = metEmpires(game).length > 0;
    if (empire) say(line(empire.species, attitudeOf(empire.relation).key === 'hostile' ? 'refusHostile' : 'accueil'), null);
    renderDetail();
  }

  // ok : true (accord), false (refus) ou null (simple parole, comme l'accueil).
  function say(text, ok, counter = null, detail = '') {
    reply = { text, ok, counter, detail };
    portrait?.setSpeaking(true);
    setTimeout(() => portrait?.setSpeaking(false), 1800);
  }

  function propose(deal) {
    const species = selected.species;
    const answer = signDeal(game, selected, deal);
    if (answer.ok) {
      offer = emptyOffer();
      say(line(species, deal.get.peace ? 'paix' : 'accepte'), true);
      renderList();
      actions.refresh();
    } else {
      const counter = counterOffer(game, selected, deal);
      const situation = counter ? 'contreOffre' : answer.reason === 'unbalanced' ? 'refusFaible' : answer.reason === 'hostile' ? 'refusHostile' : 'refus';
      const detail = ['unbalanced', 'hostile'].includes(answer.reason) ? '' : REFUSALS[answer.reason];
      say(line(species, situation), false, counter, detail);
    }
    renderDetail();
  }

  root.addEventListener('input', (e) => {
    const { side, res } = e.target.dataset;
    if (!res) return;
    const amount = Math.max(0, Math.floor(Number(e.target.value) || 0));
    if (amount) offer[side].resources[res] = amount;
    else delete offer[side].resources[res];
    reply = null;
    root.querySelector('.dp-reply')?.remove();
    renderOpinion(selected);
  });

  root.addEventListener('change', (e) => {
    const { side, tech, treaty } = e.target.dataset;
    if ('peace' in e.target.dataset) offer.get.peace = e.target.checked;
    else if (tech) {
      const list = offer[side].techs;
      if (e.target.checked) list.push(tech);
      else list.splice(list.indexOf(tech), 1);
    } else if (treaty) {
      const list = offer.get.treaties;
      if (e.target.checked) list.push(treaty);
      else list.splice(list.indexOf(treaty), 1);
    } else if ('map' in e.target.dataset) {
      offer[side].map = e.target.checked;
    } else return;
    reply = null;
    root.querySelector('.dp-reply')?.remove();
    renderOpinion(selected);
  });

  root.addEventListener('click', (e) => {
    const step = e.target.closest('[data-step]');
    if (step) {
      e.preventDefault(); // le bouton est dans un label : ne pas redonner le focus au champ
      const input = step.parentElement.querySelector('input');
      const [step10, step100] = DIPLOMACY.inputSteps;
      const rare = DIPLOMACY.values[input.dataset.res] >= DIPLOMACY.rareValue; // Vélarine et artefacts : à l'unité
      const size = rare ? 1 : e.shiftKey ? step100 : step10;
      input.value = Math.max(0, Math.min(Number(input.max), (Number(input.value) || 0) + Number(step.dataset.step) * size));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    const card = e.target.closest('[data-empire]');
    if (card) {
      select(metEmpires(game)[Number(card.dataset.empire)]);
      return;
    }
    const action = e.target.closest('[data-dp]')?.dataset.dp;
    if (action === 'close') actions.onCloseDiplomacy();
    else if (action === 'reset') {
      offer = emptyOffer();
      reply = null;
      renderDetail();
    } else if (action === 'propose') propose(offer);
    else if (action === 'war') {
      if (!confirmWar) {
        confirmWar = true;
        renderDetail();
        return;
      }
      confirmWar = false;
      if (declareWarOn(game, selected)) {
        offer = emptyOffer();
        say(line(selected.species, 'guerre'), false);
        renderList();
        actions.refresh();
      }
      renderDetail();
    }
    else if (action === 'accept-proposal') {
      const proposal = pendingProposal(game, selected);
      dropProposal(game, selected.species);
      if (proposal?.offer) propose(proposal.offer);
      else renderDetail(); // échue entre-temps
      renderList();
    } else if (action === 'decline') {
      dropProposal(game, selected.species);
      say(line(selected.species, 'refus'), null);
      renderList();
      renderDetail();
    }
    else if (action === 'counter') propose(reply.counter);
  });

  root.innerHTML = `
    <div class="diplomacy panel" role="dialog" aria-label="Diplomatie">
      <header class="dp-head"><h2>Diplomatie</h2><button data-dp="close" title="Fermer (D)">Fermer</button></header>
      <div class="dp-body">
        <aside id="dp-list" class="dp-list"></aside>
        <p id="dp-none" class="muted dp-none">Aucun empire rencontré. Explorez l'amas : on découvre un rival en analysant un système où il est présent.</p>
        <div id="dp-detail" class="dp-detail" hidden>
          <div class="dp-top"><canvas class="dp-portrait"></canvas><div class="dp-info"></div></div>
          <div class="dp-deal"></div>
        </div>
      </div>
    </div>`;

  return {
    get isOpen() {
      return !root.hidden;
    },
    open() {
      root.hidden = false;
      renderList();
      const empires = metEmpires(game);
      select(empires.includes(selected) ? selected : (empires[0] ?? null));
    },
    close() {
      root.hidden = true;
      stopPortraits();
      selected = null;
    },
  };
}
