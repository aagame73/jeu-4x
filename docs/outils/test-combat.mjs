// Tests du combat (docs/plan-combat.md). Usage : node docs/outils/test-combat.mjs .
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const D = await imp('diplomacy.js');
const { DIPLOMACY } = await imp('config.js');
const { rivalInfo } = await imp('species.js');
const { restore, serialize } = await imp('save.js');

let fails = 0;
const check = (ok, msg) => {
  console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`);
  if (!ok) fails++;
};
const copy = (x) => JSON.parse(JSON.stringify(x));
const deal = (give, get) => ({ give: { resources: {}, ...give }, get: { resources: {}, ...get } });
const setup = (partner = 'ondesiens', player = 'thrennes') => {
  const game = G.createGame(42, player, 7);
  const empire = game.empires.find((e) => e.species === partner);
  empire.met = true;
  empire.relation = 30;
  game.resources.minerais = 5000;
  return { game, empire };
};

// Étape 1 : guerre et paix.
{
  const { game, empire } = setup('ondesiens', 'thrennes');
  const rival = game.empires.find((e) => D.rivalsOf('ondesiens').includes(e.species));
  const rivalBefore = rival.relation;
  empire.treaties.frontieres = 1e9;
  game.proposals.push({ species: empire.species, offer: deal({ resources: { minerais: 1 } }, { resources: { biomasse: 1 } }), expires: 1e9 });
  const other = game.empires.find((e) => e !== empire && e.species !== rival.species);
  other.met = false;
  check(G.declareWarOn(game, other) === false, 'pas de guerre contre un empire non rencontré');
  check(G.declareWarOn(game, empire) === true && empire.war, 'le joueur déclare la guerre');
  check(G.declareWarOn(game, empire) === false, 'pas deux déclarations de suite');
  check(empire.treaties.frontieres === 0 && !game.proposals.some((p) => p.species === empire.species), 'la guerre rompt les traités et annule les propositions');
  check(empire.relation <= DIPLOMACY.warRelation, `la note tombe (${empire.relation})`);
  check(rival.relation === Math.min(100, rivalBefore + DIPLOMACY.warRivalGain), 'ses rivaux apprécient');
  check(game.log.some((l) => JSON.stringify(l).includes('Vous déclarez la guerre')), 'annoncé au journal');

  check(G.signDeal(game, empire, deal({ resources: { minerais: 100 } }, { resources: { biomasse: 10 } })).reason === 'war', 'en guerre : plus de commerce');
  check(G.signDeal(game, empire, deal({ resources: { minerais: 100 } }, { peace: true, resources: { biomasse: 1 } })).reason === 'war', 'en guerre : seule la paix se négocie');
  check(G.signDeal(game, empire, deal({ resources: { minerais: 10 } }, { peace: true })).reason === 'unbalanced', 'la paix a un prix');
  const price = D.peacePrice(empire, 'minerais');
  check(G.signDeal(game, empire, deal({ resources: { minerais: price - 1 } }, { peace: true })).reason === 'unbalanced', `un minerai de moins que le prix affiché : refusé (prix ${price})`);
  const answer = G.signDeal(game, empire, deal({ resources: { minerais: price } }, { peace: true }));
  check(answer.ok && !empire.war, `la paix s'achète (${price} minerais)`);
  check(empire.truceUntil >= game.time + DIPLOMACY.truceDays - 1e-9 && empire.relation >= DIPLOMACY.peaceRelation, 'trêve et note relevée');
  check(game.log.some((l) => JSON.stringify(l).includes('Paix signée')), 'paix annoncée au journal');
  check(G.signDeal(game, empire, deal({ resources: { minerais: 10 } }, { peace: true })).reason === 'invalid', 'pas de paix hors guerre');
  check(G.signDeal(game, empire, deal({ resources: { minerais: 10 }, peace: true }, { resources: { biomasse: 1 } })).reason === 'invalid', 'le joueur ne vend pas la paix');
}
{
  // Un rival hostile déclare la guerre : jamais avant le délai de grâce, jamais pendant une trêve.
  const runRival = (species, days, start = 0, truce = 0) => {
    const game = G.createGame(77, 'vaskhar', 7);
    const e = game.empires.find((x) => x.species === species);
    e.met = true;
    e.truceUntil = truce;
    game.time = start;
    let declared = null;
    for (let d = 0; d < days && declared === null; d++) {
      game.time += 1;
      e.relation = -90; // reste hostile
      const ev = D.tickDiplomacy(game, 1).find((x) => x.type === 'war' && x.empire === e);
      if (ev) declared = game.time;
    }
    return declared;
  };
  check(runRival('thrennes', DIPLOMACY.graceDays - 1) === null, `aucune déclaration avant le jour ${DIPLOMACY.graceDays}`);
  const when = runRival('thrennes', 3000);
  check(when !== null && when >= DIPLOMACY.graceDays, `un rival hostile finit par déclarer la guerre (jour ${when})`);
  check(runRival('thrennes', 1000, 1000, 2100) === null, 'jamais pendant une trêve');
  const notHostile = (() => {
    const game = G.createGame(77, 'vaskhar', 7);
    const e = game.empires.find((x) => x.species === 'thrennes');
    e.met = true;
    game.time = 600;
    for (let d = 0; d < 2000; d++) {
      game.time += 1;
      e.relation = -30; // méfiant, pas hostile
      if (D.tickDiplomacy(game, 1).some((x) => x.type === 'war')) return false;
    }
    return true;
  })();
  check(notHostile, 'un empire seulement méfiant ne déclare pas la guerre');
  // Les espèces agressives déclarent plus vite (moyenne sur plusieurs graines).
  const avgDay = (species) => {
    let total = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const game = G.createGame(seed, species === 'vaskhar' ? 'thrennes' : 'vaskhar', 7);
      const e = game.empires.find((x) => x.species === species) ?? null;
      if (!e) continue;
      e.met = true;
      game.time = DIPLOMACY.graceDays;
      let day = 4000;
      for (let d = 0; d < 4000; d++) {
        game.time += 1;
        e.relation = -90;
        if (D.tickDiplomacy(game, 1).some((x) => x.type === 'war')) {
          day = d;
          break;
        }
      }
      total += day;
    }
    return total / 8;
  };
  const fast = avgDay('keltirr');
  const slow = avgDay('ondesiens');
  check(fast < slow, `Kel-Tirr plus prompts à la guerre que les Ondésiens (${Math.round(fast)} jours contre ${Math.round(slow)} en moyenne)`);
}
{
  // Le jeu complet annonce une déclaration de guerre.
  const game = G.createGame(77, 'vaskhar', 7);
  const e = game.empires.find((x) => x.species === 'thrennes');
  e.met = true;
  game.time = DIPLOMACY.graceDays;
  for (let d = 0; d < 3000 && !e.war; d++) {
    e.relation = -90;
    G.tick(game, 1);
  }
  check(e.war && game.log.some((l) => JSON.stringify(l).includes('vous déclarent la guerre')), 'le journal annonce la guerre déclarée par un rival');
}
{
  // Sauvegarde.
  const { game, empire } = setup();
  G.declareWarOn(game, empire);
  const back = restore(copy(serialize(game))).empires.find((e) => e.species === empire.species);
  check(back.war === true && back.warSince === empire.warSince, 'la guerre survit à la sauvegarde');
  const bad = copy(serialize(game));
  bad.empires.forEach((e) => {
    e.war = 'oui';
    e.truceUntil = 'x';
  });
  check(restore(bad).empires.every((e) => e.war === false && e.truceUntil === 0), 'valeurs de guerre invalides : paix par défaut');
  const old = copy(serialize(setup().game));
  old.empires.forEach((e) => {
    delete e.war;
    delete e.warSince;
    delete e.truceUntil;
  });
  check(restore(old).empires.every((e) => e.war === false), 'ancienne sauvegarde : aucune guerre');
}

