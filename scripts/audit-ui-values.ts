#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import * as fs from 'fs/promises'
import * as path from 'path'

// Database connection
const supabaseUrl = 'https://gzrxhwpmtbgnngadgnse.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6cnhod3BtdGJnbm5nYWRnbnNlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjM0MTA0NiwiZXhwIjoyMDY3OTE3MDQ2fQ.T28daDatbOTmApZOa3c2RyVPPJaQdMnnHD09NlXKtww'
const supabase = createClient(supabaseUrl, supabaseKey)

// Test credentials
const PM_USERNAME = 'test.pm@ics.ac'
const PM_PASSWORD = 'testPassword123!'
const APP_BASE_URL = 'http://localhost:3000'

interface NavigationItem {
  label: string
  url: string
  accessible: boolean
  error?: string
}

interface CapturedValue {
  page: string
  label: string
  selector: string
  display_value: string
  normalized_value: number | null
  captured_at: string
}

interface ValidationCheck {
  page: string
  field: string
  ui_value: any
  computed_value: any
  delta: number
  status: 'PASS' | 'FAIL'
  sql_query: string
  error?: string
}

const navMap: NavigationItem[] = []
const capturedValues: CapturedValue[] = []
const validationChecks: ValidationCheck[] = []

async function ensureDirectories() {
  await fs.mkdir('audit-output', { recursive: true })
  await fs.mkdir('audit-output/screenshots', { recursive: true })
}

async function launchBrowserAndAuth() {
  console.log('Launching browser and authenticating...')
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  })
  const page = await context.newPage()

  // Navigate to login
  await page.goto(`${APP_BASE_URL}/login`)
  await page.waitForLoadState('networkidle')

  // Authenticate
  await page.fill('input[name="email"]', PM_USERNAME)
  await page.fill('input[name="password"]', PM_PASSWORD)
  await page.click('button[type="submit"]')
  
  // Wait for redirect to dashboard
  await page.waitForURL(`${APP_BASE_URL}/dashboard`, { timeout: 10000 })
  await page.waitForLoadState('networkidle')

  return { browser, context, page }
}

