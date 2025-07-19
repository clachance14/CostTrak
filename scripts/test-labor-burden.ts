import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

async function testLaborBurdenCalculations() {
  console.log('Testing Labor Burden Calculations\n')
  console.log('=================================\n')
  
  try {
    // Test 1: Check if burden columns exist
    console.log('1. Checking database schema for burden columns...')
    const { data: sampleEmployee, error: empError } = await supabase
      .from('labor_employee_actuals')
      .select('*, total_cost_with_burden')
      .limit(1)
    
    if (empError) {
      console.log('✗ Error checking employee actuals:', empError.message)
    } else {
      console.log('✓ Burden columns exist in labor_employee_actuals')
    }
    
    const { data: sampleActual, error: actError } = await supabase
      .from('labor_actuals')
      .select('*, burden_rate, burden_amount, actual_cost_with_burden')
      .limit(1)
    
    if (actError) {
      console.log('✗ Error checking labor actuals:', actError.message)
    } else {
      console.log('✓ Burden columns exist in labor_actuals')
    }
    
    // Test 2: Check recent labor data with burden
    console.log('\n2. Checking recent labor imports with burden...')
    const { data: recentLabor, error: recentError } = await supabase
      .from('labor_actuals')
      .select(`
        week_ending,
        actual_cost,
        burden_rate,
        burden_amount,
        actual_cost_with_burden,
        projects!inner(job_number, name)
      `)
      .order('week_ending', { ascending: false })
      .limit(5)
    
    if (recentError) {
      console.log('✗ Error fetching recent labor:', recentError.message)
    } else if (recentLabor && recentLabor.length > 0) {
      console.log(`✓ Found ${recentLabor.length} recent labor entries with burden`)
      
      recentLabor.forEach(labor => {
        const expectedBurden = labor.actual_cost * (labor.burden_rate || 0)
        const expectedTotal = labor.actual_cost + expectedBurden
        
        console.log(`\n  Project: ${labor.projects.job_number} - ${labor.projects.name}`)
        console.log(`  Week: ${labor.week_ending}`)
        console.log(`  Base Cost: $${labor.actual_cost.toFixed(2)}`)
        console.log(`  Burden Rate: ${((labor.burden_rate || 0) * 100).toFixed(1)}%`)
        console.log(`  Burden Amount: $${(labor.burden_amount || 0).toFixed(2)}`)
        console.log(`  Total with Burden: $${(labor.actual_cost_with_burden || 0).toFixed(2)}`)
        
        // Verify calculation
        if (Math.abs((labor.actual_cost_with_burden || 0) - expectedTotal) < 0.01) {
          console.log(`  ✓ Burden calculation is correct`)
        } else {
          console.log(`  ✗ Burden calculation mismatch - Expected: $${expectedTotal.toFixed(2)}`)
        }
      })
    } else {
      console.log('⚠ No recent labor data found')
    }
    
    // Test 3: Check employee actuals with burden
    console.log('\n3. Checking employee actuals with burden...')
    const { data: empActuals, error: empActualsError } = await supabase
      .from('labor_employee_actuals')
      .select(`
        week_ending,
        st_hours,
        ot_hours,
        st_wages,
        ot_wages,
        total_cost,
        burden_rate,
        st_burden_amount,
        total_cost_with_burden,
        employees!inner(employee_number, first_name, last_name)
      `)
      .order('week_ending', { ascending: false })
      .limit(3)
    
    if (empActualsError) {
      console.log('✗ Error fetching employee actuals:', empActualsError.message)
    } else if (empActuals && empActuals.length > 0) {
      console.log(`✓ Found ${empActuals.length} employee actuals with burden`)
      
      empActuals.forEach(emp => {
        const expectedSTBurden = emp.st_wages * (emp.burden_rate || 0)
        const expectedTotal = emp.st_wages + expectedSTBurden + emp.ot_wages
        
        console.log(`\n  Employee: ${emp.employees.employee_number} - ${emp.employees.first_name} ${emp.employees.last_name}`)
        console.log(`  Week: ${emp.week_ending}`)
        console.log(`  ST Hours: ${emp.st_hours}, Wages: $${emp.st_wages.toFixed(2)}`)
        console.log(`  OT Hours: ${emp.ot_hours}, Wages: $${emp.ot_wages.toFixed(2)}`)
        console.log(`  Burden on ST only: $${(emp.st_burden_amount || 0).toFixed(2)}`)
        console.log(`  Total with Burden: $${(emp.total_cost_with_burden || 0).toFixed(2)}`)
        
        // Verify only ST wages are burdened
        if (Math.abs((emp.total_cost_with_burden || 0) - expectedTotal) < 0.01) {
          console.log(`  ✓ Burden correctly applied to ST wages only`)
        } else {
          console.log(`  ✗ Burden calculation mismatch - Expected: $${expectedTotal.toFixed(2)}`)
        }
      })
    } else {
      console.log('⚠ No employee actuals found')
    }
    
    // Test 4: Check budget vs actual without separate tax line
    console.log('\n4. Checking budget vs actual handling...')
    const { data: budgetBreakdowns } = await supabase
      .from('project_budget_breakdowns')
      .select('cost_type, value')
      .eq('cost_type', 'TAXES & INSURANCE')
      .limit(5)
    
    if (budgetBreakdowns && budgetBreakdowns.length > 0) {
      console.log(`⚠ Found ${budgetBreakdowns.length} TAXES & INSURANCE entries that should be distributed`)
      console.log('  These should be proportionally distributed to labor categories on import')
    } else {
      console.log('✓ No separate TAXES & INSURANCE entries found (as expected)')
    }
    
  } catch (error) {
    console.error('Test script error:', error)
  }
}

testLaborBurdenCalculations()
  .then(() => {
    console.log('\nTest complete!')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Script error:', err)
    process.exit(1)
  })