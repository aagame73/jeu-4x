// Pictogrammes de l'interface (SVG en ligne, couleur héritée du texte).
const svg = (body, extra = '') =>
  `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${body}</svg>`;

export const ICONS = {
  // Ressources et quantités
  minerais: svg('<path d="M7 4h10l4 6-9 11L3 10z"/><path d="M3 10h18M9 4l3 6 3-6M12 10v11"/>'),
  energie: svg('<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>'),
  biomasse: svg('<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 13 11"/>'),
  velarine: svg('<path d="M12 2 19 12 12 22 5 12z"/><path d="M5 12h14M12 2v20"/>'),
  colon: svg('<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>'),
  places: svg('<path d="M3 11 12 4l9 7"/><path d="M6 10v10h12V10"/><path d="M12 13v5M9.5 15.5h5"/>'),
  jours: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  demolir: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),

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
};

export const icon = (name) => ICONS[name] ?? '';
