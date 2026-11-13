// Vaisseaux, flottes, convois et combats dans la vue 3D d'un système (voir docs/plan-systeme-guerre.md).
// Purement visuel : les règles du combat restent dans combat.js ; ici on montre qui est là et on
// anime les tirs pendant les jours de bataille.
import * as THREE from 'three';
import { SPECIES } from './config.js';
import { SHIP_KINDS } from './game.js';
import { animateShip, createShip } from './ships.js';
import { currentSpecies, rivalInfo } from './species.js';

const SHIP_SCALE = 0.45; // taille d'un vaisseau dans la vue du système
const MAX_PER_SIDE = 12; // au-delà, on n'affiche pas tous les vaisseaux d'un camp
const SHOT_EVERY = 0.15; // secondes entre deux salves pendant un combat
const SHOT_LIFE = 0.3;
const TORPEDO_TIME = 0.7;
const BIG_KINDS = new Set(['croiseur', 'cuirasse']);
const PLAYER_SHOT = '#7cffd0';

// Les modèles 3D sont gardés d'une ouverture à l'autre (création coûteuse), puis libérés quand le
// vaisseau, la flotte ou le convoi n'existe plus dans la partie.
const models = new Map();
function modelFor(key, seed, accent, kind, style, entry) {
  if (!models.has(key)) {
    const model = createShip(seed, accent, '', kind, style);
    const holder = new THREE.Group();
    holder.add(model);
    holder.scale.setScalar(SHIP_SCALE);
    models.set(key, { holder, model, look: new THREE.Vector3(), placed: false, entry });
  }
  return models.get(key);
}

// Les matériaux des vaisseaux sont partagés (textures en cache) : on ne libère que les géométries.
function forget(key) {
  const view = models.get(key);
  if (!view) return;
  view.holder.removeFromParent();
  view.holder.traverse((o) => o.geometry?.dispose());
  models.delete(key);
}

// Identifiant stable d'un vaisseau de flotte : les vaisseaux détruits sont retirés du tableau, donc
// l'indice ne suffit pas.
const fleetShipIds = new WeakMap();
let nextFleetShipId = 1;
function fleetShipId(ship) {
  if (!fleetShipIds.has(ship)) fleetShipIds.set(ship, nextFleetShipId++);
  return fleetShipIds.get(ship);
}

const glowCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,220,170,0.6)');
  grad.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
})();

