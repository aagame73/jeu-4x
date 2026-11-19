// Planche de contrôle des bâtiments (outil de développement, pas chargé par le jeu) :
// tous les bâtiments × les styles demandés, sur une case hexagonale, en une seule image.
// Dans la console du jeu : (await import('/src/buildings/sheet.js')).buildingSheet(['sans-espece', 'vaskhar', 'synodes'])
import * as THREE from 'three';
import { BUILDINGS } from '../economy.js';
import { SPECIES } from '../config.js';
import { buildingMesh } from './index.js';

const CELL = 150;
const HEAD = 120; // colonne des noms d'espèces

function disposeGroup(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    for (const mat of [o.material].flat()) if (mat && !mat.userData?.shared) mat.dispose();
  });
}

// Renvoie un canvas : une ligne par style, une colonne par bâtiment (niveau 1, construit).
export function buildingSheet(styles = ['sans-espece', 'vaskhar', 'synodes'], level = 1) {
  const types = Object.keys(BUILDINGS);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(CELL, CELL);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(1.6, 1.55, 1.9);
  camera.lookAt(0, 0.25, 0);
  const sheet = document.createElement('canvas');
  sheet.width = HEAD + CELL * types.length;
  sheet.height = 28 + CELL * styles.length;
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = '#0a0e18';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#cfd8f0';
  types.forEach((t, i) => ctx.fillText(BUILDINGS[t].label.slice(0, 22), HEAD + i * CELL + 6, 18));
  styles.forEach((species, row) => {
    ctx.fillStyle = SPECIES[species]?.accent ?? '#cfd8f0';
    ctx.fillText(SPECIES[species]?.label ?? species, 8, 28 + row * CELL + CELL / 2);
    types.forEach((type, col) => {
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0x8090b0, 1.4));
      const sun = new THREE.DirectionalLight(0xffffff, 2.4);
      sun.position.set(2, 4, 2);
      scene.add(sun);
      const hex = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.96, 0.1, 6), new THREE.MeshStandardMaterial({ color: '#4a5a3a', flatShading: true }));
      hex.position.y = -0.05;
      scene.add(hex);
      const building = buildingMesh(type, false, level, species);
      building.userData.tick?.(1.3, 0.016, { puff() {} });
      scene.add(building);
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, HEAD + col * CELL, 28 + row * CELL);
      disposeGroup(building);
      hex.geometry.dispose();
      hex.material.dispose();
    });
  });
  renderer.dispose();
  return sheet;
}

// Affiche la planche par-dessus la page (clic pour la fermer).
export function showBuildingSheet(styles, level) {
  const sheet = buildingSheet(styles, level);
  sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;max-width:100vw;max-height:100vh;margin:auto;background:#0a0e18;cursor:pointer';
  sheet.addEventListener('click', () => sheet.remove());
  document.body.append(sheet);
  return sheet;
}
