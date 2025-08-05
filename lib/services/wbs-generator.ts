import { BudgetDiscipline } from './sheet-parsers/BudgetsSheetParser'

export interface WBSNode {
  code: string
  parent_code?: string
  level: number
  description: string
  phase?: string
  cost_type?: 'DL' | 'IL' | 'MAT' | 'EQ' | 'SUB'
  labor_category_id?: string
  path: string[]
  sort_order: number
  children_count: number
  budget_total?: number
  children?: WBSNode[]
}

export class WBSGenerator {
  // Major WBS Groups (Level 3)
  private readonly WBS_GROUPS = [
    { code: '01', name: 'GENERAL STAFFING', order: 1 },
    { code: '02', name: 'SCAFFOLDING', order: 2 },
    { code: '03', name: 'CONSTRUCTABILITY', order: 3 },
    { code: '04', name: 'FABRICATION', order: 4 },
    { code: '05', name: 'MOBILIZATION', order: 5 },
    { code: '06', name: 'CLEAN UP', order: 6 },
    { code: '07', name: 'BUILDING-REMODELING', order: 7 },
    { code: '08', name: 'CIVIL', order: 8 },
    { code: '09', name: 'MECHANICAL', order: 9 },
    { code: '10', name: 'I&E', order: 10 },
    { code: '11', name: 'DEMOLITION', order: 11 },
    { code: '12', name: 'MILLWRIGHT', order: 12 },
    { code: '13', name: 'INSULATION', order: 13 },
    { code: '14', name: 'PAINTING', order: 14 }
  ]

  // Discipline to WBS Group mapping
  private readonly DISCIPLINE_TO_GROUP: Record<string, string> = {
    'GENERAL STAFFING': '01',
    'SCAFFOLDING': '02',
    'CONSTRUCTABILITY': '03',
    'FABRICATION': '04',
    'MOBILIZATION': '05',
    'CLEAN UP': '06',
    'BUILDING-REMODELING': '07',
    'BUILDING REMODELING': '07',
    // Civil disciplines
    'CIVIL': '08',
    'CIVIL - GROUNDING': '08',
    'CONCRETE': '08',
    'GROUNDING': '08',
    'GROUTING': '08',
    // Mechanical disciplines
    'MECHANICAL': '09',
    'PIPING': '09',
    'STEEL': '09',
    'EQUIPMENT': '09',
    'CRANE SUPPORT': '09',
    // I&E disciplines
    'I&E': '10',
    'INSTRUMENTATION': '10',
    'ELECTRICAL': '10',
    'HYDRO-TESTING': '10',
    // Other
    'MILLWRIGHT': '12',
    'INSULATION': '13',
    'PAINTING': '14'
  }

  // Cost categories (Level 4)
  private readonly COST_CATEGORIES = [
    { code: '01', name: 'Direct Labor', type: 'DL' as const },
    { code: '02', name: 'Indirect Labor', type: 'IL' as const },
    { code: '03', name: 'Materials', type: 'MAT' as const },
    { code: '04', name: 'Equipment', type: 'EQ' as const },
    { code: '05', name: 'Subcontracts', type: 'SUB' as const }
  ]

  /**
   * Generate complete 5-level WBS structure from budget disciplines
   */
  generateWBSStructure(
    projectId: string,
    disciplines: BudgetDiscipline[]
  ): WBSNode[] {
    const nodes: WBSNode[] = []
    let sortOrder = 0

    // Level 1: Project Total
    const projectNode: WBSNode = {
      code: '1',
      level: 1,
      description: 'PROJECT TOTAL',
      path: ['1'],
      sort_order: sortOrder++,
      children_count: 1,
      children: []
    }
    nodes.push(projectNode)

    // Level 2: Construction Phase
    const phaseNode: WBSNode = {
      code: '1.1',
      parent_code: '1',
      level: 2,
      description: 'CONSTRUCTION PHASE',
      phase: 'PROJECT_EXECUTION',
      path: ['1', '1.1'],
      sort_order: sortOrder++,
      children_count: this.WBS_GROUPS.length,
      children: []
    }
    nodes.push(phaseNode)
    projectNode.children!.push(phaseNode)

    // Level 3: Major Groups
    this.WBS_GROUPS.forEach(group => {
      const groupNode: WBSNode = {
        code: `1.1.${group.code}`,
        parent_code: '1.1',
        level: 3,
        description: group.name,
        path: ['1', '1.1', `1.1.${group.code}`],
        sort_order: sortOrder++,
        children_count: 0,
        children: []
      }
      nodes.push(groupNode)
      phaseNode.children!.push(groupNode)

      // Find disciplines that belong to this group
      const groupDisciplines = disciplines.filter(disc => 
        this.DISCIPLINE_TO_GROUP[disc.disciplineName.toUpperCase()] === group.code
      )

      if (groupDisciplines.length > 0) {
        // Add sub-disciplines if it's a parent group (Civil, Mechanical, I&E)
        if (['08', '09', '10'].includes(group.code)) {
          groupDisciplines.forEach((disc, index) => {
            const subDisciplineNode: WBSNode = {
              code: `1.1.${group.code}.${String(index + 1).padStart(2, '0')}`,
              parent_code: `1.1.${group.code}`,
              level: 3,
              description: disc.disciplineName,
              path: ['1', '1.1', `1.1.${group.code}`, `1.1.${group.code}.${String(index + 1).padStart(2, '0')}`],
              sort_order: sortOrder++,
              children_count: this.COST_CATEGORIES.length,
              children: []
            }
            nodes.push(subDisciplineNode)
            groupNode.children!.push(subDisciplineNode)
            groupNode.children_count++

            // Add cost categories for this sub-discipline
            this.addCostCategories(subDisciplineNode, disc, nodes, sortOrder)
            sortOrder += this.COST_CATEGORIES.length * 10 // Reserve space for line items
          })
        } else {
          // For standalone disciplines, add cost categories directly
          const disc = groupDisciplines[0] // Should only be one
          if (disc) {
            this.addCostCategories(groupNode, disc, nodes, sortOrder)
            groupNode.children_count = this.COST_CATEGORIES.length
            sortOrder += this.COST_CATEGORIES.length * 10 // Reserve space for line items
          }
        }
      }
    })

    return nodes
  }

