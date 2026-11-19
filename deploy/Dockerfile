# --- Build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
# Modules natifs (better-sqlite3...) : si aucun binaire précompilé ne correspond
# (musl + ABI de Node 24), npm les compile avec node-gyp. Filet de sécurité.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# mkdir : un serveur sans dépendance (live-buzzer) n'a pas de node_modules, et
# le COPY de l'étape runtime échouerait.
RUN npm run build --if-present \
 && npm prune --omit=dev \
 && mkdir -p node_modules

# --- Runtime -------------------------------------------------------------
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DATA_DIR=/data
# node_modules vient de l'étape build (même image de base, donc même libc et
# même ABI) : les modules natifs y sont déjà compilés.
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# deploy/backup.sh via `docker exec`.
COPY --from=build /app/scripts ./scripts
# /data est normalement monté (/root/scores-data, uid 1000) ; le créer ici
# permet aussi de lancer l'image seule en local.
RUN mkdir -p /data && chown node:node /data
EXPOSE 3000
# Utilisateur `node` (uid 1000) : /root/scores-data lui appartient sur l'hôte.
USER node
# wget vient de busybox (code 1 en cas d'échec). 127.0.0.1 plutôt que
# localhost, qui peut viser ::1.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:3000/health"]
CMD ["node", "build"]
