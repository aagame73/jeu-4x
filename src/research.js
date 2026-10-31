// Arbre de recherche : 7 branches, 4 paliers. Les laboratoires produisent des points de recherche ;
// une technologie à la fois, les points produits sans projet en cours sont mis de côté.
// Chaque technologie débloque un bâtiment, un vaisseau, une commande spatiale ou une amélioration.

import { speciesBonus } from './species.js';

export const BRANCHES = [
  { key: 'propulsion', label: 'Propulsion et navigation' },
  { key: 'structure', label: 'Coques et structures' },
  { key: 'armement', label: 'Armement et défense' },
  { key: 'industrie', label: 'Industrie et extraction' },
  { key: 'vie', label: 'Vie et colonisation' },
  { key: 'energie', label: 'Énergie et matière' },
  { key: 'veilleurs', label: 'Xéno-archéologie' },
];

// cost : points de recherche ; artefacts : artefacts des Veilleurs dépensés au lancement ;
// requires : technologies nécessaires ; unlocks : ce que le joueur y gagne, en une ligne.
export const TECHS = {
  // --- Propulsion et navigation (moteurs, navigation, carburant) ---
  'moteurs-saut': { label: 'Moteurs de saut', branch: 'propulsion', tier: 1, cost: 70, requires: ['mecanique-orbitale'], unlocks: 'Vaisseau : sonde. Les vaisseaux quittent enfin leur système.' },
  cartographie: { label: 'Cartographie stellaire', branch: 'propulsion', tier: 1, cost: 60, requires: [], unlocks: 'Les capteurs repèrent les lueurs 8 al plus loin.' },
  'saut-moyen': { label: 'Saut moyen', branch: 'propulsion', tier: 2, cost: 150, requires: ['moteurs-saut'], unlocks: 'Portée de saut : 30 al (au lieu de 22).' },
  'moteurs-ameliores': { label: 'Moteurs améliorés', branch: 'propulsion', tier: 2, cost: 170, requires: ['moteurs-saut'], unlocks: '+30 % de vitesse pour tous les vaisseaux.' },
  injecteurs: { label: 'Injecteurs efficaces', branch: 'propulsion', tier: 2, cost: 140, requires: ['moteurs-saut', 'chimie-deuterium'], unlocks: '-25 % de deutérium brûlé par saut.' },
  'saut-long': { label: 'Saut long', branch: 'propulsion', tier: 3, cost: 300, requires: ['saut-moyen', 'fusion-compacte'], unlocks: 'Portée de saut : 40 al.' },
  'moteurs-fusion': { label: 'Moteurs à fusion', branch: 'propulsion', tier: 3, cost: 320, requires: ['moteurs-ameliores', 'fusion-compacte'], unlocks: '+30 % de vitesse supplémentaire.' },
  'recyclage-deuterium': { label: 'Recyclage du deutérium', branch: 'propulsion', tier: 3, cost: 260, requires: ['injecteurs'], unlocks: '-25 % de deutérium supplémentaire par saut.' },
  'propulsion-velarine': { label: 'Propulsion à Vélarine', branch: 'propulsion', tier: 4, cost: 520, requires: ['moteurs-fusion', 'stabilisation-velarine'], unlocks: '+40 % de vitesse et portée de saut : 50 al.' },

  // --- Coques et structures (tailles de vaisseaux, résistance) ---
  'coques-moyennes': { label: 'Coques moyennes', branch: 'structure', tier: 1, cost: 90, requires: ['metallurgie', 'mecanique-orbitale'], unlocks: 'Taille moyenne : frégate et vaisseau colonie.' },
  'coques-renforcees': { label: 'Coques renforcées', branch: 'structure', tier: 2, cost: 180, requires: ['coques-moyennes'], unlocks: '+50 % de durée de vie pour tous les vaisseaux.' },
  'coques-lourdes': { label: 'Coques lourdes', branch: 'structure', tier: 2, cost: 200, requires: ['coques-moyennes', 'ingenierie-orbitale'], unlocks: 'Grande taille : croiseur et transport colonial.' },
  'alliages-composites': { label: 'Alliages composites', branch: 'structure', tier: 3, cost: 300, requires: ['coques-renforcees'], unlocks: '+25 % de défense pour tous les vaisseaux.' },
  'coques-titanesques': { label: 'Coques titanesques', branch: 'structure', tier: 4, cost: 480, requires: ['coques-lourdes', 'alliages-composites'], unlocks: 'Taille gigantesque : cuirassé.' },
  'blindage-veilleurs': { label: 'Blindage des Veilleurs', branch: 'structure', tier: 4, cost: 450, artefacts: 2, requires: ['alliages-composites'], unlocks: '+50 % de défense pour tous les vaisseaux.' },

  // --- Armement et défense ---
  'canons-masse': { label: 'Canons à masse', branch: 'armement', tier: 1, cost: 60, requires: ['metallurgie'], unlocks: 'Vaisseau de guerre : corvette.' },
  boucliers: { label: "Boucliers d'impulsion", branch: 'armement', tier: 1, cost: 90, requires: ['mecanique-orbitale'], unlocks: 'Commande spatiale : anneau de défense.' },
  lasers: { label: 'Lasers', branch: 'armement', tier: 2, cost: 160, requires: ['canons-masse', 'reseau-electrique'], unlocks: '+30 % d\'attaque pour tous les vaisseaux. Vaisseau : croiseur (avec coques lourdes).' },
  'boucliers-deflecteurs': { label: 'Boucliers déflecteurs', branch: 'armement', tier: 2, cost: 170, requires: ['boucliers'], unlocks: '+25 % de défense pour les vaisseaux et les anneaux de défense.' },
  'batteries-planetaires': { label: 'Batteries planétaires', branch: 'armement', tier: 2, cost: 150, requires: ['canons-masse'], unlocks: 'Bâtiment : batterie planétaire (défense de la colonie).' },
  'torpilles-plasma': { label: 'Torpilles à plasma', branch: 'armement', tier: 3, cost: 300, requires: ['lasers', 'fusion-compacte'], unlocks: '+30 % d\'attaque supplémentaire. Vaisseau : cuirassé (avec coques titanesques).' },
  'champ-stase': { label: 'Champ de stase', branch: 'armement', tier: 3, cost: 320, requires: ['boucliers-deflecteurs'], unlocks: 'Double la défense de toutes les colonies.' },
  'lance-gravite': { label: 'Lance de gravité', branch: 'armement', tier: 4, cost: 550, artefacts: 1, requires: ['torpilles-plasma', 'stabilisation-velarine'], unlocks: '+50 % d\'attaque pour tous les vaisseaux.' },

  // --- Industrie et extraction (dont les niveaux des bâtiments) ---
  metallurgie: { label: 'Métallurgie', branch: 'industrie', tier: 1, cost: 40, requires: [], unlocks: 'Bâtiment : fonderie (alliages).' },
  'mecanique-orbitale': { label: 'Mécanique orbitale', branch: 'industrie', tier: 1, cost: 60, requires: ['metallurgie'], unlocks: 'Bâtiment : spatioport (chantier spatial).' },
  'ingenierie-orbitale': { label: 'Ingénierie orbitale', branch: 'industrie', tier: 2, cost: 150, requires: ['mecanique-orbitale'], unlocks: 'Commande spatiale : dock spatial.' },
  'foreuse-croute': { label: 'Foreuse de croûte', branch: 'industrie', tier: 2, cost: 140, requires: ['metallurgie'], unlocks: 'Le rendement des puits ne descend plus sous 55 % (au lieu de 40 %).' },
  automatisation: { label: 'Automatisation', branch: 'industrie', tier: 2, cost: 150, requires: ['metallurgie'], unlocks: 'Bâtiments au niveau 2 : production ×1,5.' },
  robotique: { label: 'Robotique', branch: 'industrie', tier: 3, cost: 300, requires: ['automatisation', 'reseau-electrique'], unlocks: 'Bâtiments au niveau 3 : production ×2.' },
  nanofabrication: { label: 'Nanofabrication', branch: 'industrie', tier: 4, cost: 500, requires: ['robotique', 'fusion-compacte'], unlocks: 'Bâtiments au niveau 4 : production ×2,5.' },

  // --- Vie et colonisation ---
  hydroponie: { label: 'Hydroponie', branch: 'vie', tier: 1, cost: 50, requires: [], unlocks: '+1 biomasse par serre-dôme.' },
  'foyers-modulaires': { label: 'Foyers modulaires', branch: 'vie', tier: 2, cost: 120, requires: ['hydroponie'], unlocks: '+1 place de population par foyer.' },
  'habitats-scelles': { label: 'Habitats scellés', branch: 'vie', tier: 2, cost: 170, requires: ['hydroponie', 'coques-moyennes'], unlocks: 'Vaisseau : vaisseau colonie (2 colons). Transport colonial avec coques lourdes.' },
  arcologies: { label: 'Arcologies', branch: 'vie', tier: 3, cost: 300, requires: ['foyers-modulaires'], unlocks: '+2 places de population par foyer.' },
  'adaptation-xenobiologique': { label: 'Adaptation xénobiologique', branch: 'vie', tier: 2, cost: 160, requires: ['habitats-scelles'], unlocks: 'Colonies possibles sur les planètes hostiles à votre espèce (croissance −50 %, 1 colon de moins, production −15 %).' },
  'biospheres-adaptatives': { label: 'Biosphères adaptatives', branch: 'vie', tier: 3, cost: 320, requires: ['adaptation-xenobiologique', 'arcologies'], unlocks: 'Malus des planètes hostiles réduit : croissance −25 %, production −5 %, plus de colon en moins.' },

  // --- Énergie et matière ---
  'chimie-deuterium': { label: 'Chimie du deutérium', branch: 'energie', tier: 1, cost: 50, requires: [], unlocks: 'Bâtiment : pompe à deutérium.' },
  'reseau-electrique': { label: 'Réseau électrique', branch: 'energie', tier: 1, cost: 60, requires: [], unlocks: '+1 énergie par centrale et par champ photovoltaïque.' },
  'fusion-compacte': { label: 'Fusion compacte', branch: 'energie', tier: 2, cost: 160, requires: ['reseau-electrique'], unlocks: '+1 énergie supplémentaire par centrale.' },
  ecope: { label: 'Écope gazeuse', branch: 'energie', tier: 2, cost: 160, requires: ['chimie-deuterium', 'ingenierie-orbitale'], unlocks: 'Commande spatiale : écope gazeuse.' },
  'stabilisation-velarine': { label: 'Stabilisation de la Vélarine', branch: 'energie', tier: 3, cost: 260, requires: ['fusion-compacte'], unlocks: 'Bâtiment : siphon à Vélarine.' },
  'reacteur-velarine': { label: 'Réacteur à Vélarine', branch: 'energie', tier: 4, cost: 480, requires: ['stabilisation-velarine'], unlocks: '+2 énergie par centrale.' },

  // --- Xéno-archéologie ---
  fouilles: { label: 'Fouilles de base', branch: 'veilleurs', tier: 1, cost: 40, requires: [], unlocks: 'Bâtiment : fouille archéologique.' },
  lexique: { label: 'Lexique des Veilleurs', branch: 'veilleurs', tier: 2, cost: 120, artefacts: 1, requires: ['fouilles'], unlocks: 'Les fouilles trouvent leurs artefacts deux fois plus vite.' },
  glyphes: { label: 'Glyphes de navigation', branch: 'veilleurs', tier: 3, cost: 200, artefacts: 2, requires: ['lexique', 'moteurs-saut'], unlocks: "Révèle tous les courants gravitationnels de l'amas." },
  'ingenierie-veilleurs': { label: 'Ingénierie des Veilleurs', branch: 'veilleurs', tier: 4, cost: 500, artefacts: 3, requires: ['glyphes', 'robotique'], unlocks: '+10 % à toutes les productions des colonies.' },
};

// Technologies acquises dans la partie en cours (une seule partie par page).
let acquired = new Set();

export function bindResearch(research) {
  acquired = new Set(research.done);
}

export const hasTech = (key) => acquired.has(key);

// Coût réel d'une technologie : les technologies des Veilleurs (branche Xéno-archéologie ou payées
// en artefacts) profitent du bonus d'espèce veilleursTechCost.
export function techCost(tech) {
  const veilleurs = tech.branch === 'veilleurs' || tech.artefacts;
  return Math.ceil(tech.cost * (veilleurs ? speciesBonus('veilleursTechCost') : 1));
}

export function markTech(research, key) {
  if (!research.done.includes(key)) research.done.push(key);
  acquired.add(key);
}