// Étape 2 : résolution d'un combat.
{
  const C = await imp('combat.js');
  const { createRng } = await imp('rng.js');
  const { SHIP_KINDS } = G;
  const unit = (kind) => ({ attack: SHIP_KINDS[kind].attack, defense: SHIP_KINDS[kind].defense, damage: 0 });
  const many = (kind, n) => Array.from({ length: n }, () => unit(kind));
  const outcomes = (a, b, n = 800) => {
    const r = { A: 0, B: 0, none: 0 };
    for (let i = 0; i < n; i++) r[C.fightToEnd(a(), b(), createRng(i + 1)).winner ?? 'none']++;
    return { A: r.A / n, B: r.B / n };
  };
  const even = outcomes(() => many('fregate', 2), () => many('fregate', 2));
  check(Math.abs(even.A - even.B) < 0.08, `forces égales : chances égales (${Math.round(even.A * 100)} % contre ${Math.round(even.B * 100)} %)`);
  const r1 = outcomes(() => many('corvette', 2), () => many('corvette', 2)).A;
  const r2 = outcomes(() => many('corvette', 3), () => many('corvette', 2)).A;
  const r3 = outcomes(() => many('corvette', 5), () => many('corvette', 2)).A;
  check(r1 < r2 && r2 <= r3 && r3 > 0.95, `plus de vaisseaux, plus de victoires (${Math.round(r1 * 100)} %, ${Math.round(r2 * 100)} %, ${Math.round(r3 * 100)} %)`);
  check(outcomes(() => many('cuirasse', 1), () => many('corvette', 3)).A > 0.95, 'un cuirassé bat 3 corvettes');
  const a = many('fregate', 2);
  const b = many('corvette', 3);
  const r = C.fightToEnd(a, b, createRng(5));
  const a2 = many('fregate', 2);
  const b2 = many('corvette', 3);
  const rb = C.fightToEnd(a2, b2, createRng(5));
  check(r.days === rb.days && r.winner === rb.winner && JSON.stringify(a) === JSON.stringify(a2), 'même hasard, même combat (rejouable)');
  check([...a, ...b].every((u) => u.damage >= 0 && u.damage <= C.toughness(u)), 'les dégâts ne dépassent jamais la résistance');
  const lone = [unit('corvette')];
  const fallen = C.fightDay(lone, [{ attack: 0, defense: 50, damage: 0 }], createRng(1));
  check(fallen.length === 0 && lone[0].damage === 0, "une unité sans attaque n'inflige rien");
}

