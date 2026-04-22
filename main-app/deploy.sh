#!/bin/bash
# ─── AByte Main App — VPS Deploy Script ──────────────────────────────────────
# Run from VPS: bash /var/www/abyte-pos/main-app/deploy.sh

set -e

PROJECT_DIR="/var/www/AByte-POS/main-app"
FRONTEND_DIR="$PROJECT_DIR/frontend"
BACKEND_DIR="$PROJECT_DIR/backend"

echo ">>> Deploying AByte Main App..."

# ── 1. Pull latest code ───────────────────────────────────────────────────────
cd /var/www/AByte-POS
git pull origin main
echo "✓ Code updated"

# ── 2. Backend deps ───────────────────────────────────────────────────────────
cd "$BACKEND_DIR"
npm install --omit=dev
echo "✓ Backend dependencies installed"

# ── 3. Build Frontend ─────────────────────────────────────────────────────────
cd "$FRONTEND_DIR"
npm install
npm run build
echo "✓ Frontend built"

# ── 4. Restart backend via PM2 ───────────────────────────────────────────────
cd "$PROJECT_DIR"
pm2 startOrRestart ecosystem.config.js --env production
pm2 save
echo "✓ Backend restarted"

echo ""
echo "✅ Deploy complete!"
echo "   Frontend: nginx serving $FRONTEND_DIR/dist"
echo "   Backend:  pm2 logs abyte-main-api"
