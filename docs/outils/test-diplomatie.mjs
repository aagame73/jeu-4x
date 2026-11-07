// Tests de la diplomatie (docs/plan-diplomatie.md). Usage : node docs/outils/test-diplomatie.mjs .
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const D = await imp('diplomacy.js');
const S = await imp('species.js');
const { DIPLOMACY, SPECIES } = await imp('config.js');
const { TECHS } = await imp('research.js');
const { restore, serialize } = await imp('save.js');

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`);
  if (!ok) fails++;
};
const copy = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// Attitudes et table des rivalités.
{
  const label = (r) => D.attitudeOf(r).label;
  check(label(100) === 'Allié' && label(60) === 'Allié' && label(59) === 'Amical' && label(20) === 'Amical', 'seuils Allié et Amical');
  check(label(19) === 'Neutre' && label(-19) === 'Neutre' && label(-20) === 'Méfiant' && label(-59) === 'Méfiant' && label(-60) === 'Hostile' && label(-100) === 'Hostile', 'seuils Neutre, Méfiant et Hostile');
  check(label(19.4) === 'Neutre' && label(19.6) === 'Amical' && label(-19.4) === 'Neutre' && label(-19.6) === 'Méfiant', 'une note non entière est arrondie');
  let holes = 0;
  for (let r = -100; r <= 100; r += 0.01) if (!D.attitudeOf(r)) holes++;
  check(holes === 0, 'aucune note sans attitude');
  check(S.playableSpecies().every((k) => typeof D.startRelation(k) === 'number'), 'chaque espèce a une note de départ');
  check(DIPLOMACY.rivalries.flat().every((k) => SPECIES[k] && !SPECIES[k].hidden), 'la table des rivalités ne cite que des espèces jouables');
  check(D.rivalsOf('vaskhar').sort().join() === 'liseurs,ondesiens', 'rivaux des Vaskhar : Ondésiens et Liseurs');
  check(D.rivalsOf('ondesiens').join() === 'vaskhar', 'une rivalité vaut dans les deux sens');
}

// Départ, bornes, rencontre.
{
  const game = G.createGame(42, 'synodes', 7);
  check(game.empires.every((e) => e.relation === D.startRelation(e.species)), 'note de départ selon le style');
  const e = game.empires[0];
  D.changeRelation(e, 500);
  check(e.relation === 100, 'note bornée à 100');
  D.changeRelation(e, -500);
  check(e.relation === -100, 'note bornée à -100');
  e.relation = D.startRelation(e.species);

  const before = e.relation;
  game.colonies.push({ starId: game.stars[e.homeId].id, planetIndex: 0 });
  D.reactToDig(game);
  for (let d = 0; d < 300; d++) {
    game.time += 1;
    D.tickDiplomacy(game, 1);
  }
  check(e.relation === before, 'un empire non rencontré ne réagit pas');
  game.colonies.length = 0;
}

// Fouilles selon l'espèce.
{
  const game = G.createGame(42, 'vaskhar', 7);
  game.empires.forEach((e) => (e.met = true));
  const before = new Map(game.empires.map((e) => [e.species, e.relation]));
  D.reactToDig(game);
  const delta = (k) => game.empires.find((e) => e.species === k).relation - before.get(k);
  check(delta('ondesiens') < 0 && delta('orrhaides') < 0, 'fouille : Ondésiens et Orrhaïdes mécontents');
  check(delta('synodes') > 0 && delta('liseurs') > 0, 'fouille : Synodes et Liseurs intéressés');
}

// Évolution sur 2 000 jours, et indépendance à la vitesse du jeu.
function run(step, days = 2000, withColony = true) {
  const game = G.createGame(42, 'vaskhar', 4);
  const e = game.empires[0];
  e.met = true;
  e.relation = 80;
  if (withColony) game.colonies.push({ starId: e.homeId, planetIndex: 0 });
  for (let t = 0; t < days; t += step) {
    game.time += step;
    D.tickDiplomacy(game, step);
  }
  return e;
}
{
  const calm = run(1, 2000, false);
  check(near(calm.relation, D.startRelation(calm.species), 0.5), `sans contact, retour à la note de départ (${calm.relation.toFixed(1)})`);
  const pressed = run(1);
  check(pressed.relation < D.startRelation(pressed.species) - 1, `colonie du joueur à proximité : note plus basse (${pressed.relation.toFixed(1)})`);
  check(near(run(1).relation, run(0.25).relation) && near(run(1).relation, run(4).relation), 'même résultat aux pas de 0,25, 1 et 4 jours');
}

// Sauvegardes.
{
  const game = G.createGame(42, 'vaskhar', 5);
  game.empires[0].relation = -37.5;
  const back = restore(copy(serialize(game)));
  check(back.empires[0].relation === -37.5, 'la note survit à la sauvegarde');
  const noField = copy(serialize(game));
  noField.empires.forEach((e) => delete e.relation);
  check(restore(noField).empires.every((e) => e.relation === D.startRelation(e.species)), 'sauvegarde sans note : note de départ');
  const noEmpires = copy(serialize(game));
  delete noEmpires.empires;
  check(restore(noEmpires).empires.every((e) => e.relation === D.startRelation(e.species)), 'sauvegarde sans empires : note de départ');
  for (const bad of ['x', null, NaN, 9999, -9999]) {
    const data = copy(serialize(game));
    data.empires[0].relation = bad;
    const r = restore(data).empires[0].relation;
    check(Number.isFinite(r) && r >= -100 && r <= 100, `note invalide (${String(bad)}) : remplacée (${r})`);
  }
}

// Étape 2 : stocks des rivaux.
{
  const MATERIALS = Object.keys(DIPLOMACY.stockCap);
  check(!MATERIALS.includes('energie'), "l'énergie ne fait pas partie des stocks");
  let negative = 0;
  let overCap = 0;
  let grew = true;
  let total = 0;
  const E = await imp('empires.js');
  for (const seed of [1, 42, 77]) {
    const game = G.createGame(seed, 'vaskhar', 7);
    const first = copy(game.empires.map((e) => e.stocks));
    for (let d = 0; d < 5000; d++) {
      game.time += 1;
      E.tickEmpires(game, 1);
      D.tickDiplomacy(game, 1);
      for (const e of game.empires) {
        for (const res of MATERIALS) {
          if (!(e.stocks[res] >= 0)) negative++;
          if (e.stocks[res] > DIPLOMACY.stockCap[res] * e.colonies.length + 1e-9) overCap++;
          total++;
        }
      }
    }
    game.empires.forEach((e, i) => {
      if (!(e.stocks.minerais > first[i].minerais)) grew = false;
    });
  }
  check(total > 0 && negative === 0, 'stocks jamais négatifs sur 5 000 jours');
  check(overCap === 0, 'stocks jamais au-dessus du plafond');
  check(grew, 'les stocks montent avec le temps');
}
{
  const game = G.createGame(42, 'ondesiens', 7);
  const pick = (k) => game.empires.find((e) => e.species === k);
  const a = pick('vaskhar');
  const b = pick('synodes');
  a.stocks.minerais = 0;
  b.stocks.minerais = 0;
  game.time += 1;
  D.tickDiplomacy(game, 1);
  check(a.stocks.minerais > b.stocks.minerais, `bonus d'espèce appliqué : Vaskhar plus riches en minerais que Synodes`);
  check(game.empires.filter((e) => !e.colonies.some((c) => game.stars[c.starId].planets[c.planetIndex].ruins)).every((e) => e.stocks.artefacts === 0), 'pas de ruines, pas d\'artefacts');
}
{
  const game = G.createGame(42, 'vaskhar', 5);
  const noStocks = copy(serialize(game));
  noStocks.empires.forEach((e) => delete e.stocks);
  const r = restore(noStocks);
  check(r.empires.every((e) => Number.isFinite(e.stocks.minerais) && e.stocks.minerais > 0), 'sauvegarde sans stocks : stocks de départ');
  for (const bad of ['x', -5, null]) {
    const data = copy(serialize(game));
    data.empires[0].stocks.minerais = bad;
    const v = restore(data).empires[0].stocks.minerais;
    check(Number.isFinite(v) && v >= 0, `stock invalide (${String(bad)}) : remplacé`);
  }
  game.empires[0].stocks.alliages = 12.5;
  check(restore(copy(serialize(game))).empires[0].stocks.alliages === 12.5, 'les stocks survivent à la sauvegarde');
}

