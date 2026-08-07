FROM node:20-alpine
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache libc6-compat

# Install node dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client and build Next.js app
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Run Prisma database migrations on container start and launch server
CMD ["sh", "-c", "npx prisma migrate deploy && node .next/standalone/server.js"]
