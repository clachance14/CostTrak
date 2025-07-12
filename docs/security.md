# CostTrak Security Configuration

## Overview

CostTrak implements multiple layers of security to protect sensitive financial data and ensure only authorized access.

## Authentication & Authorization

### Email Domain Restriction

Only emails ending with `@ics.ac` can register:

```sql
-- Enforced at database level
CREATE OR REPLACE FUNCTION auth.validate_email_domain()
RETURNS trigger AS $$
BEGIN
  IF NEW.email NOT LIKE '%@ics.ac' THEN
    RAISE EXCEPTION 'Email must use @ics.ac domain';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Role-Based Access Control (RBAC)

User roles and their permissions:

| Role | Description | Access Level |
|------|-------------|--------------|
| `controller` | System admin | Full access |
| `executive` | C-level users | Read all data |
| `accounting` | Finance team | Read all, edit financial data |
| `ops_manager` | Operations managers | Full access to their division |
| `project_manager` | PMs | Full access to assigned projects |
| `viewer` | Limited users | Read-only to granted projects |

### Session Management

```typescript
// lib/auth/session.ts
export const sessionConfig = {
  maxAge: 8 * 60 * 60, // 8 hours
  refreshThreshold: 60 * 60, // Refresh if <1 hour remaining
  absoluteTimeout: 24 * 60 * 60, // Force re-login after 24 hours
}
```

## Database Security

### Row Level Security (RLS)

All tables have RLS enabled. Example policy:

```sql
-- Projects are filtered by user role and assignments
CREATE POLICY projects_select ON projects FOR SELECT
USING (
    auth.uid() IN (
        SELECT id FROM users WHERE role IN ('executive', 'controller', 'accounting')
    ) OR
    EXISTS (
        SELECT 1 FROM user_project_access 
        WHERE user_id = auth.uid() AND project_id = projects.id
    )
);
```

See [RLS Policies Documentation](./rls-policies.md) for complete details.

### Database Access Control

```sql
-- Revoke default permissions
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- Grant specific permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Never grant DELETE on financial tables
REVOKE DELETE ON purchase_orders, change_orders, labor_forecasts FROM authenticated;
```

### Encryption

- All data encrypted at rest (Supabase managed)
- TLS 1.3 for data in transit
- Sensitive fields use additional application-level encryption:

```typescript
// lib/crypto.ts
import crypto from 'crypto'

const algorithm = 'aes-256-gcm'
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(algorithm, key, iv)
  // ... implementation
}
```

## API Security

### Rate Limiting

Protect against abuse with rate limiting:

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
})

export async function rateLimit(req: NextRequest) {
  const ip = req.ip ?? '127.0.0.1'
  const { success, limit, reset, remaining } = await ratelimit.limit(ip)
  
  return { success, limit, reset, remaining }
}
```

Apply in middleware:

```typescript
// middleware.ts
export async function middleware(req: NextRequest) {
  // Apply rate limiting
  const { success } = await rateLimit(req)
  if (!success) {
    return new Response('Too Many Requests', { status: 429 })
  }
  
  // Continue with other checks...
}
```

### CORS Configuration

Configure CORS for API routes:

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

### Input Validation

All inputs validated with Zod:

```typescript
// Example: Project creation
const projectSchema = z.object({
  job_number: z.string()
    .regex(/^[A-Z0-9-]+$/, 'Invalid characters in job number'),
  contract_value: z.number()
    .positive()
    .max(999999999.99),
  // ... other validations
})

// Sanitize file uploads
const fileSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9-_\.]+$/),
  size: z.number().max(10 * 1024 * 1024), // 10MB max
  type: z.enum(['text/csv', 'application/vnd.ms-excel']),
})
```

## Security Headers

Configure security headers:

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim()
  }
]

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' *.supabase.co;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: *.supabase.co;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  block-all-mixed-content;
  upgrade-insecure-requests;
`
```

## Audit Logging

