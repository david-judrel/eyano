#!/bin/bash
set -euo pipefail

echo "============================================"
echo "  Eyano - Production Deployment Script"
echo "============================================"

# Load environment variables
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
else
    echo "ERROR: .env file not found. Copy .env.example to .env and configure it."
    exit 1
fi

if [ ! -f "docker-compose.yml" ]; then
    echo "ERROR: docker-compose.yml not found."
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose is not available."
    exit 1
fi

POSTGRES_USER=${POSTGRES_USER:-eyano}

echo ""
echo "[1/6] Pulling latest code..."
git pull origin main 2>/dev/null || echo "  WARNING: Could not pull latest code (no git remote)"

echo ""
echo "[2/6] Building Docker images..."
docker compose build --no-cache

echo ""
echo "[3/6] Stopping old containers..."
docker compose down

echo ""
echo "[4/6] Starting services..."
docker compose up -d

echo ""
echo "[5/6] Waiting for PostgreSQL to be healthy..."

for i in {1..30}; do
    if docker compose exec postgres pg_isready -U "$POSTGRES_USER" &>/dev/null; then
        echo "  PostgreSQL is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "  ERROR: PostgreSQL did not become ready in time."
        exit 1
    fi
    sleep 1
done

echo ""
echo "[6/6] Running Prisma schema push..."
docker compose exec api npx prisma db push --schema=../../packages/database/prisma/schema.prisma --skip-generate || {
    echo "  WARNING: Schema push failed. Check logs: docker compose logs api"
}

echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo ""
docker compose ps
echo ""
echo "Logs: docker compose logs -f"
echo "Stop:  docker compose down"
echo ""
