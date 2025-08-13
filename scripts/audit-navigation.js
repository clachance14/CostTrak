#!/usr/bin/env node

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3001';
const LOGIN_EMAIL = 'clachance@ics.ac';
const LOGIN_PASSWORD = 'One!663579';
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');

// Navigation map to track visited pages
const navigationMap = {
  timestamp: new Date().toISOString(),
  pages: []
};

// Values captured from UI
const capturedValues = [];

// Utility to wait and extract numerical values
async function extractNumericalValues(page, pageName) {
  const values = await page.evaluate((pageName) => {
    const results = [];
    
    // Helper to clean and parse numbers
    const parseValue = (text) => {
      if (!text) return null;
      // Remove currency symbols, commas, and spaces
      const cleaned = text.replace(/[$,\s]/g, '');
      // Handle percentages
      if (text.includes('%')) {
        return parseFloat(cleaned) / 100;
      }
      return parseFloat(cleaned);
    };
    
    // Extract from KPI cards/tiles
    document.querySelectorAll('[data-testid*="kpi"], [data-testid*="metric"], .metric-card, .kpi-card, .stat-card').forEach(el => {
      const label = el.querySelector('.text-sm, .text-xs, .label')?.textContent?.trim() || 
                   el.querySelector('[class*="muted"]')?.textContent?.trim() || 'Unknown KPI';
      const valueEl = el.querySelector('.text-2xl, .text-3xl, .text-xl, [class*="font-semibold"]');
      if (valueEl) {
        const displayValue = valueEl.textContent.trim();
        results.push({
          page: pageName,
          label: label,
          selector: el.getAttribute('data-testid') || el.className,
          display_value: displayValue,
          normalized_value: parseValue(displayValue),
          element_type: 'kpi',
          captured_at: new Date().toISOString()
        });
      }
    });
    
    // Extract from tables (totals, footers)
    document.querySelectorAll('tfoot tr, tr.total-row, tr[class*="font-bold"]').forEach(row => {
      const cells = row.querySelectorAll('td, th');
      cells.forEach((cell, index) => {
        const text = cell.textContent.trim();
        const numValue = parseValue(text);
        if (!isNaN(numValue) && numValue !== null) {
          // Try to get header label
          const headerRow = row.closest('table')?.querySelector('thead tr');
          const label = headerRow?.querySelectorAll('th')[index]?.textContent?.trim() || `Column ${index}`;
          
          results.push({
            page: pageName,
            label: `Table Total - ${label}`,
            selector: `table footer cell[${index}]`,
            display_value: text,
            normalized_value: numValue,
            element_type: 'table_total',
            captured_at: new Date().toISOString()
          });
        }
      });
    });
    
    // Extract numbers from any element with currency or percentage
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0) { // Only leaf nodes
        const text = el.textContent.trim();
        if (/^\$[\d,]+(\.\d{2})?$/.test(text) || /^\d+(\.\d+)?%$/.test(text)) {
          // Find parent with meaningful context
          let parent = el.parentElement;
          let label = 'Unknown';
          while (parent && parent !== document.body) {
            const labelEl = parent.querySelector('.label, .text-sm, [class*="muted"]');
            if (labelEl && labelEl !== el) {
              label = labelEl.textContent.trim();
              break;
            }
            parent = parent.parentElement;
          }
          
          results.push({
            page: pageName,
            label: label,
            selector: el.className || 'inline-text',
            display_value: text,
            normalized_value: parseValue(text),
            element_type: 'inline_value',
            captured_at: new Date().toISOString()
          });
        }
      }
    });
    
    return results;
  }, pageName);
  
  return values;
}

