#!/usr/bin/env node
// Simple build info script that can be called during Vercel build
// Usage: node scripts/build-info.js

const fs = require('fs');
const path = require('path');

console.log('\n🔍 Build Environment Information\n');
console.log('Timestamp:', new Date().toISOString());
console.log('Node.js:', process.version);
console.log('Platform:', process.platform, process.arch);
console.log('Working Dir:', process.cwd());

// Check if running on Vercel
if (process.env.VERCEL) {
  console.log('\n📦 Vercel Environment:');
  console.log('- Environment:', process.env.VERCEL_ENV);
  console.log('- Region:', process.env.VERCEL_REGION || 'not specified');
  console.log('- URL:', process.env.VERCEL_URL || 'not specified');
  console.log('- Git Provider:', process.env.VERCEL_GIT_PROVIDER || 'not specified');
  console.log('- Git Repo:', process.env.VERCEL_GIT_REPO_SLUG || 'not specified');
  console.log('- Git Commit:', process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || 'not specified');
  console.log('- Git Branch:', process.env.VERCEL_GIT_COMMIT_REF || 'not specified');
}

// Check package manager
console.log('\n📚 Package Manager:');
const userAgent = process.env.npm_config_user_agent || '';
if (userAgent.includes('pnpm')) {
  console.log('- Using: pnpm');
  console.log('- Version:', userAgent.split(' ')[1] || 'unknown');
} else if (userAgent.includes('npm')) {
  console.log('- Using: npm');
  console.log('- Version:', userAgent.split(' ')[1] || 'unknown');
} else {
  console.log('- Using:', userAgent || 'unknown');
}

// Check for critical files
console.log('\n📄 Critical Files Check:');
const files = [
  'middleware.ts',
  'next.config.ts',
  'tsconfig.json',
  'vercel.json',
  '.env',
  '.env.local',
  '.env.production',
  'types/database.generated.ts'
];

files.forEach(file => {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  console.log(`- ${file}: ${exists ? '✅ exists' : '❌ missing'}`);
});

// Check environment variables (safely)
console.log('\n🔐 Environment Variables:');
const envVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN',
  'NEXT_PUBLIC_APP_ENV'
];

envVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    if (varName.includes('KEY') || varName.includes('SECRET')) {
      console.log(`- ${varName}: ✅ set (redacted)`);
    } else {
      console.log(`- ${varName}: ✅ set (${value.substring(0, 20)}...)`);
    }
  } else {
    console.log(`- ${varName}: ❌ not set`);
  }
});

// Directory structure
console.log('\n📁 Directory Structure:');
const dirs = ['app', 'components', 'lib', 'public', 'types', 'scripts'];
dirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    const count = fs.readdirSync(dir).length;
    console.log(`- ${dir}/: ✅ ${count} items`);
  } else {
    console.log(`- ${dir}/: ❌ missing`);
  }
});

console.log('\n✨ Build info complete\n');