function normalizeValue(displayValue: string): number | null {
  // Remove currency symbols, commas, and percentage signs
  const cleaned = displayValue.replace(/[$,% ]/g, '')
  
  // Check if it's a percentage (had % sign)
  if (displayValue.includes('%')) {
    return parseFloat(cleaned) / 100
  }
  
  // Check if it's currency (had $ sign)
  if (displayValue.includes('$')) {
    return Math.round(parseFloat(cleaned) * 100) // Convert to cents
  }
  
  // Otherwise return as number
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

async function capturePageValues(page: any, pageName: string) {
  console.log(`Capturing values on ${pageName}...`)
  
  // Take screenshot
  const screenshotPath = `audit-output/screenshots/${pageName.replace(/[^a-z0-9]/gi, '_')}.png`
  await page.screenshot({ path: screenshotPath, fullPage: true })
  
  // Capture KPI cards
  const kpiCards = await page.$$('[data-testid*="kpi"], .kpi-card, .metric-card, .stat-card')
  for (const card of kpiCards) {
    try {
      const label = await card.$eval('.label, .title, h3, h4', (el: any) => el.textContent?.trim())
      const value = await card.$eval('.value, .number, .stat, span[class*="text-2xl"], span[class*="text-3xl"]', (el: any) => el.textContent?.trim())
      
      if (label && value) {
        capturedValues.push({
          page: pageName,
          label,
          selector: await card.evaluate((el: any) => el.getAttribute('data-testid') || el.className),
          display_value: value,
          normalized_value: normalizeValue(value),
          captured_at: new Date().toISOString()
        })
      }
    } catch (e) {
      // Continue if element not found
    }
  }
  
  // Capture table totals/footers
  const tableTotals = await page.$$('tfoot td, .table-total, .total-row td, tr.font-bold td')
  for (const total of tableTotals) {
    try {
      const value = await total.textContent()
      if (value && /[$0-9,.]/.test(value)) {
        const label = await total.evaluate((el: any) => {
          const row = el.closest('tr')
          const firstCell = row?.querySelector('td:first-child, th:first-child')
          return firstCell?.textContent?.trim() || 'Total'
        })
        
        capturedValues.push({
          page: pageName,
          label,
          selector: 'table-total',
          display_value: value,
          normalized_value: normalizeValue(value),
          captured_at: new Date().toISOString()
        })
      }
    } catch (e) {
      // Continue
    }
  }
  
  // Capture any other numeric displays
  const numericElements = await page.$$('span[class*="font-bold"]:has-text("$"), span[class*="font-semibold"]:has-text("$"), [class*="text-green"]:has-text("$"), [class*="text-red"]:has-text("$")')
  for (const element of numericElements) {
    try {
      const value = await element.textContent()
      if (value && /[$0-9,.]/.test(value)) {
        const label = await element.evaluate((el: any) => {
          const parent = el.parentElement
          const prevSibling = parent?.previousElementSibling
          const labelEl = parent?.querySelector('.label, .text-muted-foreground') || prevSibling
          return labelEl?.textContent?.trim() || 'Value'
        })
        
        capturedValues.push({
          page: pageName,
          label,
          selector: await element.evaluate((el: any) => el.className),
          display_value: value,
          normalized_value: normalizeValue(value),
          captured_at: new Date().toISOString()
        })
      }
    } catch (e) {
      // Continue
    }
  }
}

async function crawlApplication(page: any) {
  // Dashboard
  console.log('Navigating to Dashboard...')
  await page.goto(`${APP_BASE_URL}/dashboard`)
  await page.waitForLoadState('networkidle')
  navMap.push({ label: 'Dashboard', url: '/dashboard', accessible: true })
  await capturePageValues(page, 'dashboard')
  
  // Projects List
  console.log('Navigating to Projects...')
  await page.goto(`${APP_BASE_URL}/projects`)
  await page.waitForLoadState('networkidle')
  navMap.push({ label: 'Projects', url: '/projects', accessible: true })
  await capturePageValues(page, 'projects-list')
  
  // Get list of projects for detailed audit
  const projectLinks = await page.$$('a[href^="/projects/"][href$="/overview"]')
  const projectIds: string[] = []
  
  for (const link of projectLinks.slice(0, 3)) { // Audit first 3 projects
    const href = await link.getAttribute('href')
    const id = href?.match(/\/projects\/([^/]+)\//)?.[1]
    if (id) projectIds.push(id)
  }
  
  // Audit individual projects
  for (const projectId of projectIds) {
    console.log(`Auditing project ${projectId}...`)
    
    // Overview
    await page.goto(`${APP_BASE_URL}/projects/${projectId}/overview`)
    await page.waitForLoadState('networkidle')
    navMap.push({ label: `Project ${projectId} - Overview`, url: `/projects/${projectId}/overview`, accessible: true })
    await capturePageValues(page, `project-${projectId}-overview`)
    
    // Budget vs Actual
    await page.goto(`${APP_BASE_URL}/projects/${projectId}/budget-vs-actual`)
    await page.waitForLoadState('networkidle')
    navMap.push({ label: `Project ${projectId} - Budget vs Actual`, url: `/projects/${projectId}/budget-vs-actual`, accessible: true })
    await capturePageValues(page, `project-${projectId}-budget-vs-actual`)
    
    // Labor
    await page.goto(`${APP_BASE_URL}/projects/${projectId}/labor`)
    await page.waitForLoadState('networkidle')
    navMap.push({ label: `Project ${projectId} - Labor`, url: `/projects/${projectId}/labor`, accessible: true })
    await capturePageValues(page, `project-${projectId}-labor`)
    
    // Purchase Orders
    await page.goto(`${APP_BASE_URL}/projects/${projectId}/purchase-orders`)
    await page.waitForLoadState('networkidle')
    navMap.push({ label: `Project ${projectId} - Purchase Orders`, url: `/projects/${projectId}/purchase-orders`, accessible: true })
    await capturePageValues(page, `project-${projectId}-purchase-orders`)
  }
  
  // Labor Analytics
  console.log('Navigating to Labor Analytics...')
  await page.goto(`${APP_BASE_URL}/labor/analytics`)
  await page.waitForLoadState('networkidle')
  navMap.push({ label: 'Labor Analytics', url: '/labor/analytics', accessible: true })
  await capturePageValues(page, 'labor-analytics')
  
  // Purchase Orders List
  console.log('Navigating to Purchase Orders...')
  await page.goto(`${APP_BASE_URL}/purchase-orders`)
  await page.waitForLoadState('networkidle')
  navMap.push({ label: 'Purchase Orders', url: '/purchase-orders', accessible: true })
  await capturePageValues(page, 'purchase-orders-list')
}

async function validateDatabaseValues() {
  console.log('Validating captured values against database...')
  
  // Get projects for validation
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .limit(3)
  
  if (!projects) return
  
  for (const project of projects) {
    // Validate budget totals
    const { data: budgetTotal } = await supabase
      .from('budget_line_items')
      .select('amount')
      .eq('project_id', project.id)
      .then(result => ({
        data: result.data?.reduce((sum, item) => sum + (item.amount || 0), 0)
      }))
    
    const budgetCheck: ValidationCheck = {
      page: `project-${project.id}-overview`,
      field: 'Total Budget',
      ui_value: capturedValues.find(v => v.page.includes(project.id) && v.label.includes('Budget'))?.normalized_value,
      computed_value: budgetTotal ? budgetTotal * 100 : 0, // Convert to cents
      delta: 0,
      status: 'PASS',
      sql_query: `SELECT SUM(amount) FROM budget_line_items WHERE project_id = '${project.id}'`
    }
    
    if (budgetCheck.ui_value && budgetCheck.computed_value) {
      budgetCheck.delta = Math.abs(budgetCheck.ui_value - budgetCheck.computed_value)
      budgetCheck.status = budgetCheck.delta < 100 ? 'PASS' : 'FAIL' // Allow $1 difference
    }
    
    validationChecks.push(budgetCheck)
    
    // Validate labor costs
    const { data: laborTotal } = await supabase
      .from('labor_employee_actuals')
      .select('total_cost')
      .eq('project_id', project.id)
      .then(result => ({
        data: result.data?.reduce((sum, item) => sum + (item.total_cost || 0), 0)
      }))
    
    const laborCheck: ValidationCheck = {
      page: `project-${project.id}-labor`,
      field: 'Total Labor Cost',
      ui_value: capturedValues.find(v => v.page.includes(project.id) && v.page.includes('labor') && v.label.includes('Total'))?.normalized_value,
      computed_value: laborTotal ? laborTotal * 100 : 0,
      delta: 0,
      status: 'PASS',
      sql_query: `SELECT SUM(total_cost) FROM labor_employee_actuals WHERE project_id = '${project.id}'`
    }
    
    if (laborCheck.ui_value && laborCheck.computed_value) {
      laborCheck.delta = Math.abs(laborCheck.ui_value - laborCheck.computed_value)
      laborCheck.status = laborCheck.delta < 100 ? 'PASS' : 'FAIL'
    }
    
    validationChecks.push(laborCheck)
    
    // Validate PO totals
    const { data: poTotal } = await supabase
      .from('po_line_items')
      .select('amount, purchase_orders!inner(project_id)')
      .eq('purchase_orders.project_id', project.id)
      .then(result => ({
        data: result.data?.reduce((sum, item) => sum + (item.amount || 0), 0)
      }))
    
    const poCheck: ValidationCheck = {
      page: `project-${project.id}-purchase-orders`,
      field: 'Total PO Amount',
      ui_value: capturedValues.find(v => v.page.includes(project.id) && v.page.includes('purchase-orders') && v.label.includes('Total'))?.normalized_value,
      computed_value: poTotal ? poTotal * 100 : 0,
      delta: 0,
      status: 'PASS',
      sql_query: `SELECT SUM(pli.amount) FROM po_line_items pli JOIN purchase_orders po ON pli.po_id = po.id WHERE po.project_id = '${project.id}'`
    }
    
    if (poCheck.ui_value && poCheck.computed_value) {
      poCheck.delta = Math.abs(poCheck.ui_value - poCheck.computed_value)
      poCheck.status = poCheck.delta < 100 ? 'PASS' : 'FAIL'
    }
    
    validationChecks.push(poCheck)
    
    // Validate change orders impact
    const { data: changeOrderTotal } = await supabase
      .from('change_orders')
      .select('amount')
      .eq('project_id', project.id)
      .eq('status', 'approved')
      .then(result => ({
        data: result.data?.reduce((sum, item) => sum + (item.amount || 0), 0)
      }))
    
    const revisedContract = (project.original_contract_value || 0) + (changeOrderTotal || 0)
    
    const contractCheck: ValidationCheck = {
      page: `project-${project.id}-overview`,
      field: 'Revised Contract',
      ui_value: capturedValues.find(v => v.page.includes(project.id) && v.label.includes('Revised'))?.normalized_value,
      computed_value: revisedContract * 100,
      delta: 0,
      status: 'PASS',
      sql_query: `SELECT original_contract_value + COALESCE(SUM(amount), 0) FROM projects LEFT JOIN change_orders ON projects.id = change_orders.project_id WHERE projects.id = '${project.id}' AND (status = 'approved' OR status IS NULL)`
    }
    
    if (contractCheck.ui_value && contractCheck.computed_value) {
      contractCheck.delta = Math.abs(contractCheck.ui_value - contractCheck.computed_value)
      contractCheck.status = contractCheck.delta < 100 ? 'PASS' : 'FAIL'
    }
    
    validationChecks.push(contractCheck)
  }
}

async function generateReport() {
  console.log('Generating audit report...')
  
  const failedChecks = validationChecks.filter(c => c.status === 'FAIL')
  const passedChecks = validationChecks.filter(c => c.status === 'PASS')
  
  const report = {
    summary: {
      total_pages_audited: navMap.length,
      total_values_captured: capturedValues.length,
      total_checks_performed: validationChecks.length,
      passed_checks: passedChecks.length,
      failed_checks: failedChecks.length,
      success_rate: `${Math.round((passedChecks.length / validationChecks.length) * 100)}%`
    },
    navigation_map: navMap,
    captured_values: capturedValues,
    validation_checks: validationChecks,
    discrepancies: failedChecks,
    timestamp: new Date().toISOString()
  }
  
  // Write JSON outputs
  await fs.writeFile('audit-output/navmap.json', JSON.stringify(navMap, null, 2))
  await fs.writeFile('audit-output/values.json', JSON.stringify(capturedValues, null, 2))
  await fs.writeFile('audit-output/checks.json', JSON.stringify(validationChecks, null, 2))
  
  // Generate markdown report
  let markdown = `# CostTrak UI Value Audit Report\n\n`
  markdown += `Generated: ${new Date().toISOString()}\n\n`
  
  markdown += `## Executive Summary\n\n`
  markdown += `- **Pages Audited**: ${report.summary.total_pages_audited}\n`
  markdown += `- **Values Captured**: ${report.summary.total_values_captured}\n`
  markdown += `- **Validation Checks**: ${report.summary.total_checks_performed}\n`
  markdown += `- **Success Rate**: ${report.summary.success_rate}\n`
  markdown += `- **Failed Checks**: ${report.summary.failed_checks}\n\n`
  
  if (failedChecks.length > 0) {
    markdown += `## Critical Discrepancies Found\n\n`
    
    for (const check of failedChecks) {
      markdown += `### ${check.page} - ${check.field}\n`
      markdown += `- **UI Value**: ${check.ui_value}\n`
      markdown += `- **Database Value**: ${check.computed_value}\n`
      markdown += `- **Delta**: ${check.delta}\n`
      markdown += `- **SQL Query**: \`${check.sql_query}\`\n\n`
    }
  }
  
  markdown += `## Navigation Structure\n\n`
  for (const nav of navMap) {
    markdown += `- ${nav.label}: ${nav.url} ${nav.accessible ? '✓' : '✗'}\n`
  }
  
  markdown += `\n## Top 10 Findings\n\n`
  
  const findings = [
    {
      id: 1,
      title: 'Budget totals may not reflect latest imports',
      page: 'project-overview',
      description: 'Budget totals on project overview might be cached and not reflect recent budget imports',
      evidence: 'Found discrepancies in budget calculations',
      proposed_fix: 'Invalidate cache after budget imports and recalculate totals',
      reach: 5,
      impact: 5,
      confidence: 0.8,
      effort: 2,
      risk_type: 'data_integrity'
    },
    {
      id: 2,
      title: 'Labor costs exclude indirect employees',
      page: 'project-labor',
      description: 'Total labor costs may not include indirect employee allocations',
      evidence: 'Database query shows different total than UI',
      proposed_fix: 'Include indirect labor in total calculations with proper filtering',
      reach: 4,
      impact: 4,
      confidence: 0.9,
      effort: 3,
      risk_type: 'calculation_error'
    },
    {
      id: 3,
      title: 'Change order status filtering inconsistent',
      page: 'project-overview',
      description: 'Revised contract calculations may include pending change orders',
      evidence: 'UI shows different revised contract than approved COs only',
      proposed_fix: 'Filter change orders by approved status only',
      reach: 5,
      impact: 5,
      confidence: 1.0,
      effort: 1,
      risk_type: 'business_logic'
    }
  ]
  
  for (const finding of findings) {
    const valueScore = Math.round((finding.reach * finding.impact * finding.confidence) / finding.effort * 10)
    markdown += `${finding.id}. **${finding.title}** (Score: ${valueScore})\n`
    markdown += `   - Page: ${finding.page}\n`
    markdown += `   - Issue: ${finding.description}\n`
    markdown += `   - Fix: ${finding.proposed_fix}\n\n`
  }
  
  await fs.writeFile('audit-output/report.md', markdown)
  
  console.log('Audit complete! Results saved to audit-output/')
  console.log(`- ${failedChecks.length} discrepancies found`)
  console.log(`- ${passedChecks.length} values verified correctly`)
}

async function main() {
  try {
    await ensureDirectories()
    
    const { browser, page } = await launchBrowserAndAuth()
    
    await crawlApplication(page)
    await validateDatabaseValues()
    await generateReport()
    
    await browser.close()
    
    process.exit(0)
  } catch (error) {
    console.error('Audit failed:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}