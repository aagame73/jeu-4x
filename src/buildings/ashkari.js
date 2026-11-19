// Style des Ashkari : nomades des déserts et marchands. Tentes de caravane en toile ocre, voiles
// tendues qui ondulent, tuyaux et cuves de cuivre, jets de vapeur. Chaque bâtiment garde son
// élément de fonction (foreuse, antenne, cheminée…).
import * as THREE from 'three';

const CLOTH = ['#d8a25a', '#c98a48', '#e2b878', '#b8743c'];
const COPPER = '#b8643a';
const BRASS = '#c9a24a';
const SAND = '#a88a62';

export function buildAshkari(type, kit) {
  const { g, add, m, light, every, glow, part, group } = kit;
  const cloth = (i = 0, extra = {}) => m(CLOTH[Math.abs(i) % CLOTH.length], { roughness: 0.9, side: THREE.DoubleSide, ...extra });
  const copper = (extra = {}) => m(COPPER, { metalness: 0.75, roughness: 0.35, ...extra });
  const brass = (extra = {}) => m(BRASS, { metalness: 0.7, roughness: 0.3, ...extra });
  const sails = [];
  // Tente : cône à 6 pans, mât de cuivre qui dépasse.
  const tent = (x, z, r, h, i = 0) => {
    add(new THREE.ConeGeometry(r, h, 6, 1, true), cloth(i), x, h / 2, z);
    add(new THREE.CylinderGeometry(0.008, 0.008, h * 1.25, 4), copper(), x, h * 0.62, z);
    add(new THREE.TorusGeometry(r * 0.98, 0.01, 3, 6), brass(), x, 0.02, z).rotation.x = Math.PI / 2;
  };
  // Voile tendue entre deux mâts : elle ondule.
  const sail = (x, y, z, w, h, rotY = 0, i = 0) => {
    const holder = group(x, y, z);
    holder.rotation.y = rotY;
    const s = part(holder, new THREE.PlaneGeometry(w, h, 4, 1), cloth(i), 0, 0, 0);
    sails.push({ s, phase: sails.length * 1.1 });
    return holder;
  };
  // Tuyau de cuivre horizontal entre deux points (même hauteur).
  const pipe = (x1, z1, x2, z2, y, r = 0.018) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const p = add(new THREE.CylinderGeometry(r, r, len, 6), copper(), (x1 + x2) / 2, y, (z1 + z2) / 2);
    p.rotation.z = Math.PI / 2;
    p.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    return p;
  };
  // Cuve de cuivre à cerclages.
  const tank = (x, z, r, h, y = 0) => {
    add(new THREE.CylinderGeometry(r, r, h, 10), copper(), x, y + h / 2, z);
    for (const k of [0.2, 0.8]) add(new THREE.TorusGeometry(r * 1.02, 0.008, 3, 12), brass(), x, y + h * k, z).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(r, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), copper(), x, y + h, z);
  };
  const flutter = (time) => {
    for (const { s, phase } of sails) {
      s.rotation.y = Math.sin(time * 1.6 + phase) * 0.12;
      s.scale.x = 1 + Math.sin(time * 3 + phase) * 0.03;
    }
  };
  const steam = (x, y, z, period = 1.4) => every(period, (fx) => fx.puff(g, x, y, z, '#eeeae4'));

  switch (type) {
    case 'centre': {
      // Grande tente du conseil, auvents tendus, cuve et lanterne-balise.
      add(new THREE.CylinderGeometry(0.58, 0.62, 0.04, 8), m(SAND, { roughness: 1 }), 0, 0.02);
      tent(0, 0, 0.36, 0.5, 0);
      tent(0.36, 0.26, 0.14, 0.22, 1);
      tent(-0.36, 0.24, 0.13, 0.2, 2);
      sail(0, 0.3, -0.42, 0.4, 0.14, 0, 3);
      for (const x of [-0.2, 0.2]) add(new THREE.CylinderGeometry(0.01, 0.01, 0.36, 4), copper(), x, 0.18, -0.42);
      tank(0.3, -0.25, 0.07, 0.16);
      const beacon = add(new THREE.SphereGeometry(0.03, 8, 6), light('#ffb347', 1.2), 0, 0.66, 0);
      const halo = glow('#ffb347', 0, 0.66, 0, 0.35, 0.4);
      const puff = steam(0.3, 0.24, -0.25, 2);
      return (time, dt, fx) => {
        flutter(time);
        beacon.visible = Math.sin(time * 3) > -0.3;
        if (halo) halo.material.opacity = 0.25 + Math.sin(time * 3) * 0.15;
        puff(time, dt, fx);
      };
    }
    case 'foyer': {
      // Campement de trois tentes, lanternes à l'entrée.
      for (const [x, z, r, h, i] of [[-0.2, 0.1, 0.17, 0.26, 0], [0.22, 0.12, 0.14, 0.22, 1], [0, -0.22, 0.16, 0.28, 2]]) {
        tent(x, z, r, h, i);
        add(new THREE.SphereGeometry(0.02, 6, 4), light('#ffe08a'), x, 0.08, z + r * 0.9);
      }
      return null;
    }
    case 'puits': {
      // Derrick de cuivre à haubans, pompe à balancier, voile pare-sable.
      add(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 8), m(SAND), 0, 0.025);
      add(new THREE.CylinderGeometry(0.05, 0.15, 0.8, 4, 1, true), copper({ side: THREE.DoubleSide }), 0, 0.45).rotation.y = Math.PI / 4;
      add(new THREE.ConeGeometry(0.07, 0.12, 4), brass(), 0, 0.91);
      const beam = group(0.18, 0.25, 0.12);
      part(beam, new THREE.BoxGeometry(0.28, 0.025, 0.025), brass(), 0, 0, 0);
      add(new THREE.BoxGeometry(0.03, 0.25, 0.03), copper(), 0.18, 0.12, 0.12);
      sail(-0.2, 0.18, 0.15, 0.2, 0.14, 0.8, 1);
      const lamp = add(new THREE.SphereGeometry(0.03, 6, 4), light('#ffb347'), 0, 1.0);
      return (time) => {
        flutter(time);
        beam.rotation.z = Math.sin(time * 2) * 0.3;
        lamp.visible = Math.sin(time * 5) > -0.3;
      };
    }
    case 'fonderie': {
      // Forge de caravane : four de cuivre sous auvent, cheminée à chapeau, coulée.
      tank(-0.08, -0.04, 0.17, 0.26);
      const mouth = add(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 10), light('#ff8a3a', 1.2), -0.08, 0.12, 0.13);
      mouth.rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.035, 0.045, 0.66, 8), copper(), 0.22, 0.33, -0.16);
      add(new THREE.ConeGeometry(0.07, 0.06, 8), brass(), 0.22, 0.69, -0.16);
      sail(-0.08, 0.38, 0.05, 0.42, 0.26, 0, 2).rotation.x = -Math.PI / 2 + 0.25;
      add(new THREE.BoxGeometry(0.34, 0.04, 0.09), m(SAND), -0.12, 0.02, 0.27);
      const pour = add(new THREE.BoxGeometry(0.3, 0.012, 0.05), light('#ff8a3a'), -0.12, 0.045, 0.27);
      for (const x of [-0.24, -0.12, 0]) add(new THREE.BoxGeometry(0.07, 0.035, 0.05), m('#9fb4c8', { metalness: 0.8, roughness: 0.25 }), x, 0.018, 0.38);
      const smoke = every(0.9, (fx) => fx.puff(g, 0.22, 0.72, -0.16, '#7a7068'));
      return (time, dt, fx) => {
        flutter(time);
        mouth.material.emissiveIntensity = 1 + Math.sin(time * 5) * 0.35;
        pour.material.emissiveIntensity = 0.7 + Math.sin(time * 6) * 0.25;
        smoke(time, dt, fx);
      };
    }
    case 'pompe': {
      // Station de pompage : cuves de cuivre reliées par des tuyaux, réservoir sphérique, vapeur.
      add(new THREE.CylinderGeometry(0.42, 0.44, 0.04, 8), m(SAND), 0, 0.02);
      tank(-0.18, -0.1, 0.08, 0.5, 0.04);
      const sphere = add(new THREE.SphereGeometry(0.15, 14, 10), m('#5fe3ff', { emissive: '#1a8aa8', emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.3 }), 0.14, 0.24, 0.08);
      add(new THREE.TorusGeometry(0.155, 0.014, 4, 20), brass(), 0.14, 0.24, 0.08).rotation.x = Math.PI / 2;
      pipe(-0.18, -0.1, 0.14, 0.08, 0.3);
      pipe(-0.18, -0.1, 0.25, -0.28, 0.12);
      const beacon = add(new THREE.SphereGeometry(0.025, 6, 4), light('#5fe3ff'), -0.18, 0.68, -0.1);
      const puff = steam(-0.18, 0.66, -0.1, 1.5);
      return (time, dt, fx) => {
        beacon.visible = Math.sin(time * 2.5) > -0.2;
        sphere.material.emissiveIntensity = 0.45 + Math.sin(time * 1.5) * 0.2;
        puff(time, dt, fx);
      };
    }
    case 'captage': {
      // Piège à rosée : grandes voiles qui condensent l'eau dans un bassin de cuivre.
      add(new THREE.TorusGeometry(0.28, 0.035, 6, 20), copper(), -0.06, 0.04, 0.06).rotation.x = Math.PI / 2;
      const pool = add(new THREE.CircleGeometry(0.27, 20), m('#4aa8ff', { emissive: '#0a2a55', roughness: 0.1 }), -0.06, 0.05, 0.06);
      pool.rotation.x = -Math.PI / 2;
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        add(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4), copper(), -0.06 + Math.cos(a) * 0.3, 0.25, 0.06 + Math.sin(a) * 0.3);
        sail(-0.06 + Math.cos(a + 1) * 0.2, 0.35, 0.06 + Math.sin(a + 1) * 0.2, 0.3, 0.18, -a, k).rotation.x = 0.4;
      }
      tank(0.32, -0.25, 0.08, 0.3);
      return (time) => {
        flutter(time);
        pool.rotation.z = time * 0.4;
      };
    }
    case 'fouille': {
      // Chantier de fouille : tente-atelier, chèvre de levage en cuivre, relique.
      add(new THREE.CylinderGeometry(0.2, 0.16, 0.03, 8), m('#7a6040'), 0.05, 0.015, 0.05);
      const relic = add(new THREE.OctahedronGeometry(0.05), light('#ffd166'), 0.05, 0.07, 0.05);
      tent(-0.28, -0.2, 0.14, 0.24, 1);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const leg = add(new THREE.CylinderGeometry(0.01, 0.012, 0.5, 4), copper(), 0.05 + Math.cos(a) * 0.12, 0.23, 0.05 + Math.sin(a) * 0.12);
        leg.rotation.z = -Math.cos(a) * 0.25;
        leg.rotation.x = Math.sin(a) * 0.25;
      }
      const winch = group(0.05, 0.47, 0.05);
      part(winch, new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), brass(), 0, 0, 0).rotation.z = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.004, 0.004, 0.38, 3), m('#333'), 0.05, 0.27, 0.05);
      const halo = glow('#ffd166', 0.05, 0.1, 0.05, 0.45, 0.6);
      return (time) => {
        winch.rotation.x = time * 2;
        relic.rotation.y = time * 1.5;
        const p = 0.5 + Math.sin(time * 2.2) * 0.5;
        relic.material.emissiveIntensity = 0.5 + p * 0.8;
        if (halo) halo.material.opacity = 0.3 + p * 0.45;
      };
    }
    case 'centrale': {
      // Chaudière à vapeur : grande cuve, cheminée, volant qui tourne, anneau doré.
      tank(-0.1, 0, 0.2, 0.4);
      add(new THREE.CylinderGeometry(0.04, 0.05, 0.4, 8), copper(), -0.1, 0.6);
      const ring = add(new THREE.TorusGeometry(0.21, 0.018, 4, 18), light('#ffd166'), -0.1, 0.2);
      ring.rotation.x = Math.PI / 2;
      const wheel = group(0.24, 0.18, 0.12);
      part(wheel, new THREE.TorusGeometry(0.1, 0.015, 4, 16), brass(), 0, 0, 0);
      for (let k = 0; k < 3; k++) part(wheel, new THREE.BoxGeometry(0.2, 0.012, 0.012), brass(), 0, 0, 0).rotation.z = (k / 3) * Math.PI;
      add(new THREE.BoxGeometry(0.06, 0.2, 0.06), copper(), 0.24, 0.1, 0.06);
      const puff = steam(-0.1, 0.82, 0, 0.9);
      return (time, dt, fx) => {
        wheel.rotation.z = time * 2;
        ring.material.emissiveIntensity = 0.6 + Math.sin(time * 4) * 0.4;
        puff(time, dt, fx);
      };
    }
    case 'solaire': {
      // Voiles solaires tendues sur des mâts de cuivre, sombres et brillantes.
      for (const [x, z, i] of [[-0.22, -0.2, 0], [0.22, -0.2, 1], [-0.22, 0.2, 2], [0.22, 0.2, 3]]) {
        add(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 4), copper(), x, 0.1, z);
        const s = sail(x, 0.16, z, 0.32, 0.24, i * 0.2, i);
        s.rotation.x = -Math.PI / 2 + 0.45;
        s.children[0].material = m('#1d3f7a', { metalness: 0.5, roughness: 0.25, emissive: '#0a1a3a', side: THREE.DoubleSide });
      }
      return flutter;
    }
    case 'serre': {
      // Jardin d'oasis sous un grand velum, palmiers bas.
      add(new THREE.CylinderGeometry(0.48, 0.5, 0.04, 8), m(SAND), 0, 0.02);
      add(new THREE.SphereGeometry(0.34, 12, 6), m('#5fbf6a', { emissive: '#103a14' }), 0, 0.02).scale.y = 0.45;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        add(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 4), copper(), Math.cos(a) * 0.4, 0.18, Math.sin(a) * 0.4);
      }
      const velum = sail(0, 0.36, 0, 0.7, 0.7, 0, 0);
      velum.rotation.x = -Math.PI / 2;
      for (const [x, z] of [[0.15, 0.1], [-0.12, -0.14]]) {
        add(new THREE.CylinderGeometry(0.012, 0.018, 0.2, 5), m('#8a6a44'), x, 0.1, z);
        add(new THREE.ConeGeometry(0.1, 0.05, 6), m('#4f9a4a'), x, 0.22, z);
      }
      return flutter;
    }
    case 'ferme': {
      // Bassin à rebord de cuivre, filets qui tournent, petite tente du pêcheur.
      add(new THREE.TorusGeometry(0.4, 0.045, 6, 20), copper(), 0, 0.06).rotation.x = Math.PI / 2;
      const nets = group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const net = part(nets, new THREE.BoxGeometry(0.22, 0.03, 0.1), m('#4fae5a', { emissive: '#0a3010' }), Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2);
        net.rotation.y = -a;
      }
      tent(0, 0, 0.09, 0.16, 3);
      return (time) => (nets.rotation.y = time * 0.3);
    }
    case 'laboratoire': {
      // Tente-laboratoire à dôme de toile, cuves de cuivre, parabole de laiton qui balaie le ciel.
      add(new THREE.CylinderGeometry(0.3, 0.32, 0.04, 8), m(SAND), -0.05, 0.02);
      add(new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), cloth(2), -0.05, 0.04);
      const lamp = add(new THREE.SphereGeometry(0.05, 8, 6), light('#7ff0ff'), -0.05, 0.12, 0.2);
      tank(-0.28, -0.18, 0.05, 0.16);
      add(new THREE.CylinderGeometry(0.015, 0.02, 0.4, 5), copper(), 0.24, 0.2, 0.14);
      const head = group(0.24, 0.45, 0.14);
      const dish = part(head, new THREE.SphereGeometry(0.13, 12, 5, 0, Math.PI * 2, 0, Math.PI / 3.2), brass({ side: THREE.DoubleSide }), 0, 0.05, 0.1);
      dish.rotation.x = -Math.PI / 2 - 0.5;
      const tip = part(head, new THREE.SphereGeometry(0.018, 6, 4), light('#7ff0ff'), 0, 0.12, -0.05);
      const halo = glow('#7ff0ff', -0.05, 0.14, 0.2, 0.35, 0.35);
      return (time) => {
        head.rotation.y = time * 0.45 + Math.sin(time * 0.9) * 0.4;
        lamp.material.emissiveIntensity = 0.6 + Math.sin(time * 2) * 0.3;
        tip.visible = Math.sin(time * 4) > -0.4;
        if (halo) halo.material.opacity = 0.2 + (0.5 + Math.sin(time * 2) * 0.5) * 0.3;
      };
    }
    case 'siphon': {
      // Alambic de cuivre : la Vélarine est distillée et flotte au-dessus du serpentin.
      add(new THREE.CylinderGeometry(0.26, 0.3, 0.05, 8), m(SAND), 0, 0.025);
      tank(0, 0, 0.14, 0.24, 0.05);
      const coil = add(new THREE.TorusGeometry(0.1, 0.014, 4, 20), copper(), 0, 0.38, 0);
      coil.rotation.x = Math.PI / 2;
      add(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), copper(), 0.1, 0.4, 0);
      const crystal = add(new THREE.OctahedronGeometry(0.11), light('#c77dff'), 0, 0.7);
      crystal.scale.y = 1.6;
      const puff = steam(0, 0.45, 0, 1.6);
      return (time, dt, fx) => {
        crystal.rotation.y = time;
        crystal.position.y = 0.7 + Math.sin(time * 2) * 0.04;
        puff(time, dt, fx);
      };
    }
    case 'spatioport': {
      // Aire de sable damé, mâts à voiles, tour de cuivre, fusée cuivrée à bandes de laiton.
      add(new THREE.CylinderGeometry(0.5, 0.54, 0.05, 6), m(SAND, { roughness: 1 }), 0, 0.025);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.012, 6), brass(), 0.08, 0.056);
      add(new THREE.CylinderGeometry(0.27, 0.27, 0.014, 6), m('#8a7458'), 0.08, 0.058);
      const beacons = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        beacons.push(add(new THREE.SphereGeometry(0.022, 6, 4), light('#ffb347'), Math.cos(a) * 0.44, 0.07, Math.sin(a) * 0.44));
      }
      const rx = 0.08;
      add(new THREE.CylinderGeometry(0.045, 0.05, 0.32, 10), copper(), rx, 0.23, 0);
      for (const y of [0.15, 0.3]) add(new THREE.CylinderGeometry(0.047, 0.047, 0.02, 10), brass(), rx, y, 0);
      add(new THREE.ConeGeometry(0.045, 0.12, 10), brass(), rx, 0.45, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        add(new THREE.BoxGeometry(0.012, 0.08, 0.06), copper(), rx + Math.cos(a) * 0.05, 0.11, Math.sin(a) * 0.05).rotation.y = -a;
      }
      add(new THREE.CylinderGeometry(0.03, 0.05, 0.62, 6), copper(), -0.15, 0.33, 0);
      add(new THREE.BoxGeometry(0.17, 0.02, 0.03), brass(), (-0.15 + rx) / 2, 0.36, 0);
      const towerLight = add(new THREE.SphereGeometry(0.025, 6, 4), light('#ff4040'), -0.15, 0.68, 0);
      sail(-0.15, 0.5, 0.08, 0.14, 0.18, Math.PI / 2, 2);
      tent(0.02, 0.32, 0.1, 0.16, 1);
      const puff = steam(rx, 0.08, 0, 2.2);
      return (time, dt, fx) => {
        flutter(time);
        const step = Math.floor(time * 6) % beacons.length;
        beacons.forEach((b, i) => (b.material.emissiveIntensity = i === step ? 2.2 : 0.35));
        towerLight.material.emissiveIntensity = Math.sin(time * 3) > 0.2 ? 1.8 : 0.2;
        puff(time, dt, fx);
      };
    }
    case 'batterie': {
      // Batterie de caravane : tourelle de cuivre à blindage de toile, deux canons de laiton.
      add(new THREE.CylinderGeometry(0.4, 0.46, 0.06, 8), m(SAND), 0, 0.03);
      add(new THREE.TorusGeometry(0.3, 0.018, 4, 18), light('#ff4a4a'), 0, 0.08).rotation.x = Math.PI / 2;
      const head = group(0, 0.06, 0);
      part(head, new THREE.CylinderGeometry(0.18, 0.22, 0.16, 10), copper(), 0, 0.08, 0);
      const hood = part(head, new THREE.ConeGeometry(0.24, 0.16, 8, 1, true), cloth(3), 0, 0.24, -0.02);
      hood.castShadow = true;
      const cradle = group(0, 0.12, 0.16, head);
      for (const x of [-0.06, 0.06]) {
        const barrel = part(cradle, new THREE.CylinderGeometry(0.02, 0.028, 0.4, 8), brass(), x, 0, 0.18);
        barrel.rotation.x = Math.PI / 2;
      }
      const eye = part(head, new THREE.SphereGeometry(0.03, 8, 6), light('#ff3030'), 0.1, 0.14, 0.16);
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
