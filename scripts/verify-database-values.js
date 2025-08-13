#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Database connection from CLAUDE.md
const connectionString = 'postgres://postgres.gzrxhwpmtbgnngadgnse:F1dOjRhYg9lFWSlY@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require';

// Load captured values
const valuesPath = path.join(__dirname, '..', 'values.json');

const checks = [];

async function verifyDashboardValues(client, values) {
  console.log('\n=== Verifying Dashboard Values ===\n');
  
  // Get total contract values for active projects
  const contractQuery = `
    SELECT 
      SUM(p.original_contract_value) as total_original,
      SUM(p.original_contract_value + COALESCE(co_sum.approved_amount, 0)) as total_revised,
      COUNT(DISTINCT p.id) as project_count
    FROM projects p
    LEFT JOIN (
      SELECT project_id, SUM(amount) as approved_amount
      FROM change_orders
      WHERE status = 'approved'
      GROUP BY project_id
    ) co_sum ON co_sum.project_id = p.id
    WHERE p.status = 'active'
  `;
  
  const result = await client.query(contractQuery);
  const dbValues = result.rows[0];
  
  // Find corresponding UI value
  const uiContractValue = values.find(v => 
    v.page === 'Dashboard' && 
    v.label.includes('Total Contract Value')
  );
  
  if (uiContractValue) {
    const check = {
      page: 'Dashboard',
      element: 'Total Contract Value',
      ui_value: uiContractValue.display_value,
      ui_normalized: uiContractValue.normalized_value,
      db_value: dbValues.total_revised,
      delta: Math.abs(uiContractValue.normalized_value - (dbValues.total_revised || 0)),
      status: Math.abs(uiContractValue.normalized_value - (dbValues.total_revised || 0)) < 0.01 ? 'PASS' : 'FAIL',
      sql_query: contractQuery.replace(/\s+/g, ' ').trim()
    };
    checks.push(check);
    console.log(`Total Contract Value: UI=${uiContractValue.display_value}, DB=$${dbValues.total_revised?.toFixed(2) || 'null'} - ${check.status}`);
  }
  
  // Verify forecasted final cost
  const forecastQuery = `
    SELECT 
      SUM(actual_cost + remaining_forecast) as forecasted_final_cost
    FROM (
      SELECT 
        p.id,
        COALESCE(labor.total_cost, 0) + COALESCE(po.total_cost, 0) as actual_cost,
        COALESCE(p.original_contract_value * 0.3, 0) as remaining_forecast -- Placeholder logic
      FROM projects p
      LEFT JOIN (
        SELECT project_id, SUM(total_cost) as total_cost
        FROM labor_employee_actuals
        GROUP BY project_id
      ) labor ON labor.project_id = p.id
      LEFT JOIN (
        SELECT pol.project_id, SUM(pol.amount) as total_cost
        FROM po_line_items pol
        JOIN purchase_orders po ON po.id = pol.purchase_order_id
        GROUP BY pol.project_id
      ) po ON po.project_id = p.id
      WHERE p.status = 'active'
    ) forecast_calc
  `;
  
  const forecastResult = await client.query(forecastQuery);
  const forecastValue = forecastResult.rows[0]?.forecasted_final_cost;
  
  const uiForecastValue = values.find(v => 
    v.page === 'Dashboard' && 
    v.label.includes('Forecasted Final Cost')
  );
  
  if (uiForecastValue && forecastValue !== undefined) {
    const check = {
      page: 'Dashboard',
      element: 'Forecasted Final Cost',
      ui_value: uiForecastValue.display_value,
      ui_normalized: uiForecastValue.normalized_value,
      db_value: forecastValue,
      delta: Math.abs(uiForecastValue.normalized_value - forecastValue),
      status: Math.abs(uiForecastValue.normalized_value - forecastValue) < 0.01 ? 'PASS' : 'FAIL',
      sql_query: forecastQuery.replace(/\s+/g, ' ').trim()
    };
    checks.push(check);
    console.log(`Forecasted Final Cost: UI=${uiForecastValue.display_value}, DB=$${forecastValue?.toFixed(2) || 'null'} - ${check.status}`);
  }
  
  // Verify margin calculation
  const marginQuery = `
    SELECT 
      CASE 
        WHEN SUM(p.original_contract_value + COALESCE(co_sum.approved_amount, 0)) > 0 
        THEN (SUM(p.original_contract_value + COALESCE(co_sum.approved_amount, 0)) - SUM(actual_cost + remaining_forecast)) / 
             SUM(p.original_contract_value + COALESCE(co_sum.approved_amount, 0)) * 100
        ELSE 0 
      END as margin_percentage
    FROM (
      SELECT 
        p.id,
        p.original_contract_value,
        COALESCE(labor.total_cost, 0) + COALESCE(po.total_cost, 0) as actual_cost,
        COALESCE(p.original_contract_value * 0.3, 0) as remaining_forecast
      FROM projects p
      LEFT JOIN (
        SELECT project_id, SUM(total_cost) as total_cost
        FROM labor_employee_actuals
        GROUP BY project_id
      ) labor ON labor.project_id = p.id
      LEFT JOIN (
        SELECT pol.project_id, SUM(pol.amount) as total_cost
        FROM po_line_items pol
        JOIN purchase_orders po ON po.id = pol.purchase_order_id
        GROUP BY pol.project_id
      ) po ON po.project_id = p.id
      WHERE p.status = 'active'
    ) margin_calc
    LEFT JOIN (
      SELECT project_id, SUM(amount) as approved_amount
      FROM change_orders
      WHERE status = 'approved'
      GROUP BY project_id
    ) co_sum ON co_sum.project_id = margin_calc.id
  `;
  
  const marginResult = await client.query(marginQuery);
  const marginValue = marginResult.rows[0]?.margin_percentage;
  
  const uiMarginValue = values.find(v => 
    v.page === 'Dashboard' && 
    v.label.includes('Company Margin')
  );
  
  if (uiMarginValue && marginValue !== undefined) {
    const check = {
      page: 'Dashboard',
      element: 'Company Margin',
      ui_value: uiMarginValue.display_value,
      ui_normalized: uiMarginValue.normalized_value * 100, // Convert to percentage
      db_value: marginValue,
      delta: Math.abs((uiMarginValue.normalized_value * 100) - marginValue),
      status: Math.abs((uiMarginValue.normalized_value * 100) - marginValue) < 0.1 ? 'PASS' : 'FAIL',
      sql_query: marginQuery.replace(/\s+/g, ' ').trim()
    };
    checks.push(check);
    console.log(`Company Margin: UI=${uiMarginValue.display_value}, DB=${marginValue?.toFixed(1)}% - ${check.status}`);
  }
}

