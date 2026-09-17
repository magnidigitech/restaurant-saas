#!/bin/sh
set -e

echo "----------------------------------------"
echo "🗄️ Synchronizing Prisma Database Schema..."
echo "----------------------------------------"
npx prisma db push --accept-data-loss

echo "----------------------------------------"
echo "🌱 Seeding Initial System Data..."
echo "----------------------------------------"
npx tsx prisma/seed.ts || true

echo "----------------------------------------"
echo "🚀 Starting Next.js Production Server..."
echo "----------------------------------------"
exec node .next/standalone/server.js
