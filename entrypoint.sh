#!/bin/sh
set -e

echo "----------------------------------------"
echo "🗄️ Running Prisma Database Migrations..."
echo "----------------------------------------"
npx prisma migrate deploy

echo "----------------------------------------"
echo "🌱 Seeding Initial System Data..."
echo "----------------------------------------"
npx tsx prisma/seed.ts || true

echo "----------------------------------------"
echo "🚀 Starting Next.js Production Server..."
echo "----------------------------------------"
exec node .next/standalone/server.js
