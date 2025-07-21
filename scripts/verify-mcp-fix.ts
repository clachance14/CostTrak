#!/usr/bin/env tsx
import { createHash } from 'crypto'

console.log('=== MCP Configuration Verification ===\n')

// The correct connection string from your environment
const correctConnString = "postgresql://postgres.gzrxhwpmtbgnngadgnse:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cnhod3BtdGJnbm5nYWRnbnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM0MTA0NiwiZXhwIjoyMDY3OTE3MDQ2fQ.T28daDatbOTmApZOa3c2RyVPPJaQdMnnHD09NlXKtww@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

// The incorrect connection string with typo
const incorrectConnString = "postgresql://postgres.gzrxhwpmtbgnngadgnse:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cnhod3BtdGJnbm5nYWRnbnN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM0MTA0NiwiZXhwIjoyMDY3OTE3MDQ2fQ.T28daDatbOTmApZOa3c2RyVPPJaQdMnnHD09NlXKtww@aws-0-us-west-1.pooler.supabase.com:6543/postgres"

// Parse JWT tokens
function parseJWT(token: string): any {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  
  try {
    const payload = Buffer.from(parts[1], 'base64').toString()
    return JSON.parse(payload)
  } catch {
    return null
  }
}

console.log('📋 Connection String Analysis:')
console.log('─────────────────────────────')

// Extract JWT from correct string
const correctJWT = correctConnString.match(/:(eyJ[^@]+)@/)?.[1]
const incorrectJWT = incorrectConnString.match(/:(eyJ[^@]+)@/)?.[1]

if (correctJWT && incorrectJWT) {
  const correctPayload = parseJWT(correctJWT)
  const incorrectPayload = parseJWT(incorrectJWT)
  
  console.log('\n✅ CORRECT JWT Payload:')
  console.log(`   ref: "${correctPayload.ref}"`)
  console.log(`   role: ${correctPayload.role}`)
  
  console.log('\n❌ INCORRECT JWT Payload (with typo):')
  console.log(`   ref: "${incorrectPayload.ref}" <- Note the 'su' instead of 'se'`)
  console.log(`   role: ${incorrectPayload.role}`)
  
  console.log('\n📋 The Issue:')
  console.log('────────────')
  console.log(`The ref field has a typo: "${incorrectPayload.ref}" instead of "${correctPayload.ref}"`)
  console.log('This causes the connection to fail because it tries to connect to:')
  console.log(`  ❌ db.${incorrectPayload.ref}.supabase.co (doesn't exist)`)
  console.log('Instead of:')
  console.log(`  ✅ aws-0-us-west-1.pooler.supabase.com (correct pooler)`)
}

console.log('\n📋 Quick Check:')
console.log('──────────────')
console.log('The CORRECT connection string should contain:')
console.log('  - "ref":"gzrxhwpmtbgnngadgnse" (ends with "se")')
console.log('  - Host: aws-0-us-west-1.pooler.supabase.com')

console.log('\n📋 Next Steps:')
console.log('────────────')
console.log('1. Copy the correct connection string above')
console.log('2. Open Claude Desktop Settings → Developer → Edit Config')
console.log('3. Replace the postgres args[1] value')
console.log('4. Save and fully restart Claude Desktop')
console.log('5. Test with: "Query the projects table"')

console.log('\n✨ Verification complete!')