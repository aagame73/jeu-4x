// Pictogrammes de l'interface (SVG en ligne, couleur héritée du texte).
const svg = (body, extra = '') =>
  `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  // Ressources et quantités (minerais, biomasse, Vélarine : tracés « néon » repris du bandeau)
  minerais: svg('<path d="M6.5 3.5h11l4 5.5L12 21 2.5 9z"/><path d="M2.5 9h19"/><path d="M9.5 3.5 8 9l4 12 4-12-1.5-5.5"/>'),
  energie: svg('<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>'),
  biomasse: svg('<path d="M4.5 19.5C4.5 10 10.5 4 20 4c0 9.5-6 15.5-15.5 15.5z"/><path d="M4.5 19.5 15 9M9.5 14.5v-4M12.5 11.5H16"/>'),
  velarine: svg('<path d="M12 2l7.5 9L12 22l-7.5-11z"/><path d="M4.5 11 12 14l7.5-3M12 2v20"/><path d="M4.5 11 12 8.5l7.5 2.5" stroke-dasharray="1.5 2" stroke-width="1.1"/>'),
  // Alliages : deux lingots empilés en perspective
  alliages: svg('<path d="M3 15.5 6.5 12h11l3.5 3.5z"/><path d="M3 15.5V19h18v-3.5"/><path d="M7 8.5 9.5 5h8L20 8.5"/><path d="M7 8.5V12M20 8.5V12M7 8.5h13"/><path d="M6 17.2h4" stroke-width="1.1"/>'),
  // Deutérium : bulle de gaz traversée d'une orbite, noyau au centre
  deuterium: svg('<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="8" ry="3.2" transform="rotate(-30 12 12)"/><circle cx="12" cy="12" r="1.6"/><circle cx="17.5" cy="6" r="1" stroke-width="1.1"/>'),
  // Eau : goutte avec reflet
  eau: svg('<path d="M12 2.5C9 7 5.5 10.5 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10.5 15 7 12 2.5z"/><path d="M9 15a3 3 0 0 0 2.5 3" stroke-width="1.2"/>'),
  // Artefacts : tablette ancienne ébréchée portant un glyphe
  artefacts: svg('<path d="M6 3h9l3 3v4l-1 2 1 2v7H6V13l1-1.5L6 10z"/><path d="M12 7v10M9 10l3 2 3-2M9.5 15h5"/>'),
  colon: svg('<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>'),
  places: svg('<path d="M3 11 12 4l9 7"/><path d="M6 10v10h12V10"/><path d="M12 13v5M9.5 15.5h5"/>'),
  jours: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  demolir: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),

  // Bandeau du haut : compteurs, menu et horloge
  calendrier: svg('<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/><rect x="7" y="13.5" width="3" height="3"/>'),
  systemes: svg('<path d="M12 2.5 14 10l7.5 2-7.5 2-2 7.5-2-7.5-7.5-2 7.5-2z"/>'),
  lueurs: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6.5-6.5"/><circle cx="15.5" cy="15" r="1"/>'),
  pleinEcran: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  quitterPleinEcran: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  menu: svg('<path d="M4 6h16M4 12h12M4 18h8"/>'),
  lecture: svg('<path d="M7 4l13 8-13 8z"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  vitesse1: svg('<path d="M9 5l7 7-7 7"/>'),
  vitesse2: svg('<path d="M5 5l7 7-7 7M12 5l7 7-7 7"/>'),
  vitesse4: svg('<path d="M2 6l6 6-6 6M9 6l6 6-6 6M16 6l6 6-6 6"/>'),

  // Recherche : atome (noyau et trois orbites), cadenas et coche des cartes de technologie
  recherche: svg('<circle cx="12" cy="12" r="1.6"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-60 12 12)"/>'),
  cadenas: svg('<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/><path d="M12 15v2.5"/>'),
  coche: svg('<path d="M4 12.5 9.5 18 20 6"/>'),
  // Branches de l'arbre de recherche
  'branche-propulsion': svg('<path d="M21 3 11 7l-3 5 4 4 5-3z"/><path d="M8 12H4l3-4h4M12 16v4l4-3v-4"/><path d="M3 21l4-4M6 21l2-2M3 18l2-2" stroke-width="1.2"/>'),
  // Coques et structures : section de coque hexagonale et ses membrures
  'branche-structure': svg('<path d="M2.5 12 7 5h10l4.5 7-4.5 7H7z"/><path d="M9.5 5v14M14.5 5v14" stroke-width="1.2"/><path d="M2.5 12h19"/>'),
  // Armement et défense : bouclier portant un viseur
  'branche-armement': svg('<path d="M12 2.5 20 5.5v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z"/><circle cx="12" cy="12" r="3.2"/><path d="M12 6.5v2.3M12 15.2v2.3M6.5 12h2.3M15.2 12h2.3" stroke-width="1.2"/>'),
  'branche-industrie': svg('<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
  'branche-vie': svg('<path d="M7 2c0 5 10 5 10 10S7 17 7 22"/><path d="M17 2c0 5-10 5-10 10s10 5 10 10"/><path d="M8.8 5h6.4M8.8 19h6.4M10 12h4" stroke-width="1.2"/>'),
  'branche-energie': svg('<circle cx="12" cy="12" r="9.5"/><path d="M13 5.5 8 13h4l-1 5.5 5-7.5h-4z"/>'),
  'branche-veilleurs': svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M12 10.5v3M10.5 12h3" stroke-width="1.1"/>'),

  // Combat : viseur (attaque), bouclier (défense), flèches d'encombrement (taille), chevrons (niveau)
  attaque: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1.3"/>'),
  defense: svg('<path d="M12 2.5 20 5.5v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z"/><path d="M12 6v12.5M8 9.5l4-1.5 4 1.5" stroke-width="1.2"/>'),
  taille: svg('<path d="M5 19 19 5"/><path d="M5 13v6h6M19 11V5h-6"/>'),
  niveau: svg('<path d="M6 21l6-4.5 6 4.5M6 15l6-4.5 6 4.5M6 9l6-4.5L18 9"/>'),

  // Vaisseaux du chantier : silhouettes de profil (proue à droite), de plus en plus massives
  corvette: svg('<path d="M6 12 9 10h6l4.5 2-4.5 2H9z"/><path d="M6 10.5v3M3.5 12H6M11 10V8.5h2.5" stroke-width="1.2"/>'),
  fregate: svg('<path d="M4 12 6 9.5h8.5L21 12l-6.5 2.5H6z"/><path d="M7.5 9.5 9 7.5h3.5l1 2M7.5 14.5 9 16.5h3.5l1-2" stroke-width="1.2"/><path d="M1.5 11h2.5M1.5 13h2.5" stroke-width="1.2"/>'),
  croiseur: svg('<path d="M3 12 4.5 8.5h11L22 12l-6.5 3.5h-11z"/><path d="M6 8.5 7.5 6h5.5l1.5 2.5M6 15.5 7.5 18h5.5l1.5-2.5" stroke-width="1.2"/><path d="M8 12h6.5M15 10.5l3-1" stroke-width="1.2"/><path d="M1 10.5h2M1 13.5h2" stroke-width="1.2"/>'),
  transport: svg('<path d="M3.5 8h12l5.5 4-5.5 4h-12z"/><path d="M7.5 8v8M11.5 8v8" stroke-width="1.2"/><path d="M3.5 10.5H1.5M3.5 13.5H1.5" stroke-width="1.2"/><path d="M6 6h7v2" stroke-width="1.2"/>'),
  cuirasse: svg('<path d="M2.5 12 4 7h12.5l6 5-6 5H4z"/><path d="M5 7V4.5h7.5L14 7M5 17v2.5h7.5L14 17" stroke-width="1.2"/><path d="M6 10.2h8.5M6 13.8h8.5" stroke-width="1.2"/><path d="M15 9.5l3.5-1.5M15 14.5l3.5 1.5" stroke-width="1.2"/><path d="M.8 9.5h1.7M.8 12h1.7M.8 14.5h1.7" stroke-width="1.2"/>'),
  // Batterie planétaire : tourelle sur socle, canon levé
  batterie: svg('<path d="M3 21h18"/><path d="M5 21v-3.5h14V21"/><path d="M7.5 17.5a4.5 4.5 0 0 1 9 0"/><path d="M13.5 14 20 7.5M18.5 6l3 3" /><circle cx="12" cy="15.5" r="0.8" stroke-width="1.2"/>'),

  // Bâtiments
  centre: svg('<path d="M3 20h18"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M12 13V5M12 5l3 2"/>'),
  foyer: svg('<path d="M2 20h20"/><path d="M3 20a4 4 0 0 1 8 0M11 20a5 5 0 0 1 10 0"/><path d="M7 17v1M16 16v2"/>'),
  puits: svg('<path d="M8 21 12 3l4 18"/><path d="M9.5 14h5M10.5 9h3M5 21h14"/>'),
  fonderie: svg('<path d="M3 21V11l5 3v-3l5 3V8h3V3h3v18z"/><path d="M3 21h18"/>'),
  centrale: svg('<path d="M6 21c1-5 1-9 0-14h9c-1 5-1 9 0 14z"/><path d="M11 10l-2 4h3l-2 4"/><path d="M4 21h14"/>'),
  solaire: svg('<path d="M3 14 7 6h14l-4 8z"/><path d="M5 10h14M10 6l-3 8M15 6l-3 8M12 14v6M8 20h8"/>'),
  serre: svg('<path d="M3 20a9 9 0 0 1 18 0"/><path d="M3 20h18"/><path d="M12 20v-6M12 14c0-3 2-4 4-4 0 2-1 4-4 4zM12 16c0-2-2-3-3.5-3 0 2 1 3 3.5 3z"/>'),
  ferme: svg('<path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 21c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M12 13V5M12 9c-3 0-4-2-4-4 3 0 4 2 4 4zM12 8c3 0 4-2 4-4-3 0-4 2-4 4z"/>'),
  siphon: svg('<path d="M12 2 17 9 12 16 7 9z"/><path d="M12 16v3"/><path d="M8 22h8M10 19h4"/>'),
  spatioport: svg('<path d="M12 2c3 3 4 7 3 12H9C8 9 9 5 12 2z"/><path d="M9 14l-3 4h3M15 14l3 4h-3"/><path d="M11 17h2v4h-2z"/>'),
  // Pompe à deutérium : cuve sphérique sur pieds, conduite et vanne
  pompe: svg('<circle cx="9" cy="10" r="5.5"/><path d="M5.5 14.5 4 21M12.5 14.5 14 21M3 21h18"/><path d="M14.5 10H19v11"/><path d="M17 6.5h4M19 6.5V10"/><circle cx="9" cy="10" r="1.3"/>'),
  // Captage d'eau : bassin, goutte qui tombe et rides
  captage: svg('<path d="M12 2.5c-1.5 2.3-3 4-3 5.7a3 3 0 0 0 6 0c0-1.7-1.5-3.4-3-5.7z"/><path d="M3 15h18l-2 6H5z"/><path d="M7 18c1.5-1 3-1 5 0s3.5 1 5 0" stroke-width="1.2"/>'),
  // Fouille archéologique : tranchée quadrillée et pelle plantée
  fouille: svg('<path d="M2 20h20"/><path d="M4 20v-5h11v5M4 17.5h11M7.5 15v5M11.5 15v5" stroke-width="1.2"/><path d="M19 3v11M17 3h4"/><path d="M17.5 14h3l-1.5 3z"/>'),
  // Écope gazeuse : nacelle orbitale qui plonge une trompe dans une géante gazeuse
  ecope: svg('<path d="M3 21a10 10 0 0 1 18 0"/><path d="M5.5 17h13" stroke-width="1.1"/><path d="M9 4h6l1.5 3h-9z"/><path d="M5 5.5h2.5M16.5 5.5H19"/><path d="M12 7v7.5M10.5 14.5h3"/>'),
};

export const icon = (name) => ICONS[name] ?? '';
