// Tests du combat (docs/plan-combat.md). Usage : node docs/outils/test-combat.mjs .
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] ?? '.');
const imp = (f) => import(pathToFileURL(`${root}/src/${f}`).href);
const G = await imp('game.js');
const D = await imp('diplomacy.js');
const { DIPLOMACY } = await imp('config.js');
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

console.log(fails ? `\n${fails} échec(s)` : '\nTous les tests passent.');
process.exit(fails ? 1 : 0);