// Étapes 3 et 4 : flottes rivales, sièges et captures, sur une vraie partie.
function warGame(seed = 42) {
  const game = G.createGame(seed, 'vaskhar', 4);
  const arche = game.ships[0];
  const home = game.stars[arche.starId];
  home.level = 3;
  const index = home.planets.findIndex((p) => p.size && !p.inhabitedBy);
  const surface = G.getSurface(game, home.id, index);
  const tile = surface.tiles.findIndex((t) => t.terrain !== 'ocean' && !t.building && !['minerais', 'velarine'].includes(t.deposit?.resource));
  G.foundColony(game, arche, home.id, index, tile);
  const dist = (e) => Math.hypot(...['x', 'y', 'z'].map((k) => game.stars[e.homeId].pos[k] - home.pos[k]));
  const empire = [...game.empires].sort((a, b) => dist(a) - dist(b))[0];
  empire.met = true;
  empire.stocks.alliages = 2000;
  G.declareWarOn(game, empire);
  return { game, empire, home, colony: game.colonies[0] };
}
const addWarship = (game, kind, starId) => {
  const ship = { id: game.nextShipId++, kind, name: `${kind} ${game.nextShipId}`, starId, state: 'idle', toId: null, fromId: null, distance: 0, speed: 0, progress: 0, daysLeft: 0, age: 0, worn: false, shipSeed: 1, accent: '#fff', registry: 'T' };
  game.ships.push(ship);
  return ship;
};
{
  const { game, empire, home, colony } = warGame();
  // Une Arche de réserve, loin du front : sans elle, perdre la seule colonie serait une défaite et
  // arrêterait le temps (docs/plan-victoire.md), et la reprise ne pourrait pas être testée.
  const away = (s) => Math.hypot(s.pos.x - home.pos.x, s.pos.y - home.pos.y, s.pos.z - home.pos.z);
  const far = game.stars.reduce((a, s) => (away(s) > away(a) ? s : a));
  addWarship(game, 'arche', far.id);
  for (let d = 0; d < 3 && !game.fleets.length; d++) G.tick(game, 1);
  const fleet = game.fleets[0];
  check(!!fleet && fleet.species === empire.species && fleet.ships.length >= 2, `en guerre, l'empire lance une flotte (${fleet?.ships.length} ${fleet?.ships[0].kind})`);
  check(empire.stocks.alliages < 2000, 'la flotte se paie en alliages');
  check(game.log.some((l) => JSON.stringify(l).includes('lancent une flotte')), 'annoncée au journal');
  let arrived = false;
  let captured = false;
  for (let d = 0; d < 1500 && !captured; d++) {
    G.tick(game, 1);
    if (game.fleets.some((f) => f.starId === home.id && f.state === 'idle')) arrived = true;
    captured = !game.colonies.includes(colony);
  }
  check(arrived, 'la flotte rejoint la colonie du joueur');
  check(captured && home.planets[colony.planetIndex].inhabitedBy === empire.species, 'colonie sans défense : prise après le siège');
  check(game.log.some((l) => JSON.stringify(l).includes('est tombée aux mains')), 'la prise est annoncée');

  // Le joueur reprend sa colonie avec ses bâtiments.
  const buildingsBefore = G.getSurface(game, home.id, colony.planetIndex).tiles.filter((t) => t.building).length;
  game.fleets = game.fleets.filter((f) => f.starId !== home.id);
  for (let i = 0; i < 4; i++) addWarship(game, 'fregate', home.id);
  let retaken = false;
  for (let d = 0; d < 200 && !retaken; d++) {
    G.tick(game, 1);
    retaken = game.colonies.some((c) => c.starId === home.id && c.planetIndex === colony.planetIndex);
  }
  const back = game.colonies.find((c) => c.starId === home.id && c.planetIndex === colony.planetIndex);
  check(retaken && !home.planets[colony.planetIndex].inhabitedBy, 'des frégates reprennent la colonie');
  check(back?.name === colony.name && G.getSurface(game, home.id, colony.planetIndex).tiles.filter((t) => t.building).length === buildingsBefore, 'colonie reprise avec ses bâtiments');
  check(game.log.some((l) => JSON.stringify(l).includes('Vous reprenez')), 'reprise annoncée');
}
{
  // Une colonie défendue tient mieux ; des vaisseaux seuls face à une grosse flotte tombent.
  const { game, empire, home, colony } = warGame(77);
  colony.orbital.defense = 3;
  empire.power = 0;
  const lone = addWarship(game, 'corvette', home.id);
  let shipLost = false;
  let held = 0;
  for (let d = 0; d < 400; d++) {
    G.tick(game, 1);
    if (!game.ships.includes(lone)) shipLost = true;
    if (game.colonies.includes(colony)) held = d;
  }
  check(held >= 399 || game.log.some((l) => JSON.stringify(l).includes('anéantie')), `une colonie défendue (anneaux) résiste à de petites flottes (${held >= 399 ? 'tenue' : 'flottes anéanties'})`);
}
{
  // Paix : les flottes rentrent ; pas de flotte hors guerre ; mondes natals imprenables.
  const { game, empire } = warGame();
  for (let d = 0; d < 5; d++) G.tick(game, 1);
  check(game.fleets.length > 0, 'des flottes en guerre');
  game.resources.minerais = 1e6;
  const peace = G.signDeal(game, empire, { give: { resources: { minerais: D.peacePrice(empire, 'minerais') } }, get: { resources: {}, peace: true } });
  check(peace.ok && game.fleets.length === 0, 'la paix renvoie les flottes chez elles');
  for (let d = 0; d < 200; d++) G.tick(game, 1);
  check(game.fleets.length === 0, 'pas de flotte en paix');

  const w = warGame(5);
  const homeWorld = w.empire.colonies[0];
  for (let i = 0; i < 12; i++) addWarship(w.game, 'cuirasse', homeWorld.starId);
  w.game.fleets = [];
  w.empire.nextFleet = 1e9;
  for (let d = 0; d < 100; d++) G.tick(w.game, 1);
  check(w.empire.colonies[0] === homeWorld && w.game.stars[homeWorld.starId].planets[homeWorld.planetIndex].inhabitedBy === w.empire.species, 'un monde natal ne se prend pas');
}
{
  // Sauvegarde des flottes.
  const { game } = warGame();
  for (let d = 0; d < 30; d++) G.tick(game, 1);
  const data = copy(serialize(game));
  const back = restore(data);
  check(back.fleets.length === game.fleets.length && JSON.stringify(back.fleets) === JSON.stringify(game.fleets), 'les flottes survivent à la sauvegarde');
  for (const [name, spoil] of Object.entries({
    'liste invalide': (d) => (d.fleets = 'x'),
    'vaisseau inconnu': (d) => (d.fleets[0].ships = [{ kind: 'sonde', damage: 0 }]),
    'étoile hors bornes': (d) => (d.fleets[0].starId = 99999),
    'flotte vide': (d) => (d.fleets[0].ships = []),
  })) {
    const bad = copy(data);
    spoil(bad);
    let ok = true;
    try {
      const g = restore(bad);
      ok = Array.isArray(g.fleets) && g.fleets.length < data.fleets.length + 0 || g.fleets.length === 0;
      G.tick(g, 1);
    } catch {
      ok = false;
    }
    check(ok, `flotte invalide (${name}) : écartée sans plantage`);
  }
  const old = copy(data);
  delete old.fleets;
  delete old.nextFleetId;
  check(restore(old).fleets.length === 0, 'sauvegarde sans flottes : aucune');
}

