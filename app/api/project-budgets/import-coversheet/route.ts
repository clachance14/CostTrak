import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { ExcelBudgetAnalyzer } from '@/lib/services/excel-budget-analyzer'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is controller
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'controller') {
      return NextResponse.json({ error: 'Only controllers can import budgets' }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string
    const mode = formData.get('mode') as string || 'preview' // 'preview' or 'import'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Verify project exists and user has access
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, job_number')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    
    // Create analyzer - it will now extract disciplines from BUDGETS sheet
    const analyzer = new ExcelBudgetAnalyzer()
    
    // Extract budget data
    const budgetData = await analyzer.extractBudgetData(workbook)
    
    // If preview mode, return the extracted data without saving
    if (mode === 'preview') {
      return NextResponse.json({
        success: true,
        mode: 'preview',
        project: {
          id: project.id,
          name: project.name,
          job_number: project.job_number
        },
        data: budgetData,
        stats: {
          sheetsProcessed: Object.keys(budgetData.details).length,
          totalItems: Object.values(budgetData.details).reduce((sum, items) => sum + items.length, 0),
          wbsCodesFound: budgetData.wbsStructure.length,
          totalBudget: budgetData.totals.grand_total,
          byCategory: budgetData.totals,
          disciplinesIncluded: budgetData.disciplineBudgets?.map(d => d.discipline) || []
        }
      })
    }
    
    // Import mode - save to database
    const saveResult = await analyzer.saveBudgetData(projectId, budgetData, user.id)
    
    if (!saveResult.success) {
      return NextResponse.json({ 
        error: 'Failed to save budget data',
        details: saveResult.error 
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      mode: 'import',
      project: {
        id: project.id,
        name: project.name,
        job_number: project.job_number
      },
      stats: saveResult.stats,
      validation: budgetData.validation
    })
    
  } catch (error) {
    console.error('Import coversheet error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check if project has existing budget data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Check existing budget data
    const [
      { data: budgetItems, error: itemsError },
      { data: wbsStructure, error: wbsError },
      { data: projectBudget, error: budgetError }
    ] = await Promise.all([
      supabase
        .from('budget_line_items')
        .select('id')
        .eq('project_id', projectId)
        .limit(1),
      supabase
        .from('wbs_structure')
        .select('id')
        .eq('project_id', projectId)
        .limit(1),
      supabase
        .from('project_budgets')
        .select('*')
        .eq('project_id', projectId)
        .single()
    ])

    if (itemsError || wbsError) {
      throw new Error('Failed to check existing budget data')
    }

    return NextResponse.json({
      hasExistingData: (budgetItems && budgetItems.length > 0) || (wbsStructure && wbsStructure.length > 0),
      projectBudget: projectBudget || null
    })
    
  } catch (error) {
    console.error('Check budget data error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}