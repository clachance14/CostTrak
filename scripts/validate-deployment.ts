#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

async function validateDeployment() {
  console.log('🔍 Validating deployment configuration...\n')

  const errors: string[] = []
  const warnings: string[] = []

  // Check environment variables
  console.log('📋 Checking environment variables...')
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN'
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`)
    } else {
      console.log(`✅ ${envVar}: Present`)
    }
  }

  // Test Supabase connection
  console.log('\n🔌 Testing Supabase connection...')
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )

      // Test auth service
      const { error: authError } = await supabase.auth.getSession()
      if (authError) {
        errors.push(`Supabase auth test failed: ${authError.message}`)
      } else {
        console.log('✅ Supabase auth service: Connected')
      }

      // Test database connection
      const { error: dbError } = await supabase.from('profiles').select('count').limit(1)
      if (dbError) {
        errors.push(`Supabase database test failed: ${dbError.message}`)
      } else {
        console.log('✅ Supabase database: Connected')
      }
    } catch (error) {
      errors.push(`Supabase connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Check TypeScript configuration
  console.log('\n📝 Checking TypeScript configuration...')
  try {
    const tsConfig = require('../tsconfig.json')
    if (tsConfig.compilerOptions.strict !== true) {
      warnings.push('TypeScript strict mode is not enabled')
    } else {
      console.log('✅ TypeScript strict mode: Enabled')
    }
  } catch (error) {
    warnings.push('Could not read tsconfig.json')
  }

  // Check Next.js configuration
  console.log('\n⚙️ Checking Next.js configuration...')
  try {
    const nextConfig = require('../next.config.ts')
    if (nextConfig.typescript?.ignoreBuildErrors === true) {
      warnings.push('TypeScript build errors are being ignored - consider fixing them')
    }
    if (nextConfig.eslint?.ignoreDuringBuilds === true) {
      warnings.push('ESLint errors are being ignored during builds - consider fixing them')
    }
    console.log('✅ Next.js configuration: Loaded')
  } catch (error) {
    console.log('ℹ️ Next.js configuration check skipped')
  }

  // Summary
  console.log('\n' + '='.repeat(50))
  console.log('📊 DEPLOYMENT VALIDATION SUMMARY')
  console.log('='.repeat(50))

  if (errors.length === 0) {
    console.log('\n✅ All critical checks passed!')
  } else {
    console.log('\n❌ Critical errors found:')
    errors.forEach(error => console.log(`   - ${error}`))
  }

  if (warnings.length > 0) {
    console.log('\n⚠️ Warnings:')
    warnings.forEach(warning => console.log(`   - ${warning}`))
  }

  console.log('\n' + '='.repeat(50))

  // Exit with error if critical issues found
  if (errors.length > 0) {
    console.log('\n🛑 Deployment validation failed. Please fix the errors above.')
    process.exit(1)
  } else {
    console.log('\n✅ Deployment validation passed!')
  }
}

// Run validation
validateDeployment().catch(error => {
  console.error('Validation script failed:', error)
  process.exit(1)
})