{
  // Des vaisseaux de guerre qui tiennent le système empêchent la colonie de tomber.
  const { game, home, colony } = warGame(42);
  for (let i = 0; i < 2; i++) addWarship(game, 'cuirasse', home.id);
  let lost = false;
  for (let d = 0; d < 300; d++) {
    G.tick(game, 1);
    if (!game.colonies.includes(colony)) lost = true;
  }
  check(!lost, "colonie défendue par des vaisseaux de guerre : pas de prise tant qu'ils tiennent");
}

// Étape 5 : ravitaillement et pillage.
function supplyGame() {
  const { game, empire, home, colony } = warGame(42);
  game.empires.forEach((e) => (e.war = false));
  game.fleets = [];
  for (let d = 0; d < 600; d++) G.tick(game, 1); // l'empire s'étend : il lui faut au moins 2 colonies
  G.declareWarOn(game, empire) || (empire.war = true);
  empire.nextFleet = 1e9; // pas de flotte : on teste le ravitaillement seul
  empire.stocks.alliages = 500;
  empire.stocks.minerais = 500;
  return { game, empire, home, colony };
}
{
  const { game, empire } = supplyGame();
  check(empire.colonies.length >= 2, `l'empire a plusieurs colonies (${empire.colonies.length})`);
  empire.nextSupply = 0;
  G.tick(game, 1);
  const convoy = game.convoys.find((c) => c.supply && c.species === empire.species);
  check(!!convoy && convoy.fromId === empire.homeId, "en guerre, l'empire envoie un convoi de ravitaillement depuis son monde natal");
  // Le même jour, l'empire produit aussi un peu d'alliages (quelques unités).
  check(empire.stocks.alliages < 500 - (convoy?.resources.alliages ?? 0) + 5, `la cargaison quitte ses stocks (${Math.round(empire.stocks.alliages)} sur 500, convoi de ${convoy?.resources.alliages})`);
  const back = restore(copy(serialize(game)));
  check(back.convoys.some((c) => c.supply === true), 'un convoi de ravitaillement survit à la sauvegarde');
  // Sans interception, il livre l'empire, pas le joueur.
  const mine = game.resources.alliages;
  const before = empire.stocks.alliages;
  for (let d = 0; d < 400 && game.convoys.includes(convoy); d++) G.tick(game, 1);
  check(!game.convoys.includes(convoy) && empire.stocks.alliages > before && game.resources.alliages === mine, 'arrivé, le ravitaillement va à l\'empire, pas au joueur');
}
{
  const { game, empire } = supplyGame();
  addWarship(game, 'fregate', empire.homeId); // posté au départ du convoi
  const mine = game.resources.alliages;
  const relation = empire.relation;
  empire.nextSupply = 0;
  G.tick(game, 1);
  check(!game.convoys.some((c) => c.supply), 'un vaisseau de guerre posté sur la route intercepte le convoi');
  check(game.resources.alliages === mine + Math.floor(Math.min(40, 500) * 0.6), `butin : ${game.resources.alliages - mine} alliages (60 %)`);
  // −10, puis la note remonte à peine dans la journée vers sa valeur de départ.
  check(empire.relation < relation - 9, `l'empire pillé vous en veut (${relation} → ${empire.relation.toFixed(1)})`);
  check(game.log.some((l) => JSON.stringify(l).includes('intercepté')), 'pillage annoncé au journal');
}
{
  const { game, empire } = supplyGame();
  empire.war = false; // paix : plus de ravitaillement de guerre
  empire.nextSupply = 0;
  G.tick(game, 1);
  check(!game.convoys.some((c) => c.supply), 'en paix, pas de convoi de ravitaillement');
}

