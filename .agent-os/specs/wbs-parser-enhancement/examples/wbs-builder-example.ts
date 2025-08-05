/**
 * WBS Builder Implementation Example
 * 
 * This class constructs the complete 5-level WBS hierarchy from parsed sheet data.
 */

import {
  WBSNode,
  WBSLevel,
  BudgetLineItem,
  DirectLaborAllocation,
  PhaseAllocation,
  CostType,
  ProjectPhase
} from '../data-models'

export class WBSBuilder {
  private nodes: Map<string, WBSNode> = new Map()
  private codeCounter: Map<string, number> = new Map()

  /**
   * Build complete 5-level WBS hierarchy
   */
  async buildHierarchy(data: {
    lineItems: BudgetLineItem[]
    directLabor: DirectLaborAllocation[]
    phaseAllocations: PhaseAllocation[]
    projectTotal: number
  }): Promise<WBSNode[]> {
    // Clear previous build
    this.nodes.clear()
    this.codeCounter.clear()
    
    // Level 1: Create Project Total
    const projectNode = this.createNode({
      code: '1.0',
      level: WBSLevel.PROJECT,
      description: 'Project Total',
      budget_total: data.projectTotal
    })
    
    // Level 2: Create Construction Phase
    const phaseNode = this.createNode({
      code: '1.1',
      parent_code: '1.0',
      level: WBSLevel.PHASE,
      description: 'Construction Phase',
      budget_total: data.projectTotal // Will be recalculated
    })
    
    // Level 3: Create Major Groups
    this.createMajorGroups()
    
    // Level 4 & 5: Process data and create detailed nodes
    this.processLineItems(data.lineItems)
    this.processDirectLabor(data.directLabor)
    this.processPhaseAllocations(data.phaseAllocations)
    
    // Build hierarchy relationships
    this.buildRelationships()
    
    // Calculate rollups
    this.calculateRollups()
    
    // Return root nodes
    return this.getRootNodes()
  }

  /**
   * Create Level 3 Major Groups
   */
  private createMajorGroups() {
    const groups = [
      { code: '1.1.1', name: 'General Staffing Group' },
      { code: '1.1.2', name: 'Scaffolding Group' },
      { code: '1.1.3', name: 'Constructability Group' },
      { code: '1.1.4', name: 'Fabrication Group' },
      { code: '1.1.5', name: 'Mobilization Group' },
      { code: '1.1.6', name: 'Clean Up Group' },
      { code: '1.1.7', name: 'Building-Remodeling Group' },
      { code: '1.1.8', name: 'Civil Group' },
      { code: '1.1.9', name: 'Mechanical Group' },
      { code: '1.1.10', name: 'I&E Group' },
      { code: '1.1.11', name: 'Demolition Group' },
      { code: '1.1.12', name: 'Millwright Group' },
      { code: '1.1.13', name: 'Insulation/Painting Group' }
    ]
    
    groups.forEach(group => {
      this.createNode({
        code: group.code,
        parent_code: '1.1',
        level: WBSLevel.GROUP,
        description: group.name,
        budget_total: 0 // Will be calculated
      })
      
      // Initialize counter for sub-nodes
      this.codeCounter.set(group.code, 1)
    })
  }

  /**
   * Process budget line items
   */
  private processLineItems(items: BudgetLineItem[]) {
    for (const item of items) {
      // Determine which Level 3 group this belongs to
      const groupCode = this.determineGroupCode(item)
      
      // Get or create Level 4 category
      const categoryCode = this.getOrCreateCategoryNode(groupCode, item)
      
      // Create Level 5 line item
      this.createLineItemNode(categoryCode, item)
    }
  }

