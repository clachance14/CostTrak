import * as XLSX from 'xlsx'
import { createAdminClient } from '@/lib/supabase/admin'

// Import all sheet parsers
import { BudgetsSheetParser, BudgetDiscipline } from './sheet-parsers/BudgetsSheetParser'
import { StaffSheetParser } from './sheet-parsers/StaffSheetParser'
import { DirectsSheetParser } from './sheet-parsers/DirectsSheetParser'
import { MaterialsSheetParser } from './sheet-parsers/MaterialsSheetParser'
import { EquipmentSheetParser } from './sheet-parsers/EquipmentSheetParser'
import { ConstructabilitySheetParser } from './sheet-parsers/ConstructabilitySheetParser'
import { DiscEquipmentSheetParser } from './sheet-parsers/DiscEquipmentSheetParser'
import { IndirectsSheetParser } from './sheet-parsers/IndirectsSheetParser'

// Import supporting services
import { WBSGenerator, WBSNode } from './wbs-generator'
import { BudgetValidationService, ValidationResult } from './budget-validation.service'

// Re-export types from original for compatibility
export { BudgetLineItem, WBSNode, ExcelBudgetData } from './excel-budget-analyzer'
import { BudgetLineItem, ExcelBudgetData } from './excel-budget-analyzer'

export interface ExcelBudgetDataV2 extends ExcelBudgetData {
  validationResult?: ValidationResult
  wbsStructure5Level?: WBSNode[] // New 5-level structure
  phaseAllocations?: Array<any>
  directLaborAllocations?: Array<any>
}

export class ExcelBudgetAnalyzerV2 {
  private budgetsParser = new BudgetsSheetParser()
  private staffParser = new StaffSheetParser()
  private directsParser = new DirectsSheetParser()
  private materialsParser = new MaterialsSheetParser()
  private equipmentParser = new EquipmentSheetParser()
  private constructabilityParser = new ConstructabilitySheetParser()
  private discEquipmentParser = new DiscEquipmentSheetParser()
  private indirectsParser = new IndirectsSheetParser()
  private wbsGenerator = new WBSGenerator()
  private validationService = new BudgetValidationService()