// Corrections de la relecture du combat.
{
  // Le ravitaillement ennemi n'apparaît pas au journal du joueur.
  const { game, empire } = supplyGame();
  empire.nextSupply = 0;
  G.tick(game, 1);
  const convoy = game.convoys.find((c) => c.supply);
  for (let d = 0; d < 400 && game.convoys.includes(convoy); d++) G.tick(game, 1);
  check(!game.log.some((l) => JSON.stringify(l).includes(`Convoi des ${rivalInfo(empire.species).label} arrivé`)), "l'arrivée d'un ravitaillement ennemi n'est pas annoncée au joueur");
}
{
  // Un monde natal n'est pas assiégé (il ne peut pas tomber) ; une colonie rivale assiégée ne se répare pas.
  const w = warGame(5);
  const home = w.empire.colonies[0];
  w.game.fleets = [];
  w.empire.nextFleet = 1e9;
  const ship = addWarship(w.game, 'fregate', home.starId);
  for (let d = 0; d < 20; d++) G.tick(w.game, 1);
  check(!(home.damage > 0) && (ship.damage ?? 0) === 0, 'pas de combat sans fin devant un monde natal');
  const s2 = supplyGame();
  const target = s2.empire.colonies.slice(1).find((c) => s2.game.stars[c.starId].planets[c.planetIndex].inhabitedBy) ?? s2.empire.colonies[1];
  s2.game.stars[target.starId].planets[target.planetIndex].inhabitedBy = s2.empire.species;
  s2.game.fleets = [];
  s2.empire.nextFleet = 1e9;
  addWarship(s2.game, 'fregate', target.starId);
  G.tick(s2.game, 1);
  check((s2.game.battles ?? []).includes(target.starId), 'siège d\'une colonie rivale : reconnu comme un combat chaque jour');
}
{
  // En guerre, la note ne remonte pas d'elle-même.
  const { game, empire } = setup('ondesiens', 'vaskhar');
  G.declareWarOn(game, empire);
  const r = empire.relation;
  for (let d = 0; d < 300; d++) G.tick(game, 1);
  check(empire.relation <= r + 1e-9, `en guerre, la rancune ne s'efface pas (${r} → ${empire.relation.toFixed(1)})`);
}

