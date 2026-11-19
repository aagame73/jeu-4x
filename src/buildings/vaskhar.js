// Style des Vaskhar : basalte en colonnes hexagonales, massif et trapu, parcouru de fissures de
// magma qui pulsent ; braises et fumée. Chaque bâtiment garde son élément de fonction.
import * as THREE from 'three';

const ROCK = ['#2b2624', '#342d2a', '#3d3531', '#26211f'];
const MAGMA = '#ff6a1a';
const EMBER = '#ffb347';

export function buildVaskhar(type, kit) {
  const { g, ghost, add, m, light, every, glow, part, group, ghostMaterial } = kit;
  const rock = (i = 0, extra = {}) => m(ROCK[Math.abs(Math.round(i)) % ROCK.length], { roughness: 0.95, ...extra });
  // Colonne de basalte : prisme hexagonal légèrement penché.
  const column = (x, z, h, r = 0.08, i = 0, y = 0) => {
    const c = add(new THREE.CylinderGeometry(r * 0.92, r, h, 6), rock(i), x, y + h / 2, z);
    c.rotation.y = (x * 7 + z * 13) % 1;
    return c;
  };
  // Grappe de colonnes de hauteurs inégales autour d'un point.
  const cluster = (cx, cz, radius, count, hMin, hMax, r = 0.07) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + i;
      const d = i === 0 ? 0 : radius * (0.55 + ((i * 37) % 10) / 22);
      column(cx + Math.cos(a) * d, cz + Math.sin(a) * d, hMin + ((i * 53) % 10) / 10 * (hMax - hMin), r, i);
    }
  };
  // Fissure de magma : fine barre lumineuse posée sur une paroi.
  const seam = (x, y, z, w, h, d, rotY = 0) => {
    const s = add(new THREE.BoxGeometry(w, h, d), light(MAGMA, 1.1), x, y, z);
    s.rotation.y = rotY;
    return s;
  };
  const seams = [];
  const pulse = (time) => {
    const p = 0.8 + Math.sin(time * 2.1) * 0.35 + Math.sin(time * 5.3) * 0.1;
    for (const s of seams) s.material.emissiveIntensity = p;
  };
  const embers = (x, y, z, period = 1.3) => every(period, (fx) => fx.puff(g, x, y, z, '#4a3a34'));

  switch (type) {
    case 'centre': {
      // Anneau de colonnes autour d'un cœur de magma sous une coupole de basalte ; balise.
      add(new THREE.CylinderGeometry(0.58, 0.64, 0.1, 6), rock(1), 0, 0.05);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        column(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.34 + (i % 2) * 0.14, 0.09, i, 0.1);
      }
      add(new THREE.SphereGeometry(0.3, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), rock(2), 0, 0.1);
      for (let i = 0; i < 3; i++) seams.push(seam(Math.cos(i * 2.1) * 0.29, 0.2, Math.sin(i * 2.1) * 0.29, 0.03, 0.16, 0.03, i));
      const core = add(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 6), light(MAGMA, 1.4), 0, 0.42);
      seams.push(core);
      column(0.2, -0.05, 0.75, 0.035, 3, 0.1);
      const beacon = add(new THREE.SphereGeometry(0.035, 6, 4), light('#ff5050'), 0.2, 0.9, -0.05);
      const halo = glow(MAGMA, 0, 0.45, 0, 0.6, 0.4);
      const smoke = embers(0, 0.5, 0, 1.6);
      return (time, dt, fx) => {
        pulse(time);
        beacon.visible = Math.sin(time * 3) > 0;
        if (halo) halo.material.opacity = 0.25 + Math.sin(time * 2.1) * 0.12;
        smoke(time, dt, fx);
      };
    }
    case 'foyer': {
      // Trois tertres de basalte empilé, portes lumineuses.
      for (const [x, z, r, h] of [[-0.2, 0.1, 0.2, 0.26], [0.22, 0.12, 0.16, 0.2], [0, -0.22, 0.18, 0.3]]) {
        add(new THREE.CylinderGeometry(r * 0.6, r, h, 6), rock(Math.round(x * 10)), x, h / 2, z);
        add(new THREE.CylinderGeometry(r * 0.35, r * 0.6, 0.06, 6), rock(2), x, h + 0.03, z);
        seams.push(seam(x, 0.06, z + r * 0.8, 0.06, 0.1, 0.03));
      }
      return pulse;
    }
    case 'puits': {
      // Socle de colonnes, derrick de fer sombre, puits incandescent au pied.
      cluster(0, 0, 0.18, 5, 0.1, 0.18, 0.08);
      add(new THREE.CylinderGeometry(0.05, 0.16, 0.8, 4, 1, true), m('#4a3c34', { metalness: 0.6, roughness: 0.5 }), 0, 0.55).rotation.y = Math.PI / 4;
      add(new THREE.ConeGeometry(0.08, 0.15, 4), m('#5a4a40', { metalness: 0.5 }), 0, 1.02);
      seams.push(add(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 6), light(MAGMA, 1.3), 0, 0.2));
      const lamp = add(new THREE.SphereGeometry(0.03, 6, 4), light(EMBER), 0, 1.11);
      const halo = glow(MAGMA, 0, 0.25, 0, 0.35, 0.35);
      return (time) => {
        pulse(time);
        lamp.visible = Math.sin(time * 5) > -0.3;
        if (halo) halo.material.opacity = 0.2 + Math.sin(time * 3) * 0.12;
      };
    }
    case 'fonderie': {
      // Four-volcan : cône de basalte au cratère rougeoyant, rigole de coulée et lingots.
      add(new THREE.CylinderGeometry(0.14, 0.34, 0.42, 6), rock(1), -0.05, 0.21, -0.05);
      const crater = add(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 6), light(MAGMA, 1.5), -0.05, 0.43, -0.05);
      seams.push(crater);
      for (let i = 0; i < 3; i++) seams.push(seam(-0.05 + Math.cos(i * 2.1) * 0.24, 0.16, -0.05 + Math.sin(i * 2.1) * 0.24, 0.025, 0.22, 0.025, i));
      column(0.3, 0.15, 0.22, 0.07, 2);
      add(new THREE.BoxGeometry(0.34, 0.04, 0.09), rock(3), -0.12, 0.02, 0.27);
      const pour = add(new THREE.BoxGeometry(0.3, 0.012, 0.05), light('#ff8a3a'), -0.12, 0.045, 0.27);
      for (const x of [-0.24, -0.12, 0]) add(new THREE.BoxGeometry(0.07, 0.035, 0.05), m('#9fb4c8', { metalness: 0.8, roughness: 0.25 }), x, 0.018, 0.38);
      const halo = glow(MAGMA, -0.05, 0.5, -0.05, 0.6, 0.45);
      const smoke = every(0.8, (fx) => fx.puff(g, -0.05, 0.48, -0.05, '#4a3a34'));
      return (time, dt, fx) => {
        pulse(time);
        pour.material.emissiveIntensity = 0.7 + Math.sin(time * 6) * 0.25 + Math.sin(time * 13) * 0.1;
        if (halo) halo.material.opacity = 0.3 + Math.sin(time * 2.4) * 0.15;
        smoke(time, dt, fx);
      };
    }
    case 'pompe': {
      // Socle de basalte, tour de pierre, réservoir de deutérium serti dans un berceau de roche.
      add(new THREE.CylinderGeometry(0.42, 0.46, 0.12, 6), rock(0), 0, 0.06);
      column(-0.16, -0.08, 0.72, 0.07, 1, 0.12);
      add(new THREE.BoxGeometry(0.28, 0.04, 0.05), rock(3), -0.02, 0.74, -0.08);
      add(new THREE.CylinderGeometry(0.2, 0.14, 0.14, 6), rock(2), 0.14, 0.19, 0.08);
      const tank = add(new THREE.SphereGeometry(0.16, 12, 8), m('#5fe3ff', { emissive: '#1a8aa8', emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.25 }), 0.14, 0.38, 0.08);
      seams.push(seam(-0.16, 0.4, -0.01, 0.03, 0.3, 0.02));
      const beacon = add(new THREE.SphereGeometry(0.03, 6, 4), light('#5fe3ff'), -0.16, 0.9, -0.08);
      const vent = every(1.6, (fx) => fx.puff(g, 0.14, 0.56, 0.08, '#9ff0ff'));
      return (time, dt, fx) => {
        pulse(time);
        beacon.visible = Math.sin(time * 2.5) > -0.2;
        tank.material.emissiveIntensity = 0.45 + Math.sin(time * 1.5) * 0.2;
        vent(time, dt, fx);
      };
    }
    case 'captage': {
      // Bassin cerclé de colonnes basses, citerne de pierre.
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        column(-0.08 + Math.cos(a) * 0.3, 0.05 + Math.sin(a) * 0.3, 0.08 + (i % 3) * 0.03, 0.06, i);
      }
      const pool = add(new THREE.CircleGeometry(0.27, 6), ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#4aa8ff', emissive: '#0a2a55', transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.2 }), -0.08, 0.06, 0.05);
      pool.rotation.x = -Math.PI / 2;
      add(new THREE.CylinderGeometry(0.12, 0.14, 0.42, 6), rock(1), 0.3, 0.21, -0.22);
      add(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 6), m('#4aa8ff', { emissive: '#0a2a55', roughness: 0.2 }), 0.3, 0.43, -0.22);
      seams.push(seam(0.3, 0.2, -0.09, 0.025, 0.25, 0.02));
      return (time) => {
        pulse(time);
        pool.rotation.z = time * 0.4;
      };
    }
    case 'fouille': {
      // Fosse taillée dans le basalte, colonnes renversées, grue de pierre et relique dorée.
      add(new THREE.CylinderGeometry(0.2, 0.16, 0.04, 6), m('#1c1816'), 0.1, 0.02, 0.1);
      for (const [x, z, r] of [[-0.25, -0.2, 0.5], [-0.3, 0.15, 1.2], [0.25, 0.3, 2.4]]) {
        const c = add(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 6), rock(Math.round(r)), x, 0.06, z);
        c.rotation.z = Math.PI / 2;
        c.rotation.y = r;
      }
      const relic = add(new THREE.OctahedronGeometry(0.05), light('#ffd166'), 0.1, 0.08, 0.1);
      column(0.3, -0.2, 0.55, 0.05, 2);
      const boom = group(0.3, 0.58, -0.2);
      part(boom, new THREE.BoxGeometry(0.46, 0.05, 0.05), rock(3), -0.15, 0, 0);
      part(boom, new THREE.CylinderGeometry(0.004, 0.004, 0.3, 3), m('#222'), -0.34, -0.15, 0);
      const halo = glow('#ffd166', 0.1, 0.12, 0.1, 0.45, 0.6);
      return (time) => {
        boom.rotation.y = Math.sin(time * 0.35) * 1.1;
        relic.rotation.y = time * 1.5;
        const p = 0.5 + Math.sin(time * 2.2) * 0.5;
        relic.material.emissiveIntensity = 0.5 + p * 0.8;
        if (halo) halo.material.opacity = 0.3 + p * 0.45;
      };
    }
    case 'centrale': {
      // Évent géothermique : cône de colonnes autour d'une cheminée de magma, vapeur.
      cluster(-0.1, 0, 0.26, 7, 0.25, 0.55, 0.08);
      add(new THREE.CylinderGeometry(0.12, 0.2, 0.62, 6), rock(2), -0.1, 0.31, 0);
      const vent = add(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 6), light(MAGMA, 1.5), -0.1, 0.63, 0);
      seams.push(vent);
      add(new THREE.BoxGeometry(0.2, 0.16, 0.18), rock(1), 0.3, 0.08, 0.18);
      seams.push(seam(0.3, 0.1, 0.275, 0.12, 0.03, 0.02));
      const halo = glow(MAGMA, -0.1, 0.7, 0, 0.6, 0.45);
      const steam = every(1.1, (fx) => fx.puff(g, -0.1, 0.68, 0, '#e8eef4'));
      return (time, dt, fx) => {
        pulse(time);
        if (halo) halo.material.opacity = 0.3 + Math.sin(time * 2) * 0.15;
        steam(time, dt, fx);
      };
    }
    case 'solaire': {
      // Dalles d'obsidienne polie sur des moignons de basalte.
      for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) {
        column(x, z, 0.12, 0.05, Math.round(x * 10));
        const slab = add(new THREE.CylinderGeometry(0.19, 0.19, 0.025, 6), m('#120e14', { metalness: 0.7, roughness: 0.12, emissive: '#2a0e04', emissiveIntensity: 0.6 }), x, 0.15, z);
        slab.rotation.x = -0.45;
      }
      return null;
    }
    case 'serre': {
      // Anneau de colonnes basses, jardin réchauffé par des veines de magma, dôme de verre fumé.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        column(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.1, 0.06, i);
      }
      add(new THREE.SphereGeometry(0.34, 6, 4), m('#6a8a3a', { emissive: '#1a2a08' }), 0, 0.02).scale.y = 0.45;
      for (let i = 0; i < 3; i++) seams.push(seam(Math.cos(i * 2.1) * 0.2, 0.06, Math.sin(i * 2.1) * 0.2, 0.18, 0.015, 0.025, i * 2.1));
      add(new THREE.SphereGeometry(0.46, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#ffb080', transparent: true, opacity: 0.28, roughness: 0.1, flatShading: true }), 0, 0.06);
      return pulse;
    }
    case 'ferme': {
      // Bassin à rebord de basalte, filets d'élevage qui tournent.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        column(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.1, 0.07, i);
      }
      const nets = group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const net = part(nets, new THREE.BoxGeometry(0.22, 0.03, 0.1), m('#5a8a3a', { emissive: '#0a2a08' }), Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2);
        net.rotation.y = -a;
      }
      add(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 6), rock(2), 0, 0.06);
      seams.push(add(new THREE.CylinderGeometry(0.07, 0.07, 0.015, 6), light(MAGMA), 0, 0.125));
      return (time) => {
        pulse(time);
        nets.rotation.y = time * 0.3;
      };
    }
    case 'laboratoire': {
      // Bloc de basalte à fenêtres de magma, œil de cristal, parabole de pierre qui balaie le ciel.
      add(new THREE.CylinderGeometry(0.3, 0.34, 0.26, 6), rock(1), -0.05, 0.13);
      seams.push(add(new THREE.CylinderGeometry(0.305, 0.315, 0.035, 6), light(MAGMA), -0.05, 0.17));
      add(new THREE.CylinderGeometry(0.16, 0.22, 0.08, 6), rock(2), -0.05, 0.3);
      const eye = add(new THREE.OctahedronGeometry(0.09), m('#ffcf9a', { emissive: '#ff8a3a', emissiveIntensity: 0.8, roughness: 0.1, metalness: 0.2 }), -0.05, 0.42);
      column(0.24, 0.12, 0.42, 0.04, 3);
      const head = group(0.24, 0.6, 0.12);
      const dish = part(head, new THREE.SphereGeometry(0.15, 6, 4, 0, Math.PI * 2, 0, Math.PI / 3.2), m('#c07040', { metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }), 0, 0.05, 0.1);
      dish.rotation.x = -Math.PI / 2 - 0.5;
      const tip = part(head, new THREE.SphereGeometry(0.02, 6, 4), light(EMBER), 0, 0.12, -0.05);
      const halo = glow('#ff8a3a', -0.05, 0.45, 0, 0.45, 0.4);
      return (time) => {
        pulse(time);
        head.rotation.y = time * 0.45 + Math.sin(time * 0.9) * 0.4;
        eye.rotation.y = time * 0.8;
        tip.visible = Math.sin(time * 4) > -0.4;
        if (halo) halo.material.opacity = 0.2 + (0.5 + Math.sin(time * 2) * 0.5) * 0.35;
      };
    }
    case 'siphon': {
      // Puits de basalte d'où monte le cristal de Vélarine, retenu par trois colonnes.
      add(new THREE.CylinderGeometry(0.26, 0.32, 0.12, 6), rock(0), 0, 0.06);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const c = column(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.6, 0.045, i, 0.1);
        c.rotation.z = Math.cos(a) * 0.2;
        c.rotation.x = -Math.sin(a) * 0.2;
      }
      const crystal = add(new THREE.OctahedronGeometry(0.12), light('#c77dff'), 0, 0.8);
      crystal.scale.y = 1.6;
      seams.push(add(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 6), light(MAGMA), 0, 0.13));
      return (time) => {
        pulse(time);
        crystal.rotation.y = time;
        crystal.position.y = 0.8 + Math.sin(time * 2) * 0.04;
      };
    }
    case 'spatioport': {
      // Aire de basalte balisée de braises, tour de colonnes empilées, fusée cuivrée.
      add(new THREE.CylinderGeometry(0.5, 0.54, 0.06, 6), rock(0), 0, 0.03);
      add(new THREE.CylinderGeometry(0.28, 0.28, 0.014, 6), rock(3, { roughness: 0.6 }), 0.08, 0.067);
      seams.push(add(new THREE.TorusGeometry(0.29, 0.012, 3, 6), light(MAGMA), 0.08, 0.07, 0));
      seams[seams.length - 1].rotation.x = Math.PI / 2;
      const beacons = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        beacons.push(add(new THREE.CylinderGeometry(0.03, 0.035, 0.05, 6), light(EMBER), Math.cos(a) * 0.44, 0.085, Math.sin(a) * 0.44));
      }
      const rx = 0.08;
      add(new THREE.CylinderGeometry(0.045, 0.055, 0.32, 6), m('#b0603a', { metalness: 0.6, roughness: 0.4 }), rx, 0.24, 0);
      add(new THREE.CylinderGeometry(0.047, 0.047, 0.04, 6), light(MAGMA), rx, 0.3, 0);
      add(new THREE.ConeGeometry(0.045, 0.12, 6), m('#3d3531', { metalness: 0.4 }), rx, 0.46, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        add(new THREE.BoxGeometry(0.012, 0.08, 0.06), rock(2), rx + Math.cos(a) * 0.05, 0.12, Math.sin(a) * 0.05).rotation.y = -a;
      }
      const tx = -0.15;
      for (let k = 0; k < 4; k++) column(tx, 0, 0.15, 0.06 - k * 0.006, k, 0.06 + k * 0.15);
      add(new THREE.BoxGeometry(0.17, 0.03, 0.04), rock(3), (tx + rx) / 2, 0.38, 0);
      const towerLight = add(new THREE.SphereGeometry(0.025, 6, 4), light('#ff4040'), tx, 0.7, 0);
      add(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 6), rock(1), 0.02, 0.11, 0.3);
      seams.push(seam(0.02, 0.13, 0.39, 0.1, 0.025, 0.02));
      const halo = glow('#ff5050', tx, 0.7, 0, 0.3, 0.4);
      const vent = every(2.2, (fx) => fx.puff(g, rx, 0.1, 0, '#6a5a50'));
      return (time, dt, fx) => {
        pulse(time);
        const step = Math.floor(time * 6) % beacons.length;
        beacons.forEach((b, i) => (b.material.emissiveIntensity = i === step ? 2.2 : 0.35));
        const blink = Math.sin(time * 3) > 0.2;
        towerLight.material.emissiveIntensity = blink ? 1.8 : 0.2;
        if (halo) halo.material.opacity = blink ? 0.55 : 0.05;
        vent(time, dt, fx);
      };
    }
    case 'batterie': {
      // Bastion de colonnes, tourelle de basalte et canon de magma.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        column(Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0.18 + (i % 2) * 0.08, 0.07, i);
      }
      add(new THREE.CylinderGeometry(0.26, 0.32, 0.16, 6), rock(2), 0, 0.08);
      const head = group(0, 0.16, 0);
      part(head, new THREE.CylinderGeometry(0.17, 0.2, 0.18, 6), rock(1), 0, 0.09, 0);
      const cradle = group(0, 0.12, 0.12, head);
      const barrel = part(cradle, new THREE.CylinderGeometry(0.04, 0.05, 0.42, 6), rock(3, { metalness: 0.3 }), 0, 0, 0.18);
      barrel.rotation.x = Math.PI / 2;
      const muzzle = part(cradle, new THREE.CylinderGeometry(0.045, 0.045, 0.04, 6), light(MAGMA, 1.4), 0, 0, 0.4);
      muzzle.rotation.x = Math.PI / 2;
      seams.push(muzzle);
      const eye = part(head, new THREE.BoxGeometry(0.12, 0.025, 0.02), light(MAGMA), 0, 0.12, 0.17);
      seams.push(eye);
      const halo = glow(MAGMA, 0, 0.38, 0, 0.5, 0.4);
      const phase = Math.random() * 10;
      return (time) => {
        pulse(time);
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
