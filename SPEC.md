# Scores de la famille — spécification

Site pour noter les scores des jeux de cartes en famille, en direct depuis un téléphone posé sur la table, et garder l'historique pour les stats. En ligne sur `https://scores.jimmydore.fr`. Cadeau de Noël 2026 : en ligne avant le **12/12/2026**, première utilisation le 13/12.

Un QR code imprimé sur une carte du jeu de belote pointe sur la racine `/` : l'accueil doit servir dès le scan.

## Public

Des parents de 60 ans peu à l'aise avec la tech. Mobile d'abord, gros boutons (≥ 56 px), texte ≥ 18 px, peu d'écrans, aucune inscription.

## Vocabulaire

- **Jeu** : belote, 5 rois, Skull King, 6 qui prend. Défini dans le code (`src/lib/games.ts`).
- **Partie** : une série de manches d'un jeu, avec un gagnant (ou une égalité). La belote se joue en 12 manches. Une soirée à 3 parties = 3 parties.
- **Manche** : une ligne de scores, une valeur par camp.
- **Camp** : une équipe (belote) ou un joueur (autres jeux).

## Jeux

| Jeu | Camps | Fin | Gagnant | Saisie |
|---|---|---|---|---|
| Belote | 2 équipes de 2 | 12 manches | plus haut total | on touche l'équipe à noter, l'autre se pré-remplit à 162 − x (corrigeable) ; raccourcis +20 belote, Capot (252/0), Dedans (0/162) pour l'équipe sélectionnée |
| 5 rois | 2–8 joueurs | 11 manches (3 → roi) | plus bas total | un nombre par joueur |
| Skull King | 2–8 joueurs | 10 manches | plus haut total | avant la manche : annonce de chaque joueur (0 → n) ; après : plis faits + bonus (pas de 10) ; score calculé, règles classiques |
| 6 qui prend | 2–10 joueurs | dès qu'un joueur atteint 66 (modifiable au lancement) | plus bas total | un nombre par joueur |

Barème Skull King classique (manche n) : annonce ≥ 1 réussie = 20 × plis + bonus ; ratée = −10 × écart ; annonce 0 réussie = +10 × n ; ratée = −10 × n. Le bonus ne compte que si l'annonce est réussie.

Le modèle accepte d'autres jeux : score par joueur ou par équipe, plus haut ou plus bas gagne, fin au nombre de manches ou au score cible. Ajouter un jeu = ajouter une entrée dans `games.ts`.

Égalité des meilleurs totaux à la fin : partie « égalité », sans vainqueur.

## Écrans (MVP)

1. **Accueil** `/` : parties en cours (« Reprendre »), « Nouvelle partie », « Les stats », 5 dernières parties terminées. Se rafraîchit seul.
2. **Nouvelle partie** `/nouvelle` : tuiles des jeux → choix des joueurs (belote : équipe 1 puis équipe 2) → « C'est parti ». « + Ajouter quelqu'un » demande juste un prénom.
3. **Partie** `/partie/[id]` : la grille façon feuille de papa (une colonne par camp, totaux en tête, le camp en tête surligné), un tiroir de saisie en bas avec pavé numérique. Toucher une manche passée permet de la modifier ou de la supprimer. À la fin : le vainqueur, « Rejouer avec les mêmes ». Supprimer la partie (confirmation dans la page). Rafraîchissement automatique toutes les 5 s quand on ne saisit rien (plusieurs téléphones).
4. **Stats** `/stats` : un onglet par jeu et un onglet « Tous jeux », puis l'historique complet.

## Stats (MVP)

Par jeu : parties jouées, victoires et % par joueur ; meilleur total (et pire total pour les jeux où le plus bas gagne) ; meilleure manche ; plus longue série de victoires et série en cours ; pour la belote, classement des duos.
Tous jeux : victoires totales par joueur, joueur le plus actif.

## Écriture protégée

Lecture libre. Toute écriture demande le **code famille** (`FAMILY_CODE`), saisi une fois par téléphone puis mémorisé dans un cookie d'un an.

## Design

Variante D du prototype (`prototype/design.html`, branche `prototype/design`) : la grille de la feuille de papa (chiffres manuscrits bleus, police Caveat) sur un fond tapis de jeu vert, cartes crème, boutons dorés, titres en Fraunces, texte en Atkinson Hyperlegible.

## Joueurs de départ

Alain, Lili, Thomas, Morgane, Jimmy, Philippe, Marie-France. Ils ne sont **pas** dans le dépôt (public) : ils sont insérés dans la base de prod avec la feuille de papa (script `scripts/seed.mjs`, données lues sur l'entrée standard).

## Données de départ

Feuille de belote de papa du 14/11/2026 : Alain + Philippe contre Lili + Marie-France, 3 parties de 12 manches, 1073–1061, 628–1336, 1010–1084, importées manche par manche (2e partie, manche 10 : 70 / 112).

## Stack

SvelteKit (adapter-node) + SQLite (better-sqlite3) dans un seul conteneur : un seul process sert les pages et écrit les données, la base est un fichier sauvegardé chaque nuit sur R2. Pages rendues côté serveur, formulaires qui marchent même sans JS.

## Contrat de déploiement

- Écoute `0.0.0.0:$PORT` (3000).
- `GET` et `HEAD /health` → 200.
- Écrit seulement dans `DATA_DIR=/data` (uid 1000), base `scores.db`.
- HTML en `Cache-Control: no-cache`, `/_app/immutable/` immuable.
- `ORIGIN=https://scores.jimmydore.fr`, `ADDRESS_HEADER=X-Forwarded-For`, `XFF_DEPTH=1`.
- Secret : `FAMILY_CODE`.

## Bonus (après le 12/12)

Regroupement par soirée ; formulaire « Ajouter un jeu » ; courbes de score ; face-à-face entre deux joueurs ; « bête noire » ; stats par soirée ; correction manuelle d'un score Skull King ; touche de Noël en décembre.
