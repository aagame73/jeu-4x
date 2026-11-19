// Style des Kel-Tirr : peuple ailé. Flèches élancées, nids tressés, toits en forme d'ailes,
// crème et or, fanions qui flottent au vent. Chaque bâtiment garde son élément de fonction
// (foreuse, antenne, cheminée…).
import * as THREE from 'three';

const CREAM = '#efe4c8';
const GOLD = '#d9b04a';
const WOOD = '#8a6a44';
const SKY = '#7fc8ff';
const FLAGS = ['#e85a4a', '#4aa8e8', '#e8c44a', '#5ac87a'];

export function buildKeltirr(type, kit) {
  const { g, add, m, light, every, glow, part, group } = kit;
  const cream = (extra = {}) => m(CREAM, { roughness: 0.6, ...extra });
  const gold = (extra = {}) => m(GOLD, { metalness: 0.7, roughness: 0.3, ...extra });
  const flags = [];
  // Flèche : tour fine terminée par une pointe dorée.
  const spire = (x, z, h, r = 0.05, y = 0) => {
    add(new THREE.CylinderGeometry(r * 0.6, r, h * 0.8, 8), cream(), x, y + h * 0.4, z);
    add(new THREE.ConeGeometry(r * 0.75, h * 0.25, 8), gold(), x, y + h * 0.92, z);
  };
  // Fanion au bout d'une hampe : il ondule au vent.
  const flag = (x, y, z, i = 0, size = 0.1) => {
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 4), gold(), x, y + 0.08, z);
    const holder = group(x, y + 0.13, z);
    const cloth = part(holder, new THREE.PlaneGeometry(size, size * 0.55, 3, 1), m(FLAGS[i % FLAGS.length], { side: THREE.DoubleSide, roughness: 0.8 }), size / 2, 0, 0);
    flags.push({ holder, cloth, phase: i * 1.3 });
  };
  // Nid tressé : tore aplati de couleur paille.
  const nest = (x, z, r, y = 0) => {
    const n = add(new THREE.TorusGeometry(r, r * 0.28, 6, 16), m('#b89a62', { roughness: 0.95 }), x, y + r * 0.2, z);
    n.rotation.x = Math.PI / 2;
    n.scale.z = 0.6;
    return n;
  };
  // Toit en ailes : deux plans courbés en V au-dessus d'un bâtiment.
  const wings = (x, y, z, span = 0.32, rotY = 0) => {
    const w = group(x, y, z);
    w.rotation.y = rotY;
    for (const side of [-1, 1]) {
      const wing = part(w, new THREE.BoxGeometry(span, 0.015, span * 0.5), cream({ roughness: 0.5 }), side * span * 0.45, 0, 0);
      wing.rotation.z = side * 0.35;
      part(w, new THREE.BoxGeometry(span * 0.9, 0.02, 0.02), gold(), side * span * 0.45, -0.005, span * 0.25).rotation.z = side * 0.35;
    }
    return w;
  };
  const wind = (time) => {
    for (const f of flags) {
      f.holder.rotation.y = Math.sin(time * 1.4 + f.phase) * 0.5;
      f.cloth.rotation.x = Math.sin(time * 4 + f.phase) * 0.25;
    }
  };
  const feathers = (x, y, z, period = 2) => every(period, (fx) => fx.puff(g, x, y, z, '#fff8e8'));

  switch (type) {
    case 'centre': {
      // Palais aux ailes déployées sur un socle à gradins, flèche centrale et fanions.
      add(new THREE.CylinderGeometry(0.56, 0.62, 0.08, 8), cream(), 0, 0.04);
      add(new THREE.CylinderGeometry(0.4, 0.46, 0.08, 8), cream(), 0, 0.12);
      add(new THREE.CylinderGeometry(0.22, 0.28, 0.24, 8), cream(), 0, 0.28);
      add(new THREE.TorusGeometry(0.23, 0.02, 4, 16), light('#7cff9e'), 0, 0.3).rotation.x = Math.PI / 2;
      wings(0, 0.42, 0, 0.5);
      spire(0, 0, 0.55, 0.05, 0.38);
      const beacon = add(new THREE.SphereGeometry(0.03, 8, 6), light('#ff5050'), 0, 0.97, 0);
      flag(0.42, 0.08, 0.25, 0);
      flag(-0.42, 0.08, 0.25, 1);
      flag(0, 0.08, -0.45, 2);
      return (time) => {
        wind(time);
        beacon.visible = Math.sin(time * 3) > 0;
      };
    }
    case 'foyer': {
      // Trois nids perchés sur de hauts poteaux, petites lanternes dorées.
      for (const [x, z, h, i] of [[-0.2, 0.1, 0.22, 0], [0.22, 0.12, 0.16, 1], [0, -0.22, 0.28, 2]]) {
        add(new THREE.CylinderGeometry(0.025, 0.035, h, 6), m(WOOD), x, h / 2, z);
        nest(x, z, 0.14, h - 0.02);
        add(new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), cream(), x, h, z);
        add(new THREE.SphereGeometry(0.025, 6, 4), light('#ffe08a'), x, h + 0.04, z + 0.1);
        if (i === 2) flag(x, h + 0.08, z, i, 0.08);
      }
      return wind;
    }
    case 'puits': {
      // Derrick élancé aux montants dorés, foreuse et fanion au sommet.
      add(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 8), cream(), 0, 0.03);
      for (const [dx, dz] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08]]) {
        const leg = add(new THREE.CylinderGeometry(0.012, 0.016, 0.95, 4), gold(), dx * 0.5, 0.5, dz * 0.5);
        leg.rotation.z = dx * 0.9;
        leg.rotation.x = -dz * 0.9;
      }
      const drill = add(new THREE.ConeGeometry(0.05, 0.16, 6), m('#c9a24a', { metalness: 0.6 }), 0, 0.14);
      drill.rotation.x = Math.PI;
      const lamp = add(new THREE.SphereGeometry(0.03, 6, 4), light('#ffb347'), 0, 0.98);
      flag(0, 0.96, 0, 3, 0.09);
      return (time) => {
        wind(time);
        drill.rotation.y = time * 4;
        lamp.visible = Math.sin(time * 5) > -0.3;
      };
    }
    case 'fonderie': {
      // Atelier sous toit en ailes, haute cheminée en flèche, coulée et lingots.
      add(new THREE.BoxGeometry(0.5, 0.24, 0.32), cream(), -0.05, 0.12);
      wings(-0.05, 0.3, 0, 0.32);
      add(new THREE.CylinderGeometry(0.045, 0.07, 0.7, 8), m('#8a7a6a'), 0.22, 0.35, -0.14);
      add(new THREE.ConeGeometry(0.06, 0.08, 8), gold(), 0.22, 0.74, -0.14);
      add(new THREE.BoxGeometry(0.34, 0.04, 0.09), m(WOOD), -0.12, 0.02, 0.27);
      const pour = add(new THREE.BoxGeometry(0.3, 0.012, 0.05), light('#ff8a3a'), -0.12, 0.045, 0.27);
      for (const x of [-0.24, -0.12, 0]) add(new THREE.BoxGeometry(0.07, 0.035, 0.05), m('#9fb4c8', { metalness: 0.8, roughness: 0.25 }), x, 0.018, 0.38);
      const smoke = every(0.9, (fx) => fx.puff(g, 0.22, 0.75, -0.14, '#8a8480'));
      return (time, dt, fx) => {
        pour.material.emissiveIntensity = 0.7 + Math.sin(time * 6) * 0.25;
        smoke(time, dt, fx);
      };
    }
    case 'pompe': {
      // Plateforme sur pilotis fins, tour en flèche, réservoir dans un berceau doré.
      add(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 8), cream(), 0, 0.12);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        add(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 4), gold(), Math.cos(a) * 0.36, 0.06, Math.sin(a) * 0.36);
      }
      spire(-0.16, -0.08, 0.72, 0.05, 0.12);
      const tank = add(new THREE.SphereGeometry(0.15, 14, 10), m('#5fe3ff', { emissive: '#1a8aa8', emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.3 }), 0.14, 0.3, 0.08);
      add(new THREE.TorusGeometry(0.16, 0.014, 4, 20), gold(), 0.14, 0.3, 0.08).rotation.x = Math.PI / 2;
      flag(0.3, 0.14, 0.25, 1, 0.08);
      const vent = every(1.6, (fx) => fx.puff(g, 0.14, 0.46, 0.08, '#9ff0ff'));
      return (time, dt, fx) => {
        wind(time);
        tank.material.emissiveIntensity = 0.45 + Math.sin(time * 1.5) * 0.2;
        vent(time, dt, fx);
      };
    }
    case 'captage': {
      // Fontaine à vasque dorée, tour-citerne élancée.
      add(new THREE.TorusGeometry(0.3, 0.04, 6, 20), cream(), -0.08, 0.05, 0.05).rotation.x = Math.PI / 2;
      const pool = add(new THREE.CircleGeometry(0.28, 20), m('#4aa8ff', { emissive: '#0a2a55', roughness: 0.1 }), -0.08, 0.06, 0.05);
      pool.rotation.x = -Math.PI / 2;
      add(new THREE.CylinderGeometry(0.02, 0.03, 0.22, 6), gold(), -0.08, 0.15, 0.05);
      add(new THREE.CylinderGeometry(0.09, 0.03, 0.06, 10), gold(), -0.08, 0.28, 0.05);
      spire(0.3, -0.22, 0.55, 0.08);
      add(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 8), m('#4aa8ff', { emissive: '#0a2a55' }), 0.3, 0.3, -0.22);
      return (time) => (pool.rotation.z = time * 0.4);
    }
    case 'fouille': {
      // Fouille sous un auvent en ailes, grue fine et dorée, relique.
      add(new THREE.CylinderGeometry(0.2, 0.16, 0.03, 8), m('#5a4a3a'), 0.05, 0.015, 0.05);
      const relic = add(new THREE.OctahedronGeometry(0.05), light('#ffd166'), 0.05, 0.07, 0.05);
      for (const [x, z] of [[-0.18, -0.12], [-0.18, 0.22], [0.28, -0.12], [0.28, 0.22]]) add(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 4), m(WOOD), x, 0.16, z);
      wings(0.05, 0.34, 0.05, 0.3);
      add(new THREE.CylinderGeometry(0.015, 0.02, 0.6, 5), gold(), -0.32, 0.3, -0.25);
      const boom = group(-0.32, 0.6, -0.25);
      part(boom, new THREE.BoxGeometry(0.46, 0.02, 0.02), gold(), 0.18, 0, 0);
      part(boom, new THREE.CylinderGeometry(0.004, 0.004, 0.25, 3), m('#333'), 0.38, -0.125, 0);
      flag(0.3, 0.02, -0.3, 0, 0.08);
      const halo = glow('#ffd166', 0.05, 0.1, 0.05, 0.45, 0.6);
      return (time) => {
        wind(time);
        boom.rotation.y = Math.sin(time * 0.35) * 1.1;
        relic.rotation.y = time * 1.5;
        const p = 0.5 + Math.sin(time * 2.2) * 0.5;
        relic.material.emissiveIntensity = 0.5 + p * 0.8;
        if (halo) halo.material.opacity = 0.3 + p * 0.45;
      };
    }
    case 'centrale': {
      // Éolienne-centrale : haut mât, rotor à pales en forme de plumes, anneau doré.
      add(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 8), cream(), -0.1, 0.04);
      add(new THREE.CylinderGeometry(0.04, 0.08, 0.7, 8), cream(), -0.1, 0.43);
      const ring = add(new THREE.TorusGeometry(0.1, 0.018, 4, 16), light('#ffd166'), -0.1, 0.12);
      ring.rotation.x = Math.PI / 2;
      const rotor = group(-0.1, 0.78, 0.06);
      for (let k = 0; k < 5; k++) {
        const blade = part(rotor, new THREE.BoxGeometry(0.04, 0.3, 0.008), cream({ roughness: 0.5 }), 0, 0.15, 0);
        const holder = group(0, 0, 0, rotor);
        holder.rotation.z = (k / 5) * Math.PI * 2;
        holder.add(blade);
      }
      add(new THREE.SphereGeometry(0.035, 8, 6), gold(), -0.1, 0.78, 0.07);
      add(new THREE.BoxGeometry(0.2, 0.16, 0.18), cream(), 0.3, 0.08, 0.18);
      return (time) => {
        rotor.rotation.z = time * 1.6;
        ring.material.emissiveIntensity = 0.6 + Math.sin(time * 4) * 0.4;
      };
    }
    case 'solaire': {
      // Panneaux en forme d'ailes déployées, bordés d'or.
      for (const [x, z, i] of [[-0.22, -0.2, 0], [0.22, -0.2, 1], [-0.22, 0.2, 2], [0.22, 0.2, 3]]) {
        add(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 4), gold(), x, 0.06, z);
        // Deux ailes de cellules bleues, bordées d'or, en V.
        const w = group(x, 0.14, z);
        w.rotation.set(-0.35, i * 0.3, 0);
        for (const side of [-1, 1]) {
          part(w, new THREE.BoxGeometry(0.18, 0.015, 0.22), m('#1d3f7a', { metalness: 0.6, roughness: 0.2, emissive: '#0a1a3a' }), side * 0.09, 0, 0).rotation.z = side * 0.3;
          part(w, new THREE.BoxGeometry(0.18, 0.02, 0.02), gold(), side * 0.09, 0.005, 0.11).rotation.z = side * 0.3;
        }
      }
      return null;
    }
    case 'serre': {
      // Volière-jardin : coupole de fins arceaux dorés sur un jardin.
      add(new THREE.CylinderGeometry(0.48, 0.5, 0.05, 12), cream(), 0, 0.025);
      add(new THREE.SphereGeometry(0.34, 12, 6), m('#5fbf6a', { emissive: '#103a14' }), 0, 0.03).scale.y = 0.5;
      for (let k = 0; k < 6; k++) {
        const arc = add(new THREE.TorusGeometry(0.45, 0.01, 4, 20, Math.PI), gold(), 0, 0.05, 0);
        arc.rotation.y = (k / 6) * Math.PI;
      }
      add(new THREE.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m('#fff4dc', { transparent: true, opacity: 0.18, roughness: 0.1 }), 0, 0.05);
      spire(0, 0, 0.2, 0.02, 0.45);
      return null;
    }
    case 'ferme': {
      // Bassin cerclé de crème, filets qui tournent, petit perchoir au centre.
      add(new THREE.TorusGeometry(0.4, 0.05, 6, 20), cream(), 0, 0.08).rotation.x = Math.PI / 2;
      const nets = group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const net = part(nets, new THREE.BoxGeometry(0.22, 0.03, 0.1), m('#4fae5a', { emissive: '#0a3010' }), Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2);
        net.rotation.y = -a;
      }
      add(new THREE.CylinderGeometry(0.02, 0.025, 0.24, 5), m(WOOD), 0, 0.12);
      flag(0, 0.22, 0, 2, 0.08);
      return (time) => {
        wind(time);
        nets.rotation.y = time * 0.3;
      };
    }
    case 'laboratoire': {
      // Tour d'observation élancée sous toit en ailes, parabole dorée qui balaie le ciel.
      add(new THREE.CylinderGeometry(0.24, 0.3, 0.1, 8), cream(), -0.08, 0.05);
      add(new THREE.CylinderGeometry(0.14, 0.18, 0.34, 8), cream(), -0.08, 0.27);
      const windows = add(new THREE.CylinderGeometry(0.145, 0.16, 0.03, 8), light(SKY), -0.08, 0.3);
      wings(-0.08, 0.46, 0, 0.3);
      spire(-0.08, 0, 0.3, 0.025, 0.44);
      add(new THREE.CylinderGeometry(0.015, 0.02, 0.36, 5), gold(), 0.24, 0.18, 0.14);
      const head = group(0.24, 0.4, 0.14);
      const dish = part(head, new THREE.SphereGeometry(0.13, 14, 6, 0, Math.PI * 2, 0, Math.PI / 3.2), gold({ side: THREE.DoubleSide }), 0, 0.05, 0.1);
      dish.rotation.x = -Math.PI / 2 - 0.5;
      const tip = part(head, new THREE.SphereGeometry(0.018, 6, 4), light(SKY), 0, 0.12, -0.05);
      const halo = glow(SKY, -0.08, 0.3, 0, 0.45, 0.35);
      return (time) => {
        head.rotation.y = time * 0.45 + Math.sin(time * 0.9) * 0.4;
        windows.material.emissiveIntensity = 0.5 + Math.sin(time * 2) * 0.3;
        tip.visible = Math.sin(time * 4) > -0.4;
        if (halo) halo.material.opacity = 0.2 + (0.5 + Math.sin(time * 2) * 0.5) * 0.3;
      };
    }
    case 'siphon': {
      // Trois flèches dorées qui encadrent la Vélarine flottante.
      add(new THREE.CylinderGeometry(0.26, 0.32, 0.1, 8), cream(), 0, 0.05);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        spire(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.62, 0.035, 0.1);
      }
      const crystal = add(new THREE.OctahedronGeometry(0.12), light('#c77dff'), 0, 0.8);
      crystal.scale.y = 1.6;
      return (time) => {
        crystal.rotation.y = time;
        crystal.position.y = 0.8 + Math.sin(time * 2) * 0.04;
      };
    }
    case 'spatioport': {
      // Aire claire bordée d'or, tour en flèche avec fanion, sonde blanche aux ailerons-plumes.
      add(new THREE.CylinderGeometry(0.5, 0.54, 0.06, 6), cream(), 0, 0.03);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.012, 6), gold(), 0.08, 0.066);
      add(new THREE.CylinderGeometry(0.27, 0.27, 0.014, 6), cream({ roughness: 0.7 }), 0.08, 0.068);
      const beacons = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        beacons.push(add(new THREE.SphereGeometry(0.022, 6, 4), light('#ffb347'), Math.cos(a) * 0.44, 0.075, Math.sin(a) * 0.44));
      }
      const rx = 0.08;
      add(new THREE.CylinderGeometry(0.04, 0.05, 0.32, 10), m('#fbf6ea', { roughness: 0.4 }), rx, 0.24, 0);
      add(new THREE.ConeGeometry(0.04, 0.14, 10), gold(), rx, 0.47, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const fin = add(new THREE.BoxGeometry(0.01, 0.14, 0.05), cream(), rx + Math.cos(a) * 0.05, 0.14, Math.sin(a) * 0.05);
        fin.rotation.y = -a;
        fin.rotation.z = 0.2;
      }
      spire(-0.15, 0, 0.66, 0.045, 0.06);
      add(new THREE.BoxGeometry(0.17, 0.02, 0.03), gold(), (-0.15 + rx) / 2, 0.36, 0);
      const towerLight = add(new THREE.SphereGeometry(0.025, 6, 4), light('#ff4040'), -0.15, 0.76, 0);
      flag(-0.15, 0.6, 0, 1, 0.1);
      add(new THREE.BoxGeometry(0.16, 0.1, 0.12), cream(), 0.02, 0.11, 0.3);
      wings(0.02, 0.18, 0.3, 0.14);
      const vent = every(2.2, (fx) => fx.puff(g, rx, 0.1, 0, '#fff8e8'));
      return (time, dt, fx) => {
        wind(time);
        const step = Math.floor(time * 6) % beacons.length;
        beacons.forEach((b, i) => (b.material.emissiveIntensity = i === step ? 2.2 : 0.35));
        towerLight.material.emissiveIntensity = Math.sin(time * 3) > 0.2 ? 1.8 : 0.2;
        vent(time, dt, fx);
      };
    }
    case 'batterie': {
      // Tourelle-faucon : tête effilée aux ailes repliées, deux canons longs, œil rouge.
      add(new THREE.CylinderGeometry(0.4, 0.46, 0.08, 8), cream(), 0, 0.04);
      add(new THREE.TorusGeometry(0.3, 0.018, 4, 18), light('#ff4a4a'), 0, 0.09).rotation.x = Math.PI / 2;
      const head = group(0, 0.08, 0);
      const body = part(head, new THREE.ConeGeometry(0.16, 0.42, 8), cream(), 0, 0.14, 0.04);
      body.rotation.x = Math.PI / 2;
      for (const side of [-1, 1]) {
        const w = part(head, new THREE.BoxGeometry(0.22, 0.015, 0.16), gold(), side * 0.15, 0.2, -0.05);
        w.rotation.z = side * 0.5;
      }
      const cradle = group(0, 0.12, 0.2, head);
      for (const x of [-0.05, 0.05]) {
        const barrel = part(cradle, new THREE.CylinderGeometry(0.016, 0.022, 0.4, 6), gold(), x, 0, 0.16);
        barrel.rotation.x = Math.PI / 2;
      }
      const eye = part(head, new THREE.SphereGeometry(0.03, 8, 6), light('#ff3030'), 0, 0.22, 0.16);
      const halo = glow('#ff3a3a', 0, 0.36, 0, 0.45, 0.4);
      const phase = Math.random() * 10;
      return (time) => {
        const t = time + phase;
        head.rotation.y = t * 0.25 + Math.sin(t * 0.5) * 0.6;
        cradle.rotation.x = -0.25 - Math.sin(t * 0.7) * 0.2;
        const p = 0.5 + Math.sin(t * 3) * 0.5;
        eye.material.emissiveIntensity = 0.4 + p;
        if (halo) halo.material.opacity = 0.2 + p * 0.3;
      };
    }
    default:
      return undefined; // pas redessiné : style neutre
  }
}
