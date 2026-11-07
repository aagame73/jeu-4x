# État du projet (07/11/2026)

## Fait
- Prototype jouable : amas 3D, sondes, Arche, colonies sur hexagones, économie, recherche (46 technologies), sauvegardes, temps réel avec pause.
- Espèces (plan `docs/plan-especes.md`), étapes 1 à 5 :
  - 8 espèces jouables + profil neutre « Colons de l'Arche », écran de choix, conseiller animé à la place du journal ;
  - bonus et malus, planètes favorables / hostiles, équilibre simulé sur 200 jours (§ 11.5 à 11.7) ;
  - vaisseaux au style de chaque espèce, textures procédurales, propulsion animée pour tous (§ 11.8) ;
  - portraits peints et animés des 9 profils ;
  - de 3 à 7 adversaires au choix (4 par défaut) ; espèce, nom d'empire et couleur des rivaux, révélés à l'analyse (§ 12). Pas d'IA.
- Outils : hook de fin de réponse qui lance `npm run build` (`.claude/settings.json`), agent `relecteur` (`.claude/agents/relecteur.md`), serveur lancé au démarrage de Windows.

## En cours
- IA des rivaux (`docs/plan-rivaux-ia.md`) : étapes 1 et 2 codées et testées, non commitées, en attente de validation.

## Prochaine étape
- Première version de l'IA : les rivaux s'étendent, sans combat (plan `docs/plan-rivaux-ia.md`, validé). Ensuite, dans l'ordre : diplomatie, commerce, combat.

## Questions ouvertes
- Équilibre à juger en jouant : Liseurs de Vey trop forts en milieu réel (120 %), Thrennes un peu faibles (87 %, bonus militaires non mesurés tant que le combat n'existe pas).
- Vaisseaux : marques répétées sur les ailes des Thrennes, pleine poussée pas encore vue en jeu.
- Smartphone (simulé le 07/11) : interface à adapter, chantier à part. Tablette plus facile. Écran trop petit, bandeau et panneaux superposés, boutons trop petits.
- `src/ships.js` fait environ 2 900 lignes : le découper (matériaux à part) ?
- Titre du jeu à choisir.
- Victoire (idée, non codée, `docs/plan-rivaux-ia.md` § 6) : 80 % des systèmes occupés, ou plus d'ennemis. Un système partagé compte pour le joueur ; un rival ne gagne pas ainsi pour l'instant.
- Voix des espèces, décidé le 07/11/2026, à faire plus tard : voix alien générée par le jeu (Web Audio, sans fichier, unique par espèce), avec volume et bouton pour couper. Plan à écrire avant de coder.
- Niveau de difficulté : à traiter plus tard, avec l'IA.
- Avertissement `WebGL context was lost` vu dans Firefox : sans effet visible pour l'instant, à surveiller.