// Étape 2 : technologies des rivaux.
{
  const empire = (species, power) => ({ species, power, extraTechs: [] });
  check(D.rivalTechs(empire('vaskhar', 0)).length === 0, 'puissance nulle : aucune technologie');
  let badReq = 0;
  let badTier = 0;
  let notMono = 0;
  let artefacts = 0;
  for (const species of S.playableSpecies()) {
    let previous = new Set();
    for (let power = 0; power <= 150; power += 1) {
      const list = D.rivalTechs(empire(species, power));
      const set = new Set(list);
      const cap = DIPLOMACY.techTierPower.filter((p) => power >= p).length;
      for (const k of list) {
        if (TECHS[k].requires.some((r) => !set.has(r))) badReq++;
        if (TECHS[k].tier > cap) badTier++;
        if (TECHS[k].artefacts) artefacts++;
      }
      if ([...previous].some((k) => !set.has(k))) notMono++;
      previous = set;
    }
  }
  check(badReq === 0, 'chaque technologie a ses prérequis');
  check(badTier === 0, 'palier toujours autorisé par la puissance');
  check(notMono === 0, 'une technologie connue le reste quand la puissance monte');
  check(artefacts === 0, "pas de technologie à artefacts");
  const has = (species, power, branch) => D.rivalTechs(empire(species, power)).filter((k) => TECHS[k].branch === branch).length;
  check(has('thrennes', 25, 'armement') >= has('ondesiens', 25, 'armement'), 'le style oriente les technologies (armement : Thrennes au moins autant qu\'Ondésiens)');
}

