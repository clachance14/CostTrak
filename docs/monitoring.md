# CostTrak Monitoring & Observability

## Overview

CostTrak uses multiple monitoring tools to ensure system health, track performance, and quickly identify issues.

## Error Tracking with Sentry

### Setup

1. Install Sentry:
```bash
npm install @sentry/nextjs
```

2. Run setup wizard:
```bash
npx @sentry/wizard -i nextjs
```

3. Configure Sentry:

```javascript
// sentry.client.config.js
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  beforeSend(event, hint) {
    // Filter out sensitive data
    if (event.request?.cookies) {
      delete event.request.cookies
    }
    return event
  },
  
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: true,
      maskAllInputs: true,
    }),
  ],
  
  // Capture 10% of errors in production
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})
```

### Error Boundaries

```typescript
// app/error.tsx
'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

### Custom Error Tracking

```typescript
// lib/monitoring/sentry.ts
export function trackError(error: Error, context?: Record<string, any>) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('additional', context)
    }
    Sentry.captureException(error)
  })
}

// Usage
try {
  await importPurchaseOrders(file)
} catch (error) {
  trackError(error as Error, {
    projectId: project.id,
    fileName: file.name,
    fileSize: file.size,
  })
}
```

## Performance Monitoring

### Web Vitals Tracking

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

### Custom Performance Metrics

```typescript
// lib/monitoring/performance.ts
export function measureDashboardLoad() {
  performance.mark('dashboard-start')
  
  return {
    complete: () => {
      performance.mark('dashboard-end')
      performance.measure(
        'dashboard-load',
        'dashboard-start',
        'dashboard-end'
      )
      
      const measure = performance.getEntriesByName('dashboard-load')[0]
      
      // Send to analytics
      if (window.gtag) {
        window.gtag('event', 'timing_complete', {
          name: 'dashboard_load',
          value: Math.round(measure.duration),
        })
      }
    }
  }
}
```

## Application Metrics

### Custom Metrics Collection

```typescript
// lib/monitoring/metrics.ts
interface Metric {
  name: string
  value: number
  tags?: Record<string, string>
}

class MetricsCollector {
  private queue: Metric[] = []
  
  track(name: string, value: number, tags?: Record<string, string>) {
    this.queue.push({ name, value, tags, timestamp: Date.now() })
    
    if (this.queue.length >= 100) {
      this.flush()
    }
  }
  
  async flush() {
    if (this.queue.length === 0) return
    
    const metrics = [...this.queue]
    this.queue = []
    
    await fetch('/api/metrics', {
      method: 'POST',
      body: JSON.stringify({ metrics }),
    })
  }
}

export const metrics = new MetricsCollector()

// Usage
metrics.track('po_import.duration', duration, { 
  project_id: projectId,
  row_count: rowCount 
})
```

### Key Metrics to Track

1. **User Activity**
   - Login attempts (success/failure)
   - Feature usage (imports, exports, reports)
   - Session duration

2. **Performance**
   - Page load times
   - API response times
   - Database query duration

3. **Business Metrics**
   - Projects created
   - POs imported
   - Reports generated
   - Threshold breaches

## Database Monitoring

### Query Performance

```sql
-- Create monitoring views
CREATE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE mean_time > 100 -- queries taking >100ms
ORDER BY mean_time DESC
LIMIT 50;

-- Monitor table sizes
CREATE VIEW table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;
```

### Connection Monitoring

```typescript
// api/health/database.ts
export async function GET() {
  try {
    // Check database connection
    const startTime = performance.now()
    const { data, error } = await supabase
      .from('projects')
      .select('count')
      .limit(1)
    
    const responseTime = performance.now() - startTime
    
    if (error) throw error
    
    return NextResponse.json({
      status: 'healthy',
      responseTime: Math.round(responseTime),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 503 })
  }
}
```

## Health Checks

### Application Health Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    app: 'healthy',
    database: 'unknown',
    redis: 'unknown',
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION || 'unknown',
  }
  
  // Check database
  try {
    await supabase.from('users').select('count').limit(1)
    checks.database = 'healthy'
  } catch {
    checks.database = 'unhealthy'
  }
  
  // Check Redis (if used)
  try {
    await redis.ping()
    checks.redis = 'healthy'
  } catch {
    checks.redis = 'unhealthy'
  }
  
  const allHealthy = Object.values(checks)
    .filter(v => typeof v === 'string' && v.includes('healthy'))
    .every(v => v === 'healthy')
  
  return NextResponse.json(checks, {
    status: allHealthy ? 200 : 503
  })
}
```

### Uptime Monitoring

Configure external monitoring service (e.g., Pingdom, UptimeRobot):