export function createSystemFleets(game) {
  const root = new THREE.Group();
  const glow = new THREE.CanvasTexture(glowCanvas);
  let star = null;
  let bodies = [];
  let edge = 20;
  let starRadius = 1;
  let shotTimer = 0;
  const effects = []; // tirs, torpilles, éclairs, explosions
  let shown = new Map(); // clé → { item, view } de l'image précédente
  let sweepTimer = 0;

  // Le vaisseau (ou le convoi) existe-t-il encore dans la partie ?
  const alive = (entry) =>
    game.ships.includes(entry) || game.convoys.includes(entry) || game.fleets.some((f) => f.ships.includes(entry));

  const bodyPos = (index, out) => {
    const body = bodies.find((b) => b.index === index && !b.belt);
    return body ? body.anchor.getWorldPosition(out) : out.set(0, 0, 0);
  };
  const bodyRadius = (index) => bodies.find((b) => b.index === index)?.radius ?? 1;

  // Point du bord de la vue dans la direction d'un autre système (pour les arrivées et départs).
  function edgePoint(otherId, out) {
    const a = star.pos;
    const b = game.stars[otherId].pos;
    out.set(b.x - a.x, 0, b.z - a.z);
    if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
    return out.normalize().multiplyScalar(edge * 1.25).setY(2);
  }

  // Lieu de la bataille : ta colonie, sinon la colonie rivale assiégée, sinon l'étoile.
  function frontIndex() {
    const colony = game.colonies.find((c) => c.starId === star.id);
    if (colony) return colony.planetIndex;
    for (const e of game.empires) {
      const c = e.colonies.find((x) => x.starId === star.id && game.stars[star.id].planets[x.planetIndex].inhabitedBy);
      if (c) return c.planetIndex;
    }
    return null;
  }

  // Où se tient chaque vaisseau présent ou de passage, et de quel camp il est.
  function gather(time) {
    const out = [];
    const front = frontIndex();
    const center = new THREE.Vector3();
    const away = new THREE.Vector3();
    if (front !== null) bodyPos(front, center);
    away.copy(center).setY(0);
    if (away.lengthSq() < 1e-6) away.set(1, 0, 0);
    away.normalize();
    const side = new THREE.Vector3(-away.z, 0, away.x);
    const r = front !== null ? bodyRadius(front) : starRadius;
    const battle = (game.battles ?? []).includes(star.id);

    // Tes vaisseaux.
    const mine = game.ships.filter((s) => s.starId === star.id && s.state !== 'travel').slice(0, MAX_PER_SIDE);
    mine.forEach((ship, i) => {
      const p = new THREE.Vector3();
      let face = null;
      if (battle && front !== null) {
        // En ligne entre la planète et l'ennemi, tournés vers lui.
        p.copy(center).addScaledVector(away, r * 2 + 0.8).addScaledVector(side, (i - (mine.length - 1) / 2) * 0.9).setY(center.y + 0.5 + (i % 2) * 0.3);
        face = new THREE.Vector3().copy(center).addScaledVector(away, r * 4 + 3).setY(p.y);
      } else if (front !== null && game.colonies.some((c) => c.starId === star.id)) {
        const a = time * 0.25 + (i / mine.length) * Math.PI * 2;
        p.set(center.x + Math.cos(a) * (r * 2.2 + 0.8), center.y + 0.5, center.z + Math.sin(a) * (r * 2.2 + 0.8));
      } else {
        const a = time * 0.12 + (i / mine.length) * Math.PI * 2;
        const rr = starRadius * 3 + 2 + (i % 3) * 0.7;
        p.set(Math.cos(a) * rr, 1.2, Math.sin(a) * rr);
      }
      out.push({ key: `p${ship.id}`, side: 'player', kind: ship.kind, pos: p, face, entry: ship, seed: ship.shipSeed, accent: ship.accent, style: currentSpecies().shipStyle });
    });

    // Flottes ennemies au repos ici : face à la planète disputée.
    const fleets = game.fleets.filter((f) => f.starId === star.id && f.state === 'idle');
    let k = 0;
    for (const fleet of fleets) {
      for (const ship of fleet.ships) {
        if (k >= MAX_PER_SIDE) break;
        const p = new THREE.Vector3()
          .copy(center)
          .addScaledVector(away, r * 4 + 3 + (k % 2) * 0.8)
          .addScaledVector(side, (k - 2) * 1.0)
          .setY(center.y + 0.8 + (k % 3) * 0.25);
        const id = fleetShipId(ship);
        out.push({ key: `f${id}`, side: 'enemy', kind: ship.kind, pos: p, face: center.clone().setY(p.y), entry: ship, species: fleet.species, seed: fleet.id * 104729 + id * 31, accent: rivalInfo(fleet.species).accent, style: SPECIES[fleet.species].shipStyle });
        k++;
      }
    }

    // Arrivées et départs : flottes et convois dans le dernier ou le premier quart de leur trajet.
    const travellers = [
      ...game.fleets
        .filter((f) => f.state === 'travel' && f.ships.length)
        .map((f) => ({ f, kind: f.ships[0].kind, key: `f${fleetShipId(f.ships[0])}`, entry: f.ships[0], species: f.species, seed: f.id * 104729 + fleetShipId(f.ships[0]) * 31, side: 'enemy' })),
      ...game.convoys.map((c) => ({ f: c, kind: 'transport', key: `c${c.id}`, entry: c, species: c.species, seed: c.id * 7919 + 17, side: 'neutral' })),
    ];
    for (const t of travellers) {
      const { f } = t;
      const progress = Math.min(1, f.progress / f.distance);
      const arriving = f.toId === star.id && progress > 0.75;
      const leaving = f.fromId === star.id && progress < 0.25;
      if (!arriving && !leaving) continue;
      const far = edgePoint(arriving ? f.fromId : f.toId, new THREE.Vector3());
      const near = new THREE.Vector3().copy(center).addScaledVector(away, r * 4 + 3).setY(center.y + 1);
      const p = arriving ? far.clone().lerp(near, (progress - 0.75) / 0.25) : near.clone().lerp(far, progress / 0.25);
      out.push({ ...t, pos: p, face: arriving ? near : far, accent: rivalInfo(t.species).accent, style: SPECIES[t.species].shipStyle, moving: true });
    }
    return out;
  }

  function shot(from, to, color, torpedo) {
    if (torpedo) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      sprite.scale.setScalar(0.5);
      root.add(sprite);
      effects.push({ kind: 'torpedo', obj: sprite, from: from.clone(), to: to.clone(), life: TORPEDO_TIME, total: TORPEDO_TIME });
      return;
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([from, to]),
      new THREE.LineBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    root.add(line);
    effects.push({ kind: 'shot', obj: line, life: SHOT_LIFE, total: SHOT_LIFE });
    flash(to, 0.6, '#ffe2b0');
  }

  function flash(at, size, color) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sprite.position.copy(at);
    sprite.scale.setScalar(size);
    root.add(sprite);
    effects.push({ kind: 'flash', obj: sprite, life: SHOT_LIFE, total: SHOT_LIFE, size });
  }

  // Explosion d'un vaisseau détruit : boule de feu et débris.
  function explode(at) {
    flash(at, 2.4, '#ffb36b');
    const n = 24;
    const positions = new Float32Array(n * 3);
    const velocity = [];
    for (let i = 0; i < n; i++) {
      positions.set([at.x, at.y, at.z], i * 3);
      velocity.push(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(1 + Math.random() * 2));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#ffcf8a', size: 0.12, transparent: true, depthWrite: false }));
    root.add(points);
    effects.push({ kind: 'debris', obj: points, velocity, life: 1.4, total: 1.4 });
  }

  function updateEffects(dt) {
    for (const e of [...effects]) {
      e.life -= dt;
      const k = Math.max(0, e.life / e.total);
      if (e.kind === 'torpedo') {
        e.obj.position.copy(e.from).lerp(e.to, 1 - k);
        if (e.life <= 0) flash(e.to, 1.1, '#ffd0a0');
      } else if (e.kind === 'debris') {
        const pos = e.obj.geometry.attributes.position;
        e.velocity.forEach((v, i) => pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt));
        pos.needsUpdate = true;
        e.obj.material.opacity = k;
      } else {
        e.obj.material.opacity = k;
        if (e.kind === 'flash') e.obj.scale.setScalar(e.size * (1 + (1 - k)));
      }
      if (e.life > 0) continue;
      root.remove(e.obj);
      e.obj.geometry?.dispose();
      e.obj.material.dispose();
      effects.splice(effects.indexOf(e), 1);
    }
  }

  return {
    // À chaque construction de la scène du système.
    attach(scene, system, systemBodies, systemEdge, radius) {
      star = system;
      bodies = systemBodies;
      edge = systemEdge;
      starRadius = radius;
      shown = new Map();
      scene.add(root);
    },
    // Avant de jeter une scène : les modèles sont gardés pour la prochaine fois.
    detach() {
      root.removeFromParent();
      for (const view of models.values()) view.placed = false; // pas de glissement depuis l'ancienne scène
      for (const e of effects) {
        e.obj.geometry?.dispose();
        e.obj.material.dispose();
      }
      effects.length = 0;
      root.clear();
    },
    update(dt, time) {
      if (!star) return;
      const list = gather(time);
      const now = new Map();
      for (const item of list) {
        const view = modelFor(item.key, item.seed, item.accent, item.kind, item.style, item.entry);
        if (view.holder.parent !== root) root.add(view.holder);
        const k = view.placed ? Math.min(1, dt * 4) : 1;
        view.placed = true;
        view.holder.position.lerp(item.pos, k);
        // Face à son vis-à-vis ; sinon dans le sens de l'orbite.
        if (item.face) view.look.copy(item.face);
        else view.look.copy(item.pos).add(new THREE.Vector3(-item.pos.z, 0, item.pos.x).normalize());
        view.holder.lookAt(view.look);
        animateShip(view.model, time, item.moving ? 1 : 0.2);
        now.set(item.key, { item, view });
      }
      // Ceux qui ont disparu : détruits (explosion, modèle libéré), ou simplement partis.
      for (const [key, old] of shown) {
        if (now.has(key)) continue;
        old.view.holder.removeFromParent();
        old.view.placed = false;
        if (alive(old.item.entry)) continue;
        if (!old.item.moving && old.item.side !== 'neutral') explode(old.view.holder.position.clone());
        forget(key);
      }
      shown = now;
      // De temps en temps, libérer les modèles de ce qui a disparu ailleurs.
      sweepTimer -= dt;
      if (sweepTimer <= 0) {
        sweepTimer = 5;
        for (const [key, view] of models) if (!now.has(key) && !alive(view.entry)) forget(key);
      }
      const battle = (game.battles ?? []).includes(star.id);

      // Tirs pendant les jours de bataille (arrêtés pendant la pause).
      shotTimer -= dt;
      if (battle && !game.paused && shotTimer <= 0) {
        shotTimer = SHOT_EVERY;
        const ours = list.filter((x) => x.side === 'player' && SHIP_KINDS[x.kind]?.attack > 0);
        const theirs = list.filter((x) => x.side === 'enemy' && !x.moving);
        const front = frontIndex();
        const planet = front !== null ? bodyPos(front, new THREE.Vector3()) : null;
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
        const posOf = (x) => now.get(x.key).view.holder.position;
        // Tes vaisseaux armés, ou la défense de la colonie depuis la planète.
        const playerGun = ours.length ? posOf(pick(ours)) : planet;
        const playerTarget = theirs.length ? posOf(pick(theirs)) : null;
        if (playerGun && playerTarget && (ours.length || game.colonies.some((c) => c.starId === star.id))) {
          shot(playerGun, playerTarget, PLAYER_SHOT, ours.length && BIG_KINDS.has(pick(ours).kind) && Math.random() < 0.25);
        }
        if (theirs.length) {
          const gun = pick(theirs);
          const targets = list.filter((x) => x.side === 'player');
          const target = targets.length ? posOf(pick(targets)) : planet;
          if (target) shot(posOf(gun), target, rivalInfo(gun.species).accent, BIG_KINDS.has(gun.kind) && Math.random() < 0.3);
        }
      }
      updateEffects(dt);
    },
  };
}
