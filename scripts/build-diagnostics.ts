#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ANSI color codes
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

interface DiagnosticResult {
  passed: boolean;
  message: string;
  details?: string;
}

class BuildDiagnostics {
  private results: { [key: string]: DiagnosticResult } = {};
  
  log(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const color = {
      info: colors.blue,
      success: colors.green,
      warning: colors.yellow,
      error: colors.red,
    }[type];
    
    console.log(`${color}${message}${colors.reset}`);
  }
  
  logSection(title: string) {
    console.log('\n' + '='.repeat(60));
    console.log(`${colors.magenta}${title}${colors.reset}`);
    console.log('='.repeat(60));
  }
  
  async checkTypescriptConfig() {
    this.logSection('TypeScript Configuration');
    
    try {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      
      // Check critical settings
      const strict = tsconfig.compilerOptions?.strict === true;
      const skipLibCheck = tsconfig.compilerOptions?.skipLibCheck === true;
      const moduleResolution = tsconfig.compilerOptions?.moduleResolution;
      
      this.log(`Strict mode: ${strict ? '✅ Enabled' : '⚠️  Disabled'}`, strict ? 'success' : 'warning');
      this.log(`Skip lib check: ${skipLibCheck ? '✅ Enabled' : 'ℹ️  Disabled'}`, 'info');
      this.log(`Module resolution: ${moduleResolution || 'default'}`, 'info');
      
      // Check if middleware.ts is included
      const includesMiddleware = !tsconfig.exclude?.includes('middleware.ts');
      this.log(`Middleware included: ${includesMiddleware ? '✅ Yes' : '❌ No'}`, includesMiddleware ? 'success' : 'error');
      
      this.results['typescript'] = {
        passed: strict && includesMiddleware,
        message: 'TypeScript configuration',
        details: `Strict: ${strict}, Middleware included: ${includesMiddleware}`
      };
      
    } catch (error) {
      this.log('❌ Failed to read tsconfig.json', 'error');
      this.results['typescript'] = {
        passed: false,
        message: 'TypeScript configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async checkMiddlewareCompilation() {
    this.logSection('Middleware Compilation Test');
    
    try {
      // Try to compile just the middleware file
      const result = execSync('npx tsc middleware.ts --noEmit --skipLibCheck', {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      this.log('✅ Middleware compiles without errors', 'success');
      this.results['middleware-compilation'] = {
        passed: true,
        message: 'Middleware compilation'
      };
      
    } catch (error: any) {
      this.log('❌ Middleware compilation failed', 'error');
      console.log(error.stdout || error.message);
      
      this.results['middleware-compilation'] = {
        passed: false,
        message: 'Middleware compilation',
        details: error.stdout || error.message
      };
    }
  }
  
  async checkSupabaseTypes() {
    this.logSection('Supabase Type Definitions');
    
    const typesPath = path.join(process.cwd(), 'types', 'database.generated.ts');
    
    if (fs.existsSync(typesPath)) {
      const content = fs.readFileSync(typesPath, 'utf8');
      const hasDatabase = content.includes('export type Database =');
      const hasTables = content.includes('Tables:');
      
      this.log(`Database type export: ${hasDatabase ? '✅ Found' : '❌ Not found'}`, hasDatabase ? 'success' : 'error');
      this.log(`Tables definition: ${hasTables ? '✅ Found' : '❌ Not found'}`, hasTables ? 'success' : 'error');
      
      // Check file size
      const stats = fs.statSync(typesPath);
      this.log(`Type file size: ${(stats.size / 1024).toFixed(2)} KB`, 'info');
      
      this.results['supabase-types'] = {
        passed: hasDatabase && hasTables,
        message: 'Supabase type definitions',
        details: `Database: ${hasDatabase}, Tables: ${hasTables}, Size: ${stats.size} bytes`
      };
    } else {
      this.log('❌ types/database.generated.ts not found', 'error');
      this.results['supabase-types'] = {
        passed: false,
        message: 'Supabase type definitions',
        details: 'File not found'
      };
    }
  }
  
  async checkDependencies() {
    this.logSection('Dependencies Check');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const deps = packageJson.dependencies || {};
      
      const criticalDeps = [
        '@supabase/ssr',
        '@supabase/supabase-js',
        'next',
        'react',
        'react-dom'
      ];
      
      criticalDeps.forEach(dep => {
        const version = deps[dep];
        if (version) {
          this.log(`${dep}: ${version}`, 'success');
        } else {
          this.log(`${dep}: ❌ Missing`, 'error');
        }
      });
      
      // Check @supabase/ssr version specifically
      const ssrVersion = deps['@supabase/ssr'];
      if (ssrVersion === '0.6.1') {
        this.log('\n⚠️  Using @supabase/ssr 0.6.1 - known compatibility issues with Next.js 15', 'warning');
        this.log('Consider trying 0.7.0-rc.2 if issues persist', 'warning');
      }
      
      this.results['dependencies'] = {
        passed: criticalDeps.every(dep => deps[dep]),
        message: 'Critical dependencies',
        details: `All critical deps: ${criticalDeps.every(dep => deps[dep]) ? 'Present' : 'Missing some'}`
      };
      
    } catch (error) {
      this.log('❌ Failed to check dependencies', 'error');
      this.results['dependencies'] = {
        passed: false,
        message: 'Dependencies check',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async checkBuildEnvironment() {
    this.logSection('Build Environment');
    
    this.log(`Node.js: ${process.version}`, 'info');
    this.log(`Platform: ${process.platform} ${process.arch}`, 'info');
    this.log(`Working directory: ${process.cwd()}`, 'info');
    
    // Check if running on Vercel
    const isVercel = process.env.VERCEL === '1';
    const vercelEnv = process.env.VERCEL_ENV;
    
    if (isVercel) {
      this.log(`Running on Vercel: ✅ Yes (${vercelEnv || 'unknown env'})`, 'success');
      this.log(`Git SHA: ${process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 8) || 'unknown'}`, 'info');
    } else {
      this.log('Running on Vercel: ❌ No (local build)', 'info');
    }
    
    // Check Next.js cache
    const nextCacheExists = fs.existsSync('.next');
    if (nextCacheExists) {
      this.log('\n⚠️  .next directory exists - consider cleaning before build', 'warning');
      this.log('Run: rm -rf .next', 'info');
    }
  }
  
  async generateReport() {
    this.logSection('Diagnostic Summary');
    
    const allPassed = Object.values(this.results).every(r => r.passed);
    const passedCount = Object.values(this.results).filter(r => r.passed).length;
    const totalCount = Object.keys(this.results).length;
    
    console.log('\nResults:');
    Object.entries(this.results).forEach(([key, result]) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const color = result.passed ? colors.green : colors.red;
      console.log(`${color}${status}${colors.reset} - ${result.message}`);
      if (!result.passed && result.details) {
        console.log(`  └─ ${result.details}`);
      }
    });
    
    console.log(`\nOverall: ${passedCount}/${totalCount} checks passed`);
    
    if (!allPassed) {
      this.log('\n⚠️  Some checks failed. Build may encounter issues.', 'warning');
      
      // Provide specific recommendations
      if (!this.results['middleware-compilation']?.passed) {
        this.log('\n💡 Recommendation: Fix TypeScript errors in middleware.ts', 'info');
      }
      if (!this.results['supabase-types']?.passed) {
        this.log('\n💡 Recommendation: Generate Supabase types with: pnpm generate-types', 'info');
      }
    } else {
      this.log('\n✅ All diagnostics passed! Build should proceed smoothly.', 'success');
    }
    
    return allPassed;
  }
  
  async run() {
    console.log(`${colors.bright}${colors.cyan}Build Diagnostics - ${new Date().toISOString()}${colors.reset}\n`);
    
    await this.checkTypescriptConfig();
    await this.checkMiddlewareCompilation();
    await this.checkSupabaseTypes();
    await this.checkDependencies();
    await this.checkBuildEnvironment();
    
    const allPassed = await this.generateReport();
    
    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
  }
}

// Run diagnostics
const diagnostics = new BuildDiagnostics();
diagnostics.run().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});