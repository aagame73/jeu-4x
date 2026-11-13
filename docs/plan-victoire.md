# Plan : victoire et fin de partie

État : **décisions prises le 13/11/2026 (§ 3) ; animations validées.** Étape 1 faite.

| Étape | Contenu | Où on en est |
|---|---|---|
| 1 | Calcul des conditions (victoire, défaite), sans affichage, avec tests Node | fait (`src/victory.js`, `test-victoire.mjs`) |
| 2 | Mondes natals rivaux prenables par un long siège ; un empire qui perd le sien disparaît (adapter `validEmpires`, qui refuse un empire sans colonie) | à faire |
| 3 | Compteur d'objectifs dans le bandeau, détail au clic, annonces du conseiller | à faire |
| 4 | Écran de fin : bilan, « Nouvelle partie » ; la partie est terminée (bouton Pause verrouillé) | à faire |
| 5 | Animations de victoire et de défaite, différentes pour chaque espèce (§ 5) | à faire |

## 1. Point de départ

- Idée du 07/11/2026 (`docs/plan-rivaux-ia.md` § 6) : tu gagnes si tu **occupes 80 % des systèmes** ou s'il **n'y a plus d'ennemis**. Un système où tu as une colonie compte pour toi, même partagé avec un rival.
- Aujourd'hui, rien ne termine la partie. Perdre toutes ses colonies ne fait rien.
- **Obstacle** : les mondes natals rivaux sont imprenables (`combat.js`, `besiegeable`). Un empire ne peut donc jamais disparaître, et la victoire « plus d'ennemis » est impossible.
- Ordres de grandeur : l'amas compte 140 systèmes. En simulation sans joueur, le plus grand empire rival touche environ 17 % des systèmes colonisables au jour 5 000, et 35 % au jour 20 000.

## 2. Proposition

**Victoire par expansion.** Tu gagnes quand tes colonies occupent 80 % des systèmes qui comptent (question 1).

**Victoire par élimination.** Tu gagnes quand plus aucun empire rival n'existe : chacun a perdu toutes ses colonies, monde natal compris (question 2).

**Défaite.** Tu perds quand tu n'as plus aucune colonie, ni aucun vaisseau capable d'en fonder une (Arche ou vaisseau colonie).

**Suivi.** Un petit indicateur « Objectifs » (bandeau ou écran) affiche :
- ta part des systèmes, par exemple 23 % sur 80 % ;
- le nombre d'empires rivaux encore en vie.

Le conseiller annonce les étapes : 50 %, 70 %, puis un empire éliminé.

**Écran de fin** : plein écran, avec :
- le titre (victoire ou défaite) ;
- la réplique de l'espèce ;
- un bilan : jours de jeu, systèmes, colonies, technologies, empires éliminés, batailles gagnées.

Un bouton « Nouvelle partie » (et le retour au menu) : la partie est terminée (décision 4). La victoire est enregistrée dans la sauvegarde, pour ne pas la rejouer à chaque chargement.

**Fichiers touchés** :
- nouveau `src/victory.js` (règles) et nouveau `src/endView.js` (écran) ;
- `combat.js`, si les mondes natals deviennent prenables ;
- `main.js`, `ui.js`, `save.js`, `config.js` (réglages `VICTORY`) ;
- styles, docs, test `docs/outils/test-victoire.mjs`.

## 3. Décisions (13/11/2026)

1. Les 80 % se comptent sur les **systèmes colonisables** (au moins une planète où une colonie est possible).
2. Les **mondes natals deviennent prenables** par un long siège, avec une défense très forte. Un empire qui perd le sien disparaît, et ses autres colonies deviennent indépendantes (plus personne ne les tient).
3. **Aucun rival ne gagne** pour l'instant. À revoir avec le niveau de difficulté.
4. **Pas de « continuer » après la victoire** : la partie se termine. L'écran de fin ne propose que « Nouvelle partie » (et le retour au menu). La sauvegarde garde la partie marquée comme finie : la recharger rouvre l'écran de fin.
5. Compteur d'objectifs **dans le bandeau**, détail au clic.
6. Autres victoires (Héritage, alliances) : plus tard.
7. **Une animation de victoire et une de défaite, différentes pour chaque espèce** (§ 5).