  private addCostCategories(
    parentNode: WBSNode,
    discipline: BudgetDiscipline,
    allNodes: WBSNode[],
    startSortOrder: number
  ): void {
    this.COST_CATEGORIES.forEach((category, index) => {
      const categoryNode: WBSNode = {
        code: `${parentNode.code}.${category.code}`,
        parent_code: parentNode.code,
        level: 4,
        description: category.name,
        cost_type: category.type,
        path: [...parentNode.path, `${parentNode.code}.${category.code}`],
        sort_order: startSortOrder + index,
        children_count: 0,
        children: []
      }

      // Set budget based on category
      switch (category.type) {
        case 'DL':
          categoryNode.budget_total = discipline.categories.DIRECT_LABOR.value
          break
        case 'IL':
          // Include ADD ONS in indirect labor
          categoryNode.budget_total = discipline.categories.INDIRECT_LABOR.value + 
                                     discipline.categories.ADD_ONS.value
          break
        case 'MAT':
          categoryNode.budget_total = discipline.categories.MATERIALS.value
          break
        case 'EQ':
          categoryNode.budget_total = discipline.categories.EQUIPMENT.value
          break
        case 'SUB':
          categoryNode.budget_total = discipline.categories.SUBCONTRACTS.value
          break
      }

      allNodes.push(categoryNode)
      if (parentNode.children) {
        parentNode.children.push(categoryNode)
      }
    })
  }

  /**
   * Find or create WBS code for a specific item
   */
  getWBSCodeForItem(
    disciplineName: string,
    costType: 'DL' | 'IL' | 'MAT' | 'EQ' | 'SUB',
    laborCategoryCode?: string
  ): string {
    const groupCode = this.DISCIPLINE_TO_GROUP[disciplineName.toUpperCase()] || '99'
    const costCategoryCode = this.COST_CATEGORIES.find(c => c.type === costType)?.code || '99'
    
    // Base code: 1.1.GROUP.COST_CATEGORY
    let wbsCode = `1.1.${groupCode}.${costCategoryCode}`
    
    // For labor categories, add the specific code as level 5
    if (laborCategoryCode && (costType === 'DL' || costType === 'IL')) {
      const numericPart = laborCategoryCode.replace(/[DL|IL]/g, '')
      wbsCode += `.${numericPart}`
    }
    
    return wbsCode
  }

  /**
   * Create Level 5 line items for labor categories
   */
  createLaborLineItems(
    parentCode: string,
    costType: 'DL' | 'IL',
    laborCategories: Array<{ code: string; name: string; rate?: number }>,
    startSortOrder: number
  ): WBSNode[] {
    const nodes: WBSNode[] = []
    
    laborCategories.forEach((category, index) => {
      const numericCode = category.code.replace(/[DL|IL]/g, '')
      const lineItemNode: WBSNode = {
        code: `${parentCode}.${numericCode}`,
        parent_code: parentCode,
        level: 5,
        description: category.name,
        cost_type: costType,
        labor_category_id: category.code,
        path: parentCode.split('.').concat([`${parentCode}.${numericCode}`]),
        sort_order: startSortOrder + index,
        children_count: 0
      }
      nodes.push(lineItemNode)
    })
    
    return nodes
  }

  /**
   * Create Level 5 line items for materials
   */
  createMaterialLineItems(
    parentCode: string,
    startSortOrder: number
  ): WBSNode[] {
    const materialTypes = [
      { code: '01', name: 'Materials - Taxed' },
      { code: '02', name: 'Materials - Taxes' },
      { code: '03', name: 'Materials - Non-Taxed' }
    ]
    
    return materialTypes.map((type, index) => ({
      code: `${parentCode}.${type.code}`,
      parent_code: parentCode,
      level: 5,
      description: type.name,
      cost_type: 'MAT' as const,
      path: parentCode.split('.').concat([`${parentCode}.${type.code}`]),
      sort_order: startSortOrder + index,
      children_count: 0
    }))
  }
}