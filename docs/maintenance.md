# CostTrak Maintenance Guide

## Overview

Regular maintenance ensures CostTrak remains secure, performant, and reliable. This guide covers routine tasks, updates, and best practices.

## Regular Maintenance Schedule

### Daily Tasks

#### 1. Monitor System Health
```bash
# Check application health
curl https://costtrak.ics.ac/api/health

# Check error rates in Sentry
# Review monitoring dashboard
```

#### 2. Verify Backups
```sql
-- Check latest backup timestamp
SELECT 
    backup_name,
    backup_start_time,
    backup_end_time,
    backup_size
FROM backup_history
WHERE backup_start_time > NOW() - INTERVAL '24 hours'
ORDER BY backup_start_time DESC;
```

### Weekly Tasks

#### 1. Review Performance Metrics
```sql
-- Check slow queries
SELECT 
    query,
    calls,
    total_time,
    mean_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC
LIMIT 20;

-- Reset query stats after review
SELECT pg_stat_statements_reset();
```

#### 2. Clean Up Old Data
```sql
-- Archive old notifications
INSERT INTO notifications_archive
SELECT * FROM notifications
WHERE created_at < NOW() - INTERVAL '90 days'
AND is_read = true;

DELETE FROM notifications
WHERE created_at < NOW() - INTERVAL '90 days'
AND is_read = true;

-- Clean up old audit logs
INSERT INTO audit_log_archive
SELECT * FROM audit_log
WHERE created_at < NOW() - INTERVAL '1 year';

DELETE FROM audit_log
WHERE created_at < NOW() - INTERVAL '1 year';
```

#### 3. Security Review
```bash
# Check for failed login attempts
SELECT 
    email,
    COUNT(*) as attempts,
    MAX(created_at) as last_attempt
FROM login_attempts
WHERE success = false
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY email
HAVING COUNT(*) > 5
ORDER BY attempts DESC;
```

### Monthly Tasks

#### 1. Update Dependencies

```bash
# Check for outdated packages
npm outdated

# Update dependencies safely
npm update --save

# Audit for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# For major updates, test thoroughly
npm install package-name@latest
```

#### 2. Database Maintenance

```sql
-- Update table statistics
ANALYZE;

-- Reindex tables for performance
REINDEX TABLE projects;
REINDEX TABLE purchase_orders;
REINDEX TABLE labor_forecasts;

-- Vacuum to reclaim space
VACUUM ANALYZE;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;
```

#### 3. Refresh Materialized Views
```sql
-- Refresh project summary view
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_summary;

-- Refresh division summary view  
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_division_summary;

-- Verify refresh completed
SELECT 
    matviewname,
    last_refresh
FROM pg_matviews
WHERE schemaname = 'public';
```

### Quarterly Tasks

#### 1. Security Audit
- Review user access permissions
- Audit API keys and tokens
- Check for unused accounts
- Update security documentation

```sql
-- Find inactive users
SELECT 
    email,
    full_name,
    role,
    last_login
FROM users
WHERE is_active = true
AND (last_login < NOW() - INTERVAL '90 days' OR last_login IS NULL)
ORDER BY last_login ASC;

-- Review high-privilege users
SELECT 
    email,
    full_name,
    role,
    created_at
FROM users
WHERE role IN ('controller', 'executive')
ORDER BY created_at DESC;
```

#### 2. Performance Review
```typescript
// Generate performance report
async function generatePerformanceReport() {
  const report = {
    avgResponseTime: await getAvgResponseTime(90), // last 90 days
    slowestEndpoints: await getSlowestEndpoints(10),
    errorRate: await getErrorRate(90),
    userActivity: await getUserActivityStats(90),
    databaseMetrics: await getDatabaseMetrics(),
  }
  
  await sendReport(report, ['tech-lead@ics.ac', 'cto@ics.ac'])
}
```

#### 3. Capacity Planning
- Review growth trends
- Plan for scaling needs
- Optimize resource usage

## Dependency Management

### Update Strategy

1. **Security Updates**: Apply immediately
2. **Minor Updates**: Apply monthly after testing
3. **Major Updates**: Plan quarterly with full testing

### Safe Update Process

```bash
# 1. Create branch for updates
git checkout -b maintenance/dependency-updates

# 2. Update dependencies
npm update --save

# 3. Run tests
npm test
npm run type-check
npm run lint

# 4. Test locally
npm run dev
# Perform manual testing

# 5. Create PR for review
git add package*.json
git commit -m "chore: update dependencies"
git push origin maintenance/dependency-updates
```

### Handling Breaking Changes

```typescript
// package.json - lock major versions
{
  "dependencies": {
    "next": "^13.5.0", // Allow minor updates
    "@supabase/supabase-js": "~2.38.0", // Allow patch updates only
    "critical-package": "1.2.3" // Exact version
  }
}
```

## Database Maintenance

### Index Maintenance

```sql
-- Find unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelid > 16384
ORDER BY schemaname, tablename;

-- Find duplicate indexes
SELECT 
    indrelid::regclass AS table_name,
    array_agg(indexrelid::regclass) AS duplicate_indexes
FROM pg_index
GROUP BY indrelid, indkey
HAVING COUNT(*) > 1;
```

