import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export type AuditEventType = 
  | 'login'
  | 'logout'
  | 'password_reset_request'
  | 'password_reset_complete'
  | '2fa_enable'
  | '2fa_disable'
  | '2fa_verify'
  | 'account_locked'
  | 'account_unlocked'

export interface AuditLogEntry {
  userId?: string
  eventType: AuditEventType
  ipAddress?: string
  userAgent?: string
  deviceId?: string
  metadata?: Record<string, any>
}

export class AuditLogger {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const supabase = await createClient()
      
      // Get IP and user agent from headers if not provided
      const headersList = await headers()
      const ip = entry.ipAddress || this.getClientIp(headersList)
      const userAgent = entry.userAgent || headersList.get('user-agent') || undefined

      await supabase.from('auth_audit_log').insert({
        user_id: entry.userId,
        event_type: entry.eventType,
        ip_address: ip,
        user_agent: userAgent,
        device_id: entry.deviceId,
        metadata: entry.metadata,
      })
    } catch (error) {
      // Log to console but don't throw - audit logging should not break the app
      console.error('Failed to write audit log:', error)
    }
  }

  private getClientIp(headersList: Headers): string | undefined {
    const forwardedFor = headersList.get('x-forwarded-for')
    const realIp = headersList.get('x-real-ip')
    
    if (forwardedFor) {
      return forwardedFor.split(',')[0].trim()
    }
    
    return realIp || undefined
  }

  // Convenience methods
  async logLogin(userId: string, metadata?: Record<string, any>): Promise<void> {
    await this.log({
      userId,
      eventType: 'login',
      metadata,
    })
  }

  async logLogout(userId: string): Promise<void> {
    await this.log({
      userId,
      eventType: 'logout',
    })
  }

  async logPasswordResetRequest(email: string): Promise<void> {
    await this.log({
      eventType: 'password_reset_request',
      metadata: { email },
    })
  }

  async logPasswordResetComplete(userId: string): Promise<void> {
    await this.log({
      userId,
      eventType: 'password_reset_complete',
    })
  }

  async log2FAEnable(userId: string): Promise<void> {
    await this.log({
      userId,
      eventType: '2fa_enable',
    })
  }

  async log2FAVerify(userId: string, success: boolean): Promise<void> {
    await this.log({
      userId,
      eventType: '2fa_verify',
      metadata: { success },
    })
  }

  async logAccountLocked(email: string, reason: string): Promise<void> {
    await this.log({
      eventType: 'account_locked',
      metadata: { email, reason },
    })
  }
}