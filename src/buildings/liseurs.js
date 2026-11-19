// Style des Liseurs de Vey : érudits des Veilleurs. Pierre claire, arches et colonnes, coupoles,
// glyphes dorés qui s'allument l'un après l'autre. Chaque bâtiment garde son élément de fonction
// (foreuse, antenne, cheminée…).
import * as THREE from 'three';

const STONE = '#e6dcc4';
const STONE2 = '#d2c6aa';
const GOLD = '#d9b04a';
const GLYPH = '#ffd166';

export function buildLiseurs(type, kit) {
  const { g, add, m, light, every, glow, part, group } = kit;
  const stone = (i = 0, extra = {}) => m(i % 2 ? STONE2 : STONE, { roughness: 0.75, ...extra });
  const gold = (extra = {}) => m(GOLD, { metalness: 0.7, roughness: 0.3, ...extra });
  const glyphs = [];
  // Colonne cannelée avec base et chapiteau.
  const column = (x, z, h, r = 0.03, y = 0) => {
    add(new THREE.BoxGeometry(r * 2.6, 0.02, r * 2.6), stone(1), x, y + 0.01, z);
    add(new THREE.CylinderGeometry(r, r * 1.08, h - 0.04, 10), stone(), x, y + h / 2, z);
    add(new THREE.BoxGeometry(r * 2.6, 0.02, r * 2.6), stone(1), x, y + h - 0.01, z);
  };
  // Arche : deux colonnes et un demi-anneau.
  const arch = (x, z, w, h, rotY = 0, y = 0) => {
    const grp = group(x, y, z);
    grp.rotation.y = rotY;
    for (const side of [-1, 1]) {
      part(grp, new THREE.CylinderGeometry(0.025, 0.028, h, 8), stone(), side * w / 2, h / 2, 0);
    }
    const top = part(grp, new THREE.TorusGeometry(w / 2, 0.025, 6, 14, Math.PI), stone(1), 0, h, 0);
    top.castShadow = true;
    const glyph = part(grp, new THREE.BoxGeometry(0.05, 0.05, 0.01), light(GLYPH, 0.3), 0, h + w / 4, 0.02);
    glyphs.push(glyph);
    return grp;
  };
  // Coupole sur tambour, petite flèche dorée.
  const cupola = (x, z, r, y = 0) => {
    add(new THREE.CylinderGeometry(r, r, r * 0.5, 14), stone(1), x, y + r * 0.25, z);
    add(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), stone(), x, y + r * 0.5, z);
    add(new THREE.ConeGeometry(r * 0.15, r * 0.5, 8), gold(), x, y + r * 1.75, z);
  };
  // Bandeau de glyphes autour d'un cylindre.
  const glyphBand = (x, y, z, r, n = 8) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const gl = add(new THREE.BoxGeometry(0.035, 0.045, 0.008), light(GLYPH, 0.3), x + Math.cos(a) * r, y, z + Math.sin(a) * r);
      gl.rotation.y = -a + Math.PI / 2;
      glyphs.push(gl);
    }
  };
  // Les glyphes s'allument un par un, puis s'éteignent doucement.
  const read = (time) => {
    const n = glyphs.length;
    if (!n) return;
    const cursor = (time * 2.2) % n;
    glyphs.forEach((gl, k) => {
      const d = (cursor - k + n) % n;
      gl.material.emissiveIntensity = 0.25 + Math.max(0, 1.4 - d * 0.5);
    });
  };

  switch (type) {
    case 'centre': {
      // Temple à coupole sur un parvis à degrés, couronne d'arches, flambeau doré.
      add(new THREE.CylinderGeometry(0.6, 0.64, 0.05, 12), stone(1), 0, 0.025);
      add(new THREE.CylinderGeometry(0.5, 0.54, 0.05, 12), stone(), 0, 0.075);
      cupola(0, 0, 0.24, 0.1);
      glyphBand(0, 0.17, 0, 0.245, 10);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        arch(Math.cos(a) * 0.43, Math.sin(a) * 0.43, 0.14, 0.18, -a + Math.PI / 2, 0.1);
      }
      const beacon = add(new THREE.SphereGeometry(0.03, 8, 6), light('#7cff9e'), 0, 0.6, 0);
      const halo = glow(GLYPH, 0, 0.3, 0, 0.7, 0.25);
      return (time) => {
        read(time);
        beacon.visible = Math.sin(time * 3) > 0;
        if (halo) halo.material.opacity = 0.15 + Math.sin(time * 1.2) * 0.08;
      };
    }
    case 'foyer': {
      // Maisons de pierre à petites coupoles, portes dorées.
      for (const [x, z, r, i] of [[-0.2, 0.1, 0.13, 0], [0.22, 0.12, 0.11, 1], [0, -0.22, 0.12, 2]]) {
        add(new THREE.BoxGeometry(r * 2, r * 1.2, r * 2), stone(i), x, r * 0.6, z);
        add(new THREE.SphereGeometry(r * 0.85, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), stone(i + 1), x, r * 1.2, z);
        const door = add(new THREE.BoxGeometry(r * 0.6, r * 0.8, 0.01), light('#ffe08a', 0.6), x, r * 0.4, z + r + 0.005);
        glyphs.push(door);
      }
      return read;
    }
    case 'puits': {
      // Foreuse dans un portique : obélisque-derrick gravé de glyphes.
      add(new THREE.BoxGeometry(0.4, 0.06, 0.4), stone(1), 0, 0.03);
      arch(0, 0.14, 0.26, 0.22, 0, 0.06);
      const ob = add(new THREE.CylinderGeometry(0.03, 0.09, 0.8, 4), stone(), 0, 0.46);
      ob.rotation.y = Math.PI / 4;
      add(new THREE.ConeGeometry(0.045, 0.12, 4), gold(), 0, 0.92).rotation.y = Math.PI / 4;
      for (let k = 0; k < 4; k++) {
        const gl = add(new THREE.BoxGeometry(0.03, 0.04, 0.008), light(GLYPH, 0.3), 0, 0.25 + k * 0.14, 0.075 - k * 0.012);
        glyphs.push(gl);
      }
      const drill = add(new THREE.ConeGeometry(0.05, 0.14, 6), gold(), 0, 0.12);
      drill.rotation.x = Math.PI;
      return (time) => {
        read(time);
        drill.rotation.y = time * 4;
      };
    }
    case 'fonderie': {
      // Fonderie-atelier sous voûte, cheminée en colonne, coulée dorée.
      add(new THREE.BoxGeometry(0.5, 0.24, 0.32), stone(), -0.05, 0.12);
      const vault = add(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 12, 1, false, 0, Math.PI), stone(1), -0.05, 0.24, 0);
      vault.rotation.z = Math.PI / 2;
      column(0.22, -0.14, 0.66, 0.045);
      add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), light('#ff6a1a'), 0.22, 0.67, -0.14);
      const mouth = add(new THREE.BoxGeometry(0.12, 0.12, 0.01), light('#ff8a3a', 1.1), -0.05, 0.09, 0.165);
      add(new THREE.BoxGeometry(0.34, 0.04, 0.09), stone(1), -0.12, 0.02, 0.27);
      const pour = add(new THREE.BoxGeometry(0.3, 0.012, 0.05), light('#ff8a3a'), -0.12, 0.045, 0.27);
      for (const x of [-0.24, -0.12, 0]) add(new THREE.BoxGeometry(0.07, 0.035, 0.05), m('#9fb4c8', { metalness: 0.8, roughness: 0.25 }), x, 0.018, 0.38);
      const smoke = every(0.9, (fx) => fx.puff(g, 0.22, 0.7, -0.14, '#8a8478'));
      return (time, dt, fx) => {
        mouth.material.emissiveIntensity = 1 + Math.sin(time * 5) * 0.3;
        pour.material.emissiveIntensity = 0.7 + Math.sin(time * 6) * 0.25;
        smoke(time, dt, fx);
      };
    }
    case 'pompe': {
      // Plateforme à colonnade, tour-obélisque, réservoir dans une vasque dorée.
      add(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 12), stone(1), 0, 0.12);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        column(Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0.12, 0.02);
      }
      const ob = add(new THREE.CylinderGeometry(0.025, 0.07, 0.6, 4), stone(), -0.16, 0.45, -0.08);
      ob.rotation.y = Math.PI / 4;
      const tank = add(new THREE.SphereGeometry(0.15, 14, 10), m('#5fe3ff', { emissive: '#1a8aa8', emissiveIntensity: 0.5, roughness: 0.25, metalness: 0.3 }), 0.14, 0.32, 0.08);
      add(new THREE.CylinderGeometry(0.17, 0.09, 0.08, 14), gold(), 0.14, 0.19, 0.08);
      const beacon = add(new THREE.SphereGeometry(0.025, 6, 4), light('#5fe3ff'), -0.16, 0.78, -0.08);
      return (time) => {
        beacon.visible = Math.sin(time * 2.5) > -0.2;
        tank.material.emissiveIntensity = 0.45 + Math.sin(time * 1.5) * 0.2;
      };
    }
    case 'captage': {
      // Bassin sacré cerclé de colonnes, fontaine dorée.
      add(new THREE.TorusGeometry(0.3, 0.035, 6, 24), stone(1), -0.08, 0.04, 0.05).rotation.x = Math.PI / 2;
      const pool = add(new THREE.CircleGeometry(0.28, 24), m('#4aa8ff', { emissive: '#0a2a55', roughness: 0.1 }), -0.08, 0.05, 0.05);
      pool.rotation.x = -Math.PI / 2;
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        column(-0.08 + Math.cos(a) * 0.36, 0.05 + Math.sin(a) * 0.36, 0.22, 0.022);
      }
      cupola(0.3, -0.22, 0.1);
      return (time) => (pool.rotation.z = time * 0.4);
    }
    case 'fouille': {
      // Fouille sous une grande arche ; le lecteur déchiffre : glyphes qui s'allument, relique.
      add(new THREE.CylinderGeometry(0.2, 0.16, 0.03, 12), m('#6a5a44'), 0.05, 0.015, 0.05);
      const relic = add(new THREE.OctahedronGeometry(0.05), light('#ffd166'), 0.05, 0.08, 0.05);
      arch(0.05, -0.15, 0.4, 0.34, 0);
      for (const [x, z] of [[-0.32, 0.2], [0.38, 0.22]]) {
        const fallen = add(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 8), stone(), x, 0.03, z);
        fallen.rotation.z = Math.PI / 2;
        fallen.rotation.y = x * 3;
      }
      const stele = add(new THREE.BoxGeometry(0.12, 0.22, 0.03), stone(1), -0.3, 0.11, -0.2);
      stele.rotation.y = 0.5;
      for (let k = 0; k < 3; k++) {
        const gl = add(new THREE.BoxGeometry(0.03, 0.035, 0.008), light(GLYPH, 0.3), -0.3 + Math.sin(0.5) * 0.017, 0.17 - k * 0.05, -0.2 + Math.cos(0.5) * 0.017);
        gl.rotation.y = 0.5;
        glyphs.push(gl);
      }
      const halo = glow('#ffd166', 0.05, 0.12, 0.05, 0.45, 0.6);
      return (time) => {
        read(time);
        relic.rotation.y = time * 1.5;
        const p = 0.5 + Math.sin(time * 2.2) * 0.5;
        relic.material.emissiveIntensity = 0.5 + p * 0.8;
        if (halo) halo.material.opacity = 0.3 + p * 0.45;
      };
    }
    case 'centrale': {
      // Rotonde à colonnes autour d'un foyer d'énergie, anneau doré qui pulse.
      add(new THREE.CylinderGeometry(0.3, 0.34, 0.06, 12), stone(1), -0.1, 0.03);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        column(-0.1 + Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.42, 0.022, 0.06);
      }
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), stone(), -0.1, 0.5);
      add(new THREE.SphereGeometry(0.26, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), stone(1), -0.1, 0.52).scale.y = 0.5;
      const core = add(new THREE.SphereGeometry(0.08, 12, 8), light('#ffd166', 1.2), -0.1, 0.24);
      const ring = add(new THREE.TorusGeometry(0.13, 0.015, 4, 18), light('#ffd166'), -0.1, 0.24);
      ring.rotation.x = Math.PI / 2;
      add(new THREE.BoxGeometry(0.2, 0.16, 0.18), stone(), 0.3, 0.08, 0.18);
      return (time) => {
        core.material.emissiveIntensity = 1 + Math.sin(time * 3) * 0.4;
        ring.material.emissiveIntensity = 0.6 + Math.sin(time * 4) * 0.4;
        ring.rotation.z = time;
      };
    }
    case 'solaire': {
      // Miroirs dorés sur stèles, comme des pages ouvertes vers le soleil.
      for (const [x, z, i] of [[-0.22, -0.2, 0], [0.22, -0.2, 1], [-0.22, 0.2, 2], [0.22, 0.2, 3]]) {
        add(new THREE.BoxGeometry(0.06, 0.12, 0.06), stone(i), x, 0.06, z);
        const page = add(new THREE.BoxGeometry(0.32, 0.015, 0.26), m('#2a3f7a', { metalness: 0.6, roughness: 0.2, emissive: '#0a1a3a' }), x, 0.14, z);
        page.rotation.x = -0.45;
        const frame = add(new THREE.BoxGeometry(0.34, 0.008, 0.28), gold(), x, 0.133, z);
        frame.rotation.x = -0.45;
      }
      return null;
    }
    case 'serre': {
      // Jardin clos sous coupole de verre à nervures dorées, bordé de colonnes.
      add(new THREE.CylinderGeometry(0.48, 0.5, 0.05, 16), stone(1), 0, 0.025);
      add(new THREE.SphereGeometry(0.34, 12, 6), m('#5fbf6a', { emissive: '#103a14' }), 0, 0.03).scale.y = 0.5;
      for (let k = 0; k < 4; k++) {
        const rib = add(new THREE.TorusGeometry(0.44, 0.01, 3, 16, Math.PI), gold(), 0, 0.05, 0);
        rib.rotation.y = (k / 4) * Math.PI;
      }
      add(new THREE.SphereGeometry(0.44, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m('#fff4dc', { transparent: true, opacity: 0.22, roughness: 0.1 }), 0, 0.05);
      add(new THREE.ConeGeometry(0.035, 0.12, 8), gold(), 0, 0.55);
      return null;
    }
    case 'ferme': {
      // Bassin à margelle de pierre, filets qui tournent, petite fontaine.
      add(new THREE.TorusGeometry(0.4, 0.05, 6, 24), stone(1), 0, 0.06).rotation.x = Math.PI / 2;
      const nets = group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const net = part(nets, new THREE.BoxGeometry(0.22, 0.03, 0.1), m('#4fae5a', { emissive: '#0a3010' }), Math.cos(a) * 0.2, 0.06, Math.sin(a) * 0.2);
        net.rotation.y = -a;
      }
      column(0, 0, 0.16, 0.025);
      add(new THREE.CylinderGeometry(0.07, 0.03, 0.03, 10), gold(), 0, 0.17);
      return (time) => (nets.rotation.y = time * 0.3);
    }
    case 'laboratoire': {
      // Bibliothèque-observatoire : bâtiment à colonnade, coupole, astrolabe doré qui tourne.
      add(new THREE.BoxGeometry(0.5, 0.05, 0.42), stone(1), -0.04, 0.025);
      add(new THREE.BoxGeometry(0.4, 0.2, 0.32), stone(), -0.06, 0.15);
      for (let k = 0; k < 4; k++) column(-0.22 + k * 0.1, 0.19, 0.2, 0.016, 0.05);
      cupola(-0.06, -0.02, 0.12, 0.25);
      for (let k = 0; k < 5; k++) glyphs.push(add(new THREE.BoxGeometry(0.03, 0.04, 0.008), light(GLYPH, 0.3), -0.2 + k * 0.07, 0.2, 0.165));
      add(new THREE.CylinderGeometry(0.015, 0.02, 0.36, 6), gold(), 0.24, 0.18, 0.14);
      const head = group(0.24, 0.44, 0.14);
      for (let k = 0; k < 3; k++) {
        const ring = part(head, new THREE.TorusGeometry(0.1 - k * 0.02, 0.008, 4, 20), gold(), 0, 0, 0);
        ring.rotation.set(k * 0.9, k * 0.5, 0);
      }
      const tip = part(head, new THREE.SphereGeometry(0.02, 6, 4), light(GLYPH, 1.2), 0, 0, 0);
      const halo = glow(GLYPH, -0.06, 0.3, 0, 0.45, 0.3);
      return (time) => {
        read(time);
        head.rotation.y = time * 0.45 + Math.sin(time * 0.9) * 0.4;
        head.children.forEach((r, k) => (r.rotation.x = time * (0.5 + k * 0.3)));
        tip.visible = Math.sin(time * 4) > -0.4;
        if (halo) halo.material.opacity = 0.15 + (0.5 + Math.sin(time * 2) * 0.5) * 0.25;
      };
    }
    case 'siphon': {
      // Trois colonnes en triangle portent un linteau ; la Vélarine flotte au centre.
      add(new THREE.CylinderGeometry(0.26, 0.3, 0.06, 12), stone(1), 0, 0.03);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        column(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.6, 0.03, 0.06);
      }
      add(new THREE.TorusGeometry(0.2, 0.025, 4, 3), stone(), 0, 0.68, 0).rotation.x = Math.PI / 2;
      const crystal = add(new THREE.OctahedronGeometry(0.11), light('#c77dff'), 0, 0.4);
      crystal.scale.y = 1.6;
      return (time) => {
        crystal.rotation.y = time;
        crystal.position.y = 0.4 + Math.sin(time * 2) * 0.04;
      };
    }
    case 'spatioport': {
      // Esplanade de pierre, portique d'arches, tour-obélisque, fusée blanche et dorée.
      add(new THREE.CylinderGeometry(0.5, 0.54, 0.06, 6), stone(1), 0, 0.03);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.012, 6), gold(), 0.08, 0.066);
      add(new THREE.CylinderGeometry(0.27, 0.27, 0.014, 6), stone(), 0.08, 0.068);
      const beacons = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        beacons.push(add(new THREE.SphereGeometry(0.022, 6, 4), light('#ffb347'), Math.cos(a) * 0.44, 0.075, Math.sin(a) * 0.44));
      }
      const rx = 0.08;
      add(new THREE.CylinderGeometry(0.04, 0.05, 0.32, 10), m('#f6f0e2', { roughness: 0.4 }), rx, 0.24, 0);
      add(new THREE.CylinderGeometry(0.042, 0.042, 0.04, 10), gold(), rx, 0.3, 0);
      add(new THREE.ConeGeometry(0.04, 0.12, 10), gold(), rx, 0.46, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        add(new THREE.BoxGeometry(0.012, 0.08, 0.06), stone(1), rx + Math.cos(a) * 0.05, 0.12, Math.sin(a) * 0.05).rotation.y = -a;
      }
      const ob = add(new THREE.CylinderGeometry(0.025, 0.07, 0.62, 4), stone(), -0.15, 0.37, 0);
      ob.rotation.y = Math.PI / 4;
      add(new THREE.BoxGeometry(0.17, 0.02, 0.03), gold(), (-0.15 + rx) / 2, 0.36, 0);
      const towerLight = add(new THREE.SphereGeometry(0.025, 6, 4), light('#ff4040'), -0.15, 0.71, 0);
      arch(0.02, 0.32, 0.18, 0.16, 0);
      return (time) => {
        read(time);
        const step = Math.floor(time * 6) % beacons.length;
        beacons.forEach((b, i) => (b.material.emissiveIntensity = i === step ? 2.2 : 0.35));
        towerLight.material.emissiveIntensity = Math.sin(time * 3) > 0.2 ? 1.8 : 0.2;
      };
    }
    case 'batterie': {
      // Tour de garde ronde à coupole qui pivote, deux canons dorés.
      add(new THREE.CylinderGeometry(0.4, 0.46, 0.08, 12), stone(1), 0, 0.04);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        column(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.14, 0.02, 0.08);
      }
      add(new THREE.TorusGeometry(0.3, 0.018, 4, 18), light('#ff4a4a'), 0, 0.1).rotation.x = Math.PI / 2;
      const head = group(0, 0.08, 0);
      part(head, new THREE.CylinderGeometry(0.18, 0.2, 0.14, 14), stone(), 0, 0.07, 0);
      part(head, new THREE.SphereGeometry(0.18, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), stone(1), 0, 0.14, 0);
      const cradle = group(0, 0.12, 0.14, head);
      for (const x of [-0.06, 0.06]) {
        const barrel = part(cradle, new THREE.CylinderGeometry(0.02, 0.026, 0.4, 8), gold(), x, 0, 0.18);
        barrel.rotation.x = Math.PI / 2;
      }
      const eye = part(head, new THREE.SphereGeometry(0.03, 8, 6), light('#ff3030'), 0.1, 0.2, 0.14);
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
