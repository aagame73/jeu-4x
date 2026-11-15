// Générateur procédural de vaisseaux : chaque graine donne une coque, des ailes,
// des capteurs et une livrée différents. Les vaisseaux pointent vers +Z.
// Point d'entrée unique ; le détail est dans src/ships/ :
//   classic.js (générateur d'origine), archetypes.js (8 styles d'espèce), parts.js (pièces communes),
//   materials.js (textures PBR procédurales), patterns.js (motifs par espèce), jets.js (propulsion).
import * as THREE from 'three';
import { createClassicShip } from './ships/classic.js';
import { animateShip } from './ships/jets.js';
import { shipScale } from './ships/parts.js';
import { createStyledShip } from './ships/archetypes.js';

export { animateShip, shipScale };

export const SHIP_ACCENTS = ['#7cff9e', '#ffb347', '#5fd3ff', '#ff6fae', '#c6a0ff', '#fff07a'];
export const SHIP_NAMES = ['Aiguille', 'Pèlerin', 'Lanterne', 'Héron', 'Murmure', 'Sillage', 'Boussole', 'Écume'];

// style : `shipStyle` d'une espèce (config.js). Sans style, c'est le générateur d'origine, inchangé
// (mêmes tirages, mêmes vaisseaux pour les anciennes parties).
export function createShip(seed, accent, registry = '', kind = 'sonde', style = null) {
  if (style) return createStyledShip(seed, accent, registry, kind, style);
  return createClassicShip(seed, accent, registry, kind);
}

// Vignettes des vaisseaux pour l'interface, rendues une seule fois.
// style : style d'espèce commun à toutes les vignettes (chaque spec peut aussi porter le sien).
// Un seul moteur de rendu pour toutes les vignettes : en créer un par appel rechargeait toutes les
// textures (une demi-seconde par vaisseau) et faisait perdre des contextes WebGL au navigateur.
let thumbRenderer = null;
export function renderShipThumbnails(specs, width = 120, height = 72, style = null) {
  thumbRenderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  const renderer = thumbRenderer;
  renderer.setPixelRatio(2);
  renderer.setSize(width, height);
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
  camera.position.set(1.75, 1.0, 1.45);
  camera.lookAt(0, 0, 0);
  const urls = specs.map(({ seed, accent, registry, kind, style: own }) => {
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0x8090b0, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.5);
    sun.position.set(2, 3, 2);
    scene.add(sun);
    const ship = createShip(seed, accent, registry, kind, own ?? style);
    // Même cadrage pour tous : la plus grande dimension (anneaux compris) tient dans la vignette, centrée.
    ship.scale.setScalar(1);
    ship.updateMatrixWorld(true);
    const box = new THREE.Box3();
    ship.traverse((o) => {
      if (o.isMesh && !o.userData.fx) box.expandByObject(o);
    });
    const dims = box.getSize(new THREE.Vector3());
    const extent = Math.max(dims.z, Math.max(dims.x, dims.y) * 1.25, 0.001);
    ship.scale.setScalar(1.6 / extent);
    ship.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-1.6 / extent);
    animateShip(ship, seed * 0.37, 0.5);
    scene.add(ship);
    renderer.clear();
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL();
  });
  return urls;
}