  /**
   * Main method to analyze and extract all budget data from workbook
   */
  async extractBudgetData(workbook: XLSX.WorkBook, projectId?: string): Promise<ExcelBudgetDataV2> {
    const result: ExcelBudgetDataV2 = {
      summary: {},
      details: {},
      wbsStructure: [], // 3-level for backward compatibility
      wbsStructure5Level: [], // New 5-level structure
      totals: {
        labor: 0,
        material: 0,
        equipment: 0,
        subcontract: 0,
        other: 0,
        grand_total: 0,
        direct_labor_manhours: 0,
        indirect_labor_manhours: 0,
        total_manhours: 0
      },
      disciplineBudgets: [],
      validation: {
        warnings: [],
        errors: []
      },
      phaseAllocations: [],
      directLaborAllocations: []
    }

    const allItems: BudgetLineItem[] = []

    // Step 1: Parse BUDGETS sheet (source of truth)
    console.log('Parsing BUDGETS sheet...')
    const budgetsSheet = workbook.Sheets['BUDGETS']
    if (!budgetsSheet) {
      result.validation.errors.push('BUDGETS sheet not found - this is required')
      return result
    }

    const budgetsResult = this.budgetsParser.parse(budgetsSheet)
    if (budgetsResult.validation.errors.length > 0) {
      result.validation.errors.push(...budgetsResult.validation.errors)
      return result
    }

    // Store budget disciplines
    result.disciplineBudgets = this.convertBudgetDisciplines(budgetsResult.disciplines)
    
    // Get validation targets and ADD ONS
    const validationTargets = this.budgetsParser.getValidationTargets(budgetsResult.disciplines)
    const addOnsByDiscipline = this.budgetsParser.getAddOnsByDiscipline(budgetsResult.disciplines)

    // Update totals from BUDGETS - all values are safe (parser initializes to 0)
    // Calculate "other" as the difference between grand total and the sum of main categories
    const otherTotal = budgetsResult.totals.grandTotal - 
                      budgetsResult.totals.laborTotal - 
                      budgetsResult.totals.materialsTotal - 
                      budgetsResult.totals.equipmentTotal - 
                      budgetsResult.totals.subcontractorsTotal
    
    result.totals = {
      labor: budgetsResult.totals.laborTotal,
      material: budgetsResult.totals.materialsTotal,
      equipment: budgetsResult.totals.equipmentTotal,
      subcontract: budgetsResult.totals.subcontractorsTotal,
      other: otherTotal,
      grand_total: budgetsResult.totals.grandTotal,
      direct_labor_manhours: budgetsResult.totals.directLaborManhours,
      indirect_labor_manhours: budgetsResult.totals.indirectLaborManhours,
      total_manhours: budgetsResult.totals.totalManhours
    }

    // Step 2: Parse detail sheets
    const parsedSheets = {
      staff: undefined as any,
      directs: undefined as any,
      materials: undefined as any,
      equipment: undefined as any,
      constructability: undefined as any,
      indirects: undefined as any
    }

    // Parse STAFF sheet
    if (workbook.Sheets['STAFF']) {
      console.log('Parsing STAFF sheet...')
      const addOns = addOnsByDiscipline['GENERAL STAFFING'] || 0
      parsedSheets.staff = this.staffParser.parse(workbook.Sheets['STAFF'], addOns)
      
      // Store phase allocations
      if (projectId) {
        result.phaseAllocations = this.staffParser.toPhaseAllocations(
          parsedSheets.staff,
          projectId,
          '1.1.01' // WBS code for GENERAL STAFFING
        )
      }
    }

    // Parse INDIRECTS sheet
    if (workbook.Sheets['INDIRECTS']) {
      console.log('Parsing INDIRECTS sheet...')
      parsedSheets.indirects = this.indirectsParser.parse(workbook.Sheets['INDIRECTS'])
    }

    // Parse DIRECTS sheet
    if (workbook.Sheets['DIRECTS']) {
      console.log('Parsing DIRECTS sheet...')
      parsedSheets.directs = this.directsParser.parse(workbook.Sheets['DIRECTS'])
      
      // Store direct labor allocations
      if (projectId) {
        result.directLaborAllocations = this.directsParser.toDirectLaborAllocations(
          parsedSheets.directs,
          projectId
        )
      }
    }

    // Parse MATERIALS sheet
    if (workbook.Sheets['MATERIALS']) {
      console.log('Parsing MATERIALS sheet...')
      parsedSheets.materials = this.materialsParser.parse(workbook.Sheets['MATERIALS'])
      
      // Convert to line items
      if (projectId) {
        const materialItems = this.materialsParser.toBudgetLineItems(
          parsedSheets.materials,
          projectId,
          crypto.randomUUID()
        )
        result.details['MATERIALS'] = materialItems
        allItems.push(...materialItems)
      }
    }

    // Parse GENERAL EQUIPMENT sheet
    if (workbook.Sheets['GENERAL EQUIPMENT']) {
      console.log('Parsing GENERAL EQUIPMENT sheet...')
      parsedSheets.equipment = this.equipmentParser.parse(workbook.Sheets['GENERAL EQUIPMENT'])
      
      // Convert to line items
      if (projectId) {
        const equipmentItems = this.equipmentParser.toBudgetLineItems(
          parsedSheets.equipment,
          projectId,
          crypto.randomUUID()
        )
        result.details['GENERAL EQUIPMENT'] = equipmentItems
        allItems.push(...equipmentItems)
      }
    }

    // Parse CONSTRUCTABILITY sheet
    if (workbook.Sheets['CONSTRUCTABILITY']) {
      console.log('Parsing CONSTRUCTABILITY sheet...')
      parsedSheets.constructability = this.constructabilityParser.parse(workbook.Sheets['CONSTRUCTABILITY'])
      
      // Convert to line items
      if (projectId) {
        const constructabilityItems = this.constructabilityParser.toBudgetLineItems(
          parsedSheets.constructability,
          projectId,
          crypto.randomUUID()
        )
        result.details['CONSTRUCTABILITY'] = constructabilityItems
        allItems.push(...constructabilityItems)
      }
    }

    // Parse discipline-specific equipment sheet (DISC. EQUIPMENT)
    const discEquipmentSheets: Record<string, any> = {}
    
    // Look for "DISC. EQUIPMENT" sheet (with period)
    const discEquipmentSheet = workbook.Sheets['DISC. EQUIPMENT'] || workbook.Sheets['DISC.EQUIPMENT']
    if (discEquipmentSheet) {
      console.log('Parsing DISC. EQUIPMENT sheet...')
      // This sheet contains ALL discipline-specific equipment with discipline in Column B
      // Parse it with the equipment parser which already handles discipline grouping
      const discEquipmentResult = this.equipmentParser.parse(discEquipmentSheet)
      
      // Group by discipline for validation
      if (discEquipmentResult.disciplines.length > 0) {
        discEquipmentResult.disciplines.forEach(disc => {
          discEquipmentSheets[`DISC_EQUIPMENT_${disc.disciplineName}`] = {
            disciplineName: disc.disciplineName,
            items: disc.items,
            totals: disc.totals,
            validation: { warnings: [], errors: [] }
          }
        })
      }
      
      // Convert to line items
      if (projectId) {
        const discEquipmentItems = this.equipmentParser.toBudgetLineItems(
          discEquipmentResult,
          projectId,
          crypto.randomUUID()
        )
        result.details['DISC. EQUIPMENT'] = discEquipmentItems
        allItems.push(...discEquipmentItems)
      }
    }

    // Step 3: Validate all sheets against BUDGETS
    console.log('Validating all sheets against BUDGETS...')
    const validationResult = this.validationService.validateAllSheets(
      budgetsResult,
      parsedSheets.staff,
      parsedSheets.directs,
      parsedSheets.materials,
      parsedSheets.equipment,
      parsedSheets.constructability,
      discEquipmentSheets,
      parsedSheets.indirects
    )
    
    result.validationResult = validationResult
    
    // Add validation messages
    if (!validationResult.isValid) {
      result.validation.errors.push('Validation failed - see validationResult for details')
    }
    
    // Log validation report
    console.log('\n' + this.validationService.generateReport(validationResult))

    // Step 4: Generate 5-level WBS structure
    if (projectId) {
      console.log('Generating 5-level WBS structure...')
      result.wbsStructure5Level = this.wbsGenerator.generateWBSStructure(
        projectId,
        budgetsResult.disciplines
      )
      
      // For backward compatibility, create simplified 3-level structure
      result.wbsStructure = this.simplifyTo3Level(result.wbsStructure5Level)
    }

    // Convert BUDGETS data to line items
    const budgetLineItems = this.convertBudgetDisciplinesToLineItems(budgetsResult.disciplines)
    result.details['BUDGETS'] = budgetLineItems
    allItems.push(...budgetLineItems)

    // Add validation summary
    const itemsWithoutWBS = allItems.filter(item => !item.wbs_code).length
    if (itemsWithoutWBS > 0) {
      result.validation.warnings.push(
        `${itemsWithoutWBS} items do not have WBS codes assigned`
      )
    }

    return result
  }

