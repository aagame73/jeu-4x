// Bâtiments au style neutre (Colons de l'Arche) : les modèles d'origine, utilisés aussi pour
// tout bâtiment qu'un style d'espèce ne redessine pas. Renvoie l'animation du bâtiment (ou null).
import * as THREE from 'three';
import { glowTexture } from '../textures.js';

export function buildNeutral(type, kit) {
  const { g, ghost, add, m, light, every, ghostMaterial } = kit;
  let tick = null; // animation propre au bâtiment, une fois construit
  switch (type) {
    case 'centre':
      add(new THREE.CylinderGeometry(0.55, 0.62, 0.12, 6), m('#9aa3ad'), 0, 0.06);
      add(new THREE.SphereGeometry(0.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m('#e8ecf0', { metalness: 0.4, roughness: 0.35 }), 0, 0.12);
      add(new THREE.TorusGeometry(0.42, 0.03, 6, 24), light('#7cff9e'), 0, 0.14).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4), m('#555'), 0.15, 0.6, 0);
      {
        const beacon = add(new THREE.SphereGeometry(0.035, 6, 4), light('#ff5050'), 0.15, 0.86, 0);
        tick = (time) => (beacon.visible = Math.sin(time * 3) > 0);
      }
      break;
    case 'foyer':
      for (const [x, z, r] of [[-0.2, 0.1, 0.22], [0.22, 0.12, 0.18], [0, -0.22, 0.2]]) {
        add(new THREE.SphereGeometry(r, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m('#dfe3e8', { metalness: 0.3, roughness: 0.4 }), x, 0, z);
        add(new THREE.BoxGeometry(0.08, 0.08, 0.02), light('#ffe08a'), x, 0.07, z + r - 0.01);
      }
      break;
    case 'puits':
      add(new THREE.BoxGeometry(0.4, 0.1, 0.4), m('#5b5f66'), 0, 0.05);
      add(new THREE.CylinderGeometry(0.05, 0.16, 0.8, 4, 1, true), m('#c9a24a', { metalness: 0.5 }), 0, 0.5).rotation.y = Math.PI / 4;
      add(new THREE.ConeGeometry(0.08, 0.15, 4), m('#c9a24a'), 0, 0.97);
      {
        const lamp = add(new THREE.SphereGeometry(0.03, 6, 4), light('#ffb347'), 0, 1.06);
        tick = (time) => (lamp.visible = Math.sin(time * 5) > -0.3);
      }
      break;
    case 'fonderie':
      add(new THREE.BoxGeometry(0.55, 0.28, 0.35), m('#6a5a4e'), -0.05, 0.14);
      add(new THREE.BoxGeometry(0.25, 0.2, 0.25), m('#7b6a5c'), 0.25, 0.1, 0.2);
      add(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 8), m('#3c3330'), 0.2, 0.35, -0.12);
      add(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 8), light('#ff6a1a'), 0.2, 0.71, -0.12);
      {
        // Coulée d'alliage : une rigole incandescente et des lingots qui refroidissent.
        add(new THREE.BoxGeometry(0.34, 0.04, 0.09), m('#3c3330'), -0.12, 0.02, 0.27);
        const pour = add(new THREE.BoxGeometry(0.3, 0.012, 0.05), light('#ff8a3a'), -0.12, 0.045, 0.27);
        for (const x of [-0.24, -0.12, 0]) add(new THREE.BoxGeometry(0.07, 0.035, 0.05), m('#9fb4c8', { metalness: 0.8, roughness: 0.25 }), x, 0.018, 0.38);
        const smoke = every(0.9, (fx) => fx.puff(g, 0.2, 0.75, -0.12, '#6a6460'));
        tick = (time, dt, fx) => {
          pour.material.emissiveIntensity = 0.7 + Math.sin(time * 6) * 0.25 + Math.sin(time * 13) * 0.1;
          smoke(time, dt, fx);
        };
      }
      break;
    case 'pompe': {
      // Plateforme sur pilotis, tour de pompage et réservoir sphérique de deutérium.
      add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 6), m('#6b737c', { metalness: 0.5 }), 0, 0.12);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 5), m('#3e444b'), Math.cos(a) * 0.34, 0.04, Math.sin(a) * 0.34);
      }
      add(new THREE.CylinderGeometry(0.05, 0.07, 0.62, 6), m('#9aa3ad', { metalness: 0.5 }), -0.16, 0.45, -0.08);
      add(new THREE.BoxGeometry(0.28, 0.03, 0.03), m('#5b5f66'), -0.02, 0.7, -0.08);
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 5), m('#5b5f66'), 0.1, 0.28, 0.12).rotation.z = 0.3;
      const tank = add(new THREE.SphereGeometry(0.17, 14, 10), m('#5fe3ff', { emissive: '#1a8aa8', emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.25 }), 0.14, 0.34, 0.08);
      add(new THREE.TorusGeometry(0.17, 0.015, 4, 20), m('#c9ced4'), 0.14, 0.34, 0.08).rotation.x = Math.PI / 2;
      const beacon = add(new THREE.SphereGeometry(0.03, 6, 4), light('#5fe3ff'), -0.16, 0.8, -0.08);
      const vent = every(1.6, (fx) => fx.puff(g, 0.14, 0.52, 0.08, '#9ff0ff'));
      tick = (time, dt, fx) => {
        beacon.visible = Math.sin(time * 2.5) > -0.2;
        tank.material.emissiveIntensity = 0.45 + Math.sin(time * 1.5) * 0.2;
        vent(time, dt, fx);
      };
      break;
    }
    case 'captage': {
      // Bassin circulaire, tuyaux et réservoir d'eau.
      add(new THREE.TorusGeometry(0.3, 0.05, 6, 20), m('#a7b0b8'), -0.08, 0.05, 0.05).rotation.x = Math.PI / 2;
      const pool = add(
        new THREE.CircleGeometry(0.28, 20),
        ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#4aa8ff', emissive: '#0a2a55', transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.2 }),
        -0.08,
        0.07,
        0.05,
      );
      pool.rotation.x = -Math.PI / 2;
      add(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 10), m('#4aa8ff', { metalness: 0.4, roughness: 0.3 }), 0.3, 0.21, -0.22);
      add(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m('#c9ced4', { metalness: 0.5 }), 0.3, 0.42, -0.22);
      const pipe = add(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 5), m('#7d8794', { metalness: 0.6 }), 0.12, 0.08, -0.1);
      pipe.rotation.z = Math.PI / 2;
      pipe.rotation.y = 0.6;
      add(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 5), m('#7d8794', { metalness: 0.6 }), 0.3, 0.52, -0.22);
      const level = add(new THREE.BoxGeometry(0.02, 0.2, 0.02), light('#9fe0ff'), 0.3 + 0.13, 0.21, -0.22);
      tick = (time) => {
        pool.rotation.z = time * 0.4; // l'eau tourbillonne lentement
        level.scale.y = 0.6 + 0.4 * (0.5 + Math.sin(time * 0.8) * 0.5);
      };
      break;
    }
    case 'fouille': {
      // Échafaudages, bâches, petite grue et lueur dorée de l'artefact mis au jour.
      for (const [x, z] of [[-0.3, -0.25], [-0.3, 0.2], [0.05, -0.25], [0.05, 0.2]]) add(new THREE.BoxGeometry(0.025, 0.4, 0.025), m('#a8865a'), x, 0.2, z);
      for (const y of [0.18, 0.38]) {
        add(new THREE.BoxGeometry(0.38, 0.02, 0.02), m('#a8865a'), -0.125, y, -0.25);
        add(new THREE.BoxGeometry(0.38, 0.02, 0.02), m('#a8865a'), -0.125, y, 0.2);
      }
      add(new THREE.BoxGeometry(0.4, 0.015, 0.5), m('#8a7a5a'), -0.125, 0.39, -0.025);
      const tarp = add(new THREE.PlaneGeometry(0.42, 0.3), m('#d9792b', { side: THREE.DoubleSide }), -0.125, 0.3, 0.21);
      tarp.rotation.x = 0.25;
      add(new THREE.PlaneGeometry(0.3, 0.26), m('#3f7fb0', { side: THREE.DoubleSide }), 0.06, 0.25, -0.03).rotation.y = Math.PI / 2;
      // Fosse avec l'artefact.
      add(new THREE.CylinderGeometry(0.12, 0.1, 0.02, 8), m('#4a3a2a'), 0.28, 0.01, 0.22);
      const relic = add(new THREE.OctahedronGeometry(0.05), light('#ffd166'), 0.28, 0.06, 0.22);
      // Grue : mât fixe, flèche qui pivote.
      add(new THREE.CylinderGeometry(0.02, 0.025, 0.6, 5), m('#e0b030'), 0.3, 0.3, -0.2);
      const boom = new THREE.Group();
      boom.position.set(0.3, 0.6, -0.2);
      g.add(boom);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.025), m('#e0b030'));
      arm.position.x = -0.15;
      arm.castShadow = true;
      boom.add(arm);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 3), m('#333'));
      cable.position.set(-0.36, -0.125, 0);
      boom.add(cable);
      let glow = null;
      if (!ghost) {
        glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd166', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.position.set(0.28, 0.1, 0.22);
        glow.scale.setScalar(0.45);
        g.add(glow);
      }
      tick = (time) => {
        boom.rotation.y = Math.sin(time * 0.35) * 1.1;
        relic.rotation.y = time * 1.5;
        const pulse = 0.5 + Math.sin(time * 2.2) * 0.5;
        relic.material.emissiveIntensity = 0.5 + pulse * 0.8;
        if (glow) glow.material.opacity = 0.3 + pulse * 0.45;
      };
      break;
    }
    case 'centrale': {
      const profile = [0.32, 0.24, 0.2, 0.22, 0.26].map((r, i) => new THREE.Vector2(r, i * 0.15));
      add(new THREE.LatheGeometry(profile, 14), m('#b9bec4', { side: THREE.DoubleSide }), -0.1, 0);
      add(new THREE.BoxGeometry(0.2, 0.18, 0.2), m('#7d8794'), 0.3, 0.09, 0.15);
      {
        const ring = add(new THREE.TorusGeometry(0.25, 0.02, 4, 16), light('#ffd166'), -0.1, 0.6);
        ring.rotation.x = Math.PI / 2;
        const steam = every(1.4, (fx) => fx.puff(g, -0.1, 0.65, 0, '#e8eef4'));
        tick = (time, dt, fx) => {
          ring.material.emissiveIntensity = 0.6 + Math.sin(time * 4) * 0.4;
          steam(time, dt, fx);
        };
      }
      break;
    }
    case 'solaire':
      for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) {
        add(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 4), m('#666'), x, 0.06, z);
        const panel = add(new THREE.BoxGeometry(0.36, 0.02, 0.3), m('#1d3f7a', { metalness: 0.6, roughness: 0.2, emissive: 0x0a1a3a }), x, 0.14, z);
        panel.rotation.x = -0.45;
      }
      break;
    case 'serre':
      add(new THREE.CylinderGeometry(0.48, 0.5, 0.06, 12), m('#8a9098'), 0, 0.03);
      add(new THREE.SphereGeometry(0.34, 12, 6), m('#5fbf6a', { emissive: 0x103a14 }), 0, 0.02).scale.y = 0.5;
      add(new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 }), 0, 0.05);
      break;
    case 'ferme':
      add(new THREE.TorusGeometry(0.4, 0.06, 6, 20), m('#d0d4d8'), 0, 0.08).rotation.x = Math.PI / 2;
      {
        const nets = new THREE.Group();
        g.add(nets);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const net = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.1), m('#4fae5a', { emissive: 0x0a3010 }));
          net.position.set(Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2);
          net.rotation.y = -a;
          nets.add(net);
        }
        tick = (time) => (nets.rotation.y = time * 0.3);
      }
      add(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m('#e8ecf0'), 0, 0.08);
      break;
    case 'laboratoire': {
      // Bloc de laboratoire, coupole d'observation vitrée, antenne parabolique qui balaie le ciel.
      add(new THREE.BoxGeometry(0.5, 0.06, 0.42), m('#6b737c'), 0, 0.03);
      add(new THREE.BoxGeometry(0.42, 0.22, 0.34), m('#dfe3e8', { metalness: 0.3, roughness: 0.45 }), -0.04, 0.17);
      // Bandeau de fenêtres et anneau lumineux qui pulsent en cyan.
      const windows = add(new THREE.BoxGeometry(0.43, 0.035, 0.345), light('#7ff0ff'), -0.04, 0.2);
      add(new THREE.CylinderGeometry(0.13, 0.14, 0.05, 12), m('#9aa3ad', { metalness: 0.4 }), -0.1, 0.305, 0);
      add(
        new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#9fe8ff', emissive: '#0b3a48', transparent: true, opacity: 0.6, roughness: 0.05, metalness: 0.2 }),
        -0.1,
        0.33,
        0,
      );
      const scope = add(new THREE.CylinderGeometry(0.018, 0.026, 0.16, 6), m('#3e444b'), -0.1, 0.38, 0);
      scope.rotation.z = 0.6;
      const ring = add(new THREE.TorusGeometry(0.135, 0.012, 4, 20), light('#5fe3ff'), -0.1, 0.33, 0);
      ring.rotation.x = Math.PI / 2;
      // Mât et parabole : la tête pivote lentement sur son axe.
      add(new THREE.CylinderGeometry(0.02, 0.028, 0.32, 5), m('#7d8794', { metalness: 0.6 }), 0.2, 0.44, 0.08);
      const head = new THREE.Group();
      head.position.set(0.2, 0.6, 0.08);
      g.add(head);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3.2), m('#e8ecf0', { metalness: 0.5, roughness: 0.3, side: THREE.DoubleSide }));
      dish.rotation.x = -Math.PI / 2 - 0.5; // creux tourné vers le ciel, un peu incliné
      dish.position.set(0, 0.05, 0.1);
      dish.castShadow = true;
      head.add(dish);
      const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 3), m('#555'));
      feed.rotation.x = 0.5;
      feed.position.set(0, 0.06, -0.02);
      head.add(feed);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), light('#7ff0ff'));
      tip.position.set(0, 0.12, -0.05);
      head.add(tip);
      let glow = null;
      if (!ghost) {
        glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#5fe3ff', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.position.set(-0.1, 0.4, 0);
        glow.scale.setScalar(0.5);
        g.add(glow);
      }
      tick = (time) => {
        head.rotation.y = time * 0.45 + Math.sin(time * 0.9) * 0.4;
        const pulse = 0.5 + Math.sin(time * 2) * 0.5;
        ring.material.emissiveIntensity = 0.4 + pulse * 0.9;
        windows.material.emissiveIntensity = 0.5 + pulse * 0.4;
        tip.visible = Math.sin(time * 4) > -0.4;
        if (glow) glow.material.opacity = 0.2 + pulse * 0.4;
      };
      break;
    }
    case 'siphon':
      add(new THREE.CylinderGeometry(0.25, 0.32, 0.12, 8), m('#4a4458'), 0, 0.06);
      add(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6), m('#6a6478', { metalness: 0.6 }), 0, 0.4);
      {
        const crystal = add(new THREE.OctahedronGeometry(0.12), light('#c77dff'), 0, 0.8);
        crystal.scale.y = 1.6;
        tick = (time) => {
          crystal.rotation.y = time;
          crystal.position.y = 0.8 + Math.sin(time * 2) * 0.04;
        };
      }
      break;
    case 'spatioport': {
      // Spatioport : aire de lancement hexagonale balisée, tour de lancement avec une fusée-sonde
      // prête à partir, petit poste de contrôle. Balises en chenillard, feu de tour, vapeur au pied.
      add(new THREE.CylinderGeometry(0.5, 0.54, 0.06, 6), m('#5b5f66', { roughness: 0.8 }), 0, 0.03);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.012, 6), m('#d9b44a', { roughness: 0.6 }), 0.08, 0.066); // marquage jaune
      add(new THREE.CylinderGeometry(0.26, 0.26, 0.014, 6), m('#3e444b', { roughness: 0.7 }), 0.08, 0.068);
      // Balises lumineuses sur le pourtour de l'aire.
      const beacons = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        beacons.push(add(new THREE.SphereGeometry(0.022, 6, 4), light('#ffb347'), Math.cos(a) * 0.44, 0.075, Math.sin(a) * 0.44));
      }
      // Fusée-sonde : corps blanc, bande d'accent, coiffe, ailerons, posée sur la croix centrale.
      const rx = 0.08;
      add(new THREE.CylinderGeometry(0.045, 0.05, 0.32, 10), m('#eef1f4', { metalness: 0.3, roughness: 0.35 }), rx, 0.24, 0);
      add(new THREE.CylinderGeometry(0.047, 0.047, 0.04, 10), light('#5fe3ff'), rx, 0.3, 0);
      add(new THREE.ConeGeometry(0.045, 0.12, 10), m('#c9cfd6', { metalness: 0.4 }), rx, 0.46, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const fin = add(new THREE.BoxGeometry(0.012, 0.08, 0.06), m('#9aa3ad', { metalness: 0.5 }), rx + Math.cos(a) * 0.05, 0.12, Math.sin(a) * 0.05);
        fin.rotation.y = -a;
      }
      // Tour de lancement : mât en treillis (quatre montants), bras qui tient la fusée, feu au sommet.
      const tx = -0.13;
      for (const [dx, dz] of [[-0.04, -0.04], [0.04, -0.04], [-0.04, 0.04], [0.04, 0.04]]) {
        add(new THREE.BoxGeometry(0.014, 0.56, 0.014), m('#b0503a', { metalness: 0.5 }), tx + dx, 0.34, dz);
      }
      for (let y = 0.14; y < 0.6; y += 0.1) add(new THREE.BoxGeometry(0.095, 0.012, 0.095), m('#8a4030', { metalness: 0.5 }), tx, y, 0);
      add(new THREE.BoxGeometry(0.17, 0.02, 0.03), m('#7d8794', { metalness: 0.6 }), (tx + rx) / 2 - 0.01, 0.36, 0);
      const towerLight = add(new THREE.SphereGeometry(0.025, 6, 4), light('#ff4040'), tx, 0.64, 0);
      // Poste de contrôle : bloc bas et vitrage cyan, du côté opposé à la tour.
      add(new THREE.BoxGeometry(0.16, 0.1, 0.12), m('#dfe3e8', { metalness: 0.3, roughness: 0.45 }), 0.02, 0.11, 0.3);
      const glass = add(new THREE.BoxGeometry(0.165, 0.03, 0.125), light('#7ff0ff'), 0.02, 0.13, 0.3);
      let glow = null;
      if (!ghost) {
        glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff5050', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.position.set(tx, 0.64, 0);
        glow.scale.setScalar(0.3);
        g.add(glow);
      }
      const vent = every(2.2, (fx) => fx.puff(g, rx, 0.1, 0, '#e8eef4'));
      tick = (time, dt, fx) => {
        const step = Math.floor(time * 6) % beacons.length;
        beacons.forEach((b, i) => (b.material.emissiveIntensity = i === step ? 2.2 : 0.35));
        const blink = Math.sin(time * 3) > 0.2;
        towerLight.material.emissiveIntensity = blink ? 1.8 : 0.2;
        if (glow) glow.material.opacity = blink ? 0.55 : 0.05;
        glass.material.emissiveIntensity = 0.6 + Math.sin(time * 1.5) * 0.2;
        vent(time, dt, fx);
      };
      break;
    }
    case 'batterie': {
      // Batterie planétaire : socle hexagonal, tourelle qui pivote lentement, double canon, feu rouge.
      add(new THREE.CylinderGeometry(0.4, 0.46, 0.1, 6), m('#5b5f66', { metalness: 0.4 }), 0, 0.05);
      add(new THREE.CylinderGeometry(0.26, 0.32, 0.12, 8), m('#7d8794', { metalness: 0.5 }), 0, 0.16);
      add(new THREE.TorusGeometry(0.3, 0.018, 4, 18), light('#ff4a4a'), 0, 0.11).rotation.x = Math.PI / 2;
      const head = new THREE.Group();
      head.position.set(0, 0.22, 0);
      g.add(head);
      const part = (geometry, material, x, y, z) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        head.add(mesh);
        return mesh;
      };
      part(new THREE.BoxGeometry(0.3, 0.16, 0.34), m('#9aa3ad', { metalness: 0.55, roughness: 0.4 }), 0, 0.08, 0);
      part(new THREE.BoxGeometry(0.22, 0.05, 0.2), m('#6b737c', { metalness: 0.5 }), 0, 0.18, -0.04);
      // Canons : un pivot d'élévation porte les deux tubes.
      const cradle = new THREE.Group();
      cradle.position.set(0, 0.1, 0.14);
      head.add(cradle);
      for (const x of [-0.06, 0.06]) {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.42, 6), m('#3e444b', { metalness: 0.7, roughness: 0.3 }));
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(x, 0, 0.2);
        barrel.castShadow = true;
        cradle.add(barrel);
        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 6), light('#ff5050'));
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(x, 0, 0.41);
        cradle.add(muzzle);
      }
      const eye = part(new THREE.SphereGeometry(0.035, 8, 6), light('#ff3030'), 0.1, 0.13, 0.17);
      let glow = null;
      if (!ghost) {
        glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff3a3a', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
        glow.position.set(0, 0.38, 0);
        glow.scale.setScalar(0.5);
        g.add(glow);
      }
      const phase = Math.random() * 10;
      tick = (time) => {
        const t = time + phase;
        head.rotation.y = t * 0.25 + Math.sin(t * 0.5) * 0.6;
        cradle.rotation.x = -0.25 - Math.sin(t * 0.7) * 0.2;
        const pulse = 0.5 + Math.sin(t * 3) * 0.5;
        eye.material.emissiveIntensity = 0.4 + pulse;
        if (glow) glow.material.opacity = 0.2 + pulse * 0.35;
      };
      break;
    }
  }
  return tick;
}
