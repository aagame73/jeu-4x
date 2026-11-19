// Style des Orrhaïdes : cristaux vivants. Prismes et aiguilles de cristal clair aux reflets irisés,
// socles taillés à facettes, éclats qui flottent et scintillent. Chaque bâtiment garde son élément
// de fonction (foreuse, antenne, cheminée…).
import * as THREE from 'three';

const CLEAR = '#e6f4ff';
const TINTS = ['#bfe4ff', '#ffc9ef', '#c9fff0', '#e8d4ff'];
const BASE = '#8a96b0';

export function buildOrrhaides(type, kit) {
  const { g, ghost, add, m, light, every, glow, part, group, ghostMaterial } = kit;
  const crystalMat = (i = 0, opacity = 0.7) =>
    ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: TINTS[Math.abs(i) % TINTS.length], transparent: true, opacity, roughness: 0.05, metalness: 0.35, emissive: TINTS[(Math.abs(i) + 1) % TINTS.length], emissiveIntensity: 0.35, flatShading: true });
  const base = (extra = {}) => m(BASE, { roughness: 0.4, metalness: 0.5, ...extra });
  const shards = [];
  // Prisme de cristal (3 à 6 pans) terminé en pointe.
  const prism = (x, z, h, r, i = 0, y = 0, sides = 6, tilt = 0, parent = g) => {
    const grp = group(x, y, z, parent);
    grp.rotation.z = tilt;
    grp.rotation.x = tilt * 0.6;
    const mat = crystalMat(i);
    part(grp, new THREE.CylinderGeometry(r, r, h * 0.78, sides), mat, 0, h * 0.39, 0);
    part(grp, new THREE.ConeGeometry(r, h * 0.22, sides), mat, 0, h * 0.89, 0);
    shards.push(mat);
    return grp;
  };
  // Druse : plusieurs prismes qui jaillissent d'un même point.
  const druse = (cx, cz, h, r, count = 5, i = 0) => {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + i;
      prism(cx + Math.cos(a) * r * 0.8, cz + Math.sin(a) * r * 0.8, h * (0.5 + ((k * 37) % 10) / 20), r * 0.45, i + k, 0, 6, Math.cos(a) * 0.35);
    }
    prism(cx, cz, h, r * 0.55, i);
  };
  // Socle taillé : prisme bas à facettes.
  const plinth = (x, z, r, h = 0.06, sides = 6) => add(new THREE.CylinderGeometry(r * 0.94, r, h, sides), base(), x, h / 2, z);
  // Scintillement : chaque cristal brille à son rythme.
  const sparkle = (time) => {
    shards.forEach((mat, k) => {
      if (mat !== ghostMaterial) mat.emissiveIntensity = 0.25 + Math.max(0, Math.sin(time * (1.3 + (k % 5) * 0.4) + k * 1.7)) * 0.6;
    });
  };
  const glints = (x, y, z, period = 1.6) => every(period, (fx) => fx.puff(g, x, y, z, '#f4f8ff'));

  switch (type) {
    case 'centre': {
      // Grande druse sur un socle étoilé, anneau d'éclats qui tourne autour.
      plinth(0, 0, 0.6, 0.08, 6);
      druse(0, 0, 0.75, 0.32, 6, 0);
      const orbit = group(0, 0.45, 0);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const s = part(orbit, new THREE.OctahedronGeometry(0.035), crystalMat(k, 0.9), Math.cos(a) * 0.48, Math.sin(k * 2) * 0.04, Math.sin(a) * 0.48);
        s.scale.y = 1.8;
      }
      const beacon = add(new THREE.OctahedronGeometry(0.035), light('#7cff9e', 1.2), 0, 0.85, 0);
      const halo = glow('#dff0ff', 0, 0.5, 0, 0.8, 0.3);
      return (time) => {
        sparkle(time);
        orbit.rotation.y = time * 0.4;
        beacon.visible = Math.sin(time * 3) > 0;
        if (halo) halo.material.opacity = 0.2 + Math.sin(time * 1.4) * 0.1;
      };
    }
    case 'foyer': {
      // Géodes d'habitation : demi-sphères à facettes, cœur lumineux.
      for (const [x, z, r, i] of [[-0.2, 0.1, 0.2, 0], [0.22, 0.12, 0.17, 1], [0, -0.22, 0.19, 2]]) {
        add(new THREE.SphereGeometry(r, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), base({ flatShading: true }), x, 0, z);
        const inner = add(new THREE.OctahedronGeometry(r * 0.35), light('#ffe08a', 0.7), x, r * 0.35, z + r * 0.62);
        inner.scale.z = 0.4;
        prism(x, z, r * 1.2, 0.035, i, r * 0.7);
      }
      return sparkle;
    }
    case 'puits': {
      // Foreuse-aiguille : une longue pointe de cristal plantée dans un socle, qui vibre.
      plinth(0, 0, 0.24, 0.08, 6);
      const needle = prism(0, 0, 1.0, 0.07, 1, 0.06, 4);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        prism(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.35, 0.04, k + 2, 0.06, 4, Math.cos(a) * 0.4);
      }
      const lamp = add(new THREE.OctahedronGeometry(0.03), light('#ffb347'), 0, 1.12, 0);
      return (time) => {
        sparkle(time);
        needle.position.x = Math.sin(time * 40) * 0.003;
        lamp.visible = Math.sin(time * 5) > -0.3;
      };
    }
    case 'fonderie': {
      // Four-prisme : la lumière concentrée par un cristal fond le minerai ; colonne de chaleur, coulée.
      plinth(-0.05, -0.05, 0.34, 0.1, 6);
      const lens = add(new THREE.OctahedronGeometry(0.16), crystalMat(1, 0.6), -0.05, 0.38, -0.05);
      lens.scale.y = 1.5;
      shards.push(lens.material);
      const heart = add(new THREE.OctahedronGeometry(0.06), light('#ff8a3a', 1.3), -0.05, 0.18, -0.05);
      prism(0.25, -0.18, 0.6, 0.05, 2, 0, 3);
      add(new THREE.BoxGeometry(0.34, 0.04, 0.09), base(), -0.12, 0.02, 0.27);
      const pour = add(new THREE.BoxGeometry(0.3, 0.012, 0.05), light('#ff8a3a'), -0.12, 0.045, 0.27);
      for (const x of [-0.24, -0.12, 0]) add(new THREE.BoxGeometry(0.07, 0.035, 0.05), m('#9fb4c8', { metalness: 0.8, roughness: 0.25 }), x, 0.018, 0.38);
      const halo = glow('#ffb070', -0.05, 0.25, -0.05, 0.6, 0.4);
      const heat = every(1, (fx) => fx.puff(g, 0.25, 0.62, -0.18, '#fff0e0'));
      return (time, dt, fx) => {
        sparkle(time);
        lens.rotation.y = time * 0.6;
        heart.material.emissiveIntensity = 1 + Math.sin(time * 5) * 0.4;
        pour.material.emissiveIntensity = 0.7 + Math.sin(time * 6) * 0.25;
        if (halo) halo.material.opacity = 0.3 + Math.sin(time * 3) * 0.12;
        heat(time, dt, fx);
      };
    }
    case 'pompe': {
      // Socle à facettes, tour-prisme, réservoir de deutérium enchâssé dans des griffes de cristal.
      plinth(0, 0, 0.42, 0.1, 6);
      prism(-0.16, -0.08, 0.78, 0.06, 0, 0.1, 4);
      const tank = add(new THREE.SphereGeometry(0.15, 12, 8), m('#5fe3ff', { emissive: '#1a8aa8', emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.3 }), 0.14, 0.33, 0.08);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        prism(0.14 + Math.cos(a) * 0.13, 0.08 + Math.sin(a) * 0.13, 0.32, 0.025, k, 0.1, 4, Math.cos(a) * 0.4);
      }
      const beacon = add(new THREE.OctahedronGeometry(0.03), light('#5fe3ff'), -0.16, 0.92, -0.08);
      return (time) => {
        sparkle(time);
        beacon.visible = Math.sin(time * 2.5) > -0.2;
        tank.material.emissiveIntensity = 0.45 + Math.sin(time * 1.5) * 0.2;
      };
    }
    case 'captage': {
      // Vasque taillée dans le cristal, réservoir prismatique.
      const bowl = add(new THREE.CylinderGeometry(0.32, 0.22, 0.12, 8, 1, true), crystalMat(0, 0.55), -0.08, 0.06, 0.05);
      shards.push(bowl.material);
      const pool = add(new THREE.CircleGeometry(0.3, 8), ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#4aa8ff', emissive: '#0a2a55', transparent: true, opacity: 0.85, roughness: 0.1 }), -0.08, 0.1, 0.05);
      pool.rotation.x = -Math.PI / 2;
      const tank = add(new THREE.CylinderGeometry(0.12, 0.12, 0.4, 6), crystalMat(2, 0.6), 0.3, 0.2, -0.22);
      shards.push(tank.material);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 6), m('#4aa8ff', { emissive: '#0a2a55', roughness: 0.2 }), 0.3, 0.16, -0.22);
      return (time) => {
        sparkle(time);
        pool.rotation.z = time * 0.4;
      };
    }
    case 'fouille': {
      // Fouille cernée de prismes : un arc de cristal soulève la relique par la lumière.
      add(new THREE.CylinderGeometry(0.2, 0.16, 0.03, 8), m('#3a4258'), 0.05, 0.015, 0.05);
      const relic = add(new THREE.OctahedronGeometry(0.05), light('#ffd166'), 0.05, 0.1, 0.05);
      for (const [x, z, i] of [[-0.3, -0.25, 0], [-0.32, 0.22, 1], [0.32, 0.3, 2], [0.3, -0.28, 3]]) prism(x, z, 0.32, 0.045, i, 0, 5, x * 0.4);
      const arc = add(new THREE.TorusGeometry(0.22, 0.02, 4, 16, Math.PI), crystalMat(1, 0.75), 0.05, 0.05, 0.05);
      shards.push(arc.material);
      const halo = glow('#ffd166', 0.05, 0.12, 0.05, 0.45, 0.6);
      return (time) => {
        sparkle(time);
        relic.position.y = 0.1 + Math.sin(time * 0.8) * 0.04;
        relic.rotation.y = time * 1.5;
        arc.rotation.y = time * 0.3;
        const p = 0.5 + Math.sin(time * 2.2) * 0.5;
        relic.material.emissiveIntensity = 0.5 + p * 0.8;
        if (halo) halo.material.opacity = 0.3 + p * 0.45;
      };
    }
    case 'centrale': {
      // Centrale à résonance : un grand cristal vibre entre trois aiguilles, anneau doré.
      plinth(-0.1, 0, 0.32, 0.08, 6);
      const big = prism(-0.1, 0, 0.7, 0.11, 3, 0.08, 6);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        prism(-0.1 + Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.45, 0.04, k, 0, 3, Math.cos(a) * 0.25);
      }
      const ring = add(new THREE.TorusGeometry(0.22, 0.02, 4, 18), light('#ffd166'), -0.1, 0.55);
      ring.rotation.x = Math.PI / 2;
      const halo = glow('#ffd166', -0.1, 0.55, 0, 0.6, 0.35);
      const spark = glints(-0.1, 0.8, 0, 1.3);
      return (time, dt, fx) => {
        sparkle(time);
        big.rotation.y = time * 0.5;
        ring.material.emissiveIntensity = 0.6 + Math.sin(time * 4) * 0.4;
        if (halo) halo.material.opacity = 0.2 + Math.sin(time * 4) * 0.12;
        spark(time, dt, fx);
      };
    }
    case 'solaire': {
      // Lames de cristal fines et brillantes, orientées vers le soleil.
      for (const [x, z, i] of [[-0.22, -0.2, 0], [0.22, -0.2, 1], [-0.22, 0.2, 2], [0.22, 0.2, 3]]) {
        plinth(x, z, 0.06, 0.1, 6);
        const blade = add(new THREE.BoxGeometry(0.34, 0.015, 0.28), crystalMat(i, 0.8), x, 0.15, z);
        blade.rotation.x = -0.45;
        shards.push(blade.material);
      }
      return sparkle;
    }
    case 'serre': {
      // Jardin de petits cristaux sous un dôme à facettes.
      plinth(0, 0, 0.5, 0.05, 12);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        prism(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.12 + (k % 3) * 0.05, 0.03, k, 0.05, 5);
      }
      add(new THREE.SphereGeometry(0.12, 6, 4), m('#5fbf6a', { emissive: '#103a14' }), 0, 0.05).scale.y = 0.6;
      add(new THREE.SphereGeometry(0.46, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: CLEAR, transparent: true, opacity: 0.25, roughness: 0.05, metalness: 0.3, flatShading: true }), 0, 0.05);
      return sparkle;
    }
    case 'ferme': {
      // Bassin à rebord taillé ; des filets tenus par des prismes tournent.
      add(new THREE.TorusGeometry(0.4, 0.06, 4, 12), base({ flatShading: true }), 0, 0.08).rotation.x = Math.PI / 2;
      const nets = group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const net = part(nets, new THREE.BoxGeometry(0.22, 0.03, 0.1), m('#4fae5a', { emissive: '#0a3010' }), Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2);
        net.rotation.y = -a;
      }
      prism(0, 0, 0.22, 0.05, 1, 0.04);
      return (time) => {
        sparkle(time);
        nets.rotation.y = time * 0.3;
      };
    }
    case 'laboratoire': {
      // Observatoire de cristal : socle taillé, grand prisme-œil, parabole de cristal qui balaie le ciel.
      plinth(-0.05, 0, 0.32, 0.12, 6);
      const windows = add(new THREE.CylinderGeometry(0.305, 0.31, 0.03, 6), light('#7ff0ff'), -0.05, 0.09);
      const eye = add(new THREE.OctahedronGeometry(0.12), crystalMat(0, 0.75), -0.05, 0.3);
      eye.scale.y = 1.4;
      shards.push(eye.material);
      prism(0.24, 0.14, 0.42, 0.03, 2, 0, 4);
      const head = group(0.24, 0.55, 0.14);
      const dish = part(head, new THREE.SphereGeometry(0.13, 8, 3, 0, Math.PI * 2, 0, Math.PI / 3.2), crystalMat(3, 0.8), 0, 0.05, 0.1);
      if (!ghost) dish.material.side = THREE.DoubleSide;
      dish.rotation.x = -Math.PI / 2 - 0.5;
      shards.push(dish.material);
      const tip = part(head, new THREE.OctahedronGeometry(0.02), light('#7ff0ff'), 0, 0.12, -0.05);
      const halo = glow('#bfe4ff', -0.05, 0.3, 0, 0.5, 0.4);
      return (time) => {
        sparkle(time);
        head.rotation.y = time * 0.45 + Math.sin(time * 0.9) * 0.4;
        eye.rotation.y = time * 0.7;
        windows.material.emissiveIntensity = 0.5 + Math.sin(time * 2) * 0.3;
        tip.visible = Math.sin(time * 4) > -0.4;
        if (halo) halo.material.opacity = 0.2 + (0.5 + Math.sin(time * 2) * 0.5) * 0.35;
      };
    }
    case 'siphon': {
      // Trois aiguilles de cristal penchées vers le centre, qui tiennent la Vélarine en lévitation.
      plinth(0, 0, 0.3, 0.1, 6);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        prism(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.6, 0.035, k, 0.1, 4, -Math.cos(a) * 0.25);
      }
      const crystal = add(new THREE.OctahedronGeometry(0.12), light('#c77dff'), 0, 0.8);
      crystal.scale.y = 1.6;
      return (time) => {
        sparkle(time);
        crystal.rotation.y = time;
        crystal.position.y = 0.8 + Math.sin(time * 2) * 0.04;
      };
    }
    case 'spatioport': {
      // Aire taillée, balises de cristal, tour-prisme, sonde en éclat de cristal.
      add(new THREE.CylinderGeometry(0.5, 0.54, 0.06, 6), base({ flatShading: true }), 0, 0.03);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.012, 6), crystalMat(2, 0.6), 0.08, 0.066);
      const beacons = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const b = add(new THREE.OctahedronGeometry(0.03), light('#ffb347'), Math.cos(a) * 0.44, 0.09, Math.sin(a) * 0.44);
        b.scale.y = 1.6;
        beacons.push(b);
      }
      const rx = 0.08;
      const probe = add(new THREE.OctahedronGeometry(0.07), crystalMat(1, 0.85), rx, 0.28, 0);
      probe.scale.y = 3;
      shards.push(probe.material);
      const tower = prism(-0.15, 0, 0.66, 0.05, 3, 0.06, 4);
      add(new THREE.BoxGeometry(0.17, 0.02, 0.03), base(), (-0.15 + rx) / 2, 0.36, 0);
      const towerLight = add(new THREE.OctahedronGeometry(0.025), light('#ff4040'), -0.15, 0.74, 0);
      add(new THREE.SphereGeometry(0.09, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), crystalMat(0, 0.6), 0.02, 0.06, 0.3);
      const spark = glints(rx, 0.1, 0, 2.2);
      return (time, dt, fx) => {
        sparkle(time);
        probe.rotation.y = time * 0.8;
        tower.rotation.y = Math.sin(time * 0.3) * 0.2;
        const step = Math.floor(time * 6) % beacons.length;
        beacons.forEach((b, i) => (b.material.emissiveIntensity = i === step ? 2.2 : 0.35));
        towerLight.material.emissiveIntensity = Math.sin(time * 3) > 0.2 ? 1.8 : 0.2;
        spark(time, dt, fx);
      };
    }
    case 'batterie': {
      // Tourelle de cristal : un prisme pivotant concentre un rayon par deux lentilles.
      plinth(0, 0, 0.44, 0.1, 6);
      add(new THREE.TorusGeometry(0.3, 0.018, 4, 6), light('#ff4a4a'), 0, 0.11).rotation.x = Math.PI / 2;
      const head = group(0, 0.1, 0);
      const body = part(head, new THREE.OctahedronGeometry(0.2), crystalMat(1, 0.75), 0, 0.18, 0);
      body.scale.set(1, 0.8, 1.3);
      shards.push(body.material);
      const cradle = group(0, 0.18, 0.18, head);
      for (const x of [-0.06, 0.06]) {
        const barrel = part(cradle, new THREE.CylinderGeometry(0.02, 0.03, 0.36, 4), crystalMat(3, 0.9), x, 0, 0.16);
        barrel.rotation.x = Math.PI / 2;
        shards.push(barrel.material);
        part(cradle, new THREE.OctahedronGeometry(0.03), light('#ff5050'), x, 0, 0.35);
      }
      const halo = glow('#ff3a3a', 0, 0.36, 0, 0.5, 0.4);
      const phase = Math.random() * 10;
      return (time) => {
        sparkle(time);
        const t = time + phase;
        head.rotation.y = t * 0.25 + Math.sin(t * 0.5) * 0.6;
        cradle.rotation.x = -0.25 - Math.sin(t * 0.7) * 0.2;
        if (halo) halo.material.opacity = 0.2 + (0.5 + Math.sin(t * 3) * 0.5) * 0.3;
      };
    }
    default:
      return undefined; // pas redessiné : style neutre
  }
}
