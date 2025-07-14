import { createClient } from '@/lib/supabase/client'
import { headers } from 'next/headers'

export interface RateLimitConfig {
  maxAttempts: number
  windowMinutes: number
  lockoutMinutes: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxAttempts: 5,
  windowMinutes: 15,
  lockoutMinutes: 30,
}

export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async checkLoginAttempts(email: string, ip?: string): Promise<{
    allowed: boolean
    remainingAttempts: number
    lockedUntil?: Date
    requiresCaptcha: boolean
  }> {
    const supabase = createClient()
    const windowStart = new Date(Date.now() - this.config.windowMinutes * 60 * 1000)

    // Check recent attempts by email
    const { data: emailAttempts } = await supabase
      .from('login_attempts')
      .select('*')
      .eq('email', email.toLowerCase())
      .gte('created_at', windowStart.toISOString())
      .order('created_at', { ascending: false })

    // Check recent attempts by IP if provided
    interface LoginAttempt {
      email: string
      ip_address: string
      created_at: string
      success: boolean
    }
    let ipAttempts: LoginAttempt[] = []
    if (ip) {
      const { data } = await supabase
        .from('login_attempts')
        .select('*')
        .eq('ip_address', ip)
        .gte('created_at', windowStart.toISOString())
        .order('created_at', { ascending: false })
      ipAttempts = data || []
    }

    // Count failed attempts
    const failedEmailAttempts = (emailAttempts || []).filter(a => !a.success).length
    const failedIpAttempts = ipAttempts.filter(a => !a.success).length
    const totalFailedAttempts = Math.max(failedEmailAttempts, failedIpAttempts)

    // Check if account is locked
    const { data: user } = await supabase
      .from('profiles')
      .select('account_locked_at')
      .eq('email', email.toLowerCase())
      .single()

    if (user?.account_locked_at) {
      const lockoutEnd = new Date(user.account_locked_at)
      lockoutEnd.setMinutes(lockoutEnd.getMinutes() + this.config.lockoutMinutes)
      
      if (lockoutEnd > new Date()) {
        return {
          allowed: false,
          remainingAttempts: 0,
          lockedUntil: lockoutEnd,
          requiresCaptcha: true,
        }
      }
    }

    // Check if rate limit exceeded
    if (totalFailedAttempts >= this.config.maxAttempts) {
      // Lock the account
      if (user) {
        await supabase
          .from('profiles')
          .update({
            account_locked_at: new Date().toISOString(),
            failed_login_attempts: totalFailedAttempts,
          })
          .eq('email', email.toLowerCase())
      }

      const lockedUntil = new Date()
      lockedUntil.setMinutes(lockedUntil.getMinutes() + this.config.lockoutMinutes)

      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil,
        requiresCaptcha: true,
      }
    }

    return {
      allowed: true,
      remainingAttempts: this.config.maxAttempts - totalFailedAttempts,
      requiresCaptcha: totalFailedAttempts >= 3,
    }
  }

  async recordLoginAttempt(
    email: string,
    success: boolean,
    errorMessage?: string,
    metadata?: {
      ip?: string
      userAgent?: string
    }
  ): Promise<void> {
    const supabase = createClient()

    await supabase.from('login_attempts').insert({
      email: email.toLowerCase(),
      success,
      error_message: errorMessage,
      ip_address: metadata?.ip,
      user_agent: metadata?.userAgent,
    })

    // Reset failed attempts on successful login
    if (success) {
      await supabase
        .from('profiles')
        .update({
          failed_login_attempts: 0,
          account_locked_at: null,
          last_login_at: new Date().toISOString(),
          last_login_ip: metadata?.ip,
        })
        .eq('email', email.toLowerCase())
    }
  }
}

// Helper to get client IP from headers
export async function getClientIp(): Promise<string | undefined> {
  const headersList = await headers()
  const forwardedFor = headersList.get('x-forwarded-for')
  const realIp = headersList.get('x-real-ip')
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  return realIp || undefined
}