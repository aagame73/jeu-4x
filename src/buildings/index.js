// Modèles 3D des bâtiments de surface, au style de l'espèce du joueur (docs/plan-batiments-especes.md).
// Chaque style redessine les bâtiments qu'il connaît et laisse les autres au style neutre ; chaque
// bâtiment garde son élément de fonction (foreuse, antenne, cheminée…) pour rester reconnaissable.
// Le niveau (2 à 4) agrandit le bâtiment et allume 1 à 4 barres sur une petite borne.
import * as THREE from 'three';
import { BUILDINGS } from '../economy.js';
import { makeKit, std } from './kit.js';
import { buildNeutral } from './neutral.js';
import { buildVaskhar } from './vaskhar.js';
import { buildSynodes } from './synodes.js';

export { dimBuilding } from './kit.js';

const MAX_LEVEL = 4;
const LEVEL_COLORS = ['#7cff9e', '#5fe3ff', '#c9a7ff', '#ffd166'];
const isUpgradable = (type) => !!BUILDINGS[type] && BUILDINGS[type].upgradable !== false && BUILDINGS[type].buildable !== false;

// Styles d'espèce : (type, kit) => animation, null (pas d'animation) ou undefined (bâtiment non redessiné).
const STYLES = { vaskhar: buildVaskhar, synodes: buildSynodes };

export const BUILDING_TYPES = Object.keys(BUILDINGS);

export function buildingMesh(type, ghost, level = 1, species = null) {
  const kit = makeKit(ghost);
  const { g } = kit;
  let tick = STYLES[species]?.(type, kit);
  if (tick === undefined) tick = buildNeutral(type, kit);
  // Niveau : le bâtiment grandit un peu, et une petite borne porte 1 à 4 barres lumineuses.
  if (!ghost && isUpgradable(type)) {
    g.scale.setScalar(1 + 0.07 * (level - 1));
    const color = LEVEL_COLORS[Math.min(level, MAX_LEVEL) - 1];
    const barMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4 });
    const post = new THREE.Group();
    post.position.set(-0.5, 0, -0.42);
    post.scale.setScalar(1 / g.scale.x); // la borne garde la même taille quel que soit le niveau
    g.add(post);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.06 + level * 0.06, 0.035), std('#3e444b'));
    pole.position.y = (0.06 + level * 0.06) / 2;
    post.add(pole);
    for (let i = 0; i < level; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.06), barMat);
      bar.position.set(0.05, 0.05 + i * 0.06, 0);
      post.add(bar);
    }
    const base = tick;
    tick = (time, dt, fx) => {
      base?.(time, dt, fx);
      barMat.emissiveIntensity = 0.7 + Math.sin(time * 2.2) * 0.3;
    };
  }
  if (!ghost) g.userData.tick = tick;
  return g;
}
