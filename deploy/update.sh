#!/usr/bin/env bash
# Atualiza o NewFlow na Raspberry: git pull + deps + build do frontend + restart.
# Requisitos: node + yarn instalados (para o build). Rode a partir de qualquer lugar.
set -e

APP_DIR="$HOME/websites/newflow"
PUBLIC_DIR="$APP_DIR/public"

echo "==> git pull"
cd "$APP_DIR" && git pull

echo "==> backend deps"
cd "$APP_DIR/backend"
source venv/bin/activate
pip install -r requirements.txt

echo "==> build do frontend (API relativa)"
cd "$APP_DIR/frontend"
REACT_APP_BACKEND_URL="" yarn install --frozen-lockfile
REACT_APP_BACKEND_URL="" yarn build

echo "==> publicar em public/"
mkdir -p "$PUBLIC_DIR"
rm -rf "${PUBLIC_DIR:?}"/*
cp -r build/* "$PUBLIC_DIR"/

echo "==> reiniciar backend"
sudo systemctl restart newflow-backend

echo "==> OK! Recarregue https://newflow.newhybrid.com"
