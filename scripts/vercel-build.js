#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for better visibility
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const color = {
    info: colors.blue,
    success: colors.green,
    warning: colors.yellow,
    error: colors.red,
    section: colors.magenta,
  }[type] || colors.reset;
  
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'section');
  console.log('='.repeat(80) + '\n');
}

function checkEnvironmentVariables() {
  logSection('Environment Variables Check');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN',
  ];
  
  const optionalVars = [
    'NEXT_PUBLIC_APP_ENV',
    'VERCEL',
    'VERCEL_ENV',
    'VERCEL_URL',
    'VERCEL_GIT_COMMIT_SHA',
    'VERCEL_GIT_COMMIT_MESSAGE',
    'CI',
  ];
  
  log('Required Environment Variables:', 'info');
  let missingRequired = false;
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      const value = varName.includes('KEY') ? '[REDACTED]' : process.env[varName].substring(0, 20) + '...';
      log(`  ✅ ${varName}: ${value}`, 'success');
    } else {
      log(`  ❌ ${varName}: MISSING`, 'error');
      missingRequired = true;
    }
  });
  
  log('\nOptional/Build Environment Variables:', 'info');
  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      log(`  ℹ️  ${varName}: ${process.env[varName]}`, 'info');
    }
  });
  
  if (missingRequired) {
    log('\n⚠️  Missing required environment variables!', 'warning');
  }
  
  return !missingRequired;
}

function checkFileSystem() {
  logSection('File System Check');
  
  const criticalFiles = [
    'middleware.ts',
    'next.config.ts',
    'tsconfig.json',
    'package.json',
    'vercel.json',
    '.env.local',
    'types/database.generated.ts',
  ];
  
  const criticalDirs = [
    'app',
    'components',
    'lib',
    'public',
    'types',
  ];
  
  log('Critical Files:', 'info');
  criticalFiles.forEach(file => {
    const exists = fs.existsSync(file);
    if (exists) {
      const stats = fs.statSync(file);
      log(`  ✅ ${file} (${stats.size} bytes)`, 'success');
    } else {
      log(`  ⚠️  ${file} - NOT FOUND`, 'warning');
    }
  });
  
  log('\nCritical Directories:', 'info');
  criticalDirs.forEach(dir => {
    const exists = fs.existsSync(dir);
    if (exists) {
      const fileCount = fs.readdirSync(dir).length;
      log(`  ✅ ${dir}/ (${fileCount} items)`, 'success');
    } else {
      log(`  ❌ ${dir}/ - NOT FOUND`, 'error');
    }
  });
}

function checkMiddleware() {
  logSection('Middleware Analysis');
  
  try {
    const middlewarePath = path.join(process.cwd(), 'middleware.ts');
    if (fs.existsSync(middlewarePath)) {
      const content = fs.readFileSync(middlewarePath, 'utf8');
      
      // Check for critical imports
      const hasSupabaseImport = content.includes('@supabase/ssr');
      const hasTypeImport = content.includes('Database');
      const hasGetUser = content.includes('getUser');
      
      log('Middleware checks:', 'info');
      log(`  ${hasSupabaseImport ? '✅' : '❌'} @supabase/ssr import found`, hasSupabaseImport ? 'success' : 'error');
      log(`  ${hasTypeImport ? '✅' : '❌'} Database type import found`, hasTypeImport ? 'success' : 'error');
      log(`  ${hasGetUser ? '✅' : '❌'} getUser method used`, hasGetUser ? 'success' : 'error');
      
      // Check for edge runtime export
      const hasEdgeRuntime = content.includes("export const runtime = 'edge'");
      if (hasEdgeRuntime) {
        log('  ⚠️  Edge runtime export found - this might cause issues', 'warning');
      }
      
      // Count lines
      const lineCount = content.split('\n').length;
      log(`  ℹ️  Middleware size: ${lineCount} lines, ${content.length} characters`, 'info');
    } else {
      log('  ❌ middleware.ts not found!', 'error');
    }
  } catch (error) {
    log(`  ❌ Error analyzing middleware: ${error.message}`, 'error');
  }
}

function runCommand(command, description) {
  log(`Running: ${description}`, 'info');
  log(`Command: ${command}`, 'info');
  
  const startTime = Date.now();
  
  try {
    const output = execSync(command, { 
      stdio: 'pipe',
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`✅ ${description} completed in ${duration}s`, 'success');
    
    if (output && output.trim()) {
      console.log('\nCommand output:');
      console.log(output);
    }
    
    return { success: true, output, duration };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`❌ ${description} failed after ${duration}s`, 'error');
    
    if (error.stdout) {
      console.log('\nStdout:');
      console.log(error.stdout.toString());
    }
    
    if (error.stderr) {
      console.log('\nStderr:');
      console.log(error.stderr.toString());
    }
    
    console.log('\nError:', error.message);
    return { success: false, error, duration };
  }
}

async function main() {
  logSection('Vercel Build Process - Enhanced Logging');
  
  log(`Build started at: ${new Date().toISOString()}`, 'info');
  log(`Current directory: ${process.cwd()}`, 'info');
  log(`Node version: ${process.version}`, 'info');
  log(`Platform: ${process.platform} ${process.arch}`, 'info');
  
  // Run all checks
  checkEnvironmentVariables();
  checkFileSystem();
  checkMiddleware();
  
  // Check package manager
  logSection('Package Manager Check');
  const packageManager = process.env.npm_config_user_agent || 'unknown';
  log(`Package manager: ${packageManager}`, 'info');
  
  // Check dependencies
  logSection('Dependency Check');
  const { success: depsSuccess } = runCommand('pnpm list @supabase/ssr @supabase/supabase-js next react', 'Check key dependencies');
  
  // Run TypeScript check (non-blocking)
  logSection('TypeScript Check (Non-blocking)');
  runCommand('pnpm type-check || true', 'TypeScript validation');
  
  // The main build
  logSection('Next.js Build');
  log('Starting Next.js build process...', 'info');
  
  const buildStart = Date.now();
  const { success: buildSuccess, error: buildError } = runCommand('pnpm next build', 'Next.js production build');
  
  const totalDuration = ((Date.now() - buildStart) / 1000).toFixed(2);
  
  // Final summary
  logSection('Build Summary');
  
  if (buildSuccess) {
    log(`✅ Build completed successfully in ${totalDuration}s`, 'success');
    
    // Check output directory
    if (fs.existsSync('.next')) {
      const files = fs.readdirSync('.next');
      log(`Build output: .next/ directory contains ${files.length} items`, 'info');
      
      // Check for middleware in build
      const middlewareChunk = files.find(f => f.includes('middleware'));
      if (middlewareChunk) {
        log(`✅ Middleware chunk found: ${middlewareChunk}`, 'success');
      } else {
        log('⚠️  No middleware chunk found in build output', 'warning');
      }
    }
    
    process.exit(0);
  } else {
    log(`❌ Build failed after ${totalDuration}s`, 'error');
    log('Please check the error output above for details', 'error');
    process.exit(1);
  }
}

// Run the build process
main().catch(error => {
  log(`Unexpected error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});