  /**
   * Process direct labor allocations
   */
  private processDirectLabor(allocations: DirectLaborAllocation[]) {
    // Group by discipline and WBS code
    const grouped = new Map<string, DirectLaborAllocation[]>()
    
    for (const allocation of allocations) {
      const key = `${allocation.discipline}-${allocation.wbs_code}`
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(allocation)
    }
    
    // Create nodes for each group
    grouped.forEach((allocations, key) => {
      const first = allocations[0]
      const groupCode = this.getGroupCodeForDiscipline(first.discipline)
      
      // Create or get Level 4 DL category
      const categoryCode = this.getOrCreateCostTypeNode(
        groupCode, 
        first.discipline, 
        CostType.DL
      )
      
      // Create Level 5 nodes for each labor category
      allocations.forEach(allocation => {
        const lineCode = this.getNextCode(categoryCode)
        
        this.createNode({
          code: lineCode,
          parent_code: categoryCode,
          level: WBSLevel.LINE_ITEM,
          description: allocation.category,
          discipline: allocation.discipline,
          cost_type: CostType.DL,
          budget_total: allocation.total_cost,
          labor_cost: allocation.total_cost,
          manhours_total: allocation.manhours,
          direct_hours: allocation.manhours,
          crew_size: allocation.crew_size
        })
      })
    })
  }

  /**
   * Process phase allocations for indirect labor
   */
  private processPhaseAllocations(allocations: PhaseAllocation[]) {
    // Group by phase
    const phaseGroups = new Map<ProjectPhase, PhaseAllocation[]>()
    
    for (const allocation of allocations) {
      if (!phaseGroups.has(allocation.phase)) {
        phaseGroups.set(allocation.phase, [])
      }
      phaseGroups.get(allocation.phase)!.push(allocation)
    }
    
    // Process each phase
    phaseGroups.forEach((allocations, phase) => {
      // Get phase sub-category under General Staffing
      const phaseCode = this.getPhaseCode(phase)
      
      // Create IL category under phase
      const ilCode = `${phaseCode}.2` // .2 for Indirect Labor
      
      if (!this.nodes.has(ilCode)) {
        this.createNode({
          code: ilCode,
          parent_code: phaseCode,
          level: WBSLevel.CATEGORY,
          description: 'Indirect Labor (incl. Add-Ons)',
          cost_type: CostType.IL,
          phase: phase,
          budget_total: 0
        })
      }
      
      // Create Level 5 nodes for each role
      allocations.forEach(allocation => {
        const roleIndex = this.getRoleIndex(allocation.role)
        const lineCode = `${ilCode}.${roleIndex.toString().padStart(2, '0')}`
        
        this.createNode({
          code: lineCode,
          parent_code: ilCode,
          level: WBSLevel.LINE_ITEM,
          description: allocation.role,
          phase: phase,
          cost_type: CostType.IL,
          budget_total: allocation.total_cost,
          labor_cost: allocation.total_cost,
          fte_count: allocation.fte,
          indirect_hours: allocation.fte * allocation.duration_months * 173, // ~173 hours/month
        })
      })
    })
  }

  /**
   * Determine which Level 3 group a line item belongs to
   */
  private determineGroupCode(item: BudgetLineItem): string {
    // Map based on discipline, category, or sheet
    const disciplineGroupMap: Record<string, string> = {
      'GENERAL STAFFING': '1.1.1',
      'SCAFFOLDING': '1.1.2',
      'CONSTRUCTABILITY': '1.1.3',
      'FABRICATION': '1.1.4',
      'MOBILIZATION': '1.1.5',
      'CLEAN UP': '1.1.6',
      'BUILDING-REMODELING': '1.1.7',
      'CIVIL': '1.1.8',
      'MECHANICAL': '1.1.9',
      'PIPING': '1.1.9',
      'STEEL': '1.1.9',
      'EQUIPMENT': '1.1.9',
      'I&E': '1.1.10',
      'INSTRUMENTATION': '1.1.10',
      'ELECTRICAL': '1.1.10',
      'DEMOLITION': '1.1.11',
      'MILLWRIGHT': '1.1.12',
      'INSULATION': '1.1.13',
      'PAINTING': '1.1.13'
    }
    
    // Check discipline first
    if (item.discipline && disciplineGroupMap[item.discipline]) {
      return disciplineGroupMap[item.discipline]
    }
    
    // Check source sheet
    const sheetGroupMap: Record<string, string> = {
      'SCAFFOLDING': '1.1.2',
      'CONSTRUCTABILITY': '1.1.3',
      'STAFF': '1.1.1'
    }
    
    if (sheetGroupMap[item.source_sheet]) {
      return sheetGroupMap[item.source_sheet]
    }
    
    // Default to Mechanical if unclear
    return '1.1.9'
  }

