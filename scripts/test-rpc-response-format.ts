#!/usr/bin/env tsx
/**
 * Test RPC response format
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Please set SUPABASE_SERVICE_ROLE_KEY environment variable')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testRPCResponse() {
  console.log('🔍 Testing RPC Response Format')
  console.log('=' .repeat(60))
  
  const projectId = '90cc2a33-e02e-432d-abdb-c46b0e185a00' // Project 5772
  
  console.log('\n📊 Calling get_composite_labor_rate...')
  const { data, error } = await supabase.rpc('get_composite_labor_rate', {
    p_project_id: projectId,
    p_weeks_back: 16,
    p_categories: ['direct', 'indirect', 'staff']
  })
  
  if (error) {
    console.error('❌ Error:', error)
    return
  }
  
  console.log('\n✅ Raw response:')
  console.log('Type:', typeof data)
  console.log('Is Array:', Array.isArray(data))
  console.log('Data:', JSON.stringify(data, null, 2))
  
  if (Array.isArray(data) && data.length > 0) {
    console.log('\n📊 First element:')
    const first = data[0]
    console.log('Type:', typeof first)
    console.log('Keys:', Object.keys(first))
    console.log('Values:', first)
  }
  
  // Also test using .single()
  console.log('\n📊 Testing with .single()...')
  const { data: singleData, error: singleError } = await supabase
    .rpc('get_composite_labor_rate', {
      p_project_id: projectId,
      p_weeks_back: 16,
      p_categories: ['direct', 'indirect', 'staff']
    })
    .single()
    
  if (singleError) {
    console.error('❌ Single error:', singleError)
  } else {
    console.log('✅ Single response:')
    console.log('Type:', typeof singleData)
    console.log('Data:', JSON.stringify(singleData, null, 2))
  }
}

async function main() {
  await testRPCResponse()
  console.log('\n' + '='.repeat(60))
}

main().catch(console.error)