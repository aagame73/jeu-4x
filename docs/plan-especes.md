# Plan : choix de l'espèce en début de partie

État : **plan validé**. Étapes 1 (données) et 2 (écran de choix, avec portraits animés et conseiller qui remplace le journal) faites le 31/10/2026 ; étape 3 (bonus) faite le 31/10/2026, avec la décision du § 11.7 ; étape 4 (vaisseaux au style de l'espèce, textures, propulsion animée) faite le 02/11/2026, voir § 11.8 ; étape 5 (rivaux, identité seulement, § 12) faite le 07/11/2026. Décisions de design au § 10 ; revue d'avant l'étape 3 au § 11 (**validée**, ajustements d'équilibre reportés dans `config.js`).

## 1. Le parcours du joueur

1. « Nouvelle partie » (écran d'accueil ou menu Échap) ouvre l'**écran de choix d'espèce** au lieu de relancer directement.
2. Le joueur voit les 8 espèces (portrait stylisé, texte d'ambiance, force, faiblesse, milieu de prédilection, aperçu d'un de ses vaisseaux en 3D) et en choisit une.
3. Validation → la page se recharge avec l'espèce choisie → l'Arche arrive, à l'image de son espèce (nom, couleurs, silhouette).
4. Le nom de l'espèce apparaît dans le bandeau (infobulle du titre) et dans le menu (« Partie en cours : Vaskhar, jour 42 »).

## 2. Les 8 espèces proposées

Règle d'équilibre : chaque espèce a **une force (+25 % sur un axe)**, **une faiblesse (−20 % sur un autre axe)** et **un milieu** (2 types de planètes favorables, 1 hostile). Aucun axe n'est meilleur qu'un autre : un bonus de recherche vaut un bonus de minerais à long terme, et chaque faiblesse touche un axe utile.

| Espèce | Concept | Force | Faiblesse | Milieu favorable / hostile | Style de vaisseaux |
|---|---|---|---|---|---|
| **Vaskhar** | Grands invertébrés à carapace minérale qui digèrent la roche | Minerais +25 % | Croissance de la population −20 % | Volcanique, désertique / océanique | Massifs, anguleux, plaques de blindage, tons ocre et rouille |
| **Ondésiens** | Colonies de méduses reliées par des filaments lumineux | Biomasse et eau +25 % | Alliages −20 % | Océanique, marécageuse / volcanique | Organiques, arrondis, translucides, anneaux, tons bleu-vert |
| **Kel-Tirr** | Petits êtres à plumes, rapides, vivant en essaims | Vitesse des vaisseaux +25 %, chantier spatial −20 % de durée | Défense et durée de vie des vaisseaux −20 % | Tempérée, marécageuse / glacée | Effilés, ailes fines en flèche, légers, tons clairs |
| **Synodes** | Champignons en réseau qui pensent ensemble | Recherche +25 % | Minerais −20 % | Marécageuse, toxique / désertique | Modulaires : sphères et nacelles reliées par des poutres, tons violets |
| **Orrhaïdes** | Cristaux vivants nourris de lumière et de chaleur | Énergie +25 % | Biomasse −20 % | Glacée, désertique / marécageuse | Cristallins, facettes, éléments octaédriques lumineux, tons blanc-bleu |
| **Thrennes** | Reptiles à six membres, culture guerrière ritualisée | Attaque des vaisseaux et défense des colonies +25 % | Recherche −20 % | Volcanique, toxique / tempérée | Agressifs, pointes, nombreuses tourelles, tons sombres et rouges |
| **Liseurs de Vey** | Êtres longilignes qui vénèrent les Veilleurs et lisent leurs glyphes | Fouilles 2× plus rapides, technologies des Veilleurs −30 % de coût | Énergie −20 % | Glacée, tempérée / toxique | Grandes voiles et antennes, coques élancées, tons dorés |
| **Ashkari** | Nomades des géantes gazeuses, marchands et pilotes | Deutérium +25 %, sauts −25 % de carburant | Défense des colonies −20 % | Lunes habitables et océanique / volcanique | Cargos modulaires, conteneurs, écopes, tons cuivre |

(Les Vaskhar, Ondésiens, Kel-Tirr, Synodes et Orrhaïdes reprennent le document de conception ; les Humains de la Fraternité de Tellus sont remplacés par trois espèces nouvelles pour garder un univers entièrement étranger.)

## 3. Stockage des données : `src/config.js`

`config.js` gagne un objet `SPECIES` (données pures, aucune logique) :

```js
export const SPECIES = {
  vaskhar: {
    label: 'Vaskhar',
    adjective: 'vaskhar',            // « la flotte vaskhar »
    lore: 'Grands invertébrés…',
    strength: 'Minerais +25 %',      // textes affichés
    weakness: 'Croissance −20 %',
    bonuses: { minerais: 1.25, growth: 0.8 },   // multiplicateurs, voir § 4
    habitat: { favored: ['volcanique', 'desertique'], hostile: ['oceanique'] },
    shipStyle: { … },                // voir § 6
    accent: '#ffb347',               // couleur de l'espèce dans l'interface
    arkName: 'Arche Basalte',
  },
  …
};
export const DEFAULT_SPECIES = 'sans-espece'; // profil neutre, voir § 7
```

Clés de `bonuses` (toutes optionnelles, 1 = neutre) : `minerais`, `alliages`, `biomasse`, `eau`, `deuterium`, `energie`, `recherche`, `growth` (vitesse de croissance de la population), `shipSpeed`, `shipDefense`, `shipLifespan`, `shipAttack`, `shipyardTime`, `colonyDefense`, `fuel`, `digSpeed`, `veilleursTechCost`.

La partie garde la clé choisie dans `game.species`.

## 4. Application des bonus

Même mécanique que la recherche : un petit module lié à la partie en cours.

- **`src/species.js`** (nouveau) : `bindSpecies(key)` à la création ou au chargement de la partie, puis `speciesBonus(nom)` → multiplicateur (1 par défaut), `speciesHabitat(type)` → `'favored' | 'hostile' | null`.
- **Économie** (`economy.js`, `colonyReport`) : chaque production positive est multipliée par `speciesBonus(ressource)` en plus du bonus de niveau ; la recherche aussi (`perDay.recherche`). L'énergie passe par le même multiplicateur. La croissance (`tickColony`) : `GROWTH_DAYS / speciesBonus('growth')`.
- **Recherche** (`game.js`) : `researchPerDay` profite déjà du multiplicateur via `colonyReport` ; le coût des technologies de la branche Xéno-archéologie est multiplié par `speciesBonus('veilleursTechCost')` dans `researchProblem` / `checkResearchDone`.
- **Vaisseaux** (`game.js`, `shipStats` et `canReach`) : vitesse, attaque, défense, durée de vie et carburant multipliés par les bonus correspondants ; durée des commandes du chantier spatial (`startShipyard`) multipliée par `shipyardTime`.
- **Défense** (`colonyDefense`) : multipliée par `colonyDefense`.
- **Fouilles** (`tickColony`) : vitesse multipliée par `digSpeed`.
- **Milieu** (voir question 1) : selon le choix retenu, soit la croissance et le nombre de colons de départ sur les planètes favorables/hostiles, soit la production des cases de terrain correspondantes.

Les panneaux affichent déjà les valeurs calculées : les bonus apparaissent sans changement d'interface, sauf une ligne « bonus d'espèce » dans l'infobulle des productions.

## 5. Écran de choix : `src/speciesView.js` + `src/styles/especes.css`

- Plein écran au style « Hologramme », grille de 8 cartes (4 × 2) ; la carte sélectionnée s'agrandit avec le texte complet et un aperçu 3D du vaisseau (vignette rendue avec le style de l'espèce, comme les vignettes de la flotte).
- Bouton « Commencer avec les <espèce> » ; « Retour » revient à l'écran précédent.
- Ouvert par `menu.js` (« Nouvelle partie » à l'accueil et dans le menu) ; le choix est transmis par `newGameAndRestart(speciesKey)` (`save.js`, via `sessionStorage` comme aujourd'hui), puis `main.js` crée la partie avec `createGame(seed, speciesKey)`.
- Pour les tests : `?graine=42&espece=vaskhar` dans l'adresse saute l'écran.