1. Monitor endpoints:
   - `https://costtrak.ics.ac/api/health` - Overall health
   - `https://costtrak.ics.ac/api/health/database` - Database specific
   - `https://costtrak.ics.ac` - Frontend availability

2. Alert thresholds:
   - Response time > 5 seconds
   - Status code != 200
   - 2 consecutive failures

## Logging Strategy

### Structured Logging

```typescript
// lib/logger.ts
import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard',
    },
  },
})

export function log(level: string, message: string, meta?: any) {
  logger[level]({
    ...meta,
    timestamp: new Date().toISOString(),
  }, message)
}

// Usage
log('info', 'PO import started', {
  userId: user.id,
  projectId: project.id,
  fileName: file.name,
})
```

### Log Aggregation

For production, send logs to centralized service:

```typescript
// lib/logger-production.ts
import { createLogger, transports, format } from 'winston'
import WinstonCloudWatch from 'winston-cloudwatch'

const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new WinstonCloudWatch({
      logGroupName: 'costtrak',
      logStreamName: `${process.env.NODE_ENV}-${new Date().toISOString().split('T')[0]}`,
      awsRegion: process.env.AWS_REGION,
      jsonMessage: true,
    })
  ],
})
```

## Alerts & Notifications

### Alert Configuration

```typescript
// lib/monitoring/alerts.ts
export async function checkThresholds() {
  // Project margin alerts
  const lowMarginProjects = await supabase
    .from('mv_project_summary')
    .select('*')
    .lt('margin_percent', 10)
    .eq('status', 'Active')
  
  for (const project of lowMarginProjects.data || []) {
    await createNotification({
      userId: project.project_manager_id,
      type: 'threshold_breach',
      priority: 'high',
      title: 'Low Margin Alert',
      message: `Project ${project.job_number} margin dropped to ${project.margin_percent}%`,
      relatedEntityType: 'project',
      relatedEntityId: project.id,
    })
  }
}

// Schedule to run every hour
```

### Alert Channels

1. **In-App Notifications**
   - Real-time via WebSocket
   - Stored in notifications table
   - Badge on notification icon

2. **Email Alerts**
   - Critical issues only
   - Daily digest option
   - Configurable per user

3. **Slack Integration** (optional)
```typescript
// lib/notifications/slack.ts
export async function sendSlackAlert(message: string, channel = '#costtrak-alerts') {
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify({
      channel,
      text: message,
      username: 'CostTrak Bot',
    }),
  })
}
```

## Dashboard & Visualization

### Monitoring Dashboard

Create internal dashboard at `/admin/monitoring`:

```typescript
// app/admin/monitoring/page.tsx
export default async function MonitoringDashboard() {
  const [
    errorRate,
    avgResponseTime,
    activeUsers,
    dbConnections
  ] = await Promise.all([
    getErrorRate(),
    getAvgResponseTime(),
    getActiveUserCount(),
    getDatabaseConnections()
  ])
  
  return (
    <div className="grid grid-cols-2 gap-4">
      <MetricCard
        title="Error Rate"
        value={errorRate}
        unit="%"
        threshold={5}
      />
      <MetricCard
        title="Avg Response Time"
        value={avgResponseTime}
        unit="ms"
        threshold={1000}
      />
      <MetricCard
        title="Active Users"
        value={activeUsers}
      />
      <MetricCard
        title="DB Connections"
        value={dbConnections}
        threshold={80}
      />
    </div>
  )
}
```

## Monitoring Checklist

### Daily Checks
- [ ] Review error logs in Sentry
- [ ] Check system health dashboard
- [ ] Monitor active user count
- [ ] Verify backup completion

### Weekly Reviews
- [ ] Analyze slow query report
- [ ] Review error trends
- [ ] Check disk usage growth
- [ ] Audit failed login attempts

### Monthly Analysis
- [ ] Performance trend analysis
- [ ] User activity patterns
- [ ] Cost optimization review
- [ ] Capacity planning

## Incident Response

When monitoring detects issues:

1. **Automated Response**
   - Auto-scaling (if configured)
   - Circuit breakers activate
   - Alerts sent to on-call

2. **Manual Investigation**
   - Check monitoring dashboard
   - Review recent deployments
   - Analyze error patterns
   - Check system resources

3. **Communication**
   - Update status page
   - Notify affected users
   - Document in incident log

## Tools & Services

### Recommended Stack
- **Error Tracking**: Sentry
- **Analytics**: Vercel Analytics + Google Analytics
- **Uptime**: Pingdom or UptimeRobot  
- **Log Management**: CloudWatch or Datadog
- **APM**: New Relic or DataDog APM

### Integration Points
- Sentry: Automatic via SDK
- Analytics: Script in layout
- Uptime: External configuration
- Logs: Winston transports
- APM: Agent installation