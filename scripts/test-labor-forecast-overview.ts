import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testLaborForecastInOverview() {
  try {
    // First check if ANY project has forecast data
    const { data: anyForecasts } = await supabase
      .from('labor_headcount_forecasts')
      .select('project_id, week_ending, headcount')
      .limit(10)
    
    console.log(`\nTotal forecast records in database: ${anyForecasts?.length || 0}`)
    if (anyForecasts && anyForecasts.length > 0) {
      console.log('Sample forecast records:')
      anyForecasts.forEach(f => {
        console.log(`  Project: ${f.project_id}, Week: ${f.week_ending}, Headcount: ${f.headcount}`)
      })
    }

    // Get a sample project
    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, job_number, name')
      .limit(5)

    if (projectError) {
      console.error('Error fetching projects:', projectError)
      return
    }

    // Try to find a project with forecast data
    let projectId = null
    let projectInfo = null
    
    for (const proj of projects) {
      const { data: hasForecasts } = await supabase
        .from('labor_headcount_forecasts')
        .select('id')
        .eq('project_id', proj.id)
        .limit(1)
        .single()
      
      if (hasForecasts) {
        projectId = proj.id
        projectInfo = proj
        break
      }
    }
    
    if (!projectId) {
      // Use first project if none have forecasts
      projectId = projects[0].id
      projectInfo = projects[0]
    }
    
    console.log(`\nTesting project: ${projectInfo.name} (${projectInfo.job_number})`)

    // Get ALL labor forecasts to see what's in the database
    const { data: allForecasts, error: allForecastError } = await supabase
      .from('labor_headcount_forecasts')
      .select(`
        week_ending,
        headcount,
        avg_weekly_hours,
        craft_type_id,
        craft_types (
          category,
          name
        )
      `)
      .eq('project_id', projectId)
      .order('week_ending', { ascending: false })
      .limit(20)
    
    console.log(`\nALL forecast records (latest 20): ${allForecasts?.length || 0}`)
    if (allForecasts && allForecasts.length > 0) {
      console.log('Sample records:')
      allForecasts.slice(0, 5).forEach(f => {
        console.log(`  ${f.week_ending}: ${f.craft_types?.name} (${f.craft_types?.category}) - ${f.headcount} headcount`)
      })
    }

    // Get labor forecasts directly from database
    const { data: forecasts, error: forecastError } = await supabase
      .from('labor_headcount_forecasts')
      .select(`
        week_ending,
        headcount,
        avg_weekly_hours,
        craft_type_id,
        craft_types (
          category,
          name
        )
      `)
      .eq('project_id', projectId)
      .gte('week_ending', new Date().toISOString().split('T')[0])
      .order('week_ending')

    if (forecastError) {
      console.error('Error fetching forecasts:', forecastError)
      return
    }

    console.log(`\nFound ${forecasts?.length || 0} future forecast records`)
    
    if (forecasts && forecasts.length > 0) {
      console.log('\nForecast breakdown by week:')
      const weekMap = new Map()
      
      forecasts.forEach(f => {
        const week = f.week_ending.split('T')[0]
        if (!weekMap.has(week)) {
          weekMap.set(week, { direct: 0, indirect: 0, staff: 0, total: 0 })
        }
        const weekData = weekMap.get(week)
        const category = f.craft_types?.category || 'direct'
        const hours = f.headcount * (f.avg_weekly_hours || 50)
        
        weekData[category] += f.headcount
        weekData.total += f.headcount
      })
      
      weekMap.forEach((data, week) => {
        console.log(`  ${week}: Direct=${data.direct}, Indirect=${data.indirect}, Staff=${data.staff}, Total=${data.total}`)
      })
    }

    // Get category rates
    const { data: categoryRates } = await supabase
      .rpc('get_headcount_category_rates', {
        p_project_id: projectId,
        p_weeks_back: 8
      })

    console.log('\nCategory rates:')
    categoryRates?.forEach(rate => {
      console.log(`  ${rate.category}: $${rate.avg_rate?.toFixed(2) || 0}/hr`)
    })

    // Calculate total forecasted cost
    let totalForecastCost = 0
    forecasts?.forEach(f => {
      const category = f.craft_types?.category || 'direct'
      const rate = categoryRates?.find(r => r.category === category)?.avg_rate || 50
      const hours = f.headcount * (f.avg_weekly_hours || 50)
      const cost = hours * rate
      totalForecastCost += cost
    })

    console.log(`\nTotal remaining forecast cost: $${totalForecastCost.toFixed(2)}`)

  } catch (error) {
    console.error('Test failed:', error)
  }
}

testLaborForecastInOverview()