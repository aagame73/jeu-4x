// Empreinte des vaisseaux procéduraux, pour vérifier qu'un remaniement de src/ships.js ne change rien.
// À coller dans la console du navigateur, sur le jeu lancé en développement (npm run dev),
// dans une page fraîchement chargée (les textures sont mises en cache).
// Affiche une empreinte globale et une par espèce : elles doivent rester identiques.
(async () => {
  const { createShip } = await import('/src/ships.js');
  const { SPECIES } = await import('/src/config.js');
  const KINDS = ['arche', 'sonde', 'corvette', 'fregate', 'colonie', 'croiseur', 'transport', 'cuirasse'];
  const SEEDS = [1, 42, 777, 2024, 99991];
  // FNV-1a sur 32 bits
  const hasher = () => {
    let h = 0x811c9dc5;
    return {
      add(n) {
        const v = Math.round(n * 1e4) | 0;
        for (let i = 0; i < 4; i++) {
          h ^= (v >>> (i * 8)) & 0xff;
          h = Math.imul(h, 0x01000193);
        }
      },
      text(s) {
        for (let i = 0; i < s.length; i++) this.add(s.charCodeAt(i));
      },
      get value() {
        return (h >>> 0).toString(16).padStart(8, '0');
      },
    };
  };
  const seenTextures = new Map(); // texture → empreinte (calculée une fois)
  const textureHash = (tex) => {
    if (!tex) return '-';
    if (seenTextures.has(tex)) return seenTextures.get(tex);
    const H = hasher();
    const img = tex.image;
    if (img && img.getContext) {
      const d = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
      H.add(img.width);
      H.add(img.height);
      for (let i = 0; i < d.length; i += 61) H.add(d[i]);
    } else if (img && img.data) {
      for (let i = 0; i < img.data.length; i += 61) H.add(img.data[i]);
    }
    H.add(tex.repeat.x);
    H.add(tex.repeat.y);
    seenTextures.set(tex, H.value);
    return H.value;
  };
  const shipHash = (model, H) => {
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      H.text(o.type);
      for (const e of o.matrixWorld.elements) H.add(e);
      H.add(o.visible ? 1 : 0);
      if (o.geometry) {
        for (const name of Object.keys(o.geometry.attributes).sort()) {
          H.text(name);
          const a = o.geometry.attributes[name].array;
          H.add(a.length);
          for (let i = 0; i < a.length; i += 3) H.add(a[i]);
        }
        if (o.geometry.index) H.add(o.geometry.index.count);
      }
      for (const m of [o.material].flat().filter(Boolean)) {
        H.text(m.type);
        for (const k of ['color', 'emissive']) if (m[k]) H.text(m[k].getHexString());
        for (const k of ['opacity', 'metalness', 'roughness', 'emissiveIntensity', 'side', 'blending']) if (k in m) H.add(m[k] ?? 0);
        H.add(m.transparent ? 1 : 0);
        for (const k of ['map', 'roughnessMap', 'metalnessMap', 'normalMap', 'bumpMap', 'emissiveMap', 'alphaMap']) H.text(textureHash(m[k]));
      }
    });
  };
  const styles = [['origine', null], ...Object.entries(SPECIES).filter(([, s]) => s.shipStyle).map(([k, s]) => [k, s.shipStyle])];
  const total = hasher();
  const parSpecies = {};
  let count = 0;
  for (const [key, style] of styles) {
    const H = hasher();
    for (const kind of KINDS) {
      for (const seed of SEEDS) {
        shipHash(createShip(seed, '#5fd3ff', `R-${seed}`, kind, style), H);
        count++;
      }
    }
    parSpecies[key] = H.value;
    total.text(H.value);
  }
  console.log(`Empreinte de ${count} vaisseaux : ${total.value}`);
  console.table(parSpecies);
  return { total: total.value, count, parSpecies };
})();