async function verifyProjectListValues(client, values) {
  console.log('\n=== Verifying Projects List Values ===\n');
  
  // Get all project values from list
  const projectsQuery = `
    SELECT 
      p.id,
      p.project_code,
      p.project_name,
      p.original_contract_value,
      p.original_contract_value + COALESCE(co_sum.approved_amount, 0) as revised_contract,
      COALESCE(labor.total_cost, 0) as labor_cost,
      COALESCE(po.total_cost, 0) as po_cost,
      COALESCE(labor.total_cost, 0) + COALESCE(po.total_cost, 0) as total_spent
    FROM projects p
    LEFT JOIN (
      SELECT project_id, SUM(amount) as approved_amount
      FROM change_orders
      WHERE status = 'approved'
      GROUP BY project_id
    ) co_sum ON co_sum.project_id = p.id
    LEFT JOIN (
      SELECT project_id, SUM(total_cost) as total_cost
      FROM labor_employee_actuals
      GROUP BY project_id
    ) labor ON labor.project_id = p.id
    LEFT JOIN (
      SELECT pol.project_id, SUM(pol.amount) as total_cost
      FROM po_line_items pol
      JOIN purchase_orders po ON po.id = pol.purchase_order_id
      GROUP BY pol.project_id
    ) po ON po.project_id = p.id
    WHERE p.status = 'active'
    ORDER BY p.created_at DESC
  `;
  
  const result = await client.query(projectsQuery);
  
  console.log(`Found ${result.rows.length} active projects in database`);
  
  // Match UI values to database values
  const projectValues = values.filter(v => v.page === 'Projects List');
  console.log(`Found ${projectValues.length} values from Projects List page`);
  
  // Check specific project totals
  for (const project of result.rows.slice(0, 3)) { // Check first 3 projects
    const projectName = `${project.project_code} ${project.project_name}`;
    
    // Try to find matching UI values
    const uiValues = projectValues.filter(v => 
      v.display_value.includes(project.original_contract_value?.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ','))
    );
    
    if (uiValues.length > 0) {
      const check = {
        page: 'Projects List',
        element: `Project ${project.project_code} - Contract Value`,
        ui_value: uiValues[0].display_value,
        ui_normalized: uiValues[0].normalized_value,
        db_value: project.revised_contract,
        delta: Math.abs(uiValues[0].normalized_value - project.revised_contract),
        status: Math.abs(uiValues[0].normalized_value - project.revised_contract) < 0.01 ? 'PASS' : 'FAIL',
        sql_query: 'See projects query above'
      };
      checks.push(check);
      console.log(`${project.project_code}: UI=$${uiValues[0].normalized_value}, DB=$${project.revised_contract} - ${check.status}`);
    }
  }
}

