// Outils communs aux modèles de bâtiments (docs/plan-batiments-especes.md) : matériaux, ajout de
// pièces, lumières, effets réguliers. Chaque bâtiment a ses propres matériaux (on peut les ternir
// sans toucher aux autres) ; seul le matériau « fantôme » des chantiers est partagé.
import * as THREE from 'three';
import { glowTexture } from '../textures.js';

export const ghostMaterial = new THREE.MeshBasicMaterial({ color: '#7cd8ff', wireframe: true, transparent: true, opacity: 0.55 });
ghostMaterial.userData.shared = true;

export function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, flatShading: true, ...extra });
}

// ghost : bâtiment en chantier (tout en fil de fer).
export function makeKit(ghost) {
  const g = new THREE.Group();
  const m = (color, extra) => (ghost ? ghostMaterial : std(color, extra));
  const add = (geometry, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  const light = (color, intensity = 0.8) => m(color, { emissive: color, emissiveIntensity: intensity });
  // Appelle `fn` à intervalles réguliers (fumée, vapeur, spores).
  const every = (period, fn) => {
    let wait = Math.random() * period;
    return (time, dt, fx) => {
      wait -= dt;
      if (wait <= 0) {
        wait = period * (0.7 + Math.random() * 0.6);
        fn(fx);
      }
    };
  };
  // Enchaîne plusieurs animations en une.
  const chain = (...ticks) => {
    const list = ticks.filter(Boolean);
    return list.length ? (time, dt, fx) => list.forEach((t) => t(time, dt, fx)) : null;
  };
  // Halo lumineux (sprite additif) ; absent en chantier.
  const glow = (color, x, y, z, scale = 0.4, opacity = 0.5, parent = g) => {
    if (ghost) return null;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(scale);
    parent.add(sprite);
    return sprite;
  };
  // Pièce rattachée à un sous-groupe (tête qui pivote, bras…).
  const part = (parent, geometry, material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const group = (x = 0, y = 0, z = 0, parent = g) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    parent.add(grp);
    return grp;
  };
  return { g, ghost, add, m, light, every, chain, glow, part, group, ghostMaterial, std };
}

// Bâtiment à l'arrêt (en pause, ou fonderie sans minerai) : couleurs ternies, lueurs éteintes.
export function dimBuilding(group) {
  group.traverse((o) => {
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const mat of mats) {
      if (mat === ghostMaterial || mat.userData?.shared) continue;
      mat.color?.lerp(new THREE.Color('#3a3f4a'), 0.6);
      if (mat.emissive) mat.emissiveIntensity = (mat.emissiveIntensity ?? 1) * 0.15;
      if (mat.blending === THREE.AdditiveBlending) o.visible = false; // lueurs éteintes (leur animation ne touche qu'à l'opacité)
    }
  });
}
