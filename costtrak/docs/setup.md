# CostTrak Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Git
- Supabase CLI (optional for local development)
- Access to Supabase project

## Initial Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd costtrak
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=ics.ac

# Optional: Feature Flags
NEXT_PUBLIC_ENABLE_NOTIFICATIONS=true
NEXT_PUBLIC_ENABLE_EXCEL_EXPORT=true

# Optional: Development
NEXT_PUBLIC_DEBUG_MODE=false
```

### 4. Supabase Setup

#### Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Create new project
3. Save the project URL and keys

#### Configure Authentication

1. Go to Authentication → Providers
2. Enable Email provider
3. Disable "Confirm email" (internal use only)
4. Add email domain restriction:

```sql
-- Create function to validate email domain
CREATE OR REPLACE FUNCTION auth.validate_email_domain()
RETURNS trigger AS $$
BEGIN
  IF NEW.email NOT LIKE '%@ics.ac' THEN
    RAISE EXCEPTION 'Email must use @ics.ac domain';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER check_email_domain
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.validate_email_domain();
```

#### Run Database Migrations

1. Copy the schema from `docs/schema.sql` (or use provided SQL)
2. Run in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Run full schema creation script
-- (Copy full schema from schema documentation)
```

3. Create indexes for performance:

```sql
-- Run index creation script from queries.md
```

4. Enable Row Level Security:

```sql
-- Run RLS policies from rls-policies.md
```

#### Create Initial Admin User

```sql
-- Create controller user (run in SQL editor)
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES ('admin@ics.ac', crypt('temporary-password-123', gen_salt('bf')), now());

-- Get the user ID from auth.users
-- Then create user record
INSERT INTO public.users (id, email, full_name, role, is_active)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@ics.ac'),
  'admin@ics.ac',
  'System Administrator',
  'controller',
  true
);
```

### 5. Generate TypeScript Types

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Generate types
npm run generate-types
```

Or manually:

```bash
supabase gen types typescript --project-id your-project-id > src/types/database.ts
```

### 6. Verify Setup

```bash
# Run development server
npm run dev

# Open browser
open http://localhost:3000
```

## Development Workflow

### Start Development Server

```bash
npm run dev
```

### Run Type Checking

```bash
npm run type-check
```

### Run Linting

```bash
npm run lint
npm run lint:fix
```

### Build for Production

```bash
npm run build
```

## Database Management

### Local Development with Supabase CLI

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Reset local database
supabase db reset
```

### Migration Workflow

1. Create migration file:
```bash
supabase migration new <migration-name>
```

2. Write migration SQL in `supabase/migrations/<timestamp>_<migration-name>.sql`

3. Apply migration:
```bash
supabase db push
```

### Backup and Restore

```bash
# Backup
pg_dump -h db.your-project.supabase.co -U postgres -d postgres > backup.sql

# Restore
psql -h db.your-project.supabase.co -U postgres -d postgres < backup.sql
```

## Deployment

### Vercel Deployment

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard

### Manual Deployment

1. Build application:
```bash
npm run build
```

2. Start production server:
```bash
npm start
```

### Environment-Specific Configuration

Create separate env files:
- `.env.local` - Local development
- `.env.staging` - Staging environment
- `.env.production` - Production environment

## Security Configuration

### 1. CORS Settings

In Supabase Dashboard → Settings → API:
- Add your production domain to allowed origins

### 2. Database Security

```sql
-- Revoke public access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Grant specific permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
```

### 3. API Security

Configure middleware for rate limiting:

```typescript
// middleware.ts
import { rateLimit } from '@/lib/rate-limit'

export async function middleware(req: NextRequest) {
  // Apply rate limiting
  const { success } = await rateLimit(req)
  if (!success) {
    return new Response('Too Many Requests', { status: 429 })
  }
  
  // Continue with auth checks...
}
```

## Monitoring Setup

### 1. Error Tracking (Sentry)

```bash
npm install @sentry/nextjs
```

Create `sentry.client.config.js`:
```javascript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
})
```

### 2. Analytics

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Check email domain restriction
   - Verify Supabase keys in .env.local
   - Check RLS policies

2. **Type Generation Fails**
   - Ensure Supabase CLI is logged in
   - Verify project ID
   - Check network connectivity

3. **Database Connection Issues**
   - Verify Supabase URL
   - Check service role key
   - Review RLS policies

4. **Build Errors**
   - Clear .next folder: `rm -rf .next`
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check TypeScript errors: `npm run type-check`

### Debug Mode

Enable debug logging:

```typescript
// lib/debug.ts
export const debug = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'

if (debug) {
  console.log('Debug mode enabled')
}
```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review error logs
   - Check query performance
   - Monitor disk usage

2. **Monthly**
   - Update dependencies
   - Review and optimize slow queries
   - Audit user access

3. **Quarterly**
   - Security audit
   - Performance review
   - Backup verification

### Update Dependencies

```bash
# Check outdated packages
npm outdated

# Update all dependencies
npm update

# Update specific package
npm install package-name@latest
```

## Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- Internal Wiki: `<company-wiki-url>/costtrak`

## Support

For issues or questions:
1. Check troubleshooting guide above
2. Review error logs in Supabase Dashboard
3. Contact IT support at: it-support@ics.ac