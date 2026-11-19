# Déploiement de Scores de la famille

Production : https://scores.jimmydore.fr, sur le VPS Hetzner `77.42.23.215`
(alias SSH `hetzner`), à côté des autres stacks Docker.

## Comment ça marche

Chaque push sur `main` lance `.github/workflows/deploy.yml` :

1. **test** : `npm ci`, `npm test` puis `npm run build` sur Node 24.
2. **deploy** (si les tests passent) :
   - vérifie que `FAMILY_CODE` est présent et ne contient ni antislash ni
     retour à la ligne ;
   - se connecte en SSH à `root@77.42.23.215` avec la clé `DEPLOY_SSH_KEY` ;
   - clone le dépôt public en HTTPS dans `/root/scores` (ou `git fetch` +
     `git checkout -B main origin/main` s'il existe déjà) ;
   - écrit `/root/scores/.env` (mode 600, les secrets de l'app) en l'envoyant
     par stdin SSH ;
   - crée `/root/scores-data` (uid 1000, mode 700) ;
   - `docker compose up -d --build --remove-orphans` puis `docker image prune -f` ;
   - attend que les conteneurs soient sains, vus depuis le serveur ;
   - si les secrets R2 sont là, écrit `/root/.scores-backup.env` et installe
     `/etc/cron.d/scores-backup` ; sinon, supprime les deux.
3. **health** : attend jusqu'à 150 s que `https://scores.jimmydore.fr/health`
   réponde 200 en GET et en HEAD.

Le conteneur `scores-web` écoute sur le port 3000 sans le publier. Il
rejoint le réseau Docker externe `ravetycoon_default`, où le Caddy partagé le
trouve par son nom. Les autres variables sont dans `docker-compose.yml`.

Pour redéployer sans nouveau commit : onglet Actions, « Deploy to Hetzner »,
« Run workflow » (ou `gh workflow run deploy.yml -R JimmyDore/scores`).

## Secrets GitHub Actions

| Secret | Rôle |
|---|---|
| `DEPLOY_SSH_KEY` | clé privée SSH dédiée (`~/.ssh/deploy_scores`, commentaire `github-actions-scores`) ; sa clé publique est dans `/root/.ssh/authorized_keys` sur le serveur |
| `DEPLOY_KNOWN_HOSTS` | sortie de `ssh-keyscan -t ed25519,rsa,ecdsa 77.42.23.215` |
| `FAMILY_CODE` | secret de l'app (ni antislash ni retour à la ligne) |
| `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | accès au bucket Cloudflare R2 `hetzner-backups` (les mêmes que les autres projets) |
| `SLACK_WEBHOOK_URL` | alerte Slack si une sauvegarde échoue (facultatif) |

Sans les trois secrets R2, le déploiement marche mais les sauvegardes sont
désactivées.

## Ce qui vit hors de ce dépôt

- **DNS** : enregistrement A `scores.jimmydore.fr → 77.42.23.215` chez IONOS.
- **Reverse proxy / TLS** : la route
  `scores.jimmydore.fr { reverse_proxy scores-web:3000 }` est dans
  `deploy/Caddyfile` du dépôt **RaveTycoon**. On la modifie là-bas (commit +
  push, le déploiement de RaveTycoon recrée Caddy), jamais à la main sur le
  serveur : un Caddyfile cassé coupe tous les sites du VPS. Valider avant de
  pousser :
  `docker run --rm -v "$PWD/deploy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile`.
- **Sur le serveur** : `/root/scores/.env`, `/root/scores-data/`,
  `/root/.scores-backup.env`, `/etc/cron.d/scores-backup`,
  `/var/log/scores-backup.log`.

## Sauvegardes

Tous les jours à 4:30 (heure du serveur), `deploy/backup.sh` :

1. demande au conteneur un snapshot cohérent :
   `docker exec scores-web node scripts/backup.mjs /data/snapshot.db` ;
2. l'envoie avec rclone (conteneur éphémère) vers
   `r2:hetzner-backups/scores/<AAAAMMJJ_HHMMSS>/scores.db` ;
3. supprime les sauvegardes de plus de 365 jours sous `scores/` ;
4. supprime le snapshot local.

Slack n'est prévenu qu'en cas d'échec. Lancer une sauvegarde à la main et lire
les logs :

```sh
ssh hetzner /root/scores/deploy/backup.sh
ssh hetzner tail -n 50 /var/log/scores-backup.log
```

## Restaurer une sauvegarde

Sur le serveur (`ssh hetzner`) :

```sh
ENV=/root/.scores-backup.env

# 1. Lister les sauvegardes et choisir une date
docker run --rm --env-file $ENV rclone/rclone:1 lsd r2:hetzner-backups/scores

# 2. La télécharger
D=20260918_023000   # à adapter
mkdir -p /root/scores-restore
docker run --rm --env-file $ENV -v /root/scores-restore:/restore \
  rclone/rclone:1 copy "r2:hetzner-backups/scores/$D/" /restore/

# 3. Arrêter l'app et mettre les données actuelles de côté
cd /root/scores
docker compose stop scores-web
mkdir -p /root/scores-data/avant-restauration
```

```sh
mv /root/scores-data/scores.db* /root/scores-data/avant-restauration/

# 4. Mettre la sauvegarde en place (propriétaire uid 1000) et redémarrer
install -o 1000 -g 1000 -m 600 /root/scores-restore/scores.db /root/scores-data/scores.db
docker compose start scores-web
curl -fsS https://scores.jimmydore.fr/health
```

Quand tout est vérifié, supprimer `/root/scores-restore` et
`/root/scores-data/avant-restauration`.

## Secrets de l'app

Ils sont rangés dans le trousseau macOS (session) :

```sh
security find-generic-password -s scores-family-code -w
```

Pour en changer un : générer une nouvelle valeur, la mettre dans le trousseau
(`security add-generic-password -U -s scores-family-code -a FAMILY_CODE -w`,
qui la demande), dans le secret
(`security find-generic-password -s scores-family-code -w | gh secret set FAMILY_CODE -R JimmyDore/scores`),
puis relancer le workflow.

## Importer des parties déjà jouées

`scripts/seed.mjs` ajoute des joueurs et des parties lus sur l'entrée standard (format en tête du
script). Les données ne sont pas dans le dépôt, qui est public. Relancer le même fichier ne crée pas
de doublon.

```bash
ssh hetzner 'docker exec -i scores-web node scripts/seed.mjs' < feuille.json
```
