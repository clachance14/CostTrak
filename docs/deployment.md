# CostTrak Deployment Guide

## Overview

CostTrak can be deployed using Vercel (recommended), Docker, or manual deployment to any Node.js hosting provider.

## Deployment Options

### Vercel Deployment (Recommended)

#### 1. Install Vercel CLI

```bash
npm i -g vercel
```

#### 2. Deploy to Vercel

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

#### 3. Configure Environment Variables

In Vercel Dashboard:
1. Go to Project Settings → Environment Variables
2. Add all variables from `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN
```

#### 4. Configure Domains

1. Go to Project Settings → Domains
2. Add your custom domain (e.g., `costtrak.ics.ac`)
3. Update DNS records as instructed

### Docker Deployment

#### 1. Create Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

#### 2. Build and Run

```bash
# Build image
docker build -t costtrak .

# Run container
docker run -p 3000:3000 --env-file .env.production costtrak
```

### Manual Deployment

#### 1. Build Application

```bash
# Install dependencies
npm ci --production=false

# Build application
npm run build

# Copy build artifacts
cp -r .next package.json package-lock.json public/ /path/to/deployment/
```

#### 2. Start Production Server

```bash
# On production server
cd /path/to/deployment
npm ci --production
npm start
```

#### 3. Process Management with PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start npm --name "costtrak" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

## Environment Configuration

### Environment-Specific Files

Create separate environment files for each deployment:

```bash
.env.local        # Local development
.env.staging      # Staging environment
.env.production   # Production environment
```

### Production Environment Variables

```env
# .env.production
NEXT_PUBLIC_SUPABASE_URL=https://production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=production-anon-key
SUPABASE_SERVICE_ROLE_KEY=production-service-key

NEXT_PUBLIC_APP_URL=https://costtrak.ics.ac
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=ics.ac

# Production-specific
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_EXCEL_EXPORT=true
NEXT_PUBLIC_DEBUG_MODE=false

# Optional: Monitoring
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_GA_MEASUREMENT_ID=your-ga-id
```

### Staging Environment

```env
# .env.staging
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
NEXT_PUBLIC_APP_URL=https://staging.costtrak.ics.ac
# ... other staging configs
```

## Domain & CORS Configuration

### 1. Update Supabase CORS

In Supabase Dashboard → Settings → API:

1. Add production domain to allowed origins:
   - `https://costtrak.ics.ac`
   - `https://www.costtrak.ics.ac`
   - `https://staging.costtrak.ics.ac` (if applicable)

2. Configure URL configuration:
   - Site URL: `https://costtrak.ics.ac`
   - Redirect URLs: `https://costtrak.ics.ac/*`

### 2. Update Next.js Configuration

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: process.env.NEXT_PUBLIC_APP_URL },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ]
  },
}
```

## Pre-Deployment Checklist

### 1. Code Preparation

- [ ] Run production build locally: `npm run build`
- [ ] Fix any build errors
- [ ] Run type checking: `npm run type-check`
- [ ] Run linting: `npm run lint`
- [ ] Update dependencies: `npm audit fix`

### 2. Database Preparation

- [ ] Run all migrations on production database
- [ ] Verify RLS policies are enabled
- [ ] Create database backups
- [ ] Test database connections

### 3. Environment Variables

- [ ] All production environment variables set
- [ ] API keys are production versions
- [ ] Debug mode disabled
- [ ] Correct domain URLs configured

### 4. Security Review

- [ ] HTTPS enforced
- [ ] Secure headers configured
- [ ] Rate limiting enabled
- [ ] Authentication working

## Post-Deployment Verification

### 1. Functional Testing

```bash
# Test authentication
curl https://costtrak.ics.ac/api/auth/me -H "Authorization: Bearer $TOKEN"

# Test API endpoints
curl https://costtrak.ics.ac/api/projects -H "Authorization: Bearer $TOKEN"

# Test static assets
curl -I https://costtrak.ics.ac/favicon.ico
```

### 2. Performance Testing

- Load dashboard pages and verify <2 second load times
- Check browser console for errors
- Verify all assets load over HTTPS
- Test CSV import functionality

### 3. Monitoring Setup

- Verify error tracking (Sentry) is receiving events
- Check analytics are tracking page views
- Confirm notification system is working

## Rollback Procedure

### Vercel Rollback

```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]
```

### Manual Rollback

1. Keep previous build artifacts
2. Database: Restore from backup if schema changed
3. Swap deployment directories
4. Restart application server

## CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Type check
        run: npm run type-check
      
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## Scaling Considerations

### 1. Database Optimization

- Enable connection pooling in Supabase
- Use read replicas for reporting queries
- Implement caching for expensive queries

### 2. Application Optimization

- Enable Next.js ISR (Incremental Static Regeneration)
- Implement Redis caching for session data
- Use CDN for static assets

### 3. Monitoring & Alerts

Set up alerts for:
- High error rates
- Slow response times
- Database connection issues
- Failed deployments

## Support Contacts

- **Deployment Issues**: devops@ics.ac
- **Infrastructure**: infrastructure@ics.ac
- **Emergency**: +1-555-0123 (24/7 on-call)