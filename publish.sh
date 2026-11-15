#!/bin/bash
# ==========================================================
# DAG SF - Publicar backend en GitHub
# Ejecutar: bash /Users/imac-ia/.openclaw/workspace/dagsf-backend/publish.sh
# ==========================================================
set -euo pipefail

REPO_DIR="/Users/imac-ia/.openclaw/workspace/dagsf-backend"
REPO_NAME="dagsf-backend"
GH_USER="Developmentart1"

cd "$REPO_DIR"

echo "==> 1/5 Aislando el repo dentro de dagsf-backend/"
if [ -d "$REPO_DIR/.git" ]; then
  BACKUP="$REPO_DIR/.git.bak.$(date +%s)"
  mv "$REPO_DIR/.git" "$BACKUP"
  echo "    .git previo movido a $(basename "$BACKUP")"
fi

echo "==> 2/5 Inicializando repo"
git init -b main
git config user.name "Miguel Izaguirre"
git config user.email "Developmentart1@users.noreply.github.com"

echo "==> 3/5 Commit"
git add -A
git commit -m "feat: backend DAG SF - API REST para SOFOM con PostgreSQL, Redis, MinIO y Directus"

echo "==> 4/5 Publicando en GitHub"
if gh repo view "$GH_USER/$REPO_NAME" >/dev/null 2>&1; then
  echo "    El repo ya existe; se reutiliza."
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://github.com/$GH_USER/$REPO_NAME.git"
  git push -u origin main
else
  gh repo create "$REPO_NAME" --public \
    --description "Backend API para DAG Soluciones Financieras (SOFOM)" \
    --source=. --remote=origin --push
  echo "    Repo creado y primer push hecho."
fi

echo "==> 5/5 Verificando"
git remote -v
git log --oneline -1
gh repo view "$GH_USER/$REPO_NAME" --json name,visibility,url
echo ""
echo "Listo: https://github.com/$GH_USER/$REPO_NAME"
