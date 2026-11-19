// Style des Thrennes : peuple guerrier. Forteresses anguleuses noires et rouge sang, pointes et
// remparts crénelés, braseros dont les flammes dansent. Chaque bâtiment garde son élément de
// fonction (foreuse, antenne, cheminée…).
import * as THREE from 'three';

const BLACK = '#1e1a1c';
const IRON = '#3a3236';
const BLOOD = '#a01c22';
const FIRE = '#ff5a2a';

export function buildThrennes(type, kit) {
  const { g, add, m, light, every, glow, part, group } = kit;
  const black = (extra = {}) => m(BLACK, { roughness: 0.55, metalness: 0.4, ...extra });
  const iron = (extra = {}) => m(IRON, { roughness: 0.4, metalness: 0.7, ...extra });
  const blood = (extra = {}) => m(BLOOD, { roughness: 0.5, metalness: 0.3, ...extra });
  const flames = [];
  // Pointe : pyramide effilée (4 pans).
  const spike = (x, z, h, r = 0.04, y = 0, mat = black()) => {
    const s = add(new THREE.ConeGeometry(r, h, 4), mat, x, y + h / 2, z);
    s.rotation.y = Math.PI / 4;
    return s;
  };
  // Tour carrée à créneaux, terminée en pointe.
  const tower = (x, z, h, w = 0.12, y = 0) => {
    add(new THREE.BoxGeometry(w, h, w), black(), x, y + h / 2, z);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(new THREE.BoxGeometry(w * 0.3, 0.05, w * 0.3), black(), x + dx * w * 0.35, y + h + 0.025, z + dz * w * 0.35);
    add(new THREE.BoxGeometry(w * 1.02, 0.025, w * 1.02), blood(), x, y + h * 0.7, z);
    spike(x, z, w * 1.4, w * 0.45, y + h);
  };
  // Brasero : coupe de fer et flamme vacillante.
  const brazier = (x, z, y = 0, size = 1) => {
    add(new THREE.CylinderGeometry(0.05 * size, 0.025 * size, 0.06 * size, 6), iron(), x, y + 0.03 * size, z);
    const f = add(new THREE.ConeGeometry(0.035 * size, 0.1 * size, 5), light(FIRE, 1.4), x, y + 0.1 * size, z);
    flames.push({ f, base: y + 0.1 * size, phase: flames.length * 1.7 });
    glow(FIRE, x, y + 0.12 * size, z, 0.25 * size, 0.45);
    return f;
  };
  // Rempart crénelé en anneau (polygone de murets).
  const rampart = (r, h, sides = 6, y = 0) => {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const len = 2 * r * Math.sin(Math.PI / sides);
      const wall = add(new THREE.BoxGeometry(len, h, 0.05), black(), Math.cos(a + Math.PI / sides) * r * Math.cos(Math.PI / sides), y + h / 2, Math.sin(a + Math.PI / sides) * r * Math.cos(Math.PI / sides));
      wall.rotation.y = -(a + Math.PI / sides) + Math.PI / 2;
    }
  };
  const flicker = (time) => {
    for (const { f, base, phase } of flames) {
      f.scale.y = 0.8 + Math.abs(Math.sin(time * 9 + phase)) * 0.5 + Math.sin(time * 23 + phase) * 0.1;
      f.position.y = base + (f.scale.y - 1) * 0.03;
      f.material.emissiveIntensity = 1.1 + Math.sin(time * 13 + phase) * 0.4;
    }
  };
  const smoke = (x, y, z, period = 1) => every(period, (fx) => fx.puff(g, x, y, z, '#3a2a2a'));

  switch (type) {
    case 'centre': {
      // Citadelle : rempart hexagonal, donjon à pointes, braseros aux angles.
      add(new THREE.CylinderGeometry(0.58, 0.62, 0.06, 6), iron(), 0, 0.03);
      rampart(0.48, 0.14, 6, 0.06);
      add(new THREE.BoxGeometry(0.3, 0.38, 0.3), black(), 0, 0.25);
      add(new THREE.BoxGeometry(0.31, 0.04, 0.31), blood(), 0, 0.32);
      spike(0, 0, 0.4, 0.13, 0.44);
      for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) spike(x, z, 0.16, 0.035, 0.44);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + 0.5;
        brazier(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.2);
      }
      const beacon = add(new THREE.OctahedronGeometry(0.035), light('#ff5050'), 0, 0.9, 0);
      return (time) => {
        flicker(time);
        beacon.visible = Math.sin(time * 3) > 0;
      };
    }
    case 'foyer': {
      // Casernes : trois blocs bas à toits en pointe, meurtrières rouges.
      for (const [x, z, s] of [[-0.2, 0.1, 1], [0.22, 0.12, 0.8], [0, -0.22, 0.9]]) {
        add(new THREE.BoxGeometry(0.26 * s, 0.16 * s, 0.22 * s), black(), x, 0.08 * s, z);
        const roof = add(new THREE.ConeGeometry(0.19 * s, 0.16 * s, 4), blood(), x, 0.24 * s, z);
        roof.rotation.y = Math.PI / 4;
        add(new THREE.BoxGeometry(0.1 * s, 0.03, 0.01), light('#ffb070'), x, 0.1 * s, z + 0.112 * s);
      }
      brazier(0.05, 0.05, 0, 0.8);
      return flicker;
    }
    case 'puits': {
      // Foreuse-lance : socle à pointes, haute tour de fer, braise au fond du forage.
      add(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 6), black(), 0, 0.04);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        spike(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.14, 0.03, 0.04);
      }
      add(new THREE.CylinderGeometry(0.04, 0.13, 0.85, 4, 1, true), iron({ side: THREE.DoubleSide }), 0, 0.5).rotation.y = Math.PI / 4;
      spike(0, 0, 0.22, 0.07, 0.92, blood());
      const bore = add(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 6), light(FIRE, 1.2), 0, 0.09);
      return (time) => {
        flicker(time);
        bore.material.emissiveIntensity = 1 + Math.sin(time * 6) * 0.4;
      };
    }
    case 'fonderie': {
      // Forge de guerre : bloc noir à contreforts, cheminée à pointes, coulée et lingots.
      add(new THREE.BoxGeometry(0.5, 0.28, 0.34), black(), -0.05, 0.14);
      for (const x of [-0.28, 0.18]) add(new THREE.BoxGeometry(0.06, 0.32, 0.38), blood(), x, 0.16);
      add(new THREE.BoxGeometry(0.1, 0.72, 0.1), iron(), 0.2, 0.36, -0.14);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) spike(0.2 + dx * 0.05, -0.14 + dz * 0.05, 0.1, 0.02, 0.72);
      const mouth = add(new THREE.BoxGeometry(0.16, 0.1, 0.01), light(FIRE, 1.3), -0.05, 0.11, 0.176);
      add(new THREE.BoxGeometry(0.34, 0.04, 0.09), iron(), -0.12, 0.02, 0.27);
      const pour = add(new THREE.BoxGeometry(0.3, 0.012, 0.05), light('#ff8a3a'), -0.12, 0.045, 0.27);
      for (const x of [-0.24, -0.12, 0]) add(new THREE.BoxGeometry(0.07, 0.035, 0.05), m('#9fb4c8', { metalness: 0.8, roughness: 0.25 }), x, 0.018, 0.38);
      const halo = glow(FIRE, -0.05, 0.12, 0.2, 0.4, 0.4);
      const puff = smoke(0.2, 0.78, -0.14, 0.8);
      return (time, dt, fx) => {
        flicker(time);
        mouth.material.emissiveIntensity = 1 + Math.sin(time * 7) * 0.35;
        pour.material.emissiveIntensity = 0.7 + Math.sin(time * 6) * 0.25;
        if (halo) halo.material.opacity = 0.3 + Math.sin(time * 7) * 0.12;
        puff(time, dt, fx);
      };
    }
    case 'pompe': {
      // Bastion de pompage : socle noir, tour à créneaux, réservoir dans une cage de fer.
      add(new THREE.CylinderGeometry(0.42, 0.46, 0.12, 6), black(), 0, 0.06);
      tower(-0.16, -0.08, 0.6, 0.1, 0.12);
      const tank = add(new THREE.SphereGeometry(0.15, 12, 8), m('#5fe3ff', { emissive: '#1a8aa8', emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.3 }), 0.14, 0.3, 0.08);
      for (let k = 0; k < 4; k++) {
        const bar = add(new THREE.BoxGeometry(0.015, 0.36, 0.015), iron(), 0.14 + Math.cos(k * Math.PI / 2) * 0.15, 0.3, 0.08 + Math.sin(k * Math.PI / 2) * 0.15);
        bar.rotation.y = k;
      }
      brazier(0.3, -0.25, 0.12, 0.8);
      return (time) => {
        flicker(time);
        tank.material.emissiveIntensity = 0.45 + Math.sin(time * 1.5) * 0.2;
      };
    }
    case 'captage': {
      // Citerne de guerre : bassin à rempart, réservoir carré à pointes.
      const pool = add(new THREE.CircleGeometry(0.28, 6), m('#4aa8ff', { emissive: '#0a2a55', roughness: 0.1 }), -0.08, 0.05, 0.05);
      pool.rotation.x = -Math.PI / 2;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
        const wall = add(new THREE.BoxGeometry(0.28, 0.1, 0.04), black(), -0.08 + Math.cos(a) * 0.27, 0.05, 0.05 + Math.sin(a) * 0.27);
        wall.rotation.y = -a + Math.PI / 2;
      }
      add(new THREE.BoxGeometry(0.22, 0.4, 0.22), black(), 0.3, 0.2, -0.22);
      add(new THREE.BoxGeometry(0.23, 0.03, 0.23), blood(), 0.3, 0.3, -0.22);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) spike(0.3 + dx * 0.08, -0.22 + dz * 0.08, 0.12, 0.025, 0.4);
      return (time) => (pool.rotation.z = time * 0.4);
    }
    case 'fouille': {
      // Fouille gardée : palissade à pointes, grue de fer, relique.
      add(new THREE.CylinderGeometry(0.2, 0.16, 0.03, 6), m('#2a2020'), 0.05, 0.015, 0.05);
      const relic = add(new THREE.OctahedronGeometry(0.05), light('#ffd166'), 0.05, 0.07, 0.05);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        spike(0.05 + Math.cos(a) * 0.3, 0.05 + Math.sin(a) * 0.3, 0.18, 0.025);
      }
      add(new THREE.BoxGeometry(0.04, 0.6, 0.04), iron(), -0.3, 0.3, -0.28);
      const boom = group(-0.3, 0.6, -0.28);
      part(boom, new THREE.BoxGeometry(0.5, 0.03, 0.03), iron(), 0.2, 0, 0);
      part(boom, new THREE.CylinderGeometry(0.004, 0.004, 0.25, 3), m('#222'), 0.42, -0.125, 0);
      brazier(0.32, -0.28, 0, 0.8);
      const halo = glow('#ffd166', 0.05, 0.1, 0.05, 0.45, 0.6);
      return (time) => {
        flicker(time);
        boom.rotation.y = Math.sin(time * 0.35) * 1.1;
        relic.rotation.y = time * 1.5;
        const p = 0.5 + Math.sin(time * 2.2) * 0.5;
        relic.material.emissiveIntensity = 0.5 + p * 0.8;
        if (halo) halo.material.opacity = 0.3 + p * 0.45;
      };
    }
    case 'centrale': {
      // Réacteur-autel : tour noire trapue, couronne de pointes, cœur de feu, anneau doré.
      add(new THREE.CylinderGeometry(0.3, 0.36, 0.1, 6), black(), -0.1, 0.05);
      add(new THREE.CylinderGeometry(0.17, 0.24, 0.5, 6), black(), -0.1, 0.35);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        spike(-0.1 + Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0.18, 0.03, 0.6);
      }
      const core = add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6), light(FIRE, 1.4), -0.1, 0.61);
      const ring = add(new THREE.TorusGeometry(0.25, 0.02, 4, 6), light('#ffd166'), -0.1, 0.32);
      ring.rotation.x = Math.PI / 2;
      add(new THREE.BoxGeometry(0.2, 0.16, 0.18), black(), 0.3, 0.08, 0.18);
      const halo = glow(FIRE, -0.1, 0.66, 0, 0.6, 0.4);
      const puff = smoke(-0.1, 0.66, 0, 1.2);
      return (time, dt, fx) => {
        core.material.emissiveIntensity = 1.1 + Math.sin(time * 5) * 0.4;
        ring.material.emissiveIntensity = 0.6 + Math.sin(time * 4) * 0.4;
        if (halo) halo.material.opacity = 0.3 + Math.sin(time * 5) * 0.12;
        puff(time, dt, fx);
      };
    }
    case 'solaire': {
      // Boucliers solaires : panneaux noirs en losange, liseré rouge.
      for (const [x, z, i] of [[-0.22, -0.2, 0], [0.22, -0.2, 1], [-0.22, 0.2, 2], [0.22, 0.2, 3]]) {
        add(new THREE.BoxGeometry(0.03, 0.12, 0.03), iron(), x, 0.06, z);
        const shield = add(new THREE.BoxGeometry(0.26, 0.02, 0.26), m('#1a1430', { metalness: 0.7, roughness: 0.15, emissive: '#2a0a10', emissiveIntensity: 0.6 }), x, 0.15, z);
        shield.rotation.set(-0.45, Math.PI / 4 + i * 0.05, 0);
        const rim = add(new THREE.BoxGeometry(0.28, 0.008, 0.28), blood(), x, 0.14, z);
        rim.rotation.copy(shield.rotation);
      }
      return null;
    }
    case 'serre': {
      // Jardin de guerre sous dôme à nervures noires, braseros pour la chaleur.
      add(new THREE.CylinderGeometry(0.48, 0.5, 0.06, 6), black(), 0, 0.03);
      add(new THREE.SphereGeometry(0.34, 8, 6), m('#6a8a3a', { emissive: '#1a2a08' }), 0, 0.03).scale.y = 0.45;
      for (let k = 0; k < 6; k++) {
        const rib = add(new THREE.TorusGeometry(0.45, 0.012, 3, 12, Math.PI), black(), 0, 0.06, 0);
        rib.rotation.y = (k / 6) * Math.PI;
      }
      add(new THREE.SphereGeometry(0.45, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), m('#ff8a6a', { transparent: true, opacity: 0.2, roughness: 0.1 }), 0, 0.06);
      spike(0, 0, 0.18, 0.04, 0.5, blood());
      brazier(0.42, 0.25, 0.06, 0.7);
      brazier(-0.42, 0.25, 0.06, 0.7);
      return flicker;
    }
    case 'ferme': {
      // Bassin à rempart noir, filets qui tournent, brasero central.
      rampart(0.42, 0.08, 8, 0.02);
      const nets = group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const net = part(nets, new THREE.BoxGeometry(0.22, 0.03, 0.1), m('#4f7e3a', { emissive: '#0a2008' }), Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2);
        net.rotation.y = -a;
      }
      brazier(0, 0, 0.02, 0.9);
      return (time) => {
        flicker(time);
        nets.rotation.y = time * 0.3;
      };
    }
    case 'laboratoire': {
      // Tour de guet-laboratoire : bloc à meurtrières lumineuses, parabole de fer qui balaie le ciel.
      add(new THREE.BoxGeometry(0.44, 0.08, 0.38), black(), -0.04, 0.04);
      add(new THREE.BoxGeometry(0.34, 0.28, 0.3), black(), -0.06, 0.22);
      const slits = add(new THREE.BoxGeometry(0.35, 0.03, 0.31), light('#ff6a5a'), -0.06, 0.25);
      spike(-0.06, 0, 0.22, 0.12, 0.36, blood());
      tower(0.24, 0.12, 0.34, 0.07);
      const head = group(0.24, 0.6, 0.12);
      const dish = part(head, new THREE.SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI / 3.2), iron({ side: THREE.DoubleSide }), 0, 0.05, 0.1);
      dish.rotation.x = -Math.PI / 2 - 0.5;
      const tip = part(head, new THREE.OctahedronGeometry(0.02), light('#ff5050'), 0, 0.12, -0.05);
      const halo = glow('#ff6a5a', -0.06, 0.28, 0, 0.45, 0.35);
      return (time) => {
        head.rotation.y = time * 0.45 + Math.sin(time * 0.9) * 0.4;
        slits.material.emissiveIntensity = 0.5 + Math.sin(time * 2) * 0.3;
        tip.visible = Math.sin(time * 4) > -0.4;
        if (halo) halo.material.opacity = 0.2 + (0.5 + Math.sin(time * 2) * 0.5) * 0.3;
      };
    }
    case 'siphon': {
      // Trois lances noires croisées qui emprisonnent la Vélarine.
      add(new THREE.CylinderGeometry(0.26, 0.32, 0.1, 6), black(), 0, 0.05);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const lance = add(new THREE.ConeGeometry(0.035, 0.9, 4), black(), Math.cos(a) * 0.16, 0.5, Math.sin(a) * 0.16);
        lance.rotation.z = -Math.cos(a) * 0.3;
        lance.rotation.x = Math.sin(a) * 0.3;
      }
      const crystal = add(new THREE.OctahedronGeometry(0.12), light('#c77dff'), 0, 0.72);
      crystal.scale.y = 1.6;
      return (time) => {
        crystal.rotation.y = time;
        crystal.position.y = 0.72 + Math.sin(time * 2) * 0.04;
      };
    }
    case 'spatioport': {
      // Aire de lancement noire à liseré rouge, tour à créneaux, fusée-lance rouge et noire, braseros.
      add(new THREE.CylinderGeometry(0.5, 0.54, 0.06, 6), black(), 0, 0.03);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.012, 6), blood(), 0.08, 0.066);
      add(new THREE.CylinderGeometry(0.27, 0.27, 0.014, 6), iron(), 0.08, 0.068);
      const beacons = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        beacons.push(add(new THREE.OctahedronGeometry(0.025), light('#ff7040'), Math.cos(a) * 0.44, 0.08, Math.sin(a) * 0.44));
      }
      const rx = 0.08;
      add(new THREE.CylinderGeometry(0.04, 0.05, 0.3, 4), black(), rx, 0.23, 0).rotation.y = Math.PI / 4;
      add(new THREE.CylinderGeometry(0.042, 0.042, 0.04, 4), blood(), rx, 0.3, 0).rotation.y = Math.PI / 4;
      spike(rx, 0, 0.18, 0.045, 0.38, blood());
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const fin = add(new THREE.BoxGeometry(0.012, 0.12, 0.08), blood(), rx + Math.cos(a) * 0.05, 0.12, Math.sin(a) * 0.05);
        fin.rotation.y = -a;
      }
      tower(-0.15, 0, 0.56, 0.09, 0.06);
      add(new THREE.BoxGeometry(0.17, 0.02, 0.03), iron(), (-0.15 + rx) / 2, 0.36, 0);
      const towerLight = add(new THREE.OctahedronGeometry(0.025), light('#ff4040'), -0.15, 0.82, 0);
      brazier(0.32, 0.25, 0.06, 0.7);
      brazier(-0.32, 0.25, 0.06, 0.7);
      const puff = smoke(rx, 0.1, 0, 2.2);
      return (time, dt, fx) => {
        flicker(time);
        const step = Math.floor(time * 6) % beacons.length;
        beacons.forEach((b, i) => (b.material.emissiveIntensity = i === step ? 2.2 : 0.35));
        towerLight.material.emissiveIntensity = Math.sin(time * 3) > 0.2 ? 1.8 : 0.2;
        puff(time, dt, fx);
      };
    }
    case 'batterie': {
      // Bastion d'artillerie : rempart, tourelle à pointes, deux canons longs, œil rouge.
      add(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 6), black(), 0, 0.03);
      rampart(0.4, 0.12, 6, 0.06);
      add(new THREE.TorusGeometry(0.3, 0.018, 4, 6), light('#ff4a4a'), 0, 0.12).rotation.x = Math.PI / 2;
      const head = group(0, 0.1, 0);
      part(head, new THREE.BoxGeometry(0.3, 0.16, 0.34), black(), 0, 0.08, 0);
      for (const x of [-0.12, 0.12]) part(head, new THREE.ConeGeometry(0.03, 0.12, 4), blood(), x, 0.22, -0.1);
      const cradle = group(0, 0.1, 0.14, head);
      for (const x of [-0.06, 0.06]) {
        const barrel = part(cradle, new THREE.CylinderGeometry(0.022, 0.03, 0.44, 4), iron(), x, 0, 0.2);
        barrel.rotation.x = Math.PI / 2;
        const muzzle = part(cradle, new THREE.CylinderGeometry(0.03, 0.03, 0.04, 4), light('#ff5050'), x, 0, 0.42);
        muzzle.rotation.x = Math.PI / 2;
      }
      const eye = part(head, new THREE.OctahedronGeometry(0.035), light('#ff3030'), 0.1, 0.13, 0.17);
      const halo = glow('#ff3a3a', 0, 0.38, 0, 0.5, 0.45);
      const phase = Math.random() * 10;
      return (time) => {
        const t = time + phase;
        head.rotation.y = t * 0.25 + Math.sin(t * 0.5) * 0.6;
        cradle.rotation.x = -0.25 - Math.sin(t * 0.7) * 0.2;
        const p = 0.5 + Math.sin(t * 3) * 0.5;
        eye.material.emissiveIntensity = 0.4 + p;
        if (halo) halo.material.opacity = 0.2 + p * 0.35;
      };
    }
    default:
      return undefined; // pas redessiné : style neutre
  }
}