  /**
   * Convert new BudgetDiscipline format to old BudgetSheetDiscipline format
   */
  private convertBudgetDisciplines(disciplines: BudgetDiscipline[]): any[] {
    return disciplines.map(disc => ({
      discipline: disc.disciplineName,
      disciplineNumber: disc.disciplineNumber,
      directLaborHours: disc.categories.DIRECT_LABOR?.manhours || 0,
      indirectLaborHours: disc.categories.INDIRECT_LABOR?.manhours || 0,
      manhours: (disc.categories.DIRECT_LABOR?.manhours || 0) + (disc.categories.INDIRECT_LABOR?.manhours || 0),
      value: disc.categories.DISCIPLINE_TOTALS?.value || 0,
      categories: Object.entries(disc.categories).reduce((acc, [key, value]) => {
        const categoryName = key.replace(/_/g, ' ')
        const disciplineTotal = disc.categories.DISCIPLINE_TOTALS?.value || 0
        acc[categoryName] = {
          manhours: value?.manhours || 0,
          value: value?.value || 0,
          percentage: disciplineTotal > 0 && value?.value 
            ? (value.value / disciplineTotal) * 100 
            : 0
        }
        return acc
      }, {} as Record<string, any>)
    }))
  }

  /**
   * Convert BUDGETS disciplines to budget line items
   */
  private convertBudgetDisciplinesToLineItems(disciplines: BudgetDiscipline[]): BudgetLineItem[] {
    const items: BudgetLineItem[] = []
    let rowCounter = 1

    disciplines.forEach(disc => {
      // Create line items for each category except subtotals
      const categoriesToSkip = ['ALL_LABOR', 'DISCIPLINE_TOTALS']
      
      Object.entries(disc.categories).forEach(([categoryKey, categoryData]) => {
        if (categoriesToSkip.includes(categoryKey)) return
        
        const categoryName = categoryKey.replace(/_/g, ' ')
        let category = 'OTHER'
        const costType = categoryName
        
        // Determine category
        if (categoryKey.includes('LABOR') || 
            categoryKey === 'TAXES_INSURANCE' || 
            categoryKey === 'PERDIEM' || 
            categoryKey === 'ADD_ONS') {
          category = 'LABOR'
        } else if (categoryKey === 'MATERIALS') {
          category = 'MATERIAL'
        } else if (categoryKey === 'EQUIPMENT') {
          category = 'EQUIPMENT'
        } else if (categoryKey === 'SUBCONTRACTS') {
          category = 'SUBCONTRACT'
        }
        
        if (categoryData && categoryData.value > 0) {
          const item: BudgetLineItem = {
            source_sheet: 'BUDGETS',
            source_row: rowCounter++,
            discipline: disc.disciplineName,
            category: category,
            cost_type: costType,
            description: `${disc.disciplineName} - ${categoryName}`,
            total_cost: categoryData.value,
            labor_cost: category === 'LABOR' ? categoryData.value : 0,
            material_cost: category === 'MATERIAL' ? categoryData.value : 0,
            equipment_cost: category === 'EQUIPMENT' ? categoryData.value : 0,
            subcontract_cost: category === 'SUBCONTRACT' ? categoryData.value : 0,
            other_cost: ['OTHER'].includes(category) ? categoryData.value : 0,
            manhours: categoryData.manhours || 0,
            wbs_code: this.wbsGenerator.getWBSCodeForItem(
              disc.disciplineName,
              this.mapCategoryToCostType(categoryKey),
              undefined
            )
          }
          
          items.push(item)
        }
      })
    })
    
    return items
  }

