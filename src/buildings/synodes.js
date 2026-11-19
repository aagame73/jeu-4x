// Style des Synodes : champignons en réseau. Pieds fibreux, chapeaux violets et nacrés aux points
// bioluminescents, filaments de mycélium au sol, spores qui montent. Chaque bâtiment garde son
// élément de fonction (foreuse, antenne, cheminée…).
import * as THREE from 'three';

const CAP = ['#8a6ac8', '#9b7fd6', '#7a5cb8', '#a98be0'];
const STEM = '#e9e2f2';
const GILL = '#4a3a6a';
const SPORE = '#c6a0ff';
const BIO = '#b8f0ff';

export function buildSynodes(type, kit) {
  const { g, ghost, add, m, light, every, glow, part, group, ghostMaterial } = kit;
  const capMat = (i = 0, extra = {}) => m(CAP[Math.abs(Math.round(i)) % CAP.length], { roughness: 0.55, ...extra });
  const glowing = [];
  // Champignon : pied fibreux (un peu évasé), chapeau en dôme aplati, lamelles dessous, points lumineux.
  const mushroom = (x, z, h, capR, i = 0, parent = g) => {
    const grp = group(x, 0, z, parent);
    const profile = [0.5, 0.36, 0.3, 0.32].map((r, k) => new THREE.Vector2(r * capR * 0.55, (k / 3) * h));
    part(grp, new THREE.LatheGeometry(profile, 8), m(STEM, { roughness: 0.7, side: THREE.DoubleSide }), 0, 0, 0);
    const cap = part(grp, new THREE.SphereGeometry(capR, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat(i), 0, h - capR * 0.12, 0);
    cap.scale.y = 0.55;
    part(grp, new THREE.CylinderGeometry(capR * 0.98, capR * 0.4, 0.02, 12), m(GILL, { roughness: 0.9 }), 0, h - capR * 0.12, 0);
    for (let k = 0; k < Math.max(3, Math.round(capR * 18)); k++) {
      const a = k * 2.4 + i;
      const d = capR * (0.3 + ((k * 37) % 10) / 16);
      const dot = part(grp, new THREE.SphereGeometry(0.012 + capR * 0.02, 5, 3), light(BIO, 0.9), Math.cos(a) * d * 0.85, h - capR * 0.12 + Math.sqrt(Math.max(0, capR * capR - d * d)) * 0.55, Math.sin(a) * d * 0.85);
      glowing.push(dot);
    }
    return grp;
  };
  // Filaments de mycélium au sol, autour d'un point.
  const mycelium = (cx, cz, radius, count = 6) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.4;
      const f = add(new THREE.TorusGeometry(radius * (0.6 + (i % 3) * 0.15), 0.008, 3, 10, 1.1), light(SPORE, 0.5), cx, 0.012, cz);
      f.rotation.x = Math.PI / 2;
      f.rotation.z = a;
      glowing.push(f);
    }
  };
  const breathe = (time) => {
    const p = 0.6 + Math.sin(time * 1.6) * 0.35;
    for (const o of glowing) o.material.emissiveIntensity = p;
  };
  const spores = (x, y, z, period = 1.4) => every(period, (fx) => fx.puff(g, x, y, z, SPORE));

  switch (type) {
    case 'centre': {
      // Grand champignon-mère sur un tapis de mycélium, anneau de points, spore-balise au sommet.
      add(new THREE.CylinderGeometry(0.58, 0.62, 0.05, 12), m('#3a2e4a', { roughness: 0.9 }), 0, 0.025);
      mycelium(0, 0, 0.5, 8);
      mushroom(0, 0, 0.55, 0.42, 0);
      mushroom(0.38, 0.25, 0.22, 0.13, 1);
      mushroom(-0.36, 0.28, 0.18, 0.11, 2);
      const beacon = add(new THREE.SphereGeometry(0.04, 8, 6), light(SPORE, 1.2), 0, 0.72, 0);
      const halo = glow(SPORE, 0, 0.6, 0, 0.7, 0.35);
      const puff = spores(0, 0.66, 0, 1.6);
      return (time, dt, fx) => {
        breathe(time);
        beacon.position.y = 0.72 + Math.sin(time * 1.5) * 0.03;
        beacon.visible = Math.sin(time * 3) > -0.2;
        if (halo) halo.material.opacity = 0.2 + Math.sin(time * 1.6) * 0.12;
        puff(time, dt, fx);
      };
    }
    case 'foyer': {
      // Trois champignons-maisons, fenêtres dorées dans les pieds.
      for (const [x, z, h, r, i] of [[-0.2, 0.1, 0.3, 0.2, 0], [0.22, 0.12, 0.24, 0.16, 1], [0, -0.22, 0.34, 0.2, 2]]) {
        mushroom(x, z, h, r, i);
        add(new THREE.BoxGeometry(0.05, 0.06, 0.02), light('#ffe08a'), x, 0.08, z + r * 0.42);
      }
      mycelium(0, 0, 0.35, 5);
      return breathe;
    }
    case 'puits': {
      // Foreuse-racine : un pied torsadé très haut planté dans le sol, racines lumineuses, pointe qui creuse.
      mycelium(0, 0, 0.3, 7);
      add(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 10), m('#3a2e4a'), 0, 0.04);
      const stalk = add(new THREE.CylinderGeometry(0.035, 0.12, 0.85, 7, 4), m(STEM, { roughness: 0.7 }), 0, 0.5);
      stalk.rotation.y = 0.5;
      add(new THREE.ConeGeometry(0.11, 0.16, 8), capMat(1), 0, 0.98);
      const drill = add(new THREE.ConeGeometry(0.06, 0.14, 6), m('#c9a24a', { metalness: 0.5 }), 0, 0.12);
      drill.rotation.x = Math.PI;
      const lamp = add(new THREE.SphereGeometry(0.03, 6, 4), light(BIO, 1.2), 0, 1.08);
      return (time) => {
        breathe(time);
        drill.rotation.y = time * 4;
        lamp.visible = Math.sin(time * 5) > -0.3;
      };
    }
    case 'fonderie': {
      // Panse de digestion (sphère) qui fond le minerai, cheminée-tige qui crache des spores, coulée.
      const belly = add(new THREE.SphereGeometry(0.24, 12, 8), m('#7a5cb8', { roughness: 0.45, emissive: '#3a1a6a', emissiveIntensity: 0.4 }), -0.08, 0.22, -0.04);
      belly.scale.y = 0.85;
      add(new THREE.TorusGeometry(0.22, 0.02, 6, 16), m(STEM), -0.08, 0.12, -0.04).rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.035, 0.06, 0.55, 7), m(STEM, { roughness: 0.7 }), 0.2, 0.32, -0.12);
      add(new THREE.SphereGeometry(0.08, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat(3), 0.2, 0.58, -0.12).scale.y = 0.6;
      add(new THREE.BoxGeometry(0.34, 0.04, 0.09), m('#3a2e4a'), -0.12, 0.02, 0.27);
      const pour = add(new THREE.BoxGeometry(0.3, 0.012, 0.05), light('#ff8a3a'), -0.12, 0.045, 0.27);
      for (const x of [-0.24, -0.12, 0]) add(new THREE.BoxGeometry(0.07, 0.035, 0.05), m('#9fb4c8', { metalness: 0.8, roughness: 0.25 }), x, 0.018, 0.38);
      mycelium(-0.08, -0.04, 0.3, 5);
      const puff = spores(0.2, 0.62, -0.12, 0.9);
      return (time, dt, fx) => {
        breathe(time);
        belly.material.emissiveIntensity = 0.3 + Math.sin(time * 2.5) * 0.2;
        belly.scale.y = 0.85 + Math.sin(time * 1.2) * 0.03;
        pour.material.emissiveIntensity = 0.7 + Math.sin(time * 6) * 0.25;
        puff(time, dt, fx);
      };
    }
    case 'pompe': {
      // Tige-pompe et réservoir de deutérium en vesse-de-loup translucide.
      add(new THREE.CylinderGeometry(0.42, 0.44, 0.04, 12), m('#3a2e4a'), 0, 0.02);
      mycelium(0, 0, 0.4, 6);
      mushroom(-0.16, -0.08, 0.7, 0.12, 1);
      const tank = add(new THREE.SphereGeometry(0.18, 14, 10), ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#5fe3ff', emissive: '#1a8aa8', emissiveIntensity: 0.5, transparent: true, opacity: 0.75, roughness: 0.2 }), 0.14, 0.2, 0.08);
      tank.scale.y = 0.85;
      add(new THREE.ConeGeometry(0.04, 0.08, 6), m(STEM), 0.14, 0.38, 0.08);
      const vent = every(1.6, (fx) => fx.puff(g, 0.14, 0.4, 0.08, '#9ff0ff'));
      return (time, dt, fx) => {
        breathe(time);
        if (tank.material.emissiveIntensity !== undefined) tank.material.emissiveIntensity = 0.45 + Math.sin(time * 1.5) * 0.2;
        tank.scale.setScalar(1 + Math.sin(time * 1.5) * 0.03);
        vent(time, dt, fx);
      };
    }
    case 'captage': {
      // Champignon-entonnoir : son chapeau creux recueille l'eau, qui tourbillonne.
      const stem = add(new THREE.CylinderGeometry(0.06, 0.1, 0.22, 8), m(STEM), -0.05, 0.11, 0.05);
      stem.castShadow = true;
      const funnel = add(new THREE.CylinderGeometry(0.34, 0.08, 0.16, 14, 1, true), capMat(0, { side: THREE.DoubleSide }), -0.05, 0.3, 0.05);
      const pool = add(new THREE.CircleGeometry(0.3, 16), ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#4aa8ff', emissive: '#0a2a55', transparent: true, opacity: 0.85, roughness: 0.1 }), -0.05, 0.35, 0.05);
      pool.rotation.x = -Math.PI / 2;
      mushroom(0.32, -0.24, 0.3, 0.1, 2);
      mycelium(-0.05, 0.05, 0.38, 6);
      return (time) => {
        breathe(time);
        pool.rotation.z = time * 0.4;
      };
    }
    case 'fouille': {
      // Fosse où des filaments de mycélium hissent la relique ; petits champignons autour.
      add(new THREE.CylinderGeometry(0.2, 0.16, 0.03, 10), m('#2a2030'), 0.05, 0.015, 0.05);
      const lift = group(0.05, 0, 0.05);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const f = part(lift, new THREE.CylinderGeometry(0.006, 0.01, 0.3, 4), light(SPORE, 0.7), Math.cos(a) * 0.08, 0.15, Math.sin(a) * 0.08);
        f.rotation.z = Math.cos(a) * 0.3;
        f.rotation.x = -Math.sin(a) * 0.3;
        glowing.push(f);
      }
      const relic = part(lift, new THREE.OctahedronGeometry(0.05), light('#ffd166'), 0, 0.12, 0);
      for (const [x, z, h, r] of [[-0.32, -0.2, 0.16, 0.08], [-0.28, 0.25, 0.2, 0.1], [0.32, -0.25, 0.14, 0.07]]) mushroom(x, z, h, r, Math.round(x * 10));
      mycelium(0.05, 0.05, 0.35, 7);
      const halo = glow('#ffd166', 0.05, 0.14, 0.05, 0.45, 0.6);
      return (time) => {
        breathe(time);
        relic.position.y = 0.12 + Math.sin(time * 0.8) * 0.05;
        relic.rotation.y = time * 1.5;
        const p = 0.5 + Math.sin(time * 2.2) * 0.5;
        relic.material.emissiveIntensity = 0.5 + p * 0.8;
        if (halo) halo.material.opacity = 0.3 + p * 0.45;
      };
    }
    case 'centrale': {
      // Grand champignon luminescent : un anneau doré pulse sous son chapeau.
      mushroom(-0.1, 0, 0.62, 0.34, 3);
      const ring = add(new THREE.TorusGeometry(0.2, 0.025, 6, 18), light('#ffd166', 1), -0.1, 0.48, 0);
      ring.rotation.x = Math.PI / 2;
      mushroom(0.3, 0.18, 0.2, 0.1, 1);
      mycelium(-0.1, 0, 0.45, 7);
      const halo = glow('#ffd166', -0.1, 0.5, 0, 0.6, 0.35);
      const puff = spores(-0.1, 0.72, 0, 1.3);
      return (time, dt, fx) => {
        breathe(time);
        ring.material.emissiveIntensity = 0.6 + Math.sin(time * 4) * 0.4;
        if (halo) halo.material.opacity = 0.2 + Math.sin(time * 4) * 0.12;
        puff(time, dt, fx);
      };
    }
    case 'solaire': {
      // Champignons-étagères aux chapeaux plats et sombres, tournés vers le soleil.
      for (const [x, z, i] of [[-0.22, -0.2, 0], [0.22, -0.2, 1], [-0.22, 0.2, 2], [0.22, 0.2, 3]]) {
        add(new THREE.CylinderGeometry(0.025, 0.04, 0.14, 6), m(STEM), x, 0.07, z);
        const shelf = add(new THREE.CylinderGeometry(0.19, 0.17, 0.025, 12), m('#2a1d4a', { metalness: 0.3, roughness: 0.25, emissive: '#1a0a3a', emissiveIntensity: 0.6 }), x, 0.15, z);
        shelf.rotation.x = -0.45;
        shelf.rotation.y = i * 0.3;
      }
      mycelium(0, 0, 0.4, 6);
      return breathe;
    }
    case 'serre': {
      // Chapeau translucide géant au-dessus d'un jardin de petits champignons lumineux.
      add(new THREE.CylinderGeometry(0.48, 0.5, 0.04, 12), m('#3a2e4a'), 0, 0.02);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        mushroom(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.12, 0.06, i);
      }
      const dome = add(new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), ghost ? ghostMaterial : new THREE.MeshStandardMaterial({ color: '#d8c4ff', transparent: true, opacity: 0.32, roughness: 0.1 }), 0, 0.04);
      dome.scale.y = 0.75;
      return breathe;
    }
    case 'ferme': {
      // Bassin de mycélium : des tapis flottants (comme des nénuphars) tournent lentement.
      add(new THREE.TorusGeometry(0.4, 0.05, 6, 20), m(STEM), 0, 0.06).rotation.x = Math.PI / 2;
      const mats = group();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const pad = part(mats, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 10), m('#6a9a5a', { emissive: '#0a2a10' }), Math.cos(a) * 0.22, 0.06, Math.sin(a) * 0.22);
        pad.scale.x = 1.3;
      }
      mushroom(0, 0, 0.16, 0.1, 2);
      return (time) => {
        breathe(time);
        mats.rotation.y = time * 0.3;
      };
    }
    case 'laboratoire': {
      // Champignon-observatoire : son large chapeau fait office de parabole et balaie le ciel.
      mycelium(0, 0, 0.42, 7);
      add(new THREE.CylinderGeometry(0.12, 0.18, 0.3, 9), m(STEM, { roughness: 0.7 }), -0.08, 0.15, 0);
      const windows = add(new THREE.CylinderGeometry(0.125, 0.14, 0.035, 9), light('#7ff0ff'), -0.08, 0.18, 0);
      const head = group(-0.08, 0.32, 0);
      const dish = part(head, new THREE.SphereGeometry(0.26, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3), capMat(1, { side: THREE.DoubleSide }), 0, 0.36, 0);
      dish.rotation.x = Math.PI + 0.45; // creux vers le ciel, un peu incliné
      const antenna = part(head, new THREE.CylinderGeometry(0.006, 0.01, 0.22, 4), light(BIO, 0.8), 0, 0.14, 0);
      antenna.rotation.x = -0.45;
      const tip = part(head, new THREE.SphereGeometry(0.022, 6, 4), light(BIO, 1.3), 0, 0.24, -0.05);
      mushroom(0.3, 0.2, 0.18, 0.09, 3);
      const halo = glow('#5fe3ff', -0.08, 0.4, 0, 0.5, 0.4);
      return (time) => {
        breathe(time);
        head.rotation.y = time * 0.45 + Math.sin(time * 0.9) * 0.4;
        windows.material.emissiveIntensity = 0.5 + Math.sin(time * 2) * 0.3;
        tip.visible = Math.sin(time * 4) > -0.4;
        if (halo) halo.material.opacity = 0.2 + (0.5 + Math.sin(time * 2) * 0.5) * 0.35;
      };
    }
    case 'siphon': {
      // Racines qui s'élèvent en spirale et tiennent le cristal de Vélarine.
      add(new THREE.CylinderGeometry(0.25, 0.3, 0.06, 10), m('#3a2e4a'), 0, 0.03);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const root = add(new THREE.CylinderGeometry(0.015, 0.04, 0.7, 5), m(STEM, { roughness: 0.7 }), Math.cos(a) * 0.14, 0.38, Math.sin(a) * 0.14);
        root.rotation.z = Math.cos(a) * 0.22;
        root.rotation.x = -Math.sin(a) * 0.22;
      }
      mycelium(0, 0, 0.3, 6);
      const crystal = add(new THREE.OctahedronGeometry(0.12), light('#c77dff'), 0, 0.8);
      crystal.scale.y = 1.6;
      return (time) => {
        breathe(time);
        crystal.rotation.y = time;
        crystal.position.y = 0.8 + Math.sin(time * 2) * 0.04;
      };
    }
    case 'spatioport': {
      // Aire de mycélium tressé, tour-tige, et la sonde : une capsule de spores violette.
      add(new THREE.CylinderGeometry(0.5, 0.54, 0.05, 6), m('#3a2e4a', { roughness: 0.9 }), 0, 0.025);
      const ringPad = add(new THREE.TorusGeometry(0.29, 0.012, 3, 24), light(SPORE, 0.8), 0.08, 0.06, 0);
      ringPad.rotation.x = Math.PI / 2;
      glowing.push(ringPad);
      const beacons = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        mushroom(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0.07, 0.045, i);
        beacons.push(add(new THREE.SphereGeometry(0.018, 6, 4), light(SPORE, 0.4), Math.cos(a) * 0.44, 0.1, Math.sin(a) * 0.44));
      }
      const rx = 0.08;
      const pod = add(new THREE.SphereGeometry(0.07, 12, 8), m('#9b7fd6', { roughness: 0.4, emissive: '#3a1a6a', emissiveIntensity: 0.5 }), rx, 0.26, 0);
      pod.scale.y = 2.1;
      add(new THREE.ConeGeometry(0.04, 0.08, 8), m(STEM), rx, 0.46, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = add(new THREE.CylinderGeometry(0.008, 0.012, 0.16, 4), m(STEM), rx + Math.cos(a) * 0.06, 0.07, Math.sin(a) * 0.06);
        leg.rotation.z = Math.cos(a) * 0.4;
        leg.rotation.x = -Math.sin(a) * 0.4;
      }
      const tx = -0.15;
      add(new THREE.CylinderGeometry(0.03, 0.07, 0.62, 7), m(STEM, { roughness: 0.7 }), tx, 0.31, 0);
      add(new THREE.SphereGeometry(0.08, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat(2), tx, 0.6, 0).scale.y = 0.55;
      const arm = add(new THREE.CylinderGeometry(0.01, 0.015, 0.2, 4), m(STEM), (tx + rx) / 2, 0.36, 0);
      arm.rotation.z = Math.PI / 2;
      const towerLight = add(new THREE.SphereGeometry(0.025, 6, 4), light('#ff4040'), tx, 0.66, 0);
      mushroom(0.02, 0.3, 0.12, 0.08, 1);
      const halo = glow(SPORE, rx, 0.28, 0, 0.35, 0.35);
      const puff = spores(rx, 0.1, 0, 2.2);
      return (time, dt, fx) => {
        breathe(time);
        const step = Math.floor(time * 6) % beacons.length;
        beacons.forEach((b, i) => (b.material.emissiveIntensity = i === step ? 1.6 : 0.4));
        towerLight.material.emissiveIntensity = Math.sin(time * 3) > 0.2 ? 1.8 : 0.2;
        pod.material.emissiveIntensity = 0.4 + Math.sin(time * 2) * 0.2;
        if (halo) halo.material.opacity = 0.2 + Math.sin(time * 2) * 0.12;
        puff(time, dt, fx);
      };
    }
    case 'batterie': {
      // Bulbe-canon : une vesse épineuse qui pivote et vise, crachant des spores acérées.
      add(new THREE.CylinderGeometry(0.4, 0.46, 0.06, 10), m('#3a2e4a'), 0, 0.03);
      mycelium(0, 0, 0.42, 8);
      const head = group(0, 0.06, 0);
      const bulb = part(head, new THREE.SphereGeometry(0.22, 12, 8), capMat(2), 0, 0.2, 0);
      bulb.scale.y = 0.85;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = part(head, new THREE.ConeGeometry(0.025, 0.1, 5), m(STEM), Math.cos(a) * 0.2, 0.26, Math.sin(a) * 0.2);
        spike.rotation.z = -Math.cos(a) * 1.1;
        spike.rotation.x = Math.sin(a) * 1.1;
      }
      const cradle = group(0, 0.22, 0.14, head);
      const barrel = part(cradle, new THREE.CylinderGeometry(0.03, 0.05, 0.36, 7), m(STEM, { roughness: 0.6 }), 0, 0, 0.16);
      barrel.rotation.x = Math.PI / 2;
      const muzzle = part(cradle, new THREE.SphereGeometry(0.04, 8, 6), light('#ff5ab0', 1.2), 0, 0, 0.35);
      const eye = part(head, new THREE.SphereGeometry(0.035, 8, 6), light('#ff3a8a'), 0.1, 0.3, 0.14);
      const halo = glow('#ff5ab0', 0, 0.4, 0, 0.5, 0.4);
      const phase = Math.random() * 10;
      return (time) => {
        breathe(time);
        const t = time + phase;
        head.rotation.y = t * 0.25 + Math.sin(t * 0.5) * 0.6;
        cradle.rotation.x = -0.25 - Math.sin(t * 0.7) * 0.2;
        const p = 0.5 + Math.sin(t * 3) * 0.5;
        eye.material.emissiveIntensity = 0.4 + p;
        muzzle.material.emissiveIntensity = 0.6 + p;
        if (halo) halo.material.opacity = 0.2 + p * 0.3;
      };
    }
    default:
      return undefined; // pas redessiné : style neutre
  }
}
