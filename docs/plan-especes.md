# Plan : choix de l'espèce en début de partie

État : **plan validé**. Étape 1 (données) faite le 31/10/2026 ; étapes 2 à 5 à venir. Les décisions de design sont en fin de document.

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
3. **Bonus** — économie, croissance, recherche, vaisseaux, défense, milieu. *Test* : Node — même graine, 100 jours simulés avec deux espèces : les écarts attendus (+25 % / −20 %) apparaissent sur les bons axes, et rien d'autre ne change.
4. **Vaisseaux** — paramètre `style` dans `ships.js`, branché partout. *Test* : navigateur — vignettes des 8 espèces × 3 types côte à côte, chacune reconnaissable ; vaisseaux de l'amas et de la flotte au style de l'espèce jouée.
5. **(Si oui à la question 2) Rivaux** — les espèces rivales tirées parmi les 7 restantes, noms et couleurs dans la carte et les fiches. *Test* : navigateur et Node.

## 10. Décisions (validées le 31/10/2026)

1. **Milieu de prédilection** : les deux effets. Planète favorable : +1 colon au départ et croissance +25 % ; planète hostile : croissance −50 %. Les cases des terrains liés au milieu produisent +25 %.
2. **Empires de l'ordinateur** : oui, chacun prend une des 7 espèces non choisies (données et style préparés maintenant, comportement avec l'étape « espèces rivales »).
3. **Anciennes sauvegardes** : profil neutre « Colons de l'Arche », sans bonus ni malus.
4. **Espèces** : les 8 propositions du § 2 sont validées.
