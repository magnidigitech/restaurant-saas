# Hostinger VPS Deployment Blueprint

This guide provides the complete step-by-step procedure to deploy the Restaurant SaaS Platform on a **Hostinger VPS** (Ubuntu 22.04 / 24.04 LTS).

---

## 1. Prerequisites on VPS

Connect to your Hostinger VPS via SSH:
```bash
ssh root@YOUR_SERVER_IP
```

### Install Node.js 20 LTS & Core Utilities:
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx

# Install PM2 globally
sudo npm install -g pm2
```

---

## 2. PostgreSQL Database Setup

If using local PostgreSQL on the VPS:
```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start and enable service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create Database and User
sudo -u postgres psql
```
Inside the `psql` prompt:
```sql
CREATE DATABASE restaurant_saas;
CREATE USER saas_admin WITH ENCRYPTED PASSWORD 'YOUR_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE restaurant_saas TO saas_admin;
ALTER DATABASE restaurant_saas OWNER TO saas_admin;
\q
```

---

## 3. Clone Repository & Install Dependencies

```bash
# Create application directory
mkdir -p /var/www/restaurant-saas
cd /var/www/restaurant-saas

# Clone your repository (or copy files)
git clone <YOUR_GIT_REPO_URL> .

# Install dependencies
npm ci

# Configure Environment Variables
cp .env.example .env
nano .env
```

### Configure `.env` on VPS:
```env
DATABASE_URL="postgresql://saas_admin:YOUR_STRONG_PASSWORD@localhost:5432/restaurant_saas?schema=public"
DIRECT_DATABASE_URL="postgresql://saas_admin:YOUR_STRONG_PASSWORD@localhost:5432/restaurant_saas?schema=public"
JWT_SECRET="YOUR_RANDOM_64_CHAR_HEX_SECRET"
NODE_ENV="production"
PORT=3000
```

---

## 4. Run Migrations & Build Application

```bash
# Push Prisma Schema to PostgreSQL
npx prisma db push
npx prisma generate

# Build Next.js Production Bundle
npm run build

# Copy static assets to standalone directory (required for Next.js standalone)
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
```

---

## 5. Launch with PM2 (Cluster Mode)

```bash
# Start application using PM2 ecosystem file
pm2 start ecosystem.config.js

# Configure PM2 to auto-start on server reboots
pm2 save
pm2 startup
```

---

## 6. Configure Nginx Reverse Proxy (Multi-Tenant & Wildcard Subdomains)

Create `/etc/nginx/sites-available/restaurant-saas`:
```nginx
server {
    listen 80;
    server_name yourdomain.com *.yourdomain.com;

    client_max_body_size 64M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/restaurant-saas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 7. Install Free Wildcard SSL with Let's Encrypt (Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d *.yourdomain.com
```

---

## 8. Verification & Maintenance Commands

- **Check Process Status**: `pm2 status`
- **View Real-Time Logs**: `pm2 logs restaurant-saas`
- **Zero-Downtime Reload**: `pm2 reload restaurant-saas`
- **Database Backup**:
  ```bash
  pg_dump -U saas_admin -d restaurant_saas > backup_$(date +%F).sql
  ```