### Storage Management

```bash
# Monitor disk usage
df -h

# Check database size
SELECT 
    pg_database_size('costtrak_production') AS size,
    pg_size_pretty(pg_database_size('costtrak_production')) AS pretty_size;

# Find large tables
SELECT 
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;
```

### Backup Verification

```bash
# Test backup restoration (on staging)
pg_restore -h staging-db.ics.ac -U postgres -d costtrak_staging backup.dump

# Verify data integrity
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM purchase_orders;
SELECT COUNT(*) FROM users;
```

## Application Maintenance

### Cache Management

```typescript
// Clear application caches
async function clearCaches() {
  // Clear Redis cache
  await redis.flushdb()
  
  // Clear Next.js cache
  await fs.rm('.next/cache', { recursive: true, force: true })
  
  // Clear CDN cache (if applicable)
  await fetch('https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ purge_everything: true }),
  })
}
```

### Log Rotation

```bash
# Configure log rotation
cat > /etc/logrotate.d/costtrak << EOF
/var/log/costtrak/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 costtrak costtrak
    sharedscripts
    postrotate
        systemctl reload costtrak
    endscript
}
EOF
```

### Session Cleanup

```sql
-- Clean expired sessions
DELETE FROM sessions
WHERE expires_at < NOW();

-- Monitor session count
SELECT 
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_sessions
FROM sessions;
```

## Monitoring & Alerts

### Set Up Maintenance Alerts

```typescript
// lib/maintenance/alerts.ts
export async function setupMaintenanceAlerts() {
  // Disk space alert
  schedule.scheduleJob('0 * * * *', async () => {
    const diskUsage = await checkDiskUsage()
    if (diskUsage.percentUsed > 80) {
      await sendAlert('High disk usage', `Disk usage at ${diskUsage.percentUsed}%`)
    }
  })
  
  // Database size alert
  schedule.scheduleJob('0 0 * * *', async () => {
    const dbSize = await getDatabaseSize()
    if (dbSize > 10 * 1024 * 1024 * 1024) { // 10GB
      await sendAlert('Database size warning', `Database size: ${formatBytes(dbSize)}`)
    }
  })
  
  // Backup verification
  schedule.scheduleJob('0 6 * * *', async () => {
    const lastBackup = await getLastBackupTime()
    const hoursSinceBackup = (Date.now() - lastBackup) / (1000 * 60 * 60)
    
    if (hoursSinceBackup > 25) {
      await sendAlert('Backup overdue', `Last backup was ${hoursSinceBackup} hours ago`)
    }
  })
}
```

## Upgrade Procedures

### Minor Version Upgrades

1. **Preparation**
   - Review changelog
   - Test in staging
   - Schedule maintenance window

2. **Execution**
   ```bash
   # Take backup
   npm run backup:production
   
   # Deploy new version
   npm run deploy:production
   
   # Verify deployment
   npm run health:check
   ```

3. **Validation**
   - Run smoke tests
   - Check error rates
   - Monitor performance

### Major Version Upgrades

1. **Planning Phase** (1-2 weeks before)
   - Review breaking changes
   - Update test environment
   - Plan rollback strategy

2. **Testing Phase** (1 week before)
   - Full regression testing
   - Performance testing
   - User acceptance testing

3. **Deployment Phase**
   - Notify users of maintenance
   - Execute deployment plan
   - Monitor closely for 24 hours

## Documentation Updates

Keep documentation current:

```bash
# After each maintenance task
- Update runbooks
- Document any issues encountered
- Update configuration files
- Review and update this guide
```

## Maintenance Checklist Template

```markdown
## Daily Maintenance - [Date]
- [ ] Health check passed
- [ ] Backup verification complete
- [ ] Error rate normal
- [ ] No critical alerts

## Weekly Maintenance - Week of [Date]
- [ ] Performance metrics reviewed
- [ ] Old data archived
- [ ] Security logs checked
- [ ] Slow queries optimized

## Monthly Maintenance - [Month Year]
- [ ] Dependencies updated
- [ ] Database maintenance completed
- [ ] Views refreshed
- [ ] Capacity review done
- [ ] Documentation updated

## Notes
[Any issues or observations]

Completed by: [Name]
Date: [Date]
```

## Emergency Maintenance

For urgent issues:

1. **Immediate Actions**
   - Enable maintenance mode
   - Notify stakeholders
   - Begin investigation

2. **Communication**
   ```typescript
   // Enable maintenance mode
   await redis.set('maintenance_mode', 'true')
   await redis.set('maintenance_message', 'System maintenance in progress')
   ```

3. **Resolution**
   - Apply fix
   - Test thoroughly
   - Disable maintenance mode
   - Post-mortem analysis

## Support Resources

- **Documentation**: Internal wiki at wiki.ics.ac/costtrak
- **Runbooks**: /docs/runbooks/
- **On-Call**: +1-555-0911
- **Escalation**: cto@ics.ac