async function crawlApplication() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Login
    console.log('Logging in...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
    await page.type('input[type="email"]', LOGIN_EMAIL);
    await page.type('input[type="password"]', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log('Login successful');
    
    // Define pages to visit
    const pagesToVisit = [
      { path: '/dashboard', name: 'Dashboard' },
      { path: '/projects', name: 'Projects List' },
      { path: '/labor/analytics', name: 'Labor Analytics' },
      { path: '/labor/forecasts', name: 'Labor Forecasts' },
      { path: '/purchase-orders', name: 'Purchase Orders' },
      { path: '/change-orders', name: 'Change Orders' },
      { path: '/employees', name: 'Employees' }
    ];
    
    // Crawl each page
    for (const pageInfo of pagesToVisit) {
      try {
        console.log(`Navigating to ${pageInfo.name}...`);
        await page.goto(`${BASE_URL}${pageInfo.path}`, { waitUntil: 'networkidle0' });
        
        // Wait a bit for any dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Take screenshot
        const screenshotPath = path.join(SCREENSHOTS_DIR, `${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        // Extract values
        const values = await extractNumericalValues(page, pageInfo.name);
        capturedValues.push(...values);
        
        // Add to navigation map
        navigationMap.pages.push({
          name: pageInfo.name,
          path: pageInfo.path,
          url: page.url(),
          screenshot: screenshotPath,
          values_count: values.length,
          visited_at: new Date().toISOString()
        });
        
        console.log(`✓ ${pageInfo.name}: Captured ${values.length} values`);
        
        // Check for project links on projects page
        if (pageInfo.path === '/projects') {
          const projectLinks = await page.evaluate(() => {
            const links = [];
            document.querySelectorAll('a[href^="/projects/"]').forEach(link => {
              const href = link.getAttribute('href');
              if (href && href !== '/projects/new' && !href.includes('import')) {
                const name = link.textContent.trim() || 'Unknown Project';
                links.push({ href, name });
              }
            });
            return links;
          });
          
          // Visit first 3 projects for detailed audit
          for (const project of projectLinks.slice(0, 3)) {
            try {
              console.log(`  Visiting project: ${project.name}`);
              await page.goto(`${BASE_URL}${project.href}`, { waitUntil: 'networkidle0' });
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              const projectScreenshot = path.join(SCREENSHOTS_DIR, `project-${project.href.split('/').pop()}.png`);
              await page.screenshot({ path: projectScreenshot, fullPage: true });
              
              const projectValues = await extractNumericalValues(page, `Project: ${project.name}`);
              capturedValues.push(...projectValues);
              
              navigationMap.pages.push({
                name: `Project: ${project.name}`,
                path: project.href,
                url: page.url(),
                screenshot: projectScreenshot,
                values_count: projectValues.length,
                visited_at: new Date().toISOString(),
                parent: 'Projects List'
              });
              
              console.log(`  ✓ ${project.name}: Captured ${projectValues.length} values`);
              
              // Check for tabs within project
              const tabs = await page.evaluate(() => {
                const tabLinks = [];
                document.querySelectorAll('[role="tablist"] a, .tabs a').forEach(tab => {
                  const href = tab.getAttribute('href');
                  const text = tab.textContent.trim();
                  if (href && text) {
                    tabLinks.push({ href, text });
                  }
                });
                return tabLinks;
              });
              
              for (const tab of tabs) {
                if (!tab.href.includes('import') && !tab.href.includes('new')) {
                  try {
                    await page.goto(`${BASE_URL}${tab.href}`, { waitUntil: 'networkidle0' });
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    const tabValues = await extractNumericalValues(page, `${project.name} - ${tab.text}`);
                    capturedValues.push(...tabValues);
                    
                    console.log(`    ✓ ${tab.text} tab: Captured ${tabValues.length} values`);
                  } catch (tabError) {
                    console.log(`    ✗ Failed to load tab ${tab.text}: ${tabError.message}`);
                  }
                }
              }
              
            } catch (projectError) {
              console.log(`  ✗ Failed to load project ${project.name}: ${projectError.message}`);
            }
          }
        }
        
      } catch (pageError) {
        console.error(`✗ Failed to load ${pageInfo.name}: ${pageError.message}`);
        navigationMap.pages.push({
          name: pageInfo.name,
          path: pageInfo.path,
          error: pageError.message,
          visited_at: new Date().toISOString()
        });
      }
    }
    
    // Save navigation map
    await fs.writeFile(
      path.join(__dirname, '..', 'navmap.md'),
      generateNavigationMarkdown(navigationMap),
      'utf8'
    );
    
    // Save captured values
    await fs.writeFile(
      path.join(__dirname, '..', 'values.json'),
      JSON.stringify(capturedValues, null, 2),
      'utf8'
    );
    
    console.log('\n=== Audit Summary ===');
    console.log(`Pages visited: ${navigationMap.pages.length}`);
    console.log(`Total values captured: ${capturedValues.length}`);
    console.log(`Screenshots saved: ${navigationMap.pages.filter(p => p.screenshot).length}`);
    
  } finally {
    await browser.close();
  }
}

function generateNavigationMarkdown(navMap) {
  let md = '# CostTrak Navigation Map\n\n';
  md += `Generated: ${navMap.timestamp}\n\n`;
  md += '## Application Structure\n\n';
  
  // Group pages by hierarchy
  const mainPages = navMap.pages.filter(p => !p.parent);
  const subPages = navMap.pages.filter(p => p.parent);
  
  md += '### Main Navigation\n\n';
  mainPages.forEach(page => {
    if (page.error) {
      md += `- ❌ **${page.name}** (${page.path}) - ERROR: ${page.error}\n`;
    } else {
      md += `- ✅ **${page.name}** (${page.path})\n`;
      md += `  - URL: ${page.url}\n`;
      md += `  - Values captured: ${page.values_count}\n`;
      
      // Add sub-pages
      const children = subPages.filter(sp => sp.parent === page.name);
      if (children.length > 0) {
        md += '  - Sub-pages:\n';
        children.forEach(child => {
          md += `    - ${child.name} (${child.values_count} values)\n`;
        });
      }
    }
  });
  
  md += '\n### Metrics Summary\n\n';
  md += `- Total pages visited: ${navMap.pages.length}\n`;
  md += `- Successful loads: ${navMap.pages.filter(p => !p.error).length}\n`;
  md += `- Failed loads: ${navMap.pages.filter(p => p.error).length}\n`;
  
  return md;
}

// Run the crawler
crawlApplication().catch(console.error);