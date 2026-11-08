// Rendu 3D de l'amas avec Three.js : étoiles, brouillard de guerre, courants, sondes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CONFIG } from './config.js';
import { STAR_TYPES, starDistance } from './galaxy.js';
import { reachableStars, shipProgress, selectedShip } from './game.js';
import { currentSpecies, knownRival, rivalInfo } from './species.js';
import { SPECIES } from './config.js';
import { createSky } from './skybox.js';
import { animateShip, createShip, shipScale } from './ships.js';
import { canvasTexture, glowTexture } from './textures.js';

const PROBE_COLOR = 0x7cff9e; // lignes de portée
const CURRENT_COLOR = 0x5fe3ff;
const PARTICLES_PER_CURRENT = 8;

const toVec = (p) => new THREE.Vector3(p.x, p.y, p.z);

const ringTexture = () =>
  canvasTexture(128, 128, (ctx, s) => {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 10]);
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
    ctx.stroke();
  });

export function createGalaxyView(container, game, callbacks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.className = 'labels';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02040a);
  const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 6000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 420;

  // Lumière pour les vaisseaux : ambiance bleutée + une lumière qui suit la caméra.
  scene.add(new THREE.AmbientLight(0x8090b0, 1.1));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(3, 4, 0);
  sun.target.position.set(0, 0, -10);
  camera.add(sun, sun.target);
  scene.add(camera);

  const home = game.stars[game.homeId];
  controls.target.copy(toVec(home.pos));
  camera.position.copy(controls.target).add(new THREE.Vector3(0, 45, 75));

  const glow = glowTexture();
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  document.body.appendChild(tooltip);

  const sky = createSky();
  scene.add(sky);
  addNebulae(scene, glow);

  // Étoiles : un halo coloré + une étiquette pour les systèmes visités.
  const starViews = game.stars.map((star) => {
    const type = STAR_TYPES[star.type];
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: type.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sprite.position.copy(toVec(star.pos));
    scene.add(sprite);

    const el = document.createElement('div');
    el.className = 'star-label';
    el.textContent = star.name;
    const label = new CSS2DObject(el);
    label.center.set(0.5, 2.2);
    sprite.add(label);
    return { star, sprite, label, el, baseColor: new THREE.Color(type.color) };
  });

  // Courants gravitationnels : une courbe et des particules qui la parcourent.
  const currentViews = game.currents.map((c) => {
    const a = toVec(game.stars[c.a].pos);
    const b = toVec(game.stars[c.b].pos);
    const dir = b.clone().sub(a);
    const side = dir.clone().cross(new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(dir.length() * 0.12 * (c.id % 2 ? 1 : -1));
    const mid = a.clone().add(b).multiplyScalar(0.5).add(side).add(new THREE.Vector3(0, dir.length() * 0.06, 0));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)),
      new THREE.LineBasicMaterial({ color: CURRENT_COLOR, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    const points = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES_PER_CURRENT * 3), 3)),
      new THREE.PointsMaterial({ color: CURRENT_COLOR, map: glow, size: 1.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    scene.add(line, points);
    return { current: c, curve, line, points };
  });

  // Lignes vers les étoiles à portée de la sonde sélectionnée.
  const reachLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: PROBE_COLOR, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  scene.add(reachLines);

  const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTexture(), color: 0xaad4ff, transparent: true, depthWrite: false }));
  scene.add(ring);

  // Vaisseaux : un modèle 3D unique, un anneau de sélection et la trace du trajet.
  // Ils apparaissent (chantier spatial) et disparaissent (usure, fondation) en cours de partie.
  const ringTex = ringTexture();
  const shipViews = new Map();
  function syncShips() {
    for (const [id, v] of shipViews) {
      if (game.ships.some((s) => s.id === id)) continue;
      scene.remove(v.holder, v.marker, v.trail);
      shipViews.delete(id);
      if (followId === id) followId = null;
    }
    for (const ship of game.ships) {
      if (shipViews.has(ship.id)) continue;
      const model = createShip(ship.shipSeed, ship.accent, ship.registry, ship.kind, currentSpecies().shipStyle);
      const holder = new THREE.Group();
      holder.add(model);
      const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: ship.accent, transparent: true, depthWrite: false, depthTest: false }));
      marker.renderOrder = 10;
      const trail = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineDashedMaterial({ color: ship.accent, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.75 }),
      );
      scene.add(holder, marker, trail);
      shipViews.set(ship.id, { ship, model, holder, marker, trail, look: new THREE.Vector3(), placed: false, scale: 1 });
    }
  }

  // Convois des échanges : un transport au style de l'empire, de sa colonie vers celle du joueur.
  const convoyViews = new Map();
  function syncConvoys() {
    for (const [id, v] of convoyViews) {
      if (game.convoys.some((c) => c.id === id)) continue;
      scene.remove(v.holder);
      convoyViews.delete(id);
    }
    for (const convoy of game.convoys) {
      if (convoyViews.has(convoy.id)) continue;
      const model = createShip(convoy.id * 7919 + 17, rivalInfo(convoy.species).accent, '', 'transport', SPECIES[convoy.species].shipStyle);
      const holder = new THREE.Group();
      holder.add(model);
      scene.add(holder);
      convoyViews.set(convoy.id, { convoy, model, holder, look: new THREE.Vector3(), placed: false });
    }
  }
  const _from = new THREE.Vector3();
  function updateConvoys(dt, time) {
    for (const v of convoyViews.values()) {
      const { convoy } = v;
      const to = toVec(game.stars[convoy.toId].pos);
      _from.copy(toVec(game.stars[convoy.fromId].pos)).lerp(to, Math.min(1, convoy.progress / convoy.distance));
      _from.y += 1.4;
      const k = v.placed ? Math.min(1, dt * 6) : 1;
      v.placed = true;
      v.holder.position.lerp(_from, k);
      v.look.copy(to).setY(to.y + 1.4);
      v.holder.lookAt(v.look);
      v.holder.scale.setScalar(THREE.MathUtils.clamp(camera.position.distanceTo(v.holder.position) * 0.028, 0.45, 9));
      // Le ravitaillement ennemi ne se voit que près de systèmes déjà repérés.
      v.holder.visible = !convoy.supply || game.stars[convoy.fromId].level >= 2 || game.stars[convoy.toId].level >= 2;
      animateShip(v.model, time, 1);
    }
  }

  // Flottes de guerre ennemies : jusqu'à 3 vaisseaux par flotte, au style de l'empire, avec un anneau
  // rouge. On ne les voit que près de systèmes déjà repérés.
  const fleetViews = new Map();
  const known = (id) => id !== null && id !== undefined && game.stars[id].level >= 2;
  function syncFleets() {
    for (const [id, v] of fleetViews) {
      if (game.fleets.some((f) => f.id === id)) continue;
      scene.remove(v.holder, v.marker);
      fleetViews.delete(id);
    }
    for (const fleet of game.fleets) {
      if (fleetViews.has(fleet.id)) continue;
      const accent = rivalInfo(fleet.species).accent;
      const holder = new THREE.Group();
      const models = fleet.ships.slice(0, 3).map((s, i) => {
        const model = createShip(fleet.id * 104729 + i * 31, accent, '', s.kind, SPECIES[fleet.species].shipStyle);
        model.position.set((i - 1) * 0.9, (i % 2) * 0.4, -Math.abs(i - 1) * 0.6);
        holder.add(model);
        return model;
      });
      const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: '#ff4a4a', transparent: true, depthWrite: false, depthTest: false }));
      marker.renderOrder = 10;
      scene.add(holder, marker);
      fleetViews.set(fleet.id, { fleet, models, holder, marker, look: new THREE.Vector3(), placed: false });
    }
  }
  function updateFleets(dt, time) {
    for (const v of fleetViews.values()) {
      const { fleet } = v;
      const visible = known(fleet.starId) || known(fleet.fromId) || known(fleet.toId);
      v.holder.visible = v.marker.visible = visible;
      if (!visible) continue;
      if (fleet.state === 'travel') {
        const to = toVec(game.stars[fleet.toId].pos);
        _from.copy(toVec(game.stars[fleet.fromId].pos)).lerp(to, Math.min(1, fleet.progress / fleet.distance));
        _from.y += 2;
        v.look.copy(to).setY(to.y + 2);
      } else {
        const c = game.stars[fleet.starId].pos;
        const a = time * 0.2 + fleet.id;
        _from.set(c.x + Math.cos(a) * 4, c.y + 2, c.z + Math.sin(a) * 4);
        v.look.set(c.x, c.y + 2, c.z);
      }
      const k = v.placed ? Math.min(1, dt * 6) : 1;
      v.placed = true;
      v.holder.position.lerp(_from, k);
      v.holder.lookAt(v.look);
      const scale = THREE.MathUtils.clamp(camera.position.distanceTo(v.holder.position) * 0.028, 0.45, 9);
      v.holder.scale.setScalar(scale);
      for (const m of v.models) animateShip(m, time, fleet.state === 'travel' ? 1 : 0.3);
      v.marker.position.copy(v.holder.position);
      v.marker.scale.setScalar(scale * 3.4 * (1 + Math.sin(time * 4) * 0.08));
      v.marker.material.rotation += dt * 0.8;
    }
  }

  // Combats : tirs en traits lumineux et éclairs, entre les deux camps d'un système en bataille.
  const shots = [];
  const shotMaterial = (color) => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const flashMaterial = new THREE.SpriteMaterial({ map: glow, color: '#ffd9a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  let shotTimer = 0;
  function updateBattles(dt) {
    shotTimer -= dt;
    if (shotTimer <= 0 && (game.battles ?? []).length) {
      shotTimer = 0.12;
      for (const starId of game.battles) {
        if (game.stars[starId].level < 2) continue;
        const enemies = [...fleetViews.values()].filter((v) => v.fleet.starId === starId && v.fleet.state === 'idle' && v.holder.visible);
        const friends = [...shipViews.values()].filter((v) => v.ship.starId === starId && v.ship.state !== 'travel');
        const ours = friends.length ? friends[Math.floor(Math.random() * friends.length)].holder.position : toVec(game.stars[starId].pos);
        const theirs = enemies.length ? enemies[Math.floor(Math.random() * enemies.length)].holder.position : toVec(game.stars[starId].pos);
        const fromUs = Math.random() < 0.5;
        const a = (fromUs ? ours : theirs).clone();
        const b = (fromUs ? theirs : ours).clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8));
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), shotMaterial(fromUs ? '#7cff9e' : '#ff5a4a'));
        const flash = new THREE.Sprite(flashMaterial.clone());
        flash.position.copy(b);
        flash.scale.setScalar(1.6);
        scene.add(line, flash);
        shots.push({ line, flash, life: 0.35 });
      }
    }
    for (const s of [...shots]) {
      s.life -= dt;
      s.line.material.opacity = Math.max(0, s.life / 0.35);
      s.flash.material.opacity = Math.max(0, s.life / 0.35);
      s.flash.scale.setScalar(1.6 + (0.35 - s.life) * 4);
      if (s.life > 0) continue;
      scene.remove(s.line, s.flash);
      s.line.geometry.dispose();
      s.line.material.dispose();
      s.flash.material.dispose();
      shots.splice(shots.indexOf(s), 1);
    }
  }

  // Position et point visé : en orbite autour de l'étoile, ou en route vers la destination.
  const _pos = new THREE.Vector3();
  const _look = new THREE.Vector3();
  function shipPose(ship, orbitScale) {
    if (ship.state === 'travel') {
      const to = toVec(game.stars[ship.toId].pos);
      _pos.copy(toVec(game.stars[ship.fromId].pos)).lerp(to, shipProgress(ship)).y += 1;
      _look.copy(to).setY(to.y + 1);
    } else {
      const center = game.stars[ship.starId].pos;
      // Les gros vaisseaux orbitent plus loin et plus lentement, pour ne pas masquer l'étoile ni les autres.
      const big = shipScale(ship.kind) - 1;
      const angle = game.time * (ship.kind === 'arche' ? 0.12 : 0.35 / (1 + big * 0.8)) + ship.id * 2.1;
      const r = (ship.kind === 'arche' ? 5.5 : 2.6 + (ship.id % 4) * 0.6 + big * 2.4) * orbitScale;
      const y = center.y + 0.8 + Math.sin(game.time * 0.5 + ship.id) * 0.3;
      _pos.set(center.x + Math.cos(angle) * r, y, center.z + Math.sin(angle) * r);
      _look.set(center.x + Math.cos(angle + 0.3) * r, y, center.z + Math.sin(angle + 0.3) * r);
    }
    return { pos: _pos, look: _look };
  }

  // Synchronise l'affichage avec l'état de la partie.
  function update() {
    syncConvoys();
    syncFleets();
    for (const v of starViews) {
      const { star, sprite, el } = v;
      const size = STAR_TYPES[star.type].size;
      sprite.visible = star.level >= 1;
      const known = star.level >= 2;
      sprite.material.color.copy(v.baseColor);
      if (!known) sprite.material.color.lerp(new THREE.Color(0x8890a8), 0.5);
      sprite.material.opacity = known ? 1 : 0.45;
      sprite.scale.setScalar((known ? 3.4 : 2.2) * size * (star.id === game.selectedStarId ? 1.15 : 1));
      v.label.visible = known;
      // Monde natal ou colonie découverte : inhabitedBy n'est posé que sur ce que le joueur connaît.
      const occupant = star.planets.find((p) => p.inhabitedBy)?.inhabitedBy;
      const rival = knownRival(star, occupant);
      if (rival) el.style.setProperty('--empire', rival.accent);
      el.className = 'star-label' + (star.id === game.homeId ? ' home' : '') + (occupant ? ' rival' : '') + (star.hasRuins && star.level === 3 ? ' ruins' : '');
    }

    for (const v of currentViews) {
      v.line.visible = v.points.visible = v.current.known;
    }

    syncShips();
    const current = selectedShip(game);
    const positions = [];
    if (current && current.state === 'idle') {
      const from = game.stars[current.starId].pos;
      for (const s of reachableStars(game, current)) positions.push(from.x, from.y, from.z, s.pos.x, s.pos.y, s.pos.z);
    }
    reachLines.geometry.dispose();
    reachLines.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const selected = game.stars[game.selectedStarId];
    ring.visible = !!selected && selected.level >= 1;
    if (ring.visible) {
      ring.position.copy(toVec(selected.pos));
      ring.scale.setScalar(STAR_TYPES[selected.type].size * 4.2);
    }

    for (const v of shipViews.values()) {
      const traveling = v.ship.state === 'travel';
      v.trail.visible = traveling;
      if (traveling) {
        v.trail.geometry.setFromPoints([toVec(game.stars[v.ship.fromId].pos), toVec(game.stars[v.ship.toId].pos)]);
        v.trail.computeLineDistances();
      }
    }
  }

  // Sélection d'une étoile : la plus proche du curseur à l'écran.
  function starAt(clientX, clientY, maxPx) {
    const rect = renderer.domElement.getBoundingClientRect();
    let best = null;
    let bestD = maxPx;
    const p = new THREE.Vector3();
    for (const v of starViews) {
      if (!v.sprite.visible) continue;
      p.copy(v.sprite.position).project(camera);
      if (p.z > 1) continue;
      const x = rect.left + ((p.x + 1) / 2) * rect.width;
      const y = rect.top + ((1 - p.y) / 2) * rect.height;
      const d = Math.hypot(x - clientX, y - clientY);
      if (d < bestD) {
        bestD = d;
        best = v.star;
      }
    }
    return best;
  }

  // Un vaisseau sous le curseur (prioritaire sur les étoiles).
  function shipAt(clientX, clientY, maxPx) {
    const rect = renderer.domElement.getBoundingClientRect();
    let best = null;
    let bestD = maxPx;
    const p = new THREE.Vector3();
    for (const v of shipViews.values()) {
      p.copy(v.holder.position).project(camera);
      if (p.z > 1) continue;
      const d = Math.hypot(rect.left + ((p.x + 1) / 2) * rect.width - clientX, rect.top + ((1 - p.y) / 2) * rect.height - clientY);
      if (d < bestD) {
        bestD = d;
        best = v.ship;
      }
    }
    return best;
  }

  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const ship = shipAt(e.clientX, e.clientY, 14);
    if (ship) {
      focusShip(ship.id);
      return callbacks.onSelectShip(ship.id);
    }
    const star = starAt(e.clientX, e.clientY, 22);
    if (star) callbacks.onSelectStar(star.id);
  });
  renderer.domElement.addEventListener('dblclick', (e) => {
    // Double-clic sur une étoile visitée : vue du système ; sinon on centre la caméra dessus.
    const star = starAt(e.clientX, e.clientY, 22);
    if (!star) return;
    if (star.level >= 2 && callbacks.onOpenSystem) callbacks.onOpenSystem(star.id);
    else focusStar(star.id);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    const hoveredShip = shipAt(e.clientX, e.clientY, 14);
    const star = hoveredShip ? null : starAt(e.clientX, e.clientY, 16);
    renderer.domElement.style.cursor = star || hoveredShip ? 'pointer' : '';
    if (!star && !hoveredShip) {
      tooltip.style.display = 'none';
      return;
    }
    if (hoveredShip) {
      tooltip.innerHTML = `<strong style="color:${hoveredShip.accent}">${hoveredShip.name}</strong><span>${hoveredShip.registry}</span>`;
    } else {
      const current = selectedShip(game);
      const d = current ? Math.round(starDistance(game.stars[current.state === 'travel' ? current.toId : current.starId], star)) : null;
      tooltip.innerHTML = `<strong>${star.level >= 2 ? star.name : 'Lueur inconnue'}</strong>` + (d ? `<span>${d} al de ${current.name}</span>` : '');
    }
    tooltip.style.display = 'block';
    tooltip.style.left = `${e.clientX + 14}px`;
    tooltip.style.top = `${e.clientY + 12}px`;
  });
  renderer.domElement.addEventListener('pointerleave', () => (tooltip.style.display = 'none'));

  // Recentre la caméra en douceur sur une étoile.
  // Après un recentrage sur un vaisseau, la caméra le suit jusqu'à un déplacement manuel
  // (clic droit) ou un recentrage sur une étoile.
  let focus = null;
  let followId = null;
  function focusStar(id) {
    followId = null;
    const to = toVec(game.stars[id].pos);
    focus = { from: controls.target.clone(), to: () => to, t: 0 };
  }
  function focusShip(id) {
    if (!shipViews.has(id)) return;
    followId = id;
    focus = { from: controls.target.clone(), to: () => shipViews.get(id)?.holder.position ?? controls.target, t: 0 };
  }
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button === 2) followId = null;
  });

  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  });

  let active = true;
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;
    callbacks.onFrame(dt);
    if (!active) return; // vue d'une planète ouverte : le temps avance, l'amas n'est pas dessiné

    if (focus) {
      focus.t = Math.min(1, focus.t + dt * 2.2);
      const k = 1 - Math.pow(1 - focus.t, 3);
      const next = focus.from.clone().lerp(focus.to(), k);
      camera.position.add(next.clone().sub(controls.target));
      controls.target.copy(next);
      if (focus.t >= 1) focus = null;
    } else if (followId !== null) {
      const p = shipViews.get(followId).holder.position;
      camera.position.add(p.clone().sub(controls.target));
      controls.target.copy(p);
    }
    controls.update();
    sky.position.copy(camera.position);

    for (const v of currentViews) {
      if (!v.current.known) continue;
      const attr = v.points.geometry.attributes.position;
      for (let i = 0; i < PARTICLES_PER_CURRENT; i++) {
        const p = v.curve.getPoint((time * 0.06 + i / PARTICLES_PER_CURRENT) % 1);
        attr.setXYZ(i, p.x, p.y, p.z);
      }
      attr.needsUpdate = true;
      v.line.material.opacity = 0.22 + Math.sin(time * 1.5 + v.current.id) * 0.08;
    }

    for (const v of shipViews.values()) {
      const { pos, look } = shipPose(v.ship, THREE.MathUtils.clamp(v.scale * 0.7, 1, 2.5));
      const k = v.placed ? Math.min(1, dt * 6) : 1;
      v.placed = true;
      v.holder.position.lerp(pos, k);
      v.look.lerp(look, k);
      v.holder.lookAt(v.look);

      // Le vaisseau grossit avec la distance pour rester visible de loin.
      const camDist = camera.position.distanceTo(v.holder.position);
      const scale = (v.scale = THREE.MathUtils.clamp(camDist * 0.028, 0.45, 9));
      v.holder.scale.setScalar(scale);

      const traveling = v.ship.state === 'travel';
      // Propulsion : pleine poussée en voyage, ralenti en orbite.
      animateShip(v.model, time, traveling ? 1 : 0.15);
      for (const ring of v.model.userData.rings) ring.rotation.z += dt * 0.4;
      // Tourelles qui balaient lentement de gauche à droite ; feux rouges des vaisseaux de guerre.
      for (const t of v.model.userData.turrets ?? []) {
        t.rotation.y = t.userData.base + Math.sin(time * t.userData.speed + t.userData.phase) * 0.9;
      }
      for (const [i, l] of (v.model.userData.lights ?? []).entries()) l.visible = Math.sin(time * 2.5 + i * 1.3 + v.ship.id) > -0.2;
      v.model.userData.beacon.visible = Math.sin(time * 4 + v.ship.id * 2) > 0.3 || v.ship.state === 'analyse';

      const selected = v.ship.id === game.selectedShipId;
      v.marker.visible = selected || v.ship.state === 'analyse';
      v.marker.position.copy(v.holder.position);
      const pulse = v.ship.state === 'analyse' ? 1 + Math.sin(time * 5) * 0.15 : 1;
      v.marker.scale.setScalar(scale * 2.6 * pulse);
      v.marker.material.opacity = selected ? 0.9 : 0.45;
      v.marker.material.rotation -= dt * 0.6;
    }

    updateConvoys(dt, time);
    updateFleets(dt, time);
    updateBattles(dt);
    ring.material.rotation += dt * 0.4;
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  });

  update();
  return {
    update,
    focusStar,
    focusShip,
    setActive(value) {
      active = value;
      tooltip.style.display = 'none';
    },
  };
}

// Nébuleuses diffuses à l'intérieur de l'amas.
function addNebulae(scene, glow) {
  const R = CONFIG.clusterRadius;
  const tints = [0x4b2f8f, 0x1f4f99, 0x6a2a5e, 0x23506b];
  for (let i = 0; i < 9; i++) {
    const nebula = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow,
        color: tints[i % tints.length],
        transparent: true,
        opacity: 0.06 + Math.random() * 0.06,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * R * 1.1;
    nebula.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 30, Math.sin(a) * r);
    nebula.scale.setScalar(160 + Math.random() * 200);
    nebula.renderOrder = -1;
    scene.add(nebula);
  }
}