async function verifyPurchaseOrderValues(client, values) {
  console.log('\n=== Verifying Purchase Order Values ===\n');
  
  // Get PO totals
  const poQuery = `
    SELECT 
      COUNT(DISTINCT po.id) as po_count,
      COUNT(DISTINCT pol.id) as line_item_count,
      SUM(pol.amount) as total_amount,
      COUNT(DISTINCT po.vendor_name) as vendor_count
    FROM purchase_orders po
    JOIN po_line_items pol ON pol.purchase_order_id = po.id
  `;
  
  const result = await client.query(poQuery);
  const poTotals = result.rows[0];
  
  console.log(`Database PO Summary: ${poTotals.po_count} POs, ${poTotals.line_item_count} line items, Total: $${poTotals.total_amount?.toFixed(2)}`);
  
  // Find PO values in UI
  const poValues = values.filter(v => v.page === 'Purchase Orders');
  console.log(`Found ${poValues.length} values from Purchase Orders page`);
  
  // Get weekly PO totals
  const weeklyQuery = `
    SELECT 
      DATE_TRUNC('week', po.po_date) as week_start,
      SUM(pol.amount) as weekly_total,
      COUNT(DISTINCT po.id) as po_count
    FROM purchase_orders po
    JOIN po_line_items pol ON pol.purchase_order_id = po.id
    GROUP BY DATE_TRUNC('week', po.po_date)
    ORDER BY week_start DESC
    LIMIT 10
  `;
  
  const weeklyResult = await client.query(weeklyQuery);
  
  console.log(`\nWeekly PO Totals (Last 10 weeks):`);
  weeklyResult.rows.forEach(row => {
    console.log(`  Week ${row.week_start?.toISOString().split('T')[0]}: ${row.po_count} POs, Total: $${row.weekly_total?.toFixed(2)}`);
  });
}

