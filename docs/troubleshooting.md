# CostTrak Troubleshooting Guide

## Common Issues & Solutions

### Authentication Issues

#### Problem: "Email must use @ics.ac domain" error
**Symptoms**: Users cannot register or login with valid company email

**Solutions**:
1. Verify email domain configuration:
   ```typescript
   // Check .env.local
   NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=ics.ac
   ```

2. Check database trigger:
   ```sql
   -- Verify trigger exists
   SELECT * FROM pg_trigger WHERE tgname = 'check_email_domain';
   ```

3. For testing, temporarily disable check:
   ```sql
   -- CAUTION: Only in development
   DROP TRIGGER IF EXISTS check_email_domain ON auth.users;
   ```

#### Problem: User logged out unexpectedly
**Symptoms**: Session expires too quickly or randomly

**Solutions**:
1. Check session configuration:
   ```typescript
   // Verify session settings
   const { data: { session } } = await supabase.auth.getSession()
   console.log('Session expires at:', session?.expires_at)
   ```

2. Refresh token if needed:
   ```typescript
   // Force refresh
   const { data, error } = await supabase.auth.refreshSession()
   ```

3. Check for clock skew between client and server

#### Problem: "Unauthorized" errors after login
**Symptoms**: User authenticated but API calls fail

**Solutions**:
1. Verify RLS policies:
   ```sql
   -- Test policies as specific user
   SET LOCAL role TO authenticated;
   SET LOCAL request.jwt.claims TO '{"sub": "user-uuid-here"}';
   SELECT * FROM projects; -- Should return user's projects
   RESET role;
   ```

2. Check user role assignment:
   ```sql
   SELECT id, email, role FROM users WHERE email = 'user@ics.ac';
   ```

### Database Connection Issues

#### Problem: "Connection refused" or timeout errors
**Symptoms**: Application cannot connect to database

**Solutions**:
1. Verify Supabase URL and keys:
   ```bash
   # Test connection
   curl https://your-project.supabase.co/rest/v1/projects \
     -H "apikey: your-anon-key" \
     -H "Authorization: Bearer your-anon-key"
   ```

2. Check service status:
   - Visit Supabase dashboard
   - Check status.supabase.com

3. Verify environment variables are loaded:
   ```typescript
   console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
   console.log('Has anon key:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
   ```

#### Problem: "Too many connections" error
**Symptoms**: Database refuses new connections

**Solutions**:
1. Check current connections:
   ```sql
   SELECT count(*) FROM pg_stat_activity;
   
   -- See active queries
   SELECT pid, usename, application_name, state, query 
   FROM pg_stat_activity 
   WHERE state != 'idle';
   ```

2. Kill idle connections:
   ```sql
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE state = 'idle' 
   AND state_change < now() - interval '10 minutes';
   ```

3. Implement connection pooling in application

### Performance Issues

#### Problem: Dashboard loads slowly
**Symptoms**: Loading takes >2 seconds

**Solutions**:
1. Check for missing indexes:
   ```sql
   -- Analyze query performance
   EXPLAIN ANALYZE
   SELECT * FROM projects 
   WHERE division = 'North' AND status = 'Active';
   ```

2. Refresh materialized views:
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_summary;
   ```

3. Enable query caching:
   ```typescript
   // Use React Query with appropriate stale time
   const { data } = useQuery({
     queryKey: ['dashboard', division],
     queryFn: fetchDashboardData,
     staleTime: 5 * 60 * 1000, // 5 minutes
   })
   ```

#### Problem: CSV imports timeout
**Symptoms**: Large file imports fail

**Solutions**:
1. Increase timeout:
   ```typescript
   // api/import/route.ts
   export const maxDuration = 60; // seconds
   ```

2. Implement chunked processing:
   ```typescript
   const CHUNK_SIZE = 100;
   for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
     const chunk = rows.slice(i, i + CHUNK_SIZE);
     await processBatch(chunk);
   }
   ```

3. Use background jobs for large imports

### Build & Deployment Issues

#### Problem: Build fails with type errors
**Symptoms**: `npm run build` fails

**Solutions**:
1. Regenerate types:
   ```bash
   npm run generate-types
   ```

2. Clear cache and rebuild:
   ```bash
   rm -rf .next
   rm -rf node_modules
   npm install
   npm run build
   ```

3. Check for missing type definitions:
   ```bash
   npm run type-check
   ```

#### Problem: "Module not found" errors
**Symptoms**: Import errors during build

**Solutions**:
1. Verify all imports use correct paths:
   ```typescript
   // Use absolute imports
   import { supabase } from '@/lib/supabase'
   // Not: import { supabase } from '../../../lib/supabase'
   ```

2. Check tsconfig.json paths:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

### Data Import Issues

#### Problem: CSV import shows validation errors
**Symptoms**: "Invalid format" or "Missing required fields"

**Solutions**:
1. Verify CSV format:
   ```typescript
   // Expected headers
   const requiredHeaders = ['PO Number', 'Vendor', 'Amount', 'Status'];
   ```

2. Check for encoding issues:
   ```bash
   # Convert to UTF-8
   iconv -f ISO-8859-1 -t UTF-8 input.csv > output.csv
   ```

3. Remove special characters:
   ```typescript
   // Clean amount field
   const amount = value.replace(/[$,]/g, '').trim();
   ```

#### Problem: Duplicate data after import
**Symptoms**: Same records imported multiple times

**Solutions**:
1. Implement upsert logic:
   ```sql
   INSERT INTO purchase_orders (po_number, project_id, amount)
   VALUES ($1, $2, $3)
   ON CONFLICT (po_number) 
   DO UPDATE SET amount = EXCLUDED.amount;
   ```

2. Add import tracking:
   ```typescript
   // Track imported files
   const importHash = await calculateFileHash(file);
   const existing = await checkImportHistory(importHash);
   if (existing) {
     throw new Error('File already imported');
   }
   ```

### UI/UX Issues

#### Problem: Notifications not appearing
**Symptoms**: No real-time notifications shown

**Solutions**:
1. Check WebSocket connection:
   ```typescript
   // In browser console
   const channel = supabase.channel('test')
   channel.on('*', console.log).subscribe()
   ```

2. Verify notification permissions:
   ```typescript
   if (Notification.permission !== 'granted') {
     await Notification.requestPermission();
   }
   ```

3. Check notification creation:
   ```sql
   SELECT * FROM notifications 
   WHERE user_id = 'user-uuid' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

