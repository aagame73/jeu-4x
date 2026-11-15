// Propulsion animée des vaisseaux : jets en cône additif derrière chaque tuyère.
import * as THREE from 'three';
import { canvasTexture } from '../textures.js';

// --- Propulsion animée : jet en cône additif (enveloppe + cœur) derrière chaque tuyère ---

let jetTex = null;
let jetGeo = null;
const jetMats = new Map();
// Dégradé le long du jet : brillant à la tuyère, losanges de choc, extinction vers la queue.
function jetTexture() {
  jetTex ??= canvasTexture(16, 128, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const v = 1 - y / (h - 1); // 0 à la tuyère (bas du canvas), 1 en queue
      const a = Math.pow(1 - v, 1.7) * (0.82 + 0.18 * Math.cos(v * 34)) * Math.min(1, v * 14 + 0.35);
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(Math.max(0, a) * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  return jetTex;
}
function jetGeometry() {
  if (!jetGeo) {
    jetGeo = new THREE.CylinderGeometry(0.3, 1, 1, 16, 1, true);
    jetGeo.rotateX(-Math.PI / 2);
    jetGeo.translate(0, 0, -0.5); // de z = 0 (tuyère) à z = -1 (queue)
  }
  return jetGeo;
}
function jetMaterials(color) {
  const key = new THREE.Color(color).getHexString();
  if (!jetMats.has(key)) {
    const c = new THREE.Color(color);
    const opts = { map: jetTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide };
    jetMats.set(key, [
      new THREE.MeshBasicMaterial({ ...opts, color: c, opacity: 0.45 }),
      new THREE.MeshBasicMaterial({ ...opts, color: c.clone().lerp(new THREE.Color('#ffffff'), 0.65), opacity: 0.85 }),
    ]);
  }
  return jetMats.get(key);
}
// Jet à la sortie d'une tuyère de rayon r (repère du vaisseau, orienté vers -Z).
export function makeJet(parent, x, y, z, r, color, jets) {
  const [outer, inner] = jetMaterials(color);
  const group = new THREE.Group();
  const shell = new THREE.Mesh(jetGeometry(), outer);
  const core = new THREE.Mesh(jetGeometry(), inner);
  core.scale.set(0.45, 0.45, 0.6);
  shell.userData.fx = core.userData.fx = true;
  shell.renderOrder = core.renderOrder = 4;
  group.add(shell, core);
  group.position.set(x, y, z);
  parent.add(group);
  jets.push({ group, w: r * 0.85, len: r * 7, p: jets.length * 2.39 + x * 13 + y * 7 }); // phase sans tirage aléatoire : la forme ne change pas
}

// Anime la propulsion : jets qui pulsent et scintillent, halo des tuyères.
// thrust : 0 (moteurs au repos) à 1 (pleine poussée) ; le changement de régime est progressif.
export function animateShip(model, time, thrust = 1) {
  const u = model.userData;
  u.thrustNow = u.thrustNow == null ? thrust : u.thrustNow + (thrust - u.thrustNow) * 0.05;
  const t = u.thrustNow;
  const seed = u.fxSeed ?? 0;
  for (let i = 0; i < u.flames.length; i++) {
    const p = seed + i * 1.7;
    const flick = 1 + Math.sin(time * 31 + p) * 0.08 + Math.sin(time * 57.3 + p * 2.1) * 0.05;
    u.flames[i].scale.setScalar((0.3 + 0.6 * t) * flick);
  }
  for (const j of u.jets ?? []) {
    const flick = 1 + Math.sin(time * 37 + j.p) * 0.09 + Math.sin(time * 71 + j.p * 1.3) * 0.06 + Math.sin(time * 4.1 + j.p) * 0.07;
    const w = j.w * (0.7 + 0.35 * t) * (1 + Math.sin(time * 53 + j.p) * 0.04);
    j.group.scale.set(w, w, Math.max(0.001, j.len * (0.18 + 0.95 * t) * flick));
  }
}