## 6. Style de vaisseaux : paramètres pour `ships.js`

`createShip(seed, accent, registry, kind, style)` reçoit un objet `shipStyle` ; la graine continue de rendre chaque vaisseau unique **à l'intérieur** du style de son espèce.

```js
shipStyle: {
  hullTones: ['#a0522d', '#8b6b4a'],   // palette de coque
  segments: [5, 6],                    // facettes du fuselage (bas = anguleux)
  profile: 'massif',                   // 'effile' | 'massif' | 'bombe' | 'modulaire'
  wings: { ailes: 1, ailerons: 3, anneau: 0, panneaux: 1 },  // poids de tirage
  armor: 0.8,                          // part de plaques de blindage (0 à 1)
  organic: 0,                          // formes arrondies, translucides (0 à 1)
  crystals: 0,                         // éléments octaédriques lumineux (0 à 1)
  sails: 0,                            // grandes voiles / antennes (0 à 1)
  pods: 0.5,                           // modules et conteneurs accolés
  engineGlow: '#ff8a3a',               // couleur des réacteurs
}
```

Fichiers qui appellent `createShip` : `scene.js` (modèles de l'amas), `ui.js` (vignettes de la flotte), `speciesView.js` (aperçu). Ils passent `SPECIES[game.species].shipStyle`.

## 7. Sauvegardes sans espèce

- `save.js` enregistre `species` ; au chargement, `data.species ?? DEFAULT_SPECIES`.
- `DEFAULT_SPECIES` = profil neutre **« Colons de l'Arche »** : aucun bonus, aucun malus, style de vaisseaux actuel. Les parties existantes se rechargent donc exactement comme avant (voir question 3).
- La version de sauvegarde reste 1 (champ simplement ajouté, comme pour les ressources).

## 8. Fichiers touchés

| Fichier | Changement |
|---|---|
| `src/config.js` | `SPECIES`, `DEFAULT_SPECIES` |
| `src/species.js` (nouveau) | `bindSpecies`, `speciesBonus`, `speciesHabitat` |
| `src/game.js` | `createGame(seed, species)`, bonus des vaisseaux, défense, chantier, coûts de recherche, milieu |
| `src/economy.js` | multiplicateurs de production, croissance, fouilles |
| `src/save.js` | `species` enregistrée, valeur par défaut, `newGameAndRestart(species)` |
| `src/main.js` | lecture de l'espèce demandée (`sessionStorage`, `?espece=`) |
| `src/menu.js` | « Nouvelle partie » ouvre l'écran de choix |
| `src/speciesView.js` + `src/styles/especes.css` (nouveaux) | écran de choix |
| `src/ships.js` | paramètre `style` du générateur |
| `src/scene.js`, `src/ui.js` | passent le style aux modèles et vignettes |
| `src/galaxy.js` | (si question 2 = oui) les rivaux prennent des espèces de `SPECIES` |
| `index.html` | conteneur `#species` |
| `CLAUDE.md`, document de conception | mise à jour |

## 9. Étapes testables

1. **Données** — `SPECIES` dans `config.js`, `species.js`, `game.species`, sauvegarde avec valeur par défaut. *Test* : Node — une partie de chaque espèce se crée, s'enregistre et se recharge ; une ancienne sauvegarde se charge avec « Colons de l'Arche ».
2. **Écran de choix** — `speciesView.js`, branchement dans `menu.js`, `save.js`, `main.js`. *Test* : navigateur — Accueil → Nouvelle partie → choix → l'Arche arrive avec le bon nom ; `?espece=` saute l'écran ; Retour fonctionne.
3. **Bonus** — économie, croissance, recherche, vaisseaux, défense, milieu, colonisation des planètes hostiles (§ 11.1). *Test* : Node — (a) même graine, deux espèces : les écarts attendus apparaissent sur les bons axes et rien d'autre ne change ; (b) **comparaison des 8 espèces + profil neutre sur 200 jours simulés**, même graine et même stratégie automatique, tableau au § 11.5 ; (c) une colonie hostile est refusée sans la technologie, acceptée avec, et subit le malus.
4. **Vaisseaux** (✓ fait le 02/11/2026) — paramètre `style` dans `ships.js`, branché partout. *Test* : navigateur — vignettes des 8 espèces × 3 types côte à côte, chacune reconnaissable ; vaisseaux de l'amas et de la flotte au style de l'espèce jouée.
5. **Rivaux, identité seulement (pas d'IA, voir § 12)** (✓ fait le 07/11/2026) — choix de 3 à 7 adversaires sur l'écran de nouvelle partie (4 par défaut), espèces rivales tirées parmi les 7 restantes, nom d'empire et couleur sur la carte et dans les fiches. *Test* : `docs/outils/test-etape5.mjs` et navigateur.

## 10. Décisions (validées le 31/10/2026)

1. **Milieu de prédilection** : les deux effets. Planète favorable : +1 colon au départ et croissance +25 % ; planète hostile : croissance −50 %. Les cases des terrains liés au milieu produisent +25 %.
2. **Empires de l'ordinateur** : oui, chacun prend une des 7 espèces non choisies (données et style préparés maintenant, comportement avec l'étape « espèces rivales »).
3. **Anciennes sauvegardes** : profil neutre « Colons de l'Arche », sans bonus ni malus.
4. **Espèces** : les 8 propositions du § 2 sont validées.

## 11. Revue avant l'étape 3 (31/10/2026) — propositions validées le 31/10/2026

### 11.1 Planètes hostiles : colonisation bloquée, puis débloquée par la recherche

Constat : le § 10 ne prévoit qu'une croissance −50 %. Il manque le blocage et le déblocage.

Proposition :

| Moment | Règle |
|---|---|
| Au départ | Un vaisseau colonie ou un transport **ne peut pas** fonder sur une planète hostile. `foundingProblem` répond : « Milieu hostile aux Vaskhar : recherchez Adaptation xénobiologique. » La fiche de la planète affiche un badge « hostile » (et « favorable » dans le cas inverse). |
| Technologie **Adaptation xénobiologique** (branche Vie, palier 2, 160 points, requiert Habitats scellés) | La fondation devient possible, avec malus : **croissance −50 %**, **1 colon de moins au départ** (minimum 1) et **−15 % sur toute la production de la colonie** (équipements de survie). |
| Technologie **Biosphères adaptatives** (branche Vie, palier 3, 320 points, requiert Adaptation xénobiologique et Arcologies) | Malus divisé par deux : croissance −25 %, production −5 %, plus de colon en moins. |
| Exception : **l'Arche** | Elle peut toujours se poser sur une planète hostile : ses moteurs sont cassés, et un refus bloquerait la partie pour de bon si le système de départ n'offrait qu'un milieu hostile. Elle subit le malus complet, et la fiche le signale avant le choix. |

Ces deux technologies servent à toutes les espèces (chacune a un type hostile). Anciennes parties : sans objet (profil neutre, aucun type hostile).

### 11.2 Équilibre des 8 espèces

Constat : Ondésiens, Kel-Tirr, Thrennes, Liseurs et Ashkari ont deux bonus, les trois autres un seul. Le nombre compte moins que la **valeur réelle dans le jeu actuel**, où il n'y a encore **ni combat ni attaque**. Barème indicatif : axe central (minerais, énergie, recherche, croissance) = 3 ; axe secondaire (alliages, biomasse + eau, vitesse des vaisseaux, chantier) = 2 ; axe de niche (deutérium, carburant, fouilles, durée de vie) = 1 ; axe militaire = **0 aujourd'hui**, 2 quand le combat existera.

| Espèce | Force (valeur) | Faiblesse (coût) | Solde aujourd'hui | Solde avec combat | Avis |
|---|---|---|---|---|---|
| Vaskhar | minerais 3 | croissance −3 | 0 | 0 | équilibré ; la croissance pèse surtout au début : à surveiller |
| Ondésiens | biomasse + eau 2 | alliages −2 | 0 | 0 | équilibré |
| Kel-Tirr | vitesse 2, chantier 2 | défense 0, durée de vie −1 | **+3** | +1 | un peu fort aujourd'hui |
| Synodes | recherche 3 | minerais −3 | 0 | 0 | équilibré |
| Orrhaïdes | énergie 3 | biomasse −2 | +1 | +1 | légèrement fort |
| Thrennes | attaque 0, défense des colonies 0 | recherche −3 | **−3** | +1 | **trop faible tant que le combat n'existe pas** |
| Liseurs de Vey | fouilles 1, techno. des Veilleurs 1 | énergie −3 | **−1** | −1 | faible : dépend des ruines proches (9 sur 140 étoiles) |
| Ashkari | deutérium 1, carburant 1 | défense des colonies 0 | **+2** | 0 | malus gratuit tant que le combat n'existe pas |

Ajustements proposés (chiffres finaux calés par la simulation du § 11.5) :

1. **Thrennes** : ajouter **alliages +15 %** (industrie de guerre), ou ramener leur faiblesse à recherche −15 %.
2. **Ashkari** : ajouter **minerais −10 %** à leur faiblesse (peuple de bord, peu de mineurs).
3. **Liseurs de Vey** : faiblesse ramenée à **énergie −15 %**, et chaque fouille terminée donne **+1 artefact**.
4. **Kel-Tirr** : chantier spatial **−15 %** de durée au lieu de −20 %.
5. **Orrhaïdes** : biomasse **−25 %** au lieu de −20 %.
6. Préciser « technologies des Veilleurs » = toute la branche Xéno-archéologie **et** toutes les technologies qui coûtent des artefacts (ex. Blindage des Veilleurs, branche Structure).

Règle conservée : une force et une faiblesse **thématiques** par espèce (une force peut toucher deux axes proches).

### 11.3 Cumul espèce + terrain (ex. Vaskhar, puits de forage sur case volcanique)

Calcul actuel (`colonyReport`) : `base × bonus de niveau (1 / 1,5 / 2 / 2,5) × 1,1 si Ingénierie des Veilleurs`, puis × encadrement × énergie.

L'étape 3 ajoute deux facteurs d'espèce. **Multipliés**, ils donnent 1,25 (minerais) × 1,25 (terrain favori) = **1,5625**, soit +56 % ; un puits de niveau 4 avec Ingénierie des Veilleurs atteint alors 2,5 × 1,1 × 1,5625 ≈ **4,3 fois** la base.

Proposition : **additionner les bonus d'espèce entre eux**, puis multiplier le total par le reste :

`facteur d'espèce = 1 + (bonus de ressource − 1) + (0,25 si terrain favori) − (malus de planète hostile)`

| Cas | Facteur |
|---|---|
| Vaskhar, minerais, case volcanique | 1 + 0,25 + 0,25 = **1,50** |
| Synodes, minerais (−20 %), case toxique favorite | 1 − 0,20 + 0,25 = **1,05** |
| Vaskhar, minerais, case volcanique, colonie hostile (−15 %) | 1 + 0,25 + 0,25 − 0,15 = **1,35** |

**Plafond : facteur d'espèce entre 0,5 et 1,5.** Avec les valeurs actuelles, 1,5 est déjà le maximum : le plafond protège surtout les ajouts futurs (technologies d'espèce, rivaux). Maximum global : 2,5 × 1,1 × 1,5 ≈ 4,1 fois la base, acceptable (le niveau 4 coûte cher et les terrains favoris ne couvrent qu'une partie des cases).

Précision : le bonus de terrain s'applique à toutes les productions positives de la case (un laboratoire sur case favorite produit +25 % de recherche), jamais aux consommations ni aux places de population. L'infobulle de production détaillera « espèce +25 %, terrain +25 % ».

### 11.4 Profil neutre et style de vaisseaux (étape 4)

Vérifié dans `config.js` : le profil **`'sans-espece'`** (« Colons de l'Arche ») existe, caché de l'écran de choix, avec `bonuses: {}`, `habitat` vide, `favoredTerrains: []` et **`shipStyle: null`**. Une clé absente ou inconnue retombe sur lui (`bindSpecies`, `createGame`, `restore`, testés à l'étape 1).

Risque : si l'étape 4 lit `style.hullTones` sans vérification, une ancienne sauvegarde plantera. Deux options :

- **(recommandée)** `shipStyle: null` = « générateur d'origine » : `createShip(seed, accent, registry, kind, style = null)` ne prend la branche « style d'espèce » que si `style` existe. Les vaisseaux des anciennes parties restent **identiques**, ce qu'un `shipStyle` imitant l'ancien générateur ne garantirait pas (l'ordre des tirages aléatoires changerait).
- donner au profil neutre un `shipStyle` complet qui imite l'ancien style.

Ajout au test de l'étape 4 : charger une sauvegarde sans espèce, ouvrir la flotte et l'amas : aucune erreur, vignettes de même forme qu'avant (seuls les jets de propulsion animés s'ajoutent, voir § 11.8).

### 11.5 Comparaison des 8 espèces sur 200 jours simulés (test de l'étape 3)

Protocole (script Node, sans navigateur) :

- **Même graine** (42) pour toutes les espèces, plus le profil neutre comme référence.
- **Même stratégie automatique** : l'Arche analyse puis fonde sur la **même planète et la même case** (neutre pour toutes) ; ordre de construction fixe (le premier bâtiment abordable d'une liste : foyer, puits, solaire, serre, pompe, laboratoire, fonderie, spatioport…) ; ordre de recherche fixe ; améliorations de niveau dès que possible ; aucune sonde (on mesure l'économie seule).
- Deuxième passe : chaque espèce sur une planète **favorable** (même graine, ou la graine la plus proche qui en offre une), pour mesurer l'effet du milieu.
- Mesures au jour 200 : population, production par jour (minerais, alliages, biomasse, eau, deutérium, énergie nette, recherche), technologies acquises, bâtiments et niveaux, jour où la 1re sonde est possible.
- Critère : un **score économique** (somme pondérée des productions et de la recherche) à **±10 %** du profil neutre. Une espèce hors fourchette est ajustée (§ 11.2) et la simulation relancée. Les bonus militaires (Thrennes, Kel-Tirr, Ashkari) ne se mesurent pas tant que le combat n'existe pas : revus à l'étape « espèces rivales ».

Résultats de l'étape 3 (31/10/2026). Scripts : `docs/outils/sim-especes.mjs` (lancer `node docs/outils/sim-especes.mjs . 42 1`, ou `0` en dernier argument pour le milieu réel) et `docs/outils/test-etape3.mjs` (tests des règles). Le score est la **production brute cumulée sur 200 jours**, pondérée (minerais 1, alliages 2, biomasse 0,3, eau 0,3, deutérium 0,7, énergie 0,5, recherche 1,5). La production est comptée **avant consommation**, pour que les choix du bot ne faussent pas la mesure.

**Méthode corrigée en cours de route.** Un seul bot adaptatif sur une seule graine variait de ±40 % d'une espèce à l'autre, simplement parce qu'il ne fait pas les mêmes choix. D'où deux mesures :

- **A** : la suite d'actions des Colons (graine 42) est rejouée à l'identique pour chaque espèce, ce qui isole l'effet des bonus.
- **B** : bot adaptatif sur 20 graines × les 3 planètes du système de départ, soit 60 parties par espèce, avec les médianes.

Autre correction : chaque espèce a des terrains favoris, contrairement au profil neutre. Le critère devient donc **±10 % autour de la moyenne des 8 espèces** (colonne « vs espèces »), et non plus autour du neutre.

**A. Suite d'actions identique, milieu neutralisé** (graine 42, Urlor III, tempérée)

| Espèce | Population | Minerais/j | Alliages/j | Biomasse/j | Eau/j | Deutérium/j | Énergie nette | Recherche/j | Technologies | Score vs neutre |
|---|---|---|---|---|---|---|---|---|---|---|
| Colons de l'Arche (référence) | 16 | 0,7 | 1 | 2,8 | 7,4 | 1 | 2 | 10 | 16 | 100 % |
| Vaskhar | 14 | 1,2 | 1 | 3,2 | 7,6 | 1 | 2 | 8,5 | 14 | 94 % |
| Ondésiens | 16 | 0,7 | 0,8 | 4,3 | 9,2 | 1,3 | 2 | 10 | 16 | 102 % |
| Kel-Tirr | 16 | 0,7 | 1 | 2,8 | 8,9 | 1 | 2 | 11,5 | 16 | 109 % |
| Synodes | 13 | 0,1 | 1 | 3,4 | 1,7 | 0 | 4 | 10,3 | 16 | 103 % |
| Orrhaïdes | 16 | 0,7 | 1 | 1,3 | 7,4 | 1 | 4,5 | 10 | 16 | 103 % |
| Thrennes | 15 | 0,7 | 1,3 | 3 | 5,5 | 1 | 2 | 8 | 14 | 91 % |
| Liseurs de Vey | 16 | 0,7 | 1 | 2,8 | 7,4 | 1 | 0,5 | 11,5 | 16 | 105 % |
| Ashkari | 16 | 0,7 | 1 | 2,2 | 8,2 | 1,5 | 2 | 10 | 16 | 101 % |

(Les valeurs par jour sont nettes, au jour 200 : un « 0,1 minerai/j » signifie que les fonderies consomment presque tout.)

**B. Bot adaptatif, 60 parties par espèce, milieu neutralisé**

| Espèce | vs neutre | vs espèces | 1er quartile | 3e quartile | Population moyenne | Technologies moyennes | Verdict |
|---|---|---|---|---|---|---|---|
| Colons de l'Arche | 100 % | 96 % | 95 % | 97 % | 13,5 | 12,9 | référence |
| Vaskhar | 115 % | **111 %** | 98 % | 115 % | 11,9 | 12 | limite haute |
| Ondésiens | 111 % | 107 % | 98 % | 109 % | 14 | 13,2 | ✓ |
| Kel-Tirr | 100 % | 97 % | 96 % | 108 % | 13,6 | 14,2 | ✓ (bonus de vaisseaux non mesurés) |
| Synodes | 107 % | 102 % | 99 % | 105 % | 13,1 | 14,5 | ✓ |
| Orrhaïdes | 104 % | 100 % | 99 % | 103 % | 12,6 | 13,4 | ✓ |
| Thrennes | 93 % | **90 %** | 87 % | 92 % | 13,4 | 11,2 | limite basse (bonus militaires non mesurés) |
| Liseurs de Vey | 96 % | 93 % | 92 % | 103 % | 13,5 | 13,7 | ✓ (fouilles rarement possibles) |
| Ashkari | 100 % | 96 % | 94 % | 96 % | 13,1 | 12,6 | ✓ |

**Ajustements faits pour atteindre ce résultat** (en plus de ceux du § 11.2), reportés dans `config.js` :

| Espèce | Avant | Après | Raison mesurée |
|---|---|---|---|
| Vaskhar | minerais +25 % ; croissance −20 % ; terrains volcanique + désert | **minerais +20 %** ; croissance −20 % **et recherche −15 %** ; **volcanique seul** | 138 % au départ. La croissance ne pèse presque rien, puisque c'est le nombre de logements qui limite la population : même à −30 %, rien ne changeait. |
| Ondésiens | biomasse et eau +25 % ; terrains océan + marais | biomasse +25 %, **eau +10 %** ; **océan seul** | 121 % : l'eau manque souvent, donc un bonus d'eau vaut beaucoup |
| Kel-Tirr | terrains plaine + forêt | **forêt + marais** | 133 % : la plaine accepte 8 bâtiments sur 14, c'est le meilleur terrain |
| Synodes | terrains marais + toxique | marais + toxique **+ forêt** | 93 % : leurs deux terrains n'acceptent qu'un bâtiment chacun |
| Orrhaïdes | terrains glace + désert | **glace seule** | glace et désert couvraient 44 % des cases de l'amas |
| Thrennes | alliages +15 % ; milieu hostile tempérée | **alliages +25 %** ; **hostile glacée** (sang froid) | 85 % ; la tempérée est l'une des planètes de départ les plus fréquentes |
| Liseurs de Vey | terrains glace + ruines | glace + **forêt** + ruines | les ruines ne couvrent que 0,1 % des cases |
| Ashkari | minerais −10 % | **biomasse −10 %** | 86 % avec le malus de minerais |

Couverture des terrains dans l'amas (60 graines) : désert 25,5 %, glace 18,6 %, volcanique 16,3 %, océan 10,2 %, plaine 9,4 %, toxique 9 %, marais 5,6 %, forêt 5,4 %, ruines 0,1 %.

### 11.6 Problème découvert : les planètes « favorables » étaient souvent des pièges (décidé au § 11.7)

Avec le **milieu réel**, le bot choisit comme un joueur : planète favorable d'abord, l'hostile en dernier. Quatre espèces s'effondrent alors :

| Espèce | vs espèces (milieu réel) | Ses planètes favorables |
|---|---|---|
| Thrennes | 39 % | volcanique, toxique |
| Ashkari | 41 % | océanique, lunes |
| Orrhaïdes | 53 % | glacée, désertique |
| Vaskhar | 72 % | volcanique, désertique |
| Kel-Tirr, Liseurs, Synodes, Ondésiens | 131 à 167 % | tempérée, marécageuse, océanique |

Cause : les types volcanique, toxique, glacé et désertique n'ont presque **pas de biomasse** (0 à 0,3, contre 2 à 3 pour les types tempéré, océanique et marécageux), et les lunes sont petites. La colonie finit par manquer de nourriture. Le +1 colon et la croissance +25 % ne compensent pas ce manque. À l'inverse, Ondésiens et Synodes trouvent rarement une planète favorable dans leur système de départ (10 % des parties).

Mesuré, puis retiré du code (en attente de décision) : « sur une planète favorable, les colons consomment 50 % de biomasse et d'eau en moins ». Vaskhar remonte à 117 %, Orrhaïdes à 109 % et Thrennes à 87 %, mais les Ashkari restent à 53 % et les Liseurs montent à 144 %.

Pistes proposées :

1. **Colons adaptés** : sur une planète favorable, biomasse et eau consommées −50 % (la mesure ci-dessus). Les Vaskhar digèrent la roche, les Orrhaïdes vivent de lumière : c'est cohérent avec leur histoire.
2. **Revoir les milieux favorables** pour que chaque espèce ait un type « riche » (tempéré, océanique ou marécageux) et un type rude. Les Ashkari prendraient océanique + géantes gazeuses habitables à la place des lunes.
3. Garder tel quel : le joueur choisit sa planète en connaissance de cause (sa fiche affiche les gisements et le badge « favorable »).

Recommandation : **1 + 2**, puis relancer la simulation en milieu réel.

### 11.7 Décision (31/10/2026) : pistes 1 + 2, et valeurs finales

**Piste 1, colons adaptés** (code : `colonyReport`, `economy.js`). Sur une planète favorable à son espèce, la colonie consomme **50 % de biomasse et d'eau en moins**. S'y ajoutent, comme avant, +1 colon au départ et une croissance +25 %.

**Piste 2, milieux favorables revus**. Chaque espèce a désormais un type de planète riche (tempérée, océanique ou marécageuse) et un type rude (volcanique, désertique ou glacée). Ses terrains favoris suivent ce milieu. Résultat : chaque espèce trouve une planète favorable dans son système de départ, dans **100 % des parties** (200 graines testées). Avant, Ondésiens et Synodes n'en trouvaient que dans 10 % des cas.

**Les 8 espèces, valeurs finales** (elles remplacent celles du § 2 ; source : `config.js`)

| Espèce | Force | Faiblesse | Planètes favorables / hostile | Terrains favoris (+25 %) |
|---|---|---|---|---|
| Vaskhar | Minerais +20 % | Croissance −20 %, recherche −15 % | volcanique, tempérée / océanique | volcanique |
| Ondésiens | Biomasse +25 %, eau +10 % | Alliages −20 % | océanique, glacée (océans sous la glace) / volcanique | océan |
| Kel-Tirr | Vitesse des vaisseaux +25 %, chantier spatial 15 % plus rapide | Défense et durée de vie des vaisseaux −20 % | tempérée, désertique / glacée | forêt, marais |
| Synodes | Recherche +25 % | Minerais −20 % | marécageuse, volcanique (chaleur des volcans) / désertique | marais, toxique, forêt |
| Orrhaïdes | Énergie +25 % | Biomasse −25 % | désertique, océanique (dunes et récifs cristallins) / marécageuse | désert |
| Thrennes | Attaque des vaisseaux et défense des colonies +25 %, alliages +25 % | Recherche −15 % | marécageuse, volcanique / glacée (sang froid) | volcanique, marais |
| Liseurs de Vey | Fouilles 2× plus rapides (+1 artefact chacune), technologies des Veilleurs −30 % | Énergie −15 % | glacée, tempérée / toxique | glace, ruines |
| Ashkari | Deutérium +25 %, sauts −25 % de carburant | Défense des colonies −20 %, biomasse −10 % | désertique, tempérée (peuple de caravanes) / volcanique | océan, glace |

**Simulation finale** : 20 graines × planètes du système de départ, soit 60 parties par espèce. Valeur : médiane du rapport à la moyenne des 8 espèces dans la même partie.

En **milieu réel**, le bot choisit comme un joueur : il évite la planète hostile et pèse la taille, la biomasse et le bonus favorable. (La version précédente prenait la planète favorable même stérile, et faussait le résultat.)

| Espèce | Milieu neutralisé | Milieu réel | Verdict |
|---|---|---|---|
| Vaskhar | 109 % | 103 % | ✓ |
| Ondésiens | 105 % | 91 % | ✓ |
| Kel-Tirr | 95 % | 104 % | ✓ (bonus de vaisseaux non mesurés) |
| Synodes | 101 % | 94 % | ✓ |
| Orrhaïdes | 110 % | 103 % | ✓ (limite haute en milieu neutralisé) |
| Thrennes | 91 % | **87 %** | un peu faible : bonus militaires non mesurés tant que le combat n'existe pas |
| Liseurs de Vey | 91 % | **120 %** | **trop fort en milieu réel** (planète favorable tempérée, la plus riche) |
| Ashkari | 94 % | 90 % | ✓ (limite basse) |
| (Colons de l'Arche, référence) | 95 % | 88 % | sans terrains ni planètes favorables |

**Limites de la mesure.** Le bot est simpliste, et chaque réglage déplace aussi des espèces qu'on n'a pas touchées. Exemple : retirer la forêt des terrains des Liseurs les a fait passer de 113 % à 120 % en milieu réel. J'ai arrêté les réglages ici pour ne pas sur-ajuster ce bot. À trancher en jouant :

- les Liseurs, peut-être en remplaçant leur planète favorable « tempérée » par un type rude ;
- les Thrennes, à revoir quand le combat existera.

Tests : `docs/outils/test-etape3.mjs`, **28 tests**, tous passent (dont la consommation réduite sur planète favorable).

### 11.8 Décision (02/11/2026) : propulsion animée pour tous les vaisseaux

Les vaisseaux d'espèce ont des textures procédurales (plaques, usure, relief, hublots éclairés) et des silhouettes propres ; seuls les Ondésiens gardent des anneaux. Les jets de propulsion animés (pulsation, scintillement, halo ; plus forts en voyage) s'appliquent **à tous les vaisseaux, y compris sans espèce** (option b, choisie par l'utilisateur). Les parties sans espèce et les anciennes sauvegardes gardent donc la même forme de vaisseaux, mais avec les nouveaux jets. Aucun tirage aléatoire n'est ajouté : la forme reste identique pour une même graine.

## 12. Étape 5 : rivaux, identité seulement (07/11/2026)

**Couvert** : nombre d'adversaires de 3 à 7, 4 par défaut (`RIVALS` dans `config.js`), choisi sur l'écran de choix d'espèce ; espèce, nom d'empire (`empire`) et couleur (`accent`) de chaque rival, sur la carte, la vue du système et les fiches.

**Hors champ** : IA, difficulté, vaisseaux rivaux, expansion, diplomatie, combat, portraits rivaux, équilibre selon le nombre d'adversaires. La revue des bonus militaires (§ 11.5) attend le combat.

**Données** : `star.rival` et `planet.inhabitedBy` contiennent la clé de l'espèce. Le tirage utilise son propre générateur et le placement ne change pas : l'amas reste identique quels que soient l'espèce et le nombre, et les premiers rivaux restent les mêmes quand le nombre augmente.

**Sauvegarde** : seul le nombre est enregistré (`rivals`) ; l'identité est recalculée depuis la graine, l'espèce et ce nombre. Une sauvegarde sans `rivals`, ou avec une valeur invalide, en a 4. Profil neutre : les 4 espèces historiques aux mêmes étoiles (vérifié sur 200 graines contre l'ancien code). Sauvegarde avec espèce choisie : mêmes étoiles rivales, mais l'espèce de chacune peut changer ; le journal déjà enregistré garde les anciens noms (limite acceptée).

**Décisions de l'utilisateur après relecture** : l'identité d'un rival reste cachée jusqu'à l'analyse de son système (avant : « Signaux artificiels », en rouge) ; chaque espèce a une couleur d'empire propre (`empireColor`), distincte de son `accent` utilisé par l'écran de choix et le conseiller.