Track all sensitive operations:

```typescript
// lib/audit.ts
export async function logAuditEvent({
  userId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues
}: AuditEvent) {
  await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_values: oldValues,
    new_values: newValues,
    ip_address: getClientIp(),
    user_agent: getUserAgent(),
  })
}

// Usage
await logAuditEvent({
  userId: user.id,
  action: 'UPDATE',
  entityType: 'project',
  entityId: project.id,
  oldValues: { contract_value: 1000000 },
  newValues: { contract_value: 1200000 }
})
```

## File Upload Security

### CSV Import Validation

```typescript
// lib/csv-security.ts
export async function validateCSVFile(file: File) {
  // Check file size
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File too large (max 10MB)')
  }
  
  // Check file type
  if (!['text/csv', 'application/vnd.ms-excel'].includes(file.type)) {
    throw new Error('Invalid file type')
  }
  
  // Scan file content
  const content = await file.text()
  
  // Check for malicious patterns
  const maliciousPatterns = [
    /javascript:/gi,
    /<script/gi,
    /onclick=/gi,
    /onerror=/gi,
  ]
  
  for (const pattern of maliciousPatterns) {
    if (pattern.test(content)) {
      throw new Error('Suspicious content detected')
    }
  }
  
  return true
}
```

### Sanitize CSV Data

```typescript
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeCSVData(data: any[]): any[] {
  return data.map(row => {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') {
        sanitized[key] = DOMPurify.sanitize(value, { 
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: []
        })
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  })
}
```

## Secrets Management

### Environment Variables

Never commit secrets. Use environment variables:

```bash
# .env.local (git ignored)
SUPABASE_SERVICE_ROLE_KEY=secret-key-here
ENCRYPTION_KEY=64-char-hex-string
JWT_SECRET=random-string-here
```

### Rotate Keys Regularly

Schedule for key rotation:
- API keys: Every 90 days
- Database passwords: Every 60 days
- Encryption keys: Annually (with data re-encryption)

## Security Monitoring

### Failed Login Monitoring

```typescript
// Track failed attempts
export async function trackFailedLogin(email: string) {
  const key = `failed_login:${email}`
  const attempts = await redis.incr(key)
  await redis.expire(key, 15 * 60) // 15 minute window
  
  if (attempts > 5) {
    await lockAccount(email)
    await notifySecurityTeam(email, 'Account locked: too many failed attempts')
  }
}
```

### Anomaly Detection

Monitor for suspicious patterns:
- Multiple failed logins
- Unusual access patterns
- Large data exports
- After-hours activity

## Incident Response

### Security Incident Procedure

1. **Immediate Actions**
   - Isolate affected systems
   - Revoke compromised credentials
   - Enable emergency maintenance mode

2. **Investigation**
   - Review audit logs
   - Identify scope of breach
   - Preserve evidence

3. **Recovery**
   - Patch vulnerabilities
   - Reset affected credentials
   - Restore from clean backups

4. **Post-Incident**
   - Document lessons learned
   - Update security procedures
   - Notify affected users (if required)

### Emergency Contacts

- Security Team: security@ics.ac
- On-Call: +1-555-0911 (24/7)
- Legal: legal@ics.ac

## Security Checklist

### Development
- [ ] All inputs validated with Zod
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] CSRF protection enabled
- [ ] Dependencies regularly updated

### Deployment
- [ ] HTTPS enforced everywhere
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring active
- [ ] Backups encrypted and tested

### Ongoing
- [ ] Security patches applied promptly
- [ ] Access reviews quarterly
- [ ] Penetration testing annually
- [ ] Security training for developers
- [ ] Incident response drills

## Compliance

### Data Protection
- Personal data minimized
- Data retention policies enforced
- Right to deletion implemented
- Audit trail maintained

### Industry Standards
- OWASP Top 10 addressed
- CIS benchmarks followed
- Regular security assessments
- Vulnerability scanning