// Étape 7 : répliques de guerre.
{
  const { DIALOGUES } = await imp('dialogues.js');
  const S = await imp('species.js');
  const war = ['guerre', 'paix', 'victoire', 'defaite', 'pillage'];
  const all = S.playableSpecies().flatMap((k) => war.map((x) => DIALOGUES[k]?.[x]));
  check(all.length === 40 && all.every((t) => typeof t === 'string' && t.length > 10), '40 répliques de guerre : 5 situations pour chacune des 8 espèces');
  check(new Set(Object.values(DIALOGUES).flatMap((d) => Object.values(d))).size === 120, '120 répliques au total, aucune en double');
  // Elles apparaissent bien au journal.
  const { game, empire } = setup('thrennes', 'vaskhar');
  G.declareWarOn(game, empire);
  game.resources.minerais = 1e6;
  G.signDeal(game, empire, deal({ resources: { minerais: D.peacePrice(empire, 'minerais') } }, { peace: true }));
  check(game.log.some((l) => JSON.stringify(l).includes(DIALOGUES.thrennes.paix.slice(0, 20))), "la paix est commentée par la réplique de l'espèce");
  const w = warGame(42);
  for (let d = 0; d < 1500 && w.game.colonies.length; d++) G.tick(w.game, 1);
  check(w.game.log.some((l) => JSON.stringify(l).includes(DIALOGUES[w.empire.species].victoire.slice(0, 20))), "la prise d'une colonie est commentée par le vainqueur");
}

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