  /**
   * Get group code for a discipline
   */
  private getGroupCodeForDiscipline(discipline: string): string {
    const map: Record<string, string> = {
      'PIPING': '1.1.9',
      'STEEL': '1.1.9',
      'EQUIPMENT': '1.1.9',
      'INSTRUMENTATION': '1.1.10',
      'ELECTRICAL': '1.1.10',
      'CIVIL': '1.1.8',
      'CONCRETE': '1.1.8',
      'FABRICATION': '1.1.4',
      'MILLWRIGHT': '1.1.12'
    }
    
    return map[discipline] || '1.1.9'
  }

  /**
   * Get phase code for General Staffing phases
   */
  private getPhaseCode(phase: ProjectPhase): string {
    const phaseCodes: Record<ProjectPhase, string> = {
      'JOB_SET_UP': '1.1.1.1',
      'PRE_WORK': '1.1.1.2',
      'PROJECT_EXECUTION': '1.1.1.3',
      'JOB_CLOSE_OUT': '1.1.1.4'
    }
    
    return phaseCodes[phase]
  }

  /**
   * Get or create Level 4 category node
   */
  private getOrCreateCategoryNode(groupCode: string, item: BudgetLineItem): string {
    // Determine category based on item properties
    const categoryName = this.determineCategoryName(item)
    const costType = this.determineCostType(item)
    
    // Check if category already exists
    const existingCategory = this.findCategoryNode(groupCode, categoryName)
    if (existingCategory) {
      return existingCategory.code
    }
    
    // Create new category
    const categoryIndex = this.codeCounter.get(groupCode) || 1
    const categoryCode = `${groupCode}.${categoryIndex}`
    this.codeCounter.set(groupCode, categoryIndex + 1)
    
    this.createNode({
      code: categoryCode,
      parent_code: groupCode,
      level: WBSLevel.CATEGORY,
      description: categoryName,
      cost_type: costType,
      discipline: item.discipline,
      budget_total: 0
    })
    
    // Initialize line item counter
    this.codeCounter.set(categoryCode, 1)
    
    return categoryCode
  }

  /**
   * Get or create cost type node
   */
  private getOrCreateCostTypeNode(
    groupCode: string, 
    discipline: string, 
    costType: CostType
  ): string {
    // Find discipline sub-group
    let disciplineCode: string | undefined
    
    this.nodes.forEach((node, code) => {
      if (node.parent_code === groupCode && 
          node.description === discipline) {
        disciplineCode = code
      }
    })
    
    if (!disciplineCode) {
      // Create discipline sub-group
      const index = this.codeCounter.get(groupCode) || 1
      disciplineCode = `${groupCode}.${index}`
      this.codeCounter.set(groupCode, index + 1)
      
      this.createNode({
        code: disciplineCode,
        parent_code: groupCode,
        level: WBSLevel.CATEGORY,
        description: discipline,
        discipline: discipline,
        budget_total: 0
      })
    }
    
    // Check if cost type category exists
    const costTypeCode = `${disciplineCode}.${costType === CostType.DL ? '1' : '2'}`
    
    if (!this.nodes.has(costTypeCode)) {
      this.createNode({
        code: costTypeCode,
        parent_code: disciplineCode,
        level: WBSLevel.CATEGORY,
        description: costType === CostType.DL ? 'Direct Labor' : 'Indirect Labor',
        cost_type: costType,
        discipline: discipline,
        budget_total: 0
      })
      
      this.codeCounter.set(costTypeCode, 1)
    }
    
    return costTypeCode
  }