#### Problem: Export to Excel not working
**Symptoms**: Download fails or file is corrupted

**Solutions**:
1. Check file generation:
   ```typescript
   try {
     const wb = XLSX.utils.book_new();
     const ws = XLSX.utils.json_to_sheet(data);
     XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
     XLSX.writeFile(wb, 'export.xlsx');
   } catch (error) {
     console.error('Excel generation error:', error);
   }
   ```

2. Verify response headers:
   ```typescript
   return new Response(buffer, {
     headers: {
       'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
       'Content-Disposition': 'attachment; filename="export.xlsx"',
     },
   });
   ```

## Debug Mode

Enable debug mode for detailed logging:

### 1. Set Environment Variable
```bash
# .env.local
NEXT_PUBLIC_DEBUG_MODE=true
```

### 2. Use Debug Helper
```typescript
// lib/debug.ts
export const debug = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';

export function debugLog(...args: any[]) {
  if (debug) {
    console.log('[DEBUG]', new Date().toISOString(), ...args);
  }
}

// Usage
debugLog('API Response:', response);
debugLog('User permissions:', permissions);
```

### 3. Enable Verbose Logging
```typescript
// For Supabase queries
if (debug) {
  supabase.on('*', (payload) => {
    console.log('Supabase event:', payload);
  });
}
```

## Recovery Procedures

### Database Recovery

#### From Backup
```bash
# 1. Stop application
pm2 stop costtrak

# 2. Restore database
pg_restore -h db.supabase.co -U postgres -d postgres backup.dump

# 3. Verify data
psql -h db.supabase.co -U postgres -d postgres -c "SELECT COUNT(*) FROM projects;"

# 4. Restart application
pm2 start costtrak
```

#### Corrupted Data Fix
```sql
-- Find and fix orphaned records
DELETE FROM purchase_orders 
WHERE project_id NOT IN (SELECT id FROM projects);

-- Rebuild constraints
ALTER TABLE purchase_orders 
DROP CONSTRAINT IF EXISTS purchase_orders_project_id_fkey;

ALTER TABLE purchase_orders 
ADD CONSTRAINT purchase_orders_project_id_fkey 
FOREIGN KEY (project_id) REFERENCES projects(id);
```

### Application Recovery

#### Reset to Known Good State
```bash
# 1. Identify last working commit
git log --oneline -10

# 2. Create backup branch
git checkout -b backup/current-state

# 3. Reset to working commit
git checkout main
git reset --hard <commit-hash>

# 4. Force deploy
npm run deploy:production -- --force
```

#### Clear All Caches
```typescript
// Emergency cache clear
async function emergencyCacheClear() {
  // Application cache
  await redis.flushall();
  
  // CDN cache
  await purgeCDNCache();
  
  // Browser cache (via headers)
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, must-revalidate');
    next();
  });
  
  // Materialized views
  await supabase.rpc('refresh_all_views');
}
```

## Getting Help

### Collect Diagnostic Information

```bash
# Create diagnostic report
cat > diagnostic-report.md << EOF
## System Information
- Date: $(date)
- Node Version: $(node --version)
- NPM Version: $(npm --version)
- Deployment: $DEPLOYMENT_ENV

## Recent Errors
$(tail -100 /var/log/costtrak/error.log)

## Database Status
$(psql -h $DB_HOST -U postgres -c "SELECT version();")
$(psql -h $DB_HOST -U postgres -c "SELECT COUNT(*) FROM projects;")

## Environment Check
Supabase URL Set: $([ -z "$NEXT_PUBLIC_SUPABASE_URL" ] && echo "NO" || echo "YES")
Anon Key Set: $([ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] && echo "NO" || echo "YES")
EOF
```

### Contact Support

1. **Internal Support**
   - Slack: #costtrak-support
   - Email: it-support@ics.ac
   - Phone: ext. 1234

2. **Escalation Path**
   - Level 1: Application Support Team
   - Level 2: Senior Developer (dev-lead@ics.ac)
   - Level 3: CTO (cto@ics.ac)

3. **Emergency Contacts**
   - On-call: +1-555-0911
   - Supabase Support: support@supabase.io
   - Vercel Support: support@vercel.com

### Useful Resources

- [Supabase Troubleshooting](https://supabase.com/docs/guides/platform/troubleshooting)
- [Next.js Error Reference](https://nextjs.org/docs/messages)
- [PostgreSQL Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
- Internal Wiki: wiki.ics.ac/costtrak/troubleshooting