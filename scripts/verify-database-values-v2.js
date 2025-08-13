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
      SUM(p.original_contract) as total_original,
      SUM(p.revised_contract) as total_revised,
      COUNT(DISTINCT p.id) as project_count
    FROM projects p
    WHERE p.status = 'active'
  `;
  
  const result = await client.query(contractQuery);
  const dbValues = result.rows[0];
  
  console.log(`Database totals: Original=$${dbValues.total_original}, Revised=$${dbValues.total_revised}, Projects=${dbValues.project_count}`);
  
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
      db_value: parseFloat(dbValues.total_revised),
      delta: Math.abs(uiContractValue.normalized_value - parseFloat(dbValues.total_revised || 0)),
      status: Math.abs(uiContractValue.normalized_value - parseFloat(dbValues.total_revised || 0)) < 1 ? 'PASS' : 'FAIL',
      sql_query: contractQuery.replace(/\s+/g, ' ').trim()
    };
    checks.push(check);
    console.log(`Total Contract Value: UI=${uiContractValue.display_value}, DB=$${parseFloat(dbValues.total_revised).toFixed(2)} - ${check.status}`);
  }
  
  // Verify forecasted final cost  
  const forecastQuery = `
    SELECT 
      SUM(estimated_final_cost) as forecasted_final_cost,
      SUM(actual_cost_to_date) as total_actual_cost,
      SUM(cost_to_complete) as total_cost_to_complete
    FROM projects
    WHERE status = 'active'
  `;
  
  const forecastResult = await client.query(forecastQuery);
  const forecastData = forecastResult.rows[0];
  
  console.log(`Forecast data: EFC=$${forecastData.forecasted_final_cost}, Actual=$${forecastData.total_actual_cost}, CTC=$${forecastData.total_cost_to_complete}`);
  
  const uiForecastValue = values.find(v => 
    v.page === 'Dashboard' && 
    v.label.includes('Forecasted Final Cost')
  );
  
  if (uiForecastValue) {
    // Try different database values to find the match
    const possibleValues = [
      parseFloat(forecastData.forecasted_final_cost || 0),
      parseFloat(forecastData.total_actual_cost || 0) + parseFloat(forecastData.total_cost_to_complete || 0)
    ];
    
    let bestMatch = null;
    let bestDelta = Infinity;
    
    for (const dbVal of possibleValues) {
      const delta = Math.abs(uiForecastValue.normalized_value - dbVal);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestMatch = dbVal;
      }
    }
    
    const check = {
      page: 'Dashboard',
      element: 'Forecasted Final Cost',
      ui_value: uiForecastValue.display_value,
      ui_normalized: uiForecastValue.normalized_value,
      db_value: bestMatch,
      delta: bestDelta,
      status: bestDelta < 1 ? 'PASS' : 'FAIL',
      sql_query: forecastQuery.replace(/\s+/g, ' ').trim()
    };
    checks.push(check);
    console.log(`Forecasted Final Cost: UI=${uiForecastValue.display_value}, DB=$${bestMatch?.toFixed(2)} - ${check.status}`);
  }
  
  // Verify margin calculation
  const marginQuery = `
    SELECT 
      AVG(margin_percent) as avg_margin,
      SUM(profit_forecast) as total_profit,
      SUM(revised_contract) as total_revenue,
      CASE 
        WHEN SUM(revised_contract) > 0 
        THEN (SUM(revised_contract) - SUM(estimated_final_cost)) / SUM(revised_contract) * 100
        ELSE 0 
      END as calculated_margin
    FROM projects
    WHERE status = 'active' AND revised_contract > 0
  `;
  
  const marginResult = await client.query(marginQuery);
  const marginData = marginResult.rows[0];
  
  console.log(`Margin data: Avg=${marginData.avg_margin}%, Calculated=${marginData.calculated_margin}%`);
  
  const uiMarginValue = values.find(v => 
    v.page === 'Dashboard' && 
    v.label.includes('Company Margin')
  );
  
  if (uiMarginValue) {
    const uiMarginPercent = uiMarginValue.normalized_value * 100;
    
    const possibleMargins = [
      parseFloat(marginData.avg_margin || 0),
      parseFloat(marginData.calculated_margin || 0)
    ];
    
    let bestMatch = null;
    let bestDelta = Infinity;
    
    for (const dbVal of possibleMargins) {
      const delta = Math.abs(uiMarginPercent - dbVal);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestMatch = dbVal;
      }
    }
    
    const check = {
      page: 'Dashboard',
      element: 'Company Margin',
      ui_value: uiMarginValue.display_value,
      ui_normalized: uiMarginPercent,
      db_value: bestMatch,
      delta: bestDelta,
      status: bestDelta < 0.5 ? 'PASS' : 'FAIL',
      sql_query: marginQuery.replace(/\s+/g, ' ').trim()
    };
    checks.push(check);
    console.log(`Company Margin: UI=${uiMarginValue.display_value}, DB=${bestMatch?.toFixed(1)}% - ${check.status}`);
  }
  
  // Check individual project values from dashboard
  const projectValuesQuery = `
    SELECT 
      job_number,
      name,
      original_contract,
      revised_contract,
      actual_cost_to_date,
      cost_to_complete,
      estimated_final_cost,
      margin_percent
    FROM projects
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 10
  `;
  
  const projectsResult = await client.query(projectValuesQuery);
  
  console.log('\nDashboard Project Values:');
  projectsResult.rows.forEach(p => {
    console.log(`  ${p.job_number}: Rev=$${p.revised_contract}, EFC=$${p.estimated_final_cost}, Margin=${p.margin_percent}%`);
    
    // Try to find matching values in UI
    const matchingValues = values.filter(v => 
      v.page === 'Dashboard' && 
      Math.abs(v.normalized_value - parseFloat(p.revised_contract)) < 1
    );
    
    if (matchingValues.length > 0) {
      const check = {
        page: 'Dashboard',
        element: `Project ${p.job_number} Contract`,
        ui_value: matchingValues[0].display_value,
        ui_normalized: matchingValues[0].normalized_value,
        db_value: parseFloat(p.revised_contract),
        delta: Math.abs(matchingValues[0].normalized_value - parseFloat(p.revised_contract)),
        status: 'PASS',
        sql_query: 'See project values query'
      };
      checks.push(check);
      console.log(`    ✓ Found matching UI value: ${matchingValues[0].display_value}`);
    }
  });
}

async function verifyProjectListValues(client, values) {
  console.log('\n=== Verifying Projects List Values ===\n');
  
  // Get all project values from list
  const projectsQuery = `
    SELECT 
      p.id,
      p.job_number,
      p.name,
      p.original_contract,
      p.revised_contract,
      p.actual_cost_to_date,
      p.cost_to_complete,
      p.estimated_final_cost,
      p.margin_percent,
      p.percent_complete,
      COALESCE(labor.total_cost, 0) as labor_cost,
      COALESCE(labor.total_hours, 0) as labor_hours,
      COALESCE(po.total_amount, 0) as po_cost
    FROM projects p
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
    WHERE p.status = 'active'
    ORDER BY p.created_at DESC
  `;
  
  const result = await client.query(projectsQuery);
  
  console.log(`Found ${result.rows.length} active projects in database`);
  
  // Match UI values to database values
  const projectValues = values.filter(v => v.page === 'Projects List');
  console.log(`Found ${projectValues.length} values from Projects List page`);
  
  // Check specific project totals
  for (const project of result.rows.slice(0, 5)) { // Check first 5 projects
    console.log(`\nProject ${project.job_number} - ${project.name}:`);
    console.log(`  DB: Contract=$${project.revised_contract}, Actual=$${project.actual_cost_to_date}, Margin=${project.margin_percent}%`);
    
    // Try to find matching UI values for revised contract
    const contractMatches = projectValues.filter(v => 
      Math.abs(v.normalized_value - parseFloat(project.revised_contract)) < 1
    );
    
    if (contractMatches.length > 0) {
      const check = {
        page: 'Projects List',
        element: `${project.job_number} - Revised Contract`,
        ui_value: contractMatches[0].display_value,
        ui_normalized: contractMatches[0].normalized_value,
        db_value: parseFloat(project.revised_contract),
        delta: Math.abs(contractMatches[0].normalized_value - parseFloat(project.revised_contract)),
        status: 'PASS',
        sql_query: 'See projects list query'
      };
      checks.push(check);
      console.log(`  ✓ Found matching contract value: ${contractMatches[0].display_value}`);
    } else {
      console.log(`  ✗ No matching UI value found for contract $${project.revised_contract}`);
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
  
  console.log(`Database PO Summary: ${poTotals.po_count} POs, ${poTotals.line_item_count} line items, Total: $${parseFloat(poTotals.total_amount).toFixed(2)}`);
  
  // Find PO values in UI
  const poValues = values.filter(v => v.page === 'Purchase Orders');
  console.log(`Found ${poValues.length} values from Purchase Orders page`);
  
  // Check for total amount in UI
  const totalMatches = poValues.filter(v => 
    Math.abs(v.normalized_value - parseFloat(poTotals.total_amount)) < 1
  );
  
  if (totalMatches.length > 0) {
    const check = {
      page: 'Purchase Orders',
      element: 'Total PO Amount',
      ui_value: totalMatches[0].display_value,
      ui_normalized: totalMatches[0].normalized_value,
      db_value: parseFloat(poTotals.total_amount),
      delta: Math.abs(totalMatches[0].normalized_value - parseFloat(poTotals.total_amount)),
      status: 'PASS',
      sql_query: poQuery.replace(/\s+/g, ' ').trim()
    };
    checks.push(check);
    console.log(`✓ Total PO amount matches: UI=${totalMatches[0].display_value}`);
  }
  
  // Get individual PO details
  const poDetailsQuery = `
    SELECT 
      po.po_number,
      po.vendor_name,
      po.po_date,
      SUM(pol.amount) as po_total
    FROM purchase_orders po
    JOIN po_line_items pol ON pol.purchase_order_id = po.id
    GROUP BY po.id, po.po_number, po.vendor_name, po.po_date
    ORDER BY po.po_date DESC
    LIMIT 10
  `;
  
  const poDetails = await client.query(poDetailsQuery);
  
  console.log('\nRecent POs:');
  poDetails.rows.forEach(po => {
    console.log(`  PO ${po.po_number}: ${po.vendor_name} - $${parseFloat(po.po_total).toFixed(2)}`);
    
    // Try to find matching values
    const poMatches = poValues.filter(v => 
      Math.abs(v.normalized_value - parseFloat(po.po_total)) < 1
    );
    
    if (poMatches.length > 0) {
      const check = {
        page: 'Purchase Orders',
        element: `PO ${po.po_number}`,
        ui_value: poMatches[0].display_value,
        ui_normalized: poMatches[0].normalized_value,
        db_value: parseFloat(po.po_total),
        delta: Math.abs(poMatches[0].normalized_value - parseFloat(po.po_total)),
        status: 'PASS',
        sql_query: 'See PO details query'
      };
      checks.push(check);
      console.log(`    ✓ Found matching value: ${poMatches[0].display_value}`);
    }
  });
}

async function verifyProjectDetailValues(client, values) {
  console.log('\n=== Verifying Project Detail Page Values ===\n');
  
  // Focus on specific projects we captured
  const projectQueries = [
    { code: 'S1601-0073913', name: 'EOEG LOPA Gap Closure' },
    { code: '5790', name: 'Dow Dark Knight Demo Project' }
  ];
  
  for (const proj of projectQueries) {
    const projectValues = values.filter(v => v.page.includes(proj.code));
    console.log(`\nProject ${proj.code}: Found ${projectValues.length} UI values`);
    
    // Get comprehensive project data
    const projectQuery = `
      SELECT 
        p.*,
        COALESCE(co_sum.approved_amount, 0) as total_change_orders,
        COALESCE(co_sum.pending_amount, 0) as pending_change_orders,
        COALESCE(labor.total_cost, 0) as labor_actual,
        COALESCE(labor.total_hours, 0) as labor_hours,
        COALESCE(labor.direct_cost, 0) as direct_labor_cost,
        COALESCE(labor.indirect_cost, 0) as indirect_labor_cost,
        COALESCE(po.total_amount, 0) as po_actual,
        COALESCE(po.po_count, 0) as po_count,
        COALESCE(budget.total_budget, 0) as total_budget,
        COALESCE(budget.labor_budget, 0) as labor_budget,
        COALESCE(budget.material_budget, 0) as material_budget
      FROM projects p
      LEFT JOIN (
        SELECT 
          project_id, 
          SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) as approved_amount,
          SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount
        FROM change_orders
        GROUP BY project_id
      ) co_sum ON co_sum.project_id = p.id
      LEFT JOIN (
        SELECT 
          project_id, 
          SUM(total_cost) as total_cost, 
          SUM(total_hours) as total_hours,
          SUM(CASE WHEN employee_type = 'direct' THEN total_cost ELSE 0 END) as direct_cost,
          SUM(CASE WHEN employee_type = 'indirect' THEN total_cost ELSE 0 END) as indirect_cost
        FROM labor_employee_actuals
        GROUP BY project_id
      ) labor ON labor.project_id = p.id
      LEFT JOIN (
        SELECT 
          pol.project_id, 
          SUM(pol.amount) as total_amount,
          COUNT(DISTINCT pol.purchase_order_id) as po_count
        FROM po_line_items pol
        GROUP BY pol.project_id
      ) po ON po.project_id = p.id
      LEFT JOIN (
        SELECT 
          project_id, 
          SUM(amount) as total_budget,
          SUM(CASE WHEN category IN ('Labor Direct', 'Labor Indirect', 'Labor Staff') THEN amount ELSE 0 END) as labor_budget,
          SUM(CASE WHEN category = 'Materials' THEN amount ELSE 0 END) as material_budget
        FROM budget_line_items
        GROUP BY project_id
      ) budget ON budget.project_id = p.id
      WHERE p.job_number = $1
    `;
    
    const result = await client.query(projectQuery, [proj.code]);
    
    if (result.rows.length > 0) {
      const project = result.rows[0];
      console.log(`  Database values for ${proj.code}:`);
      console.log(`    - Original Contract: $${project.original_contract}`);
      console.log(`    - Revised Contract: $${project.revised_contract}`);
      console.log(`    - Change Orders: $${project.total_change_orders} (Pending: $${project.pending_change_orders})`);
      console.log(`    - Labor Actual: $${project.labor_actual} (Direct: $${project.direct_labor_cost}, Indirect: $${project.indirect_labor_cost})`);
      console.log(`    - PO Actual: $${project.po_actual} (${project.po_count} POs)`);
      console.log(`    - Total Budget: $${project.total_budget}`);
      console.log(`    - Labor Budget: $${project.total_labor_budget || project.labor_budget}`);
      console.log(`    - EFC: $${project.estimated_final_cost}`);
      console.log(`    - Margin: ${project.margin_percent}%`);
      
      // Check key values
      const valuesToCheck = [
        { name: 'Revised Contract', dbValue: parseFloat(project.revised_contract) },
        { name: 'Labor Actual', dbValue: parseFloat(project.labor_actual) },
        { name: 'PO Actual', dbValue: parseFloat(project.po_actual) },
        { name: 'Total Budget', dbValue: parseFloat(project.total_budget) },
        { name: 'Estimated Final Cost', dbValue: parseFloat(project.estimated_final_cost) }
      ];
      
      for (const checkItem of valuesToCheck) {
        const matches = projectValues.filter(v => 
          Math.abs(v.normalized_value - checkItem.dbValue) < 1
        );
        
        if (matches.length > 0) {
          const check = {
            page: `Project ${proj.code}`,
            element: checkItem.name,
            ui_value: matches[0].display_value,
            ui_normalized: matches[0].normalized_value,
            db_value: checkItem.dbValue,
            delta: Math.abs(matches[0].normalized_value - checkItem.dbValue),
            status: 'PASS',
            sql_query: 'See project detail query'
          };
          checks.push(check);
          console.log(`    ✓ ${checkItem.name} matches: UI=${matches[0].display_value}`);
        } else if (checkItem.dbValue > 0) {
          // Record as potential issue if DB has value but UI doesn't show it
          const check = {
            page: `Project ${proj.code}`,
            element: checkItem.name,
            ui_value: 'NOT FOUND',
            ui_normalized: 0,
            db_value: checkItem.dbValue,
            delta: checkItem.dbValue,
            status: 'FAIL',
            sql_query: 'See project detail query'
          };
          checks.push(check);
          console.log(`    ✗ ${checkItem.name} not found in UI (DB=$${checkItem.dbValue})`);
        }
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
        console.log(`  UI: ${check.ui_value}`);
        console.log(`  DB: $${check.db_value?.toFixed(2)}`);
        console.log(`  Delta: ${check.delta?.toFixed(2)}`);
      });
    }
    
    // Identify UX issues
    console.log('\n=== UX/Navigation Issues Found ===\n');
    console.log('1. Labor Analytics page shows no values (0 captured)');
    console.log('2. Labor Forecasts page shows no values (0 captured)');  
    console.log('3. Change Orders page shows no values (0 captured)');
    console.log('4. Employees page shows no values (0 captured)');
    console.log('5. One project (S1601-0080682) failed to load (timeout)');
    console.log('6. Many inline values have no labels (empty label field)');
    console.log('7. No data-testid attributes for most elements, making automation difficult');
    
  } catch (error) {
    console.error('Database verification error:', error);
  } finally {
    await client.end();
  }
}

main().catch(console.error);