// Étape 3 : échanges.
function trader(species = 'vaskhar', partner = 'ondesiens') {
  const game = G.createGame(42, species, 7);
  const empire = game.empires.find((e) => e.species === partner);
  empire.met = true;
  empire.relation = 30; // amical
  empire.stocks.biomasse = 100;
  game.resources.minerais = 1000;
  return { game, empire };
}
const deal = (give, get) => ({ give: { resources: {}, ...give }, get: { resources: {}, ...get } });
{
  const { game, empire } = trader();
  const stockBefore = empire.stocks.biomasse;
  const mineBefore = game.resources.minerais;
  const bioBefore = game.resources.biomasse;
  const good = deal({ resources: { minerais: 200 } }, { resources: { biomasse: 10 } });
  const answer = G.signDeal(game, empire, good);
  check(answer.ok, 'offre rentable : acceptée');
  check(game.resources.minerais === mineBefore - 200 && game.resources.biomasse === bioBefore + 10, 'les matières changent de main');
  check(empire.stocks.biomasse === stockBefore - 10, "le stock de l'empire baisse d'autant");

  const before = JSON.stringify(game.resources);
  check(G.signDeal(game, empire, deal({}, { resources: { biomasse: 1 } })).reason === 'nothing-free', 'demander sans rien donner : toujours refusé');
  check(G.signDeal(game, empire, deal({ resources: { minerais: 1 } }, {})).reason === 'nothing-free', 'donner sans rien recevoir : refusé aussi');
  check(G.signDeal(game, empire, deal({ resources: { minerais: 1 } }, { resources: { biomasse: 90 } })).reason === 'unbalanced', 'offre trop faible : refusée');
  check(G.signDeal(game, empire, deal({ resources: { minerais: 2000 } }, { resources: { biomasse: 1 } })).reason === 'player-short', 'le joueur ne peut pas donner ce qu\'il n\'a pas');
  check(G.signDeal(game, empire, deal({ resources: { minerais: 800 } }, { resources: { biomasse: 5000 } })).reason === 'empire-short', "l'empire ne peut pas donner ce qu'il n'a pas");
  for (const bad of [{ minerais: -5 }, { minerais: 1.5 }, { energie: 5 }]) {
    check(G.signDeal(game, empire, deal({ resources: bad }, { resources: { biomasse: 1 } })).reason === 'invalid', `quantité ou matière invalide refusée : ${JSON.stringify(bad)}`);
  }
  check(JSON.stringify(game.resources) === before, 'une offre refusée ne change rien');
}
{
  const { game, empire } = trader();
  const offer = deal({ resources: { minerais: 100 } }, { resources: { biomasse: 10 } });
  empire.met = false;
  check(G.signDeal(game, empire, offer).reason === 'unknown', 'empire non rencontré : pas de négociation');
  empire.met = true;
  empire.relation = -80;
  check(G.signDeal(game, empire, offer).reason === 'hostile', 'empire hostile : refuse tout');
  const small = deal({ resources: { minerais: 10 } }, { resources: { biomasse: 17 } });
  empire.relation = 70;
  const friendly = D.evaluateDeal(game, empire, small).ok;
  empire.relation = -40;
  const wary = D.evaluateDeal(game, empire, small).ok;
  check(friendly && !wary, 'la même offre passe auprès d\'un allié, pas d\'un empire méfiant');
}
{
  const { game, empire } = trader();
  empire.stocks.minerais = 0;
  const poor = D.evaluateDeal(game, empire, deal({ resources: { minerais: 10 } }, { resources: { biomasse: 1 } })).received;
  empire.stocks.minerais = 1e9;
  const rich = D.evaluateDeal(game, empire, deal({ resources: { minerais: 10 } }, { resources: { biomasse: 1 } })).received;
  check(poor > rich, 'une matière rare chez l\'empire vaut plus pour lui');
}
{
  const { game, empire } = trader();
  const offer = deal({ resources: { minerais: 20 } }, { resources: { biomasse: 60 } });
  check(D.evaluateDeal(game, empire, offer).reason === 'unbalanced', 'contre-offre : offre de départ trop faible');
  const counter = D.counterOffer(game, empire, offer);
  check(counter && counter.get.resources.biomasse < 60 && D.evaluateDeal(game, empire, counter).ok, `contre-offre acceptable (${counter?.get.resources.biomasse} au lieu de 60)`);
  check(counter.give === offer.give, 'la contre-offre ne demande pas plus au joueur');
  check(D.counterOffer(game, empire, deal({ resources: { minerais: 1 } }, { resources: { biomasse: 500 } })) === null || D.evaluateDeal(game, empire, D.counterOffer(game, empire, deal({ resources: { minerais: 1 } }, { resources: { biomasse: 500 } }))).reason !== 'unbalanced', 'contre-offre impossible : aucune, ou valable');
}
// Note auprès des rivaux du partenaire.
{
  const { game, empire } = trader('thrennes', 'ondesiens');
  const rival = game.empires.find((e) => e.species === 'vaskhar');
  const neutral = game.empires.find((e) => e.species !== 'vaskhar' && e.species !== 'ondesiens' && !D.rivalsOf('ondesiens').includes(e.species));
  rival.met = false;
  const b = { partner: empire.relation, rival: rival.relation, neutral: neutral.relation };
  const answer = G.signDeal(game, empire, deal({ resources: { minerais: 300 } }, { resources: { biomasse: 10 } }));
  check(answer.ok && empire.relation > b.partner, 'échange : note du partenaire en hausse');
  check(rival.relation < b.rival, 'échange : note des rivaux du partenaire en baisse, même non rencontrés');
  check(neutral.relation === b.neutral, 'échange : les autres ne bougent pas');
  check(b.rival - rival.relation >= DIPLOMACY.rivalPenaltyMin && b.rival - rival.relation <= DIPLOMACY.rivalPenaltyMax, 'la baisse reste dans ses bornes');
}
// Technologies.
{
  const { game, empire } = trader();
  empire.power = 100;
  const known = D.rivalTechs(empire);
  const free = known.find((k) => TECHS[k].tier < DIPLOMACY.closedTier && TECHS[k].requires.every((r) => game.research.done.includes(r)));
  game.resources.minerais = 5000;
  empire.stocks.minerais = 0;
  const got = G.signDeal(game, empire, deal({ resources: { minerais: 5000 } }, { techs: [free] }));
  check(got.ok && game.research.done.includes(free), `technologie reçue : ${free}`);
  check(game.log.some((l) => JSON.stringify(l).includes('obtenue par échange')), 'annoncée au journal');
  game.resources.minerais = 100;
  check(G.signDeal(game, empire, deal({ resources: { minerais: 1 } }, { techs: [free] })).reason === 'tech-take', 'technologie déjà connue : refusée');
  const other = known.find((k) => k !== free && TECHS[k].tier < DIPLOMACY.closedTier && TECHS[k].requires.every((r) => game.research.done.includes(r)));
  game.resources.minerais = 5000;
  check(G.signDeal(game, empire, deal({ resources: { minerais: 5000 } }, { techs: [other] })).reason === 'tech-delay', 'délai entre deux échanges de technologies');
  game.time += DIPLOMACY.techDelay + 1;
  const tier4 = Object.keys(TECHS).find((k) => TECHS[k].tier === DIPLOMACY.closedTier && !TECHS[k].artefacts);
  check(G.signDeal(game, empire, deal({ resources: { minerais: 1000 } }, { techs: [tier4] })).reason === 'tech-closed', 'le palier 4 ne s\'achète pas');
  const blocked = Object.keys(TECHS).find((k) => TECHS[k].tier < DIPLOMACY.closedTier && !TECHS[k].artefacts && known.includes(k) && TECHS[k].requires.some((r) => !game.research.done.includes(r)));
  check(!blocked || G.signDeal(game, empire, deal({ resources: { minerais: 1000 } }, { techs: [blocked] })).reason === 'tech-take', 'il faut les prérequis pour acheter');

  // Vente au rival.
  const buyer = trader();
  buyer.empire.power = 0;
  const key = Object.keys(TECHS).find((k) => TECHS[k].tier === 1 && !TECHS[k].requires.length && !TECHS[k].artefacts);
  check(G.signDeal(buyer.game, buyer.empire, deal({ techs: [key] }, { resources: { biomasse: 1 } })).reason === 'tech-give', 'on ne vend pas une technologie qu\'on n\'a pas');
  buyer.game.research.done.push(key);
  const p = buyer.empire.power;
  const sold = G.signDeal(buyer.game, buyer.empire, deal({ techs: [key] }, { resources: { biomasse: 1 } }));
  check(sold.ok && D.rivalTechs(buyer.empire).includes(key) && buyer.empire.power > p, 'technologie vendue : connue de l\'empire, puissance en hausse');
}
// Cartes.
{
  const { game, empire } = trader();
  const E = await imp('empires.js');
  for (let d = 0; d < 800; d++) {
    game.time += 1;
    E.tickEmpires(game, 1);
  }
  const hidden = empire.colonies.slice(1);
  check(hidden.length > 0 && hidden.every((c) => !game.stars[c.starId].planets[c.planetIndex].inhabitedBy), 'cartes : colonies cachées avant');
  game.resources.minerais = 3000;
  const bought = G.signDeal(game, empire, deal({ resources: { minerais: 3000 } }, { map: true }));
  check(bought.ok && hidden.every((c) => c.known && game.stars[c.starId].planets[c.planetIndex].inhabitedBy && game.stars[c.starId].level >= 2), 'carte achetée : colonies révélées');
  game.resources.minerais = 3000;
  check(G.signDeal(game, empire, deal({ resources: { minerais: 100 } }, { map: true })).reason === 'map-take', 'rien de nouveau à révéler : refusé');
  check(game.empires.filter((e) => e !== empire).every((e) => e.colonies.slice(1).every((c) => !c.known)), 'les autres empires restent cachés');
}
// Sauvegarde des échanges.
{
  const { game, empire } = trader();
  empire.extraTechs = ['cartographie'];
  empire.nextTechTrade = 321;
  empire.nextMapTrade = 654;
  const back = restore(copy(serialize(game))).empires.find((e) => e.species === empire.species);
  check(back.extraTechs.join() === 'cartographie' && back.nextTechTrade === 321 && back.nextMapTrade === 654, 'échanges conservés à la sauvegarde');
  const bad = copy(serialize(game));
  bad.empires.forEach((e) => {
    e.extraTechs = ['inconnue', 3];
    e.nextTechTrade = 'x';
  });
  const fixed = restore(bad).empires[0];
  check(fixed.extraTechs.length === 0 && fixed.nextTechTrade === 0, 'données d\'échange invalides : nettoyées');
}

// Le jeu complet appelle bien les relations.
{
  const game = G.createGame(42, 'vaskhar', 4);
  const e = game.empires[0];
  e.met = true;
  e.relation = 80;
  for (let d = 0; d < 50; d++) G.tick(game, 1);
  check(e.relation < 80, 'tick fait évoluer les notes');
}

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
