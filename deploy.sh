#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Starting Restaurant SaaS Production Deployment"
echo "=========================================="

echo "📦 1. Installing npm dependencies..."
npm install --production=false

echo "🗄️ 2. Generating Prisma Client..."
npx prisma generate

echo "🔄 3. Running Database Migrations..."
npx prisma migrate deploy

echo "🏗️ 4. Building Next.js Standalone Bundle..."
npm run build

echo "⚙️ 5. Restarting PM2 Application Server..."
if pm2 list | grep -q "restaurant-saas"; then
  pm2 restart restaurant-saas
else
  pm2 start .next/standalone/server.js --name "restaurant-saas"
fi

echo "=========================================="
echo "✅ Deployment completed successfully!"
echo "=========================================="
