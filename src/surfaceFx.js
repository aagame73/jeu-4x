// Animations de la surface : eau qui s'écoule, volcans en éruption, arbres qui poussent
// et se balancent, bulles toxiques, éclats de glace, fumée (bâtiments compris).
// Le décor ambiant suit le temps réel ; la croissance des forêts suit le temps du jeu.
import * as THREE from 'three';
import { canvasTexture, glowTexture } from './textures.js';

const TREE_GROWTH_PER_DAY = 0.025; // un jeune arbre met une quarantaine de jours à grandir
const SAPLING_CHANCE_PER_DAY = 0.04;
const MAX_TREES = 7;

function waveTexture(vertical) {
  const texture = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2f78b8';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(190, 230, 255, 0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const y = (i / 14) * h + Math.random() * 6;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const yy = y + Math.sin((x / w) * Math.PI * 4 + i) * 3;
        if (vertical) ctx.lineTo(yy, x);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

const lavaGeometry = new THREE.SphereGeometry(0.035, 6, 4);
const lavaMaterial = new THREE.MeshBasicMaterial({ color: '#ff7a1a' });

export function createSurfaceFx() {
  const waterMap = waveTexture(false);
  const fallMap = waveTexture(true);
  const water = new THREE.MeshStandardMaterial({ color: '#7fc0ff', map: waterMap, transparent: true, opacity: 0.8, roughness: 0.15, metalness: 0.2 });
  const fall = new THREE.MeshStandardMaterial({ color: '#9fd0ff', map: fallMap, transparent: true, opacity: 0.85, roughness: 0.2, side: THREE.DoubleSide });
  const sparkle = new THREE.MeshStandardMaterial({ color: '#cfe6ff', roughness: 0.15, metalness: 0.2, emissive: '#2a4a6a', flatShading: true });

  const forests = [];
  const swayers = [];
  const volcanoes = [];
  const bubbles = [];
  const glyphs = [];
  const particles = [];

  function makeTree(rng) {
    const tree = new THREE.Group();
    const h = rng.range(0.35, 0.6);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(rng.range(0.12, 0.18), h, 6),
      new THREE.MeshStandardMaterial({ color: new THREE.Color('#2d5f2c').offsetHSL(rng.range(-0.03, 0.03), 0, rng.range(-0.05, 0.05)), roughness: 0.8, flatShading: true }),
    );
    crown.position.y = h / 2 + 0.06;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.12, 5), new THREE.MeshStandardMaterial({ color: '#5a4030', flatShading: true }));
    trunk.position.y = 0.06;
    crown.castShadow = trunk.castShadow = true;
    tree.add(crown, trunk);
    return tree;
  }

  function spawnSmoke(group, x, y, z, color = '#8a8a8a') {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.5, depthWrite: false }));
    sprite.position.set(x, y, z);
    sprite.scale.setScalar(0.15);
    group.add(sprite);
    particles.push({ object: sprite, group, kind: 'smoke', vel: new THREE.Vector3((Math.random() - 0.5) * 0.1, 0.35, (Math.random() - 0.5) * 0.1), life: 0, maxLife: 2.5 + Math.random() });
  }

  function erupt(v) {
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(lavaGeometry, lavaMaterial);
      mesh.position.set(v.x, v.y, v.z);
      v.group.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const s = 0.3 + Math.random() * 0.6;
      particles.push({ object: mesh, group: v.group, kind: 'lava', vel: new THREE.Vector3(Math.cos(a) * s, 1.6 + Math.random() * 1.4, Math.sin(a) * s), life: 0, maxLife: 1.8, floor: v.top });
    }
    for (let i = 0; i < 4; i++) spawnSmoke(v.group, v.x, v.y + 0.1, v.z, '#5a504a');
    v.flare = 1;
  }

  return {
    water,
    fall,
    sparkle,
    makeTree,

    addForest(group, rng, top, spots) {
      const forest = { group, rng, top, trees: [], spots };
      for (let i = rng.int(3, 5); i > 0; i--) this.plantTree(forest, rng.range(0.7, 1));
      forests.push(forest);
    },
    plantTree(forest, size) {
      const [x, z] = forest.spots();
      const tree = makeTree(forest.rng);
      tree.position.set(x, forest.top, z);
      tree.scale.setScalar(size);
      forest.group.add(tree);
      forest.trees.push({ tree, size, phase: forest.rng.range(0, 6) });
    },
    addSwayer(object, amount = 0.08) {
      swayers.push({ object, amount, phase: Math.random() * 6 });
    },
    addVolcano(group, x, z, top, glow) {
      volcanoes.push({ group, x, y: top + 0.24, z, top, glow, next: 2 + Math.random() * 8, flare: 0 });
    },
    addBubble(object, top) {
      bubbles.push({ object, top, phase: Math.random(), speed: 0.2 + Math.random() * 0.2, size: object.scale.x });
    },
    addGlyph(object) {
      glyphs.push(object);
    },
    puff: spawnSmoke,

    // dt : secondes réelles ; days : jours de jeu écoulés depuis l'image précédente.
    update(time, dt, days) {
      waterMap.offset.set(time * 0.03, time * 0.015);
      fallMap.offset.set(0, -time * 0.6);
      sparkle.emissiveIntensity = 0.7 + Math.sin(time * 3) * 0.5;

      for (const forest of forests) {
        for (const t of forest.trees) {
          if (t.size < 1) {
            t.size = Math.min(1, t.size + TREE_GROWTH_PER_DAY * days);
            t.tree.scale.setScalar(t.size);
          }
          t.tree.rotation.z = Math.sin(time * 1.3 + t.phase) * 0.04;
        }
        if (days > 0 && forest.trees.length < MAX_TREES && Math.random() < SAPLING_CHANCE_PER_DAY * days) this.plantTree(forest, 0.1);
      }
      for (const s of swayers) s.object.rotation.z = Math.sin(time * 1.8 + s.phase) * s.amount;
      for (const b of bubbles) {
        const k = (time * b.speed + b.phase) % 1;
        b.object.position.y = b.top + 0.04 + k * 0.35;
        b.object.scale.setScalar(b.size * (1 - k * 0.7));
      }
      for (const g of glyphs) {
        g.rotation.z = time * 0.3;
        g.material.opacity = 0.45 + Math.sin(time * 2) * 0.3;
      }
      for (const v of volcanoes) {
        v.next -= dt;
        if (v.next <= 0) {
          erupt(v);
          v.next = 6 + Math.random() * 10;
        }
        v.flare = Math.max(0, v.flare - dt * 0.8);
        v.glow.scale.setScalar(0.6 + v.flare * 1.6 + Math.sin(time * 2 + v.x) * 0.08);
        v.glow.material.opacity = 0.6 + v.flare * 0.4;
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.kind === 'lava') {
          p.vel.y -= 4.5 * dt;
          p.object.position.addScaledVector(p.vel, dt);
          if (p.object.position.y < p.floor) {
            p.object.position.y = p.floor;
            p.vel.set(0, 0, 0);
          }
          p.object.scale.setScalar(1 - (p.life / p.maxLife) * 0.6);
        } else {
          p.object.position.addScaledVector(p.vel, dt);
          p.object.scale.setScalar(0.15 + p.life * 0.25);
          p.object.material.opacity = 0.5 * (1 - p.life / p.maxLife);
        }
        if (p.life >= p.maxLife) {
          p.group.remove(p.object);
          if (p.kind === 'smoke') p.object.material.dispose();
          particles.splice(i, 1);
        }
      }
    },
  };
}
