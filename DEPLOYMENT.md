# Eyano - Deployment Guide

## Prerequis du VPS

- OS: Ubuntu 22.04 LTS / Debian 12 ou superieur
- RAM: 2 Go minimum (4 Go recommande)
- Disk: 20 Go minimum
- Ports ouverts: 80, 443, 22 (SSH)

## 1. Installation de Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

## 2. Installation de Docker Compose

Docker Compose est inclus avec Docker. Verifier:

```bash
docker compose version
```

## 3. Cloner le projet

```bash
git clone <your-repo-url> /opt/eyano
cd /opt/eyano
```

## 4. Configurer le domaine

1. Configurer les DNS:
   - `example.com` → IP du VPS
   - `api.example.com` → IP du VPS

2. Modifier le Caddyfile:
   ```bash
   nano Caddyfile
   ```
   Remplacer `example.com` et `api.example.com` par vos domaines reels.

## 5. Configurer l'environnement

```bash
cp .env.example .env
nano .env
```

Remplir toutes les variables obligatoires:
- `POSTGRES_PASSWORD` — mot de passe fort pour PostgreSQL
- `AUTH_SECRET` — secret aleatoire (generer avec `openssl rand -hex 32`)
- `ADMIN_API_KEY` — cle API admin (generer avec `openssl rand -hex 32`)
- `GEMINI_API_KEY_1` — cle API Gemini
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth Google
- `FRONTEND_URL` — `https://example.com`
- `NEXT_PUBLIC_API_URL` — `https://api.example.com/api`
- `DOMAIN` — `example.com`
- `API_DOMAIN` — `api.example.com`

## 6. Premier deploiement

```bash
chmod +x deploy.sh
./deploy.sh
```

Ou manuellement:

```bash
docker compose build
docker compose up -d
docker compose exec postgres pg_isready -U eyano
docker compose exec api npx prisma db push --schema=../../packages/database/prisma/schema.prisma
```

## 7. Creer le premier admin

```bash
docker compose exec api node scripts/create-admin.js
```

## 8. Verification

```bash
docker compose ps
docker compose logs api --tail=50
docker compose logs web --tail=50
curl -k https://api.example.com/api/health
curl -k https://example.com
```

## Commandes utiles

### Logs
```bash
docker compose logs -f              # tous les services
docker compose logs -f api          # backend uniquement
docker compose logs -f web          # frontend uniquement
docker compose logs -f postgres     # base de donnees
docker compose logs -f caddy        # reverse proxy
```

### Redemarrage
```bash
docker compose restart              # tous
docker compose restart api          # backend
docker compose restart web          # frontend
```

### Shell dans un conteneur
```bash
docker compose exec api sh
docker compose exec web sh
docker compose exec postgres sh
```

### Arreter
```bash
docker compose down                 # arrete les containers
docker compose down -v              # ARRETE + SUPPRIME LES VOLUMES (ATTENTION!)
```

### Mise a jour
```bash
git pull
docker compose build --no-cache
docker compose up -d
docker compose exec api npx prisma migrate deploy --schema=../../packages/database/prisma/schema.prisma
```

## Backup PostgreSQL

### Dump
```bash
docker compose exec postgres pg_dump -U eyano eyano > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restauration
```bash
cat backup.sql | docker compose exec -T postgres psql -U eyano -d eyano
```

### Backup automatique (cron)
```bash
# Ajouter au crontab du VPS
0 3 * * * cd /opt/eyano && docker compose exec -T postgres pg_dump -U eyano eyano > /var/backups/eyano/backup_$(date +\%Y\%m\%d).sql 2>/dev/null
```

## Diagnostic

### Le backend ne demarre pas
```bash
docker compose logs api --tail=100
```

### La base de donnees n'est pas prete
```bash
docker compose exec postgres pg_isready -U eyano
docker compose restart postgres
```

### Le frontend ne charge pas
```bash
docker compose logs web --tail=100
curl -v http://localhost:3000
```

### Caddy ne resolve pas HTTPS
```bash
docker compose logs caddy --tail=100
docker compose restart caddy
```

## Architecture Docker

```
Internet
   │
   ↓
Caddy (:80/:443)
   ├──→ web:3000  (example.com)
   └──→ api:3001  (api.example.com)
              │
              ↓
         postgres:5432
```

- **Caddy**: Reverse proxy avec HTTPS automatique (Let's Encrypt)
- **web**: Next.js frontend (port 3000, non expose)
- **api**: NestJS backend (port 3001, non expose)
- **postgres**: PostgreSQL 16 (port 5432, accessible uniquement via reseau Docker)

## Securite

- PostgreSQL et Redis ne sont PAS exposes publiquement
- HTTPS active via Caddy/Let's Encrypt
- Headers de securite configures (X-Content-Type-Options, X-Frame-Options, etc.)
- Mots de passe jamais en dur dans docker-compose.yml
- Applications non root dans les conteneurs

## Problemes courants

| Probleme | Solution |
|---|---|
| `connection refused` API | Verifier que postgres est healthy: `docker compose ps` |
| `ECONNREFUSED` DB | Verifier DATABASE_URL, `docker compose restart postgres` |
| Pas de HTTPS | Verifier les DNS, `docker compose logs caddy` |
| Admin button absent | Creer un admin: `docker compose exec api node scripts/create-admin.js` |
| Migration error | `docker compose exec api npx prisma db push --schema=../../packages/database/prisma/schema.prisma` |
