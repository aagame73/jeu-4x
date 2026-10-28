// Rendu 3D de l'amas avec Three.js : étoiles, brouillard de guerre, courants, sondes.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CONFIG } from './config.js';
import { STAR_TYPES, starDistance } from './galaxy.js';
import { reachableStars, probeProgress } from './game.js';
import { createSky } from './skybox.js';
import { createShip } from './ships.js';
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

  // Sondes : un vaisseau 3D unique, un anneau de sélection et la trace de son trajet.
  const ringTex = ringTexture();
  const probeViews = game.probes.map((probe) => {
    const ship = createShip(probe.shipSeed, probe.accent, probe.registry);
    const holder = new THREE.Group();
    holder.add(ship);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color: probe.accent, transparent: true, depthWrite: false, depthTest: false }));
    marker.renderOrder = 10;
    const trail = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineDashedMaterial({ color: probe.accent, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.75 }),
    );
    scene.add(holder, marker, trail);
    return { probe, ship, holder, marker, trail, look: new THREE.Vector3(), placed: false, scale: 1 };
  });

  // Position et point visé : en orbite autour de l'étoile, ou en route vers la destination.
  const _pos = new THREE.Vector3();
  const _look = new THREE.Vector3();
  function probePose(probe, orbitScale) {
    if (probe.state === 'travel') {
      const to = toVec(game.stars[probe.toId].pos);
      _pos.copy(toVec(game.stars[probe.fromId].pos)).lerp(to, probeProgress(probe)).y += 1;
      _look.copy(to).setY(to.y + 1);
    } else {
      const center = game.stars[probe.starId].pos;
      const angle = game.time * 0.35 + probe.id * 2.1;
      const r = (2.6 + probe.id * 0.6) * orbitScale;
      const y = center.y + 0.8 + Math.sin(game.time * 0.5 + probe.id) * 0.3;
      _pos.set(center.x + Math.cos(angle) * r, y, center.z + Math.sin(angle) * r);
      _look.set(center.x + Math.cos(angle + 0.3) * r, y, center.z + Math.sin(angle + 0.3) * r);
    }
    return { pos: _pos, look: _look };
  }

  // Synchronise l'affichage avec l'état de la partie.
  function update() {
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
      el.className = 'star-label' + (star.id === game.homeId ? ' home' : '') + (star.rival ? ' rival' : '') + (star.hasRuins && star.level === 3 ? ' ruins' : '');
    }

    for (const v of currentViews) {
      v.line.visible = v.points.visible = v.current.known;
    }

    const probe = game.probes[game.selectedProbeId];
    const positions = [];
    if (probe && probe.state === 'idle') {
      const from = game.stars[probe.starId].pos;
      for (const s of reachableStars(game, probe)) positions.push(from.x, from.y, from.z, s.pos.x, s.pos.y, s.pos.z);
    }
    reachLines.geometry.dispose();
    reachLines.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    const selected = game.stars[game.selectedStarId];
    ring.visible = !!selected && selected.level >= 1;
    if (ring.visible) {
      ring.position.copy(toVec(selected.pos));
      ring.scale.setScalar(STAR_TYPES[selected.type].size * 4.2);
    }

    for (const v of probeViews) {
      const traveling = v.probe.state === 'travel';
      v.trail.visible = traveling;
      if (traveling) {
        v.trail.geometry.setFromPoints([toVec(game.stars[v.probe.fromId].pos), toVec(game.stars[v.probe.toId].pos)]);
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

  // Une sonde sous le curseur (prioritaire sur les étoiles).
  function probeAt(clientX, clientY, maxPx) {
    const rect = renderer.domElement.getBoundingClientRect();
    let best = null;
    let bestD = maxPx;
    const p = new THREE.Vector3();
    for (const v of probeViews) {
      p.copy(v.holder.position).project(camera);
      if (p.z > 1) continue;
      const d = Math.hypot(rect.left + ((p.x + 1) / 2) * rect.width - clientX, rect.top + ((1 - p.y) / 2) * rect.height - clientY);
      if (d < bestD) {
        bestD = d;
        best = v.probe;
      }
    }
    return best;
  }

  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || e.button !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const probe = probeAt(e.clientX, e.clientY, 14);
    if (probe) {
      focusProbe(probe.id);
      return callbacks.onSelectProbe(probe.id);
    }
    const star = starAt(e.clientX, e.clientY, 22);
    if (star) callbacks.onSelectStar(star.id);
  });
  renderer.domElement.addEventListener('dblclick', (e) => {
    const star = starAt(e.clientX, e.clientY, 22);
    if (star) focusStar(star.id);
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    const hoveredProbe = probeAt(e.clientX, e.clientY, 14);
    const star = hoveredProbe ? null : starAt(e.clientX, e.clientY, 16);
    renderer.domElement.style.cursor = star || hoveredProbe ? 'pointer' : '';
    if (!star && !hoveredProbe) {
      tooltip.style.display = 'none';
      return;
    }
    if (hoveredProbe) {
      tooltip.innerHTML = `<strong style="color:${hoveredProbe.accent}">${hoveredProbe.name}</strong><span>${hoveredProbe.registry}</span>`;
    } else {
      const probe = game.probes[game.selectedProbeId];
      const d = probe ? Math.round(starDistance(game.stars[probe.state === 'travel' ? probe.toId : probe.starId], star)) : null;
      tooltip.innerHTML = `<strong>${star.level >= 2 ? star.name : 'Lueur inconnue'}</strong>` + (d ? `<span>${d} al de ${probe.name}</span>` : '');
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
  function focusProbe(id) {
    followId = id;
    focus = { from: controls.target.clone(), to: () => probeViews[id].holder.position, t: 0 };
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

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;
    callbacks.onFrame(dt);

    if (focus) {
      focus.t = Math.min(1, focus.t + dt * 2.2);
      const k = 1 - Math.pow(1 - focus.t, 3);
      const next = focus.from.clone().lerp(focus.to(), k);
      camera.position.add(next.clone().sub(controls.target));
      controls.target.copy(next);
      if (focus.t >= 1) focus = null;
    } else if (followId !== null) {
      const p = probeViews[followId].holder.position;
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

    for (const v of probeViews) {
      const { pos, look } = probePose(v.probe, THREE.MathUtils.clamp(v.scale * 0.7, 1, 2.5));
      const k = v.placed ? Math.min(1, dt * 6) : 1;
      v.placed = true;
      v.holder.position.lerp(pos, k);
      v.look.lerp(look, k);
      v.holder.lookAt(v.look);

      // Le vaisseau grossit avec la distance pour rester visible de loin.
      const camDist = camera.position.distanceTo(v.holder.position);
      const scale = (v.scale = THREE.MathUtils.clamp(camDist * 0.028, 0.45, 9));
      v.holder.scale.setScalar(scale);

      const traveling = v.probe.state === 'travel';
      for (const flame of v.ship.userData.flames) {
        flame.scale.setScalar((traveling ? 0.9 : 0.35) * (1 + Math.sin(time * 30 + v.probe.id) * 0.12));
      }
      v.ship.userData.beacon.visible = Math.sin(time * 4 + v.probe.id * 2) > 0.3 || v.probe.state === 'analyse';

      const selected = v.probe.id === game.selectedProbeId;
      v.marker.visible = selected || v.probe.state === 'analyse';
      v.marker.position.copy(v.holder.position);
      const pulse = v.probe.state === 'analyse' ? 1 + Math.sin(time * 5) * 0.15 : 1;
      v.marker.scale.setScalar(scale * 2.6 * pulse);
      v.marker.material.opacity = selected ? 0.9 : 0.45;
      v.marker.material.rotation -= dt * 0.6;
    }

    ring.material.rotation += dt * 0.4;
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  });

  update();
  return { update, focusStar, focusProbe };
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