  /**
   * Map category key to cost type
   */
  private mapCategoryToCostType(categoryKey: string): 'DL' | 'IL' | 'MAT' | 'EQ' | 'SUB' {
    switch (categoryKey) {
      case 'DIRECT_LABOR':
        return 'DL'
      case 'INDIRECT_LABOR':
      case 'ADD_ONS':
        return 'IL'
      case 'MATERIALS':
        return 'MAT'
      case 'EQUIPMENT':
        return 'EQ'
      case 'SUBCONTRACTS':
        return 'SUB'
      default:
        return 'SUB' // Default to subcontract for other categories
    }
  }

  /**
   * Simplify 5-level WBS to 3-level for backward compatibility
   */
  private simplifyTo3Level(wbs5Level: WBSNode[]): any[] {
    const simplified: any[] = []
    
    wbs5Level.forEach(node => {
      if (node.level <= 3) {
        const simpleNode = {
          code: node.code,
          parent_code: node.parent_code,
          level: node.level,
          description: node.description,
          budget_total: node.budget_total || 0,
          children: []
        }
        
        if (node.children) {
          simpleNode.children = this.simplifyTo3Level(node.children)
        }
        
        simplified.push(simpleNode)
      }
    })
    
    return simplified
  }

  /**
   * Save extracted budget data to database
   */
  async saveBudgetData(
    projectId: string,
    budgetData: ExcelBudgetDataV2,
    userId: string
  ): Promise<{ success: boolean; error?: string; stats?: any }> {
    const adminSupabase = createAdminClient()
    const importBatchId = crypto.randomUUID()
    
    try {
      // 1. Save 5-level WBS structure
      if (budgetData.wbsStructure5Level && budgetData.wbsStructure5Level.length > 0) {
        const wbsNodes = this.flattenWBSNodes(budgetData.wbsStructure5Level, projectId)
        
        if (wbsNodes.length > 0) {
          const { error: wbsError } = await adminSupabase
            .from('wbs_structure')
            .upsert(wbsNodes, {
              onConflict: 'project_id,code',
              ignoreDuplicates: false
            })
          
          if (wbsError) throw wbsError
        }
      }
      
      // 2. Save phase allocations
      if (budgetData.phaseAllocations && budgetData.phaseAllocations.length > 0) {
        const { error: phaseError } = await adminSupabase
          .from('phase_allocations')
          .insert(budgetData.phaseAllocations)
        
        if (phaseError) throw phaseError
      }
      
      // 3. Save direct labor allocations
      if (budgetData.directLaborAllocations && budgetData.directLaborAllocations.length > 0) {
        const { error: directError } = await adminSupabase
          .from('direct_labor_allocations')
          .insert(budgetData.directLaborAllocations)
        
        if (directError) throw directError
      }
      
      // 4. Save all budget line items
      const allItems: Array<BudgetLineItem & { project_id: string; import_batch_id: string }> = []
      
      Object.entries(budgetData.details).forEach(([, items]) => {
        items.forEach(item => {
          allItems.push({
            ...item,
            project_id: projectId,
            import_batch_id: importBatchId
          })
        })
      })
      
      if (allItems.length > 0) {
        const { error: itemsError } = await adminSupabase
          .from('budget_line_items')
          .insert(allItems)
        
        if (itemsError) throw itemsError
      }
      
      // 5. Update project budget totals
      const { error: updateError } = await adminSupabase
        .from('project_budgets')
        .upsert({
          project_id: projectId,
          labor_budget: budgetData.totals.labor,
          materials_budget: budgetData.totals.material,
          equipment_budget: budgetData.totals.equipment,
          subcontracts_budget: budgetData.totals.subcontract,
          other_budget: budgetData.totals.other,
          total_budget: budgetData.totals.grand_total,
          budget_status: 'approved',
          created_by: userId,
          approved_by: userId,
          approved_at: new Date().toISOString()
        }, {
          onConflict: 'project_id'
        })
      
      if (updateError) throw updateError
      
      return {
        success: true,
        stats: {
          wbsCodesCreated: budgetData.wbsStructure5Level?.length || 0,
          phaseAllocations: budgetData.phaseAllocations?.length || 0,
          directLaborAllocations: budgetData.directLaborAllocations?.length || 0,
          lineItemsImported: allItems.length,
          totalBudget: budgetData.totals.grand_total,
          byCategory: budgetData.totals
        }
      }
      
    } catch (error) {
      console.error('Error saving budget data:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Flatten WBS nodes for database storage
   */
  private flattenWBSNodes(nodes: WBSNode[], projectId: string): Array<any> {
    const flattened: Array<any> = []
    
    const processNode = (node: WBSNode) => {
      flattened.push({
        project_id: projectId,
        code: node.code,
        parent_code: node.parent_code,
        level: node.level,
        description: node.description,
        phase: node.phase,
        cost_type: node.cost_type,
        labor_category_id: node.labor_category_id,
        path: node.path,
        sort_order: node.sort_order,
        children_count: node.children_count,
        budget_total: node.budget_total || 0
      })
      
      if (node.children) {
        node.children.forEach(processNode)
      }
    }
    
    nodes.forEach(processNode)
    return flattened
  }
}