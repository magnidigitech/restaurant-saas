FROM node:22-alpine
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

# Copy static assets into Next.js standalone directory for CSS/JS styling
RUN mkdir -p .next/standalone/public .next/standalone/.next/static && \
    cp -a public/. .next/standalone/public/ && \
    cp -a .next/static/. .next/standalone/.next/static/

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# Launch Next.js standalone server directly
CMD ["node", ".next/standalone/server.js"]