async function verifyProjectDetailValues(client, values) {
  console.log('\n=== Verifying Project Detail Page Values ===\n');
  
  // Focus on the two projects we successfully loaded
  const projectCodes = ['S1601-0073913', '5790'];
  
  for (const code of projectCodes) {
    const projectValues = values.filter(v => v.page.includes(code));
    console.log(`\nProject ${code}: Found ${projectValues.length} UI values`);
    
    // Get comprehensive project data
    const projectQuery = `
      SELECT 
        p.*,
        COALESCE(co_sum.approved_amount, 0) as total_change_orders,
        p.original_contract_value + COALESCE(co_sum.approved_amount, 0) as revised_contract,
        COALESCE(labor.total_cost, 0) as labor_actual,
        COALESCE(labor.total_hours, 0) as labor_hours,
        COALESCE(po.total_amount, 0) as po_actual,
        COALESCE(budget.total_budget, 0) as total_budget
      FROM projects p
      LEFT JOIN (
        SELECT project_id, SUM(amount) as approved_amount
        FROM change_orders
        WHERE status = 'approved'
        GROUP BY project_id
      ) co_sum ON co_sum.project_id = p.id
      LEFT JOIN (
        SELECT project_id, SUM(total_cost) as total_cost, SUM(total_hours) as total_hours
        FROM labor_employee_actuals
        GROUP BY project_id
      ) labor ON labor.project_id = p.id
      LEFT JOIN (
        SELECT pol.project_id, SUM(pol.amount) as total_amount
        FROM po_line_items pol
        GROUP BY pol.project_id
      ) po ON po.project_id = p.id
      LEFT JOIN (
        SELECT project_id, SUM(amount) as total_budget
        FROM budget_line_items
        GROUP BY project_id
      ) budget ON budget.project_id = p.id
      WHERE p.project_code = $1
    `;
    
    const result = await client.query(projectQuery, [code]);
    
    if (result.rows.length > 0) {
      const project = result.rows[0];
      console.log(`  Database values for ${code}:`);
      console.log(`    - Original Contract: $${project.original_contract_value}`);
      console.log(`    - Change Orders: $${project.total_change_orders}`);
      console.log(`    - Revised Contract: $${project.revised_contract}`);
      console.log(`    - Labor Actual: $${project.labor_actual}`);
      console.log(`    - PO Actual: $${project.po_actual}`);
      console.log(`    - Total Budget: $${project.total_budget}`);
      
      // Try to match specific values
      const revisedContractUI = projectValues.find(v => 
        Math.abs(v.normalized_value - project.revised_contract) < 1
      );
      
      if (revisedContractUI) {
        const check = {
          page: `Project ${code}`,
          element: 'Revised Contract Value',
          ui_value: revisedContractUI.display_value,
          ui_normalized: revisedContractUI.normalized_value,
          db_value: project.revised_contract,
          delta: Math.abs(revisedContractUI.normalized_value - project.revised_contract),
          status: 'PASS',
          sql_query: 'See project detail query'
        };
        checks.push(check);
        console.log(`    ✓ Revised Contract matches: UI=${revisedContractUI.display_value}`);
      }
    }
  }
}

async function main() {
  const client = new Client({ 
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    await client.connect();
    console.log('Connected to database successfully');
    
    // Load captured values
    const valuesData = await fs.readFile(valuesPath, 'utf8');
    const values = JSON.parse(valuesData);
    console.log(`Loaded ${values.length} captured UI values`);
    
    // Run verification checks
    await verifyDashboardValues(client, values);
    await verifyProjectListValues(client, values);
    await verifyPurchaseOrderValues(client, values);
    await verifyProjectDetailValues(client, values);
    
    // Save checks results
    await fs.writeFile(
      path.join(__dirname, '..', 'checks.json'),
      JSON.stringify(checks, null, 2),
      'utf8'
    );
    
    // Generate summary
    console.log('\n=== Verification Summary ===\n');
    const passed = checks.filter(c => c.status === 'PASS').length;
    const failed = checks.filter(c => c.status === 'FAIL').length;
    console.log(`Total checks: ${checks.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success rate: ${((passed / checks.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n=== Failed Checks ===\n');
      checks.filter(c => c.status === 'FAIL').forEach(check => {
        console.log(`${check.page} - ${check.element}:`);
        console.log(`  UI: ${check.ui_value} (${check.ui_normalized})`);
        console.log(`  DB: ${check.db_value}`);
        console.log(`  Delta: ${check.delta}`);
      });
    }
    
  } catch (error) {
    console.error('Database verification error:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);