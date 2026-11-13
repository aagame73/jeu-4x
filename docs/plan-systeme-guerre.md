# Plan : vaisseaux, flottes et combats dans la vue 3D du système

État : **fait** (validé le 2026-11-13). Décisions au § 3.

| Étape | Contenu | Où on en est |
|---|---|---|
| 1 | Vaisseaux du joueur dans la vue du système | fait |
| 2 | Flottes ennemies et convois dans la vue du système | fait |
| 3 | Combats animés dans la vue du système | fait |
| 4 | Panneau de bataille (forces en présence, état des coques, siège) | fait |

## 1. Point de départ

- La **vue du système** (`systemView.js`, double-clic sur une étoile) montre l'étoile, les planètes, les lunes et les anneaux. Elle ne montre **aucun vaisseau**, même pas les tiens.
- Sur la **carte de l'amas** (`scene.js`), on voit déjà tes vaisseaux, les convois, les flottes ennemies (anneau rouge) et les tirs pendant les combats (`game.battles`).
- Le combat lui-même est calculé jour par jour dans `combat.js` : la vue n'a qu'à le montrer, sans rien changer aux règles.

## 2. Proposition

**Vaisseaux en orbite.** Dans la vue du système, chaque vaisseau présent (le tien, celui d'une flotte ennemie, un convoi) apparaît avec son modèle 3D, à son style d'espèce, en orbite haute autour de l'étoile, ou en orbite d'une planète quand il l'assiège ou la défend. Les vaisseaux qui arrivent ou partent traversent la vue.

**Combat animé.** Quand le système est en combat :
- les deux camps se font face près de la planète disputée ;
- tirs (traits lumineux, torpilles lentes pour les gros vaisseaux), impacts et boucliers qui scintillent ;
- un vaisseau détruit explose en débris ;
- la défense de la colonie (anneaux, batteries) tire depuis la planète.

Les tirs sont décoratifs : ils suivent le rythme du combat, mais le résultat vient toujours de `combat.js`.

**Panneau de bataille** (dans la vue du système, pendant un combat) : les deux camps, le nombre et le type de vaisseaux, une barre d'état par vaisseau (coque), et l'état du siège (défense restante ou jours avant la chute).

**Performance** : modèles mis en cache par espèce et type, au plus une douzaine de vaisseaux affichés par camp (au-delà, un « +N »), tirs recyclés.

**Fichiers touchés** : `systemView.js` (vaisseaux, combats, panneau), éventuellement un nouveau `src/battleFx.js` (effets de tir et d'explosion partagés avec `scene.js`), `styles/systeme.css`, docs. Aucune règle de jeu ne change.

## 3. Décisions (2026-11-13)

1. Tes vaisseaux sont visibles aussi en temps de paix.
2. La vue du système s'ouvre d'elle-même au début d'un combat chez toi (elle attend qu'un écran ouvert se ferme).
3. Panneau de bataille simple : forces et barres d'état.
4. Pendant un combat chez toi, le temps est ralenti (`COMBAT.battleSpeed`, 0,5 jour par seconde), badge « ⚔ ralenti » ; la pause reste possible.

Réalisation : `src/systemFleets.js` (vaisseaux, tirs, torpilles, explosions), `systemView.js` (panneau), `main.js` (ralenti, ouverture), `combat.js` (`playerBattles`, états des coques).

Pas faits, notés pour plus tard : le « +N » au-delà de 12 vaisseaux par camp (les suivants ne sont simplement pas affichés), les boucliers qui scintillent, le recyclage des tirs (chaque tir est créé puis libéré, sans souci mesuré).

### Questions posées à l'origine

1. **Tes vaisseaux aussi ?** Afficher aussi tes vaisseaux dans la vue du système, même en paix (recommandé : la vue est plus vivante, et on voit qui défend), ou seulement pendant les combats ?
2. **Ouverture automatique ?** Quand un combat commence chez toi, ouvrir la vue du système automatiquement (risque d'interrompre ce que tu fais), ou simplement l'annoncer avec un bouton « Voir le combat » dans le journal et la fiche (recommandé) ?
3. **Panneau de bataille** : le garder simple (forces et barres d'état, recommandé), ou plus détaillé (attaque, défense, dégâts du jour) ?
4. **Ralenti** : pendant un combat dans la vue du système, ralentir le temps du jeu pour mieux voir (par exemple vitesse ×1 forcée), ou laisser la vitesse choisie (recommandé : tu gardes la main, pause possible) ?

## 4. Vérification

- Tests Node : aucune règle ne change, les tests existants doivent tous passer.
- Navigateur : un combat réel dans la vue du système, avec captures ; mesure de la fluidité avec une douzaine de vaisseaux par camp.
- Relecteur, puis commit après chaque étape validée ; publication à ta demande.