### Questions posées à l'origine

1. **Quels systèmes comptent pour les 80 % ?**
   - **Option A (recommandée)** : les systèmes colonisables, c'est-à-dire ceux qui ont au moins une planète où une colonie est possible. Les systèmes vides ne comptent pas, sinon la barre est presque impossible à atteindre.
   - **Option B** : les 140 systèmes de l'amas.
2. **Mondes natals rivaux**
   - **Option A (recommandée)** : les rendre prenables par un long siège, avec une défense très forte (par exemple 3 fois celle d'une colonie, et beaucoup plus de jours). Quand un empire perd son monde natal, il disparaît, et ses autres colonies deviennent indépendantes ou passent à toi.
   - **Option B** : les laisser imprenables. Un empire est alors « éliminé » quand il ne lui reste que son monde natal et qu'il capitule. La capitulation fait de lui un vassal en paix, qui ne compte plus comme ennemi.
3. **Un rival peut-il gagner ?**
   - **Option A (recommandée pour l'instant)** : non. Tu ne perds qu'en perdant tout.
   - **Option B** : oui, s'il atteint lui-même 80 %. Ce serait une défaite pour toi.
4. **Après la victoire** : proposer de continuer la partie (recommandé), ou finir la partie obligatoirement ?
5. **Où afficher les objectifs ?**
   - **Option A (recommandée)** : un petit compteur dans le bandeau du haut ; au clic, le détail.
   - **Option B** : seulement dans un écran à part.
6. **Autres victoires** (le fil rouge de l'Héritage, la victoire diplomatique par alliances) : plus tard, recommandé.

## 4. Vérification

**Tests Node** :
- la part des systèmes ;
- la victoire à 80 % ;
- l'élimination d'un empire ;
- la défaite ;
- les anciennes sauvegardes (sans le champ victoire) ;
- la victoire non rejouée au chargement.

**Navigateur** : forcer la victoire puis la défaite avec `window.jeu`, et vérifier l'écran de fin et « Nouvelle partie » (pas de « Continuer », décision 4).

**Ensuite** : relecteur, puis commit après chaque étape ; publication à ta demande.

## 5. Animations de fin, par espèce (proposition à valider)

Même technique que la cinématique du premier contact (`contactView.js`) : dessinée en direct en Canvas, sans fichier vidéo, environ 12 secondes, passable d'un clic. On y voit le **portrait animé** de ton espèce (`aliens.js`), puis l'écran de bilan apparaît par-dessus.

Chaque espèce a sa propre scène, en version **victoire** (lumière, élan) et en version **défaite** (sombre, ralentie) :

| Espèce | Victoire | Défaite |
|---|---|---|
| Vaskhar | une cité creusée dans le basalte s'illumine ; braises et éclats de roche qui montent | la roche se fissure et s'effondre, la poussière retombe |
| Ondésiens | des méduses montent en spirale, leurs filaments s'allument un à un | les filaments s'éteignent, les méduses coulent vers le fond |
| Kel-Tirr | un essaim de plumes tourbillonne et dessine une étoile | l'essaim se disperse au vent, quelques plumes tombent |
| Synodes | un réseau de filaments s'étend sur tout l'amas, chaque nœud s'allume | le réseau se coupe, les nœuds s'éteignent un à un |
| Orrhaïdes | des cristaux poussent et chantent : anneaux de lumière à chaque note | les cristaux se fêlent et perdent leur éclat |
| Thrennes | une coque se grave de traits rouges, un par victoire | les gravures s'effacent, la coque se brise |
| Liseurs de Vey | les glyphes des Veilleurs s'assemblent en une grande figure | les glyphes se défont et retombent en poussière |
| Ashkari | une caravane de voiles traverse une géante gazeuse au lever du soleil | les voiles se déchirent, la caravane dérive dans la nuit |
| Colons de l'Arche | l'Arche réparée saute vers les étoiles | l'Arche dérive, ses lumières s'éteignent |

La réplique de l'espèce s'affiche en même temps : une nouvelle réplique par espèce pour la victoire, et une pour la défaite, ajoutées dans `dialogues.js`.

**Fichier** : nouveau `src/endingFx.js` (les 9 × 2 scènes), utilisé par `endView.js`.