  /**
   * Create Level 5 line item node
   */
  private createLineItemNode(categoryCode: string, item: BudgetLineItem) {
    const lineCode = this.getNextCode(categoryCode)
    
    this.createNode({
      code: lineCode,
      parent_code: categoryCode,
      level: WBSLevel.LINE_ITEM,
      description: item.description,
      discipline: item.discipline,
      budget_total: item.total_cost,
      labor_cost: item.labor_cost,
      material_cost: item.material_cost,
      equipment_cost: item.equipment_cost,
      subcontract_cost: item.subcontract_cost,
      other_cost: item.other_cost,
      manhours_total: item.manhours,
      source_sheet: item.source_sheet,
      source_row: item.source_row
    })
  }

  /**
   * Create a WBS node
   */
  private createNode(data: Partial<WBSNode> & { code: string }): WBSNode {
    const node: WBSNode = {
      id: crypto.randomUUID(),
      code: data.code,
      parent_code: data.parent_code,
      level: data.level || WBSLevel.PROJECT,
      description: data.description || '',
      discipline: data.discipline,
      phase: data.phase,
      cost_type: data.cost_type,
      children: [],
      path: this.buildPath(data.code),
      sort_order: this.nodes.size,
      budget_total: data.budget_total || 0,
      labor_cost: data.labor_cost || 0,
      material_cost: data.material_cost || 0,
      equipment_cost: data.equipment_cost || 0,
      subcontract_cost: data.subcontract_cost || 0,
      other_cost: data.other_cost || 0,
      manhours_total: data.manhours_total,
      direct_hours: data.direct_hours,
      indirect_hours: data.indirect_hours,
      crew_size: data.crew_size,
      fte_count: data.fte_count,
      source_sheet: data.source_sheet,
      source_row: data.source_row,
      created_at: new Date(),
      updated_at: new Date()
    }
    
    this.nodes.set(node.code, node)
    return node
  }

  /**
   * Build relationships between nodes
   */
  private buildRelationships() {
    this.nodes.forEach(node => {
      if (node.parent_code) {
        const parent = this.nodes.get(node.parent_code)
        if (parent) {
          parent.children.push(node)
        }
      }
    })
  }

  /**
   * Calculate rollups from bottom to top
   */
  private calculateRollups() {
    // Start from Level 5 and work up
    for (let level = 5; level >= 1; level--) {
      this.nodes.forEach(node => {
        if (node.level === level && node.children.length > 0) {
          // Sum all child values
          node.budget_total = node.children.reduce((sum, child) => sum + child.budget_total, 0)
          node.labor_cost = node.children.reduce((sum, child) => sum + child.labor_cost, 0)
          node.material_cost = node.children.reduce((sum, child) => sum + child.material_cost, 0)
          node.equipment_cost = node.children.reduce((sum, child) => sum + child.equipment_cost, 0)
          node.subcontract_cost = node.children.reduce((sum, child) => sum + child.subcontract_cost, 0)
          node.other_cost = node.children.reduce((sum, child) => sum + child.other_cost, 0)
          
          // Sum hours
          if (node.children.some(c => c.manhours_total !== undefined)) {
            node.manhours_total = node.children.reduce((sum, child) => 
              sum + (child.manhours_total || 0), 0
            )
          }
          
          if (node.children.some(c => c.direct_hours !== undefined)) {
            node.direct_hours = node.children.reduce((sum, child) => 
              sum + (child.direct_hours || 0), 0
            )
          }
          
          if (node.children.some(c => c.indirect_hours !== undefined)) {
            node.indirect_hours = node.children.reduce((sum, child) => 
              sum + (child.indirect_hours || 0), 0
            )
          }
        }
      })
    }
  }

