# État du projet (02/11/2026)

## Fait
- Prototype jouable : amas 3D, sondes, Arche, colonies sur hexagones, économie, recherche (46 technologies), sauvegardes, temps réel avec pause.
- Espèces (plan `docs/plan-especes.md`), étapes 1 à 4 :
  - 8 espèces jouables + profil neutre « Colons de l'Arche », écran de choix, conseiller animé à la place du journal ;
  - bonus et malus, planètes favorables / hostiles, équilibre simulé sur 200 jours (§ 11.5 à 11.7) ;
  - vaisseaux au style de chaque espèce, textures procédurales, propulsion animée pour tous (§ 11.8) ;
  - portraits peints et animés des 9 profils.
- Outils : hook de fin de réponse qui lance `npm run build` (`.claude/settings.json`), agent `relecteur` (`.claude/agents/relecteur.md`), serveur lancé au démarrage de Windows.

## En cours
- Rien.

## Prochaine étape
- Étape 5 du plan des espèces : les rivaux (empires de l'ordinateur) prennent les espèces non choisies.

## Questions ouvertes
- Équilibre à juger en jouant : Liseurs de Vey trop forts en milieu réel (120 %), Thrennes un peu faibles (87 %, bonus militaires non mesurés tant que le combat n'existe pas).
- Portrait des Orrhaïdes : tête presque blanche par moments quand il parle (pulsation à baisser ?).
- Vaisseaux : Liseurs un peu sombres dans le jeu, marques répétées sur les ailes des Thrennes, pleine poussée pas encore vue en jeu.
- `src/ships.js` fait environ 2 900 lignes : le découper (matériaux à part) ?
- Titre du jeu à choisir.
