// Réglages du prototype. Les distances sont en années-lumière (al).
export const CONFIG = {
  starCount: 140,
  clusterRadius: 100,
  minStarSpacing: 7,
  jumpRange: 22, // portée de saut d'une sonde
  sensorRange: 28, // rayon dans lequel une sonde repère des lueurs
  probeSpeed: 2, // al parcourues par jour
  currentSpeedFactor: 5, // un courant gravitationnel multiplie la vitesse
  analyseDays: 10, // jours pour connaître la composition d'un système
  secondsPerDay: 1, // durée d'un jour à la vitesse x1
  speeds: [1, 2, 4],
  ruinCount: 9,
  extraCurrents: 8,
};

// Espèces jouables (voir docs/plan-especes.md). Données pures : la logique est dans species.js.
// bonuses : multiplicateurs (1 = neutre), clés possibles : minerais, alliages, biomasse, eau, deuterium,
// energie, recherche, growth, shipSpeed, shipDefense, shipLifespan, shipAttack, shipyardTime,
// colonyDefense, fuel, digSpeed, veilleursTechCost (branche Xéno-archéologie et technologies à artefacts) ;
// digArtefacts : artefacts ajoutés à chaque fouille terminée (additif, 0 par défaut).
// habitat : types de planètes favorables / hostiles ('lune' = toute lune habitable) ;
// favoredTerrains : terrains d'hexagones qui produisent +25 % ; shipStyle : paramètres de ships.js.
export const SPECIES = {
  vaskhar: {
    label: 'Vaskhar',
    lore: 'Grands invertébrés à carapace minérale, ils digèrent la roche et creusent leurs cités dans le basalte.',
    strength: 'Minerais +25 %',
    weakness: 'Croissance de la population −20 %',
    bonuses: { minerais: 1.25, growth: 0.8 },
    habitat: { favored: ['volcanique', 'desertique'], hostile: ['oceanique'] },
    favoredTerrains: ['volcanique', 'desert'],
    accent: '#ffb347',
    arkName: 'Arche Basalte',
    shipStyle: { hullTones: ['#8b5a3c', '#a0522d', '#7a5c44'], segments: [5, 6], profile: 'massif', wings: { ailes: 1, ailerons: 3, anneau: 0, panneaux: 1 }, armor: 0.8, organic: 0, crystals: 0, sails: 0, pods: 0.6, engineGlow: '#ff8a3a' },
  },
  ondesiens: {
    label: 'Ondésiens',
    lore: 'Colonies de méduses géantes reliées par des filaments lumineux, nées dans les océans chauds.',
    strength: 'Biomasse et eau +25 %',
    weakness: 'Alliages −20 %',
    bonuses: { biomasse: 1.25, eau: 1.25, alliages: 0.8 },
    habitat: { favored: ['oceanique', 'marecageuse'], hostile: ['volcanique'] },
    favoredTerrains: ['ocean', 'marais'],
    accent: '#5fd3ff',
    arkName: 'Arche Marée',
    shipStyle: { hullTones: ['#6fb7c9', '#4f9fb0', '#8fd0d8'], segments: [12, 16], profile: 'bombe', wings: { ailes: 0, ailerons: 0, anneau: 4, panneaux: 0 }, armor: 0, organic: 0.9, crystals: 0, sails: 0, pods: 0.3, engineGlow: '#5fe3ff' },
  },
  keltirr: {
    label: 'Kel-Tirr',
    lore: 'Petits êtres à plumes vivant en essaims, vifs et curieux, toujours en mouvement.',
    strength: 'Vitesse des vaisseaux +25 %, chantier spatial 15 % plus rapide',
    weakness: 'Défense et durée de vie des vaisseaux −20 %',
    bonuses: { shipSpeed: 1.25, shipyardTime: 0.85, shipDefense: 0.8, shipLifespan: 0.8 },
    habitat: { favored: ['tempere', 'marecageuse'], hostile: ['glacee'] },
    favoredTerrains: ['plaine', 'foret'],
    accent: '#fff07a',
    arkName: 'Arche Volée',
    shipStyle: { hullTones: ['#e8e2d0', '#d6d2c8', '#f0ead8'], segments: [6, 8], profile: 'effile', wings: { ailes: 5, ailerons: 1, anneau: 0, panneaux: 0 }, armor: 0, organic: 0.2, crystals: 0, sails: 0, pods: 0.1, engineGlow: '#fff07a' },
  },
  synodes: {
    label: 'Synodes',
    lore: 'Champignons en réseau qui pensent ensemble ; chaque colonie est un seul esprit aux milliers de corps.',
    strength: 'Recherche +25 %',
    weakness: 'Minerais −20 %',
    bonuses: { recherche: 1.25, minerais: 0.8 },
    habitat: { favored: ['marecageuse', 'toxique'], hostile: ['desertique'] },
    favoredTerrains: ['marais', 'toxique'],
    accent: '#c6a0ff',
    arkName: 'Arche Mycélium',
    shipStyle: { hullTones: ['#8a7aa8', '#6f6390', '#a596c0'], segments: [8, 10], profile: 'modulaire', wings: { ailes: 0, ailerons: 1, anneau: 1, panneaux: 2 }, armor: 0.1, organic: 0.5, crystals: 0, sails: 0, pods: 1, engineGlow: '#c6a0ff' },
  },
  orrhaides: {
    label: 'Orrhaïdes',
    lore: "Cristaux vivants nourris de lumière et de chaleur ; ils chantent quand une étoile se lève.",
    strength: 'Énergie +25 %',
    weakness: 'Biomasse −25 %',
    bonuses: { energie: 1.25, biomasse: 0.75 },
    habitat: { favored: ['glacee', 'desertique'], hostile: ['marecageuse'] },
    favoredTerrains: ['glace', 'desert'],
    accent: '#cfe8ff',
    arkName: 'Arche Prisme',
    shipStyle: { hullTones: ['#dce8f2', '#c8d8e8', '#eef4fa'], segments: [5, 6], profile: 'effile', wings: { ailes: 1, ailerons: 2, anneau: 0, panneaux: 1 }, armor: 0, organic: 0, crystals: 0.9, sails: 0, pods: 0.2, engineGlow: '#bfe8ff' },
  },
  thrennes: {
    label: 'Thrennes',
    lore: 'Reptiles à six membres, à la culture guerrière ritualisée : chaque victoire se grave sur leurs coques.',
    strength: 'Attaque des vaisseaux et défense des colonies +25 %, alliages +15 %',
    weakness: 'Recherche −20 %',
    bonuses: { shipAttack: 1.25, colonyDefense: 1.25, alliages: 1.15, recherche: 0.8 },
    habitat: { favored: ['volcanique', 'toxique'], hostile: ['tempere'] },
    favoredTerrains: ['volcanique', 'toxique'],
    accent: '#ff6f6f',
    arkName: 'Arche Serment',
    shipStyle: { hullTones: ['#3a3236', '#4a3a3a', '#2e2a30'], segments: [4, 6], profile: 'massif', wings: { ailes: 2, ailerons: 3, anneau: 0, panneaux: 0 }, armor: 1, organic: 0, crystals: 0, sails: 0, pods: 0.3, engineGlow: '#ff5040' },
  },
  liseurs: {
    label: 'Liseurs de Vey',
    lore: 'Êtres longilignes qui vénèrent les Veilleurs ; ils déchiffrent leurs glyphes depuis des siècles.',
    strength: 'Fouilles 2× plus rapides (+1 artefact chacune), technologies des Veilleurs −30 %',
    weakness: 'Énergie −15 %',
    bonuses: { digSpeed: 2, digArtefacts: 1, veilleursTechCost: 0.7, energie: 0.85 },
    habitat: { favored: ['glacee', 'tempere'], hostile: ['toxique'] },
    favoredTerrains: ['glace', 'ruines'],
    accent: '#ffd166',
    arkName: 'Arche Glyphe',
    shipStyle: { hullTones: ['#c9b79c', '#d8c49a', '#b8a888'], segments: [8, 10], profile: 'effile', wings: { ailes: 1, ailerons: 0, anneau: 1, panneaux: 1 }, armor: 0, organic: 0.2, crystals: 0.2, sails: 1, pods: 0.1, engineGlow: '#ffd166' },
  },
  ashkari: {
    label: 'Ashkari',
    lore: 'Nomades des géantes gazeuses, marchands et pilotes ; leurs familles vivent à bord depuis toujours.',
    strength: 'Deutérium +25 %, sauts −25 % de carburant',
    weakness: 'Défense des colonies −20 %, minerais −10 %',
    bonuses: { deuterium: 1.25, fuel: 0.75, colonyDefense: 0.8, minerais: 0.9 },
    habitat: { favored: ['oceanique', 'lune'], hostile: ['volcanique'] },
    favoredTerrains: ['ocean', 'glace'],
    accent: '#e0a070',
    arkName: 'Arche Caravane',
    shipStyle: { hullTones: ['#b07850', '#9a6a48', '#c08a60'], segments: [6, 8], profile: 'modulaire', wings: { ailes: 0, ailerons: 1, anneau: 1, panneaux: 2 }, armor: 0.3, organic: 0, crystals: 0, sails: 0, pods: 1, engineGlow: '#ffb070' },
  },
  // Profil neutre des parties commencées avant le choix d'espèce : aucun bonus, vaisseaux d'origine.
  'sans-espece': {
    label: "Colons de l'Arche",
    lore: "Les colons partis avant que l'on ne choisisse son espèce.",
    strength: 'Aucune',
    weakness: 'Aucune',
    bonuses: {},
    habitat: { favored: [], hostile: [] },
    favoredTerrains: [],
    accent: '#7cff9e',
    arkName: null, // garde le nom tiré au hasard
    shipStyle: null, // générateur d'origine
    hidden: true, // absent de l'écran de choix
  },
};
export const DEFAULT_SPECIES = 'sans-espece';