  /**
   * Get root nodes (Level 1)
   */
  private getRootNodes(): WBSNode[] {
    return Array.from(this.nodes.values())
      .filter(node => !node.parent_code)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  /**
   * Helper methods
   */
  private buildPath(code: string): string[] {
    const parts = code.split('.')
    const path: string[] = []
    
    for (let i = 1; i <= parts.length; i++) {
      path.push(parts.slice(0, i).join('.'))
    }
    
    return path
  }

  private getNextCode(parentCode: string): string {
    const counter = this.codeCounter.get(parentCode) || 1
    this.codeCounter.set(parentCode, counter + 1)
    return `${parentCode}.${counter}`
  }

  private findCategoryNode(groupCode: string, categoryName: string): WBSNode | undefined {
    for (const node of this.nodes.values()) {
      if (node.parent_code === groupCode && 
          node.description === categoryName &&
          node.level === WBSLevel.CATEGORY) {
        return node
      }
    }
    return undefined
  }

  private determineCategoryName(item: BudgetLineItem): string {
    // Logic to determine category name based on item properties
    if (item.subcategory) return item.subcategory
    if (item.cost_type) return item.cost_type
    return item.category
  }

  private determineCostType(item: BudgetLineItem): CostType | undefined {
    switch (item.category) {
      case 'LABOR':
        return item.subcategory === 'DIRECT' ? CostType.DL : CostType.IL
      case 'MATERIAL':
        return CostType.MAT
      case 'EQUIPMENT':
        return CostType.EQ
      case 'SUBCONTRACT':
        return CostType.SUB
      default:
        return undefined
    }
  }

  private getRoleIndex(role: string): number {
    const roles = [
      'Area Superintendent',
      'Clerk',
      'Cost Engineer',
      'Field Engineer',
      'Field Exchanger General Foreman',
      'General Foreman',
      'Lead Planner',
      'Lead Scheduler',
      'Planner A',
      'Planner B',
      'Procurement Coordinator',
      'Project Controls Lead',
      'Project Manager',
      'QA/QC Inspector A',
      'QA/QC Inspector B',
      'QA/QC Supervisor',
      'Safety Supervisor',
      'Safety Technician A',
      'Safety Technician B',
      'Scheduler',
      'Senior Project Manager',
      'Superintendent',
      'Timekeeper'
    ]
    
    return roles.indexOf(role) + 1
  }
}

// Example usage
async function exampleUsage() {
  const builder = new WBSBuilder()
  
  // Sample data
  const data = {
    lineItems: [
      {
        id: '1',
        project_id: 'proj-123',
        import_batch_id: 'batch-1',
        source_sheet: 'MATERIALS',
        source_row: 10,
        description: 'Pipe Fittings',
        discipline: 'PIPING',
        category: 'MATERIAL' as const,
        total_cost: 50000,
        material_cost: 50000,
        labor_cost: 0,
        equipment_cost: 0,
        subcontract_cost: 0,
        other_cost: 0
      }
    ],
    directLabor: [
      {
        id: '2',
        project_id: 'proj-123',
        wbs_code: '1.1.9.4.1',
        discipline: 'PIPING',
        category: 'Welder - Class A' as any,
        manhours: 1000,
        crew_size: 4,
        duration_days: 25,
        rate: 90,
        total_cost: 90000,
        source_sheet: 'DIRECTS',
        source_row: 15
      }
    ],
    phaseAllocations: [
      {
        id: '3',
        project_id: 'proj-123',
        wbs_code: '1.1.1.1.2.13',
        phase: 'JOB_SET_UP' as ProjectPhase,
        role: 'Project Manager' as any,
        fte: 1,
        duration_months: 2,
        monthly_rate: 12000,
        perdiem: 2750,
        add_ons: 3600,
        total_cost: 30350
      }
    ],
    projectTotal: 170350
  }
  
  const hierarchy = await builder.buildHierarchy(data)
  
  // Print hierarchy
  console.log('\n=== WBS Hierarchy ===')
  printHierarchy(hierarchy)
  
  // Validate 100% rule
  const projectNode = hierarchy[0]
  const sumOfChildren = projectNode.children.reduce((sum, child) => sum + child.budget_total, 0)
  console.log('\n100% Rule Validation:')
  console.log(`Project Total: $${projectNode.budget_total.toLocaleString()}`)
  console.log(`Sum of Children: $${sumOfChildren.toLocaleString()}`)
  console.log(`Difference: $${Math.abs(projectNode.budget_total - sumOfChildren).toFixed(2)}`)
}

function printHierarchy(nodes: WBSNode[], indent = '') {
  nodes.forEach(node => {
    console.log(`${indent}${node.code} ${node.description} - $${node.budget_total.toLocaleString()}`)
    if (node.children.length > 0) {
      printHierarchy(node.children, indent + '  ')
    }
  })
}

export { exampleUsage }