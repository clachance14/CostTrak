import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import speakeasy from 'speakeasy'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if 2FA is already enabled
    const { data: profile } = await supabase
      .from('profiles')
      .select('two_factor_enabled')
      .eq('id', user.id)
      .single()

    if (profile?.two_factor_enabled) {
      return NextResponse.json(
        { error: '2FA is already enabled' },
        { status: 400 }
      )
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `CostTrak (${user.email})`,
      issuer: 'Industrial Construction Services',
      length: 32,
    })

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () => 
      nanoid(10).toUpperCase().match(/.{1,5}/g)?.join('-') || ''
    )

    // Store secret temporarily (in production, use a cache like Redis)
    // For now, we'll return it to the client
    // In production, store in a temporary table or cache

    return NextResponse.json({
      secret: secret.base32,
      qrCode: secret.otpauth_url,
      backupCodes,
    })

  } catch (error) {
    console.error('2FA setup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}