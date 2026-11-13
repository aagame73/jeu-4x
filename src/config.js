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
// habitat : types de planètes favorables (un type riche + un type rude) / hostiles ('lune' = toute lune habitable) ;
// favoredTerrains : terrains d'hexagones qui produisent +25 % (environ 15 à 25 % des cases de l'amas) ; shipStyle : paramètres de ships.js.
// empire, empireColor : nom et couleur de l'empire quand l'espèce est une rivale (couleurs bien distinctes, à côté de celles de l'interface).
export const SPECIES = {
  vaskhar: {
    label: 'Vaskhar',
    empire: 'Hégémonie vaskhar',
    empireColor: '#ffa030',
    lore: 'Grands invertébrés à carapace minérale, ils digèrent la roche et creusent leurs cités dans le basalte.',
    strength: 'Minerais +20 %',
    weakness: 'Croissance de la population −20 %, recherche −15 %',
    bonuses: { minerais: 1.2, growth: 0.8, recherche: 0.85 },
    habitat: { favored: ['volcanique', 'tempere'], hostile: ['oceanique'] },
    favoredTerrains: ['volcanique'], // un seul terrain : le volcanique est riche en minerais
    accent: '#ffb347',
    arkName: 'Arche Basalte',
    shipStyle: { hullTones: ['#8b5a3c', '#a0522d', '#7a5c44'], segments: [5, 6], profile: 'massif', armor: 0.8, organic: 0, crystals: 0, sails: 0, pods: 0.6, engineGlow: '#ff8a3a' },
  },
  ondesiens: {
    label: 'Ondésiens',
    empire: 'Confluence ondésienne',
    empireColor: '#38d6ff',
    lore: 'Colonies de méduses géantes reliées par des filaments lumineux, nées dans les océans chauds.',
    strength: 'Biomasse +25 %, eau +10 %',
    weakness: 'Alliages −20 %',
    bonuses: { biomasse: 1.25, eau: 1.1, alliages: 0.8 },
    habitat: { favored: ['oceanique', 'glacee'], hostile: ['volcanique'] }, // océans sous la glace
    favoredTerrains: ['ocean'],
    accent: '#5fd3ff',
    arkName: 'Arche Marée',
    shipStyle: { hullTones: ['#6fb7c9', '#4f9fb0', '#8fd0d8'], segments: [12, 16], profile: 'bombe', armor: 0, organic: 0.9, crystals: 0, sails: 0, pods: 0.3, engineGlow: '#5fe3ff' },
  },
  keltirr: {
    label: 'Kel-Tirr',
    empire: 'Ligue des Vents kel-tirr',
    empireColor: '#c8f04a',
    lore: 'Petits êtres à plumes vivant en essaims, vifs et curieux, toujours en mouvement.',
    strength: 'Vitesse des vaisseaux +25 %, chantier spatial 15 % plus rapide',
    weakness: 'Défense et durée de vie des vaisseaux −20 %',
    bonuses: { shipSpeed: 1.25, shipyardTime: 0.85, shipDefense: 0.8, shipLifespan: 0.8 },
    habitat: { favored: ['tempere', 'desertique'], hostile: ['glacee'] },
    favoredTerrains: ['foret', 'marais'],
    accent: '#fff07a',
    arkName: 'Arche Volée',
    shipStyle: { hullTones: ['#e8e2d0', '#d6d2c8', '#f0ead8'], segments: [6, 8], profile: 'effile', armor: 0, organic: 0.2, crystals: 0, sails: 0, pods: 0.1, engineGlow: '#fff07a' },
  },
  synodes: {
    label: 'Synodes',
    empire: 'Grand Synode',
    empireColor: '#b478ff',
    lore: 'Champignons en réseau qui pensent ensemble ; chaque colonie est un seul esprit aux milliers de corps.',
    strength: 'Recherche +25 %',
    weakness: 'Minerais −20 %',
    bonuses: { recherche: 1.25, minerais: 0.8 },
    habitat: { favored: ['marecageuse', 'volcanique'], hostile: ['desertique'] }, // réseaux nourris par la chaleur des volcans
    favoredTerrains: ['marais', 'toxique', 'foret'],
    accent: '#c6a0ff',
    arkName: 'Arche Mycélium',
    shipStyle: { hullTones: ['#8a7aa8', '#6f6390', '#a596c0'], segments: [8, 10], profile: 'modulaire', armor: 0.1, organic: 0.5, crystals: 0, sails: 0, pods: 1, engineGlow: '#c6a0ff' },
  },
  orrhaides: {
    label: 'Orrhaïdes',
    empire: 'Concordat orrhaïde',
    empireColor: '#ff5cc8',
    lore: "Cristaux vivants nourris de lumière et de chaleur ; ils chantent quand une étoile se lève.",
    strength: 'Énergie +25 %',
    weakness: 'Biomasse −25 %',
    bonuses: { energie: 1.25, biomasse: 0.75 },
    habitat: { favored: ['desertique', 'oceanique'], hostile: ['marecageuse'] }, // dunes et récifs cristallins
    favoredTerrains: ['desert'],
    accent: '#cfe8ff',
    arkName: 'Arche Prisme',
    shipStyle: { hullTones: ['#dce8f2', '#c8d8e8', '#eef4fa'], segments: [5, 6], profile: 'effile', armor: 0, organic: 0, crystals: 0.9, sails: 0, pods: 0.2, engineGlow: '#bfe8ff' },
  },
  thrennes: {
    label: 'Thrennes',
    empire: 'Serment threnne',
    empireColor: '#e8483c',
    lore: 'Reptiles à six membres, à la culture guerrière ritualisée : chaque victoire se grave sur leurs coques.',
    strength: 'Attaque des vaisseaux et défense des colonies +25 %, alliages +25 %',
    weakness: 'Recherche −15 %',
    bonuses: { shipAttack: 1.25, colonyDefense: 1.25, alliages: 1.25, recherche: 0.85 },
    habitat: { favored: ['marecageuse', 'volcanique'], hostile: ['glacee'] }, // reptiles à sang froid
    favoredTerrains: ['volcanique', 'marais'],
    accent: '#ff6f6f',
    arkName: 'Arche Serment',
    shipStyle: { hullTones: ['#3a3236', '#4a3a3a', '#2e2a30'], segments: [4, 6], profile: 'massif', armor: 1, organic: 0, crystals: 0, sails: 0, pods: 0.3, engineGlow: '#ff5040' },
  },
  liseurs: {
    label: 'Liseurs de Vey',
    empire: 'Archive de Vey',
    empireColor: '#2fe890',
    lore: 'Êtres longilignes qui vénèrent les Veilleurs ; ils déchiffrent leurs glyphes depuis des siècles.',
    strength: 'Fouilles 2× plus rapides (+1 artefact chacune), technologies des Veilleurs −30 %',
    weakness: 'Énergie −15 %',
    bonuses: { digSpeed: 2, digArtefacts: 1, veilleursTechCost: 0.7, energie: 0.85 },
    habitat: { favored: ['glacee', 'tempere'], hostile: ['toxique'] },
    favoredTerrains: ['glace', 'ruines'],
    accent: '#ffd166',
    arkName: 'Arche Glyphe',
    shipStyle: { hullTones: ['#c9b79c', '#d8c49a', '#b8a888'], segments: [8, 10], profile: 'effile', armor: 0, organic: 0.2, crystals: 0.2, sails: 1, pods: 0.1, engineGlow: '#ffd166' },
  },
  ashkari: {
    label: 'Ashkari',
    empire: 'Caravane ashkari',
    empireColor: '#4f7dff',
    lore: 'Nomades des géantes gazeuses, marchands et pilotes ; leurs familles vivent à bord depuis toujours.',
    strength: 'Deutérium +25 %, sauts −25 % de carburant',
    weakness: 'Défense des colonies −20 %, biomasse −10 %',
    bonuses: { deuterium: 1.25, fuel: 0.75, colonyDefense: 0.8, biomasse: 0.9 },
    habitat: { favored: ['desertique', 'tempere'], hostile: ['volcanique'] }, // peuple de caravanes
    favoredTerrains: ['ocean', 'glace'],
    accent: '#e0a070',
    arkName: 'Arche Caravane',
    shipStyle: { hullTones: ['#b07850', '#9a6a48', '#c08a60'], segments: [6, 8], profile: 'modulaire', armor: 0.3, organic: 0, crystals: 0, sails: 0, pods: 1, engineGlow: '#ffb070' },
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

// Nombre d'empires rivaux, choisi sur l'écran de nouvelle partie.
export const RIVALS = { min: 3, max: 7, default: 4 };
// Rivaux du profil neutre : les 4 premiers sont ceux des parties d'avant le choix d'espèce.
export const NEUTRAL_RIVALS = ['vaskhar', 'ondesiens', 'keltirr', 'synodes', 'orrhaides', 'thrennes', 'liseurs'];

// Diplomatie (diplomacy.js). Note de -100 à 100 envers le joueur ; attitudes de la plus haute à la plus basse.
export const DIPLOMACY = {
  attitudes: [
    { key: 'allie', label: 'Allié', min: 60 },
    { key: 'amical', label: 'Amical', min: 20 },
    { key: 'neutre', label: 'Neutre', min: -19 },
    { key: 'mefiant', label: 'Méfiant', min: -59 },
    { key: 'hostile', label: 'Hostile', min: -100 },
  ],
  rivalries: [['vaskhar', 'ondesiens'], ['keltirr', 'orrhaides'], ['synodes', 'thrennes'], ['liseurs', 'vaskhar'], ['ashkari', 'keltirr']],
  startRelation: { ondesiens: 20, ashkari: 15, synodes: 5, liseurs: 5, orrhaides: 0, vaskhar: 0, keltirr: -15, thrennes: -20 },
  returnPerDay: 0.003, // part de l'écart à la note de départ rattrapée chaque jour
  proximityRange: 30, // al : une colonie du joueur à cette distance d'un empire le gêne
  proximityPerColony: 0.02, // points perdus par jour et par colonie proche
  proximityMax: 0.1,
  digReaction: { ondesiens: -6, orrhaides: -6, synodes: 4, liseurs: 4 }, // par artefact fouillé
  // Stocks simulés des rivaux, par colonie : gain par jour (× bonus de l'espèce) et plafond.
  // Les artefacts ne viennent que des colonies sur des ruines. L'énergie ne se transporte pas.
  stockPerDay: { minerais: 0.5, alliages: 0.2, biomasse: 0.4, eau: 0.4, deuterium: 0.3, velarine: 0.002, artefacts: 0.005 },
  stockCap: { minerais: 150, alliages: 60, biomasse: 120, eau: 120, deuterium: 80, velarine: 1, artefacts: 2 },
  stockStart: 0.25, // part du plafond possédée au départ
  // Technologies simulées : nombre connu = puissance × techPerPower, palier ouvert selon la puissance.
  techPerPower: 0.5,
  techTierPower: [0, 10, 30, 60], // puissance requise pour les paliers 1 à 4
  // Échanges. Valeur d'une unité de matière, modulée par la rareté chez l'empire (× 0,5 à × 1,5).
  values: { minerais: 1, alliages: 3, biomasse: 1, eau: 1, deuterium: 2, velarine: 25, artefacts: 40 },
  scarcity: { full: 0.5, empty: 1.5 }, // facteur de valeur : stock plein → full, stock vide → empty
  techValue: 2, // valeur d'une technologie = coût × techValue
  mapValuePerColony: 15, // valeur d'une carte, par colonie révélée
  // L'empire accepte si ce qu'il reçoit vaut au moins ce qu'il donne × ce facteur ; hostile : il refuse tout.
  // Jamais moins de marginFloor : sinon des allers-retours rapporteraient des matières gratuites.
  margin: { allie: 1, amical: 1.05, neutre: 1.2, mefiant: 1.6 },
  tradeFactor: { ondesiens: 0.95, ashkari: 0.95, thrennes: 1.1, keltirr: 1.1 }, // ouverture au commerce selon l'espèce
  marginFloor: 1,
  techDelay: 200, // jours entre deux échanges de technologies avec un même empire
  mapDelay: 500, // jours entre deux ventes de carte à un même empire
  soldTechPower: 1, // puissance gagnée par un empire qui reçoit une technologie
  closedTier: 4, // ce palier ne s'échange pas
  rareValue: 25, // à partir de cette valeur, l'écran compte la matière à l'unité
  inputSteps: [10, 100], // pas des boutons − et + (avec Maj)
  tradeGainPerValue: 0.05, // note gagnée par unité de valeur donnée en plus du nécessaire
  generosityMin: 0.1, // il faut donner au moins 10 % de plus que nécessaire pour gagner de la note
  tradeGainMax: 8,
  rivalPenaltyPerValue: 0.02, // note perdue auprès des rivaux du partenaire
  rivalPenaltyMin: 1,
  rivalPenaltyMax: 15,
  // Traités : valeur (prix à payer à l'empire), durée, attitude minimale, zone protégée autour des colonies du joueur.
  treaties: {
    frontieres: { label: 'Traité de frontières', value: 150, days: 1000, minRelation: -19, range: 25 },
    ruines: { label: 'Pacte de ruines', value: 250, days: 1000, minRelation: 20, range: 40 },
  },
  // Propositions des rivaux rencontrés (et non hostiles) : environ une tous les proposalEvery jours, valable proposalDays jours.
  proposalEvery: 100,
  proposalDays: 60,
  proposalShare: 0.25, // part de son stock que le rival demande au joueur
  proposalMin: 10,
  proposalMax: 200,
  proposalMaterials: ['minerais', 'alliages', 'biomasse', 'eau', 'deuterium'], // la Vélarine et les artefacts ne se proposent pas
  // Guerre et paix (docs/plan-combat.md). Un rival hostile peut déclarer la guerre au joueur, jamais avant graceDays
  // ni pendant une trêve ; warChancePerDay × warStyle de l'espèce, chaque jour.
  graceDays: 500,
  truceDays: 300,
  warChancePerDay: 0.004,
  warStyle: { keltirr: 2, thrennes: 2, ondesiens: 0.5, ashkari: 0.5 },
  warRelation: -70, // note au plus haut après une déclaration de guerre
  peaceRelation: -30, // note au plus bas après la paix
  warRivalGain: 10, // ses rivaux apprécient qu'on lui déclare la guerre
  peaceValue: 300, // prix de la paix : peaceValue + peaceValuePerPower × puissance de l'empire
  peaceValuePerPower: 10,
  warMargin: 1.2, // en guerre, l'empire exige un peu plus que ce que vaut la paix
  convoySpeed: 2, // al par jour : les matières reçues voyagent depuis la colonie la plus proche de l'empire
  treatyRespectPerDay: 0.01, // note gagnée chaque jour tant qu'un traité tient
  treatyBreakPenalty: 25, // note perdue à la rupture
  techBranches: {
    vaskhar: ['industrie', 'structure'],
    ondesiens: ['vie', 'energie'],
    keltirr: ['propulsion', 'armement'],
    synodes: ['energie', 'vie', 'industrie'],
    orrhaides: ['energie', 'propulsion'],
    thrennes: ['armement', 'structure'],
    liseurs: ['veilleurs', 'propulsion'],
    ashkari: ['propulsion', 'industrie'],
  },
};

// Victoire et fin de partie (docs/plan-victoire.md).
export const VICTORY = {
  share: 0.8, // part des systèmes colonisables à occuper pour gagner par l'expansion
};

// Combat (combat.js, docs/plan-combat.md). Résolution automatique, une journée à la fois.
export const COMBAT = {
  hpPerDefense: 3, // une unité tombe quand ses dégâts atteignent 3 × sa défense
  spread: 0.25, // part de hasard sur les dégâts d'une journée (± 25 %)
  maxBattleDays: 60, // au-delà, les deux camps se séparent (simulation seulement)
  battleSpeed: 0.5, // jours par seconde pendant un combat chez le joueur (la vitesse x1 en fait 1)
  // Flottes rivales, seulement en guerre contre le joueur.
  fleetEvery: 60, // jours entre deux flottes d'un même empire
  maxFleets: 3, // flottes en même temps par empire
  fleetSpeed: 1.5, // al par jour
  fleetSize: { base: 2, perPower: 0.05, max: 6 }, // vaisseaux par flotte selon la puissance de l'empire
  fleetKinds: [[60, 'cuirasse'], [30, 'croiseur'], [10, 'fregate'], [0, 'corvette']], // puissance minimale → type
  shipCost: { corvette: 20, fregate: 45, croiseur: 90, cuirasse: 180 }, // alliages pris dans les stocks de l'empire
  powerBonus: 0.005, // attaque et défense des vaisseaux rivaux : × (1 + puissance × powerBonus)
  // Colonies : la défense combat aussi (attaque = défense × colonyAttack) ; sans défense, elle tombe après captureDays de siège.
  colonyAttack: 0.5,
  captureDays: 10,
  capturePopulation: 2, // colons d'une colonie rivale prise par le joueur
  rivalColonyDefense: { base: 8, perPower: 0.4, home: 6 }, // monde natal : × home ; le prendre fait disparaître l'empire
  homeSiegeDays: 30, // un monde natal ne tombe qu'après ce nombre de jours de siège d'affilée, défense détruite ou non
  regenPerDay: 0.05, // part de sa résistance qu'une colonie répare chaque jour sans combat
  repairPerDay: 0.1, // idem pour un vaisseau en orbite d'une colonie du joueur
  wearPerBattleDay: 5, // jours d'usure ajoutés à un vaisseau à chaque jour de combat
  // Ravitaillement des empires en guerre, que le joueur peut piller.
  supplyEvery: 40, // jours entre deux convois de ravitaillement d'un empire
  supplyLoad: { alliages: 40, minerais: 60 }, // au plus, pris dans ses stocks
  interceptRange: 10, // al : un vaisseau de guerre du joueur intercepte un convoi passant à cette distance
  pillageShare: 0.6, // part de la cargaison récupérée
  pillageRelation: 10, // note perdue auprès de l'empire pillé
};

// Expansion des empires rivaux (empires.js). Un niveau de difficulté pourra agir sur ces réglages.
// Une colonie coûte baseCost points × (1 + costGrowth par colonie déjà fondée) ; un empire gagne growth points par jour.
// power : monte chaque jour, augmente la portée (al) et autorise les milieux hostiles. deposits : poids des gisements.
// ruins : attrait des ruines ; frontier : attrait des systèmes proches d'un autre empire.
export const RIVAL_AI = {
  baseCost: 40,
  costGrowth: 0.25,
  startRange: 22,
  maxExtraRange: 28,
  hostilePower: 15,
  keepFreeRuins: 3, // pour que le fil rouge reste réalisable tant que le combat n'existe pas
  scoreNoise: 1.5,
  distancePenalty: 0.15,
  habitatScore: { favored: 8, neutral: 3, hostile: 0 },
  sizeScore: { petite: 1, moyenne: 2, grande: 3 },
  retryDays: 5, // sans planète à portée, un empire attend avant de chercher de nouveau
  styles: {
    vaskhar: { growth: 1.4, power: 0.01, deposits: { minerais: 2 }, ruins: 0, frontier: 0 }, // expansion
    ondesiens: { growth: 1, power: 0.012, deposits: { biomasse: 1, eau: 1 }, ruins: 0, frontier: 0 }, // commerce
    keltirr: { growth: 1.4, power: 0.01, deposits: {}, ruins: 0, frontier: 6 }, // agressif
    synodes: { growth: 0.7, power: 0.025, deposits: {}, ruins: 2, frontier: 0 }, // technologie
    orrhaides: { growth: 0.7, lateGrowth: 1.4, lateDay: 800, power: 0.02, deposits: { energie: 1 }, ruins: 6, frontier: 0 }, // technologie puis expansion
    thrennes: { growth: 1, power: 0.012, deposits: { minerais: 1 }, ruins: 0, frontier: 6 }, // agressif
    liseurs: { growth: 0.7, power: 0.015, deposits: {}, ruins: 12, frontier: 0 }, // savoir
    ashkari: { growth: 1, power: 0.02, deposits: { deuterium: 2 }, ruins: 0, frontier: 0 }, // commerce, longues distances
  },
};
