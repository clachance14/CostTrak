export interface DisciplineMapping {
  parentDiscipline: string
  childDisciplines: string[]
  includesDemos: boolean
}

export interface ProjectDisciplines {
  allDisciplines: string[]
  disciplineGroups: Record<string, DisciplineMapping>
  disciplineToParent: Record<string, string>
}

export class DisciplineMapper {
  // Core parent disciplines that always get their own category
  private static readonly PARENT_DISCIPLINES = ['MECHANICAL', 'I&E', 'CIVIL']
  
  // Standard discipline mappings to parent categories
  private static readonly DISCIPLINE_RULES: Record<string, string> = {
    // Mechanical group
    'PIPING': 'Mechanical',
    'STEEL': 'Mechanical',
    'EQUIPMENT': 'Mechanical',
    'PIPING DEMO': 'Mechanical',
    'STEEL DEMO': 'Mechanical',
    'EQUIPMENT DEMO': 'Mechanical',
    
    // I&E group
    'INSTRUMENTATION': 'I&E',
    'ELECTRICAL': 'I&E',
    'INSTRUMENTATION DEMO': 'I&E',
    'ELECTRICAL DEMO': 'I&E',
    'I&E DEMO': 'I&E',
    'HYDRO-TESTING': 'I&E',
    
    // Civil group
    'CIVIL': 'Civil',
    'CIVIL DEMO': 'Civil',
    'CONCRETE': 'Civil',
    'CONCRETE DEMO': 'Civil',
    'GROUNDING': 'Civil',
    'GROUTING': 'Civil',
    'BUILDING-REMODELING': 'Civil',
    'BUILDING REMODELING': 'Civil',
    'CIVIL - GROUNDING': 'Civil',  // Handle this specific format
    
    // Standalone disciplines (keep as their own category)
    'FABRICATION': 'Fabrication',
    'MOBILIZATION': 'Mobilization',
    'CLEAN UP': 'Clean Up',
    
    // Note: Any discipline not listed here will be its own category
  }
  
  /**
   * Extract disciplines from INPUT sheet data
   * Reads from columns AG (included flag) and AH (discipline name)
   */
  static extractDisciplinesFromInput(inputSheetData: any[][]): string[] {
    const disciplines: string[] = []
    
    console.log('=== DisciplineMapper: INPUT Sheet Debug ===')
    console.log('Total rows:', inputSheetData.length)
    
    // Column indices (0-based)
    const INCLUDED_COL = 32  // Column AG (32nd column, 0-based)
    const DISCIPLINE_COL = 33 // Column AH (33rd column, 0-based)
    
    // Find where the discipline list starts by looking for the header or pattern
    let startRow = -1
    for (let i = 0; i < inputSheetData.length; i++) {
      const row = inputSheetData[i]
      if (row && row.length > DISCIPLINE_COL) {
        const disciplineValue = row[DISCIPLINE_COL]
        // Look for known disciplines to find the start
        if (disciplineValue && String(disciplineValue).toUpperCase().includes('FABRICATION')) {
          startRow = i
          break
        }
      }
    }
    
    if (startRow === -1) {
      console.warn('Could not find discipline list in INPUT sheet columns AG/AH')
      return []
    }
    
    console.log(`Found discipline list starting at row ${startRow}`)
    
    // Process discipline list
    for (let i = startRow; i < inputSheetData.length; i++) {
      const row = inputSheetData[i]
      if (!row || row.length <= DISCIPLINE_COL) continue
      
      const includedFlag = row[INCLUDED_COL]
      const disciplineName = row[DISCIPLINE_COL]
      
      // Stop if we hit empty cells
      if (!disciplineName || disciplineName === '') break
      
      // Check if discipline is included (1 = included, 0 = not included)
      if (includedFlag === 1 || includedFlag === '1') {
        const discipline = String(disciplineName).trim().toUpperCase()
        console.log(`Row ${i}: Included discipline: ${discipline}`)
        disciplines.push(discipline)
      } else {
        console.log(`Row ${i}: Excluded discipline: ${disciplineName} (flag: ${includedFlag})`)
      }
    }
    
    console.log('=== Final disciplines extracted:', disciplines)
    console.log('=== Total count:', disciplines.length)
    return disciplines
  }
  
  /**
   * Create discipline mapping from list of disciplines
   */
  static createDisciplineMapping(disciplines: string[], skipUnmapped: boolean = false): ProjectDisciplines {
    const disciplineGroups: Record<string, DisciplineMapping> = {}
    const disciplineToParent: Record<string, string> = {}
    
    // Initialize parent groups
    const parentGroups = new Set<string>()
    
    // Map each discipline to its parent
    disciplines.forEach(disc => {
      const parent = this.DISCIPLINE_RULES[disc]
      
      if (parent) {
        // Discipline has a parent mapping
        parentGroups.add(parent)
        disciplineToParent[disc] = parent
      } else {
        // Discipline becomes its own parent (standalone)
        const standaloneName = this.formatDisciplineName(disc)
        parentGroups.add(standaloneName)
        disciplineToParent[disc] = standaloneName
        
        // Create a standalone group with just this discipline
        disciplineGroups[standaloneName] = {
          parentDiscipline: standaloneName,
          childDisciplines: [disc],
          includesDemos: disc.includes('DEMO')
        }
      }
    })
    
    // Build discipline groups for mapped disciplines
    parentGroups.forEach(parent => {
      // Skip if already created as standalone
      if (disciplineGroups[parent]) return
      
      const children = disciplines.filter(disc => disciplineToParent[disc] === parent)
      const hasDemos = children.some(child => child.includes('DEMO'))
      
      disciplineGroups[parent] = {
        parentDiscipline: parent,
        childDisciplines: children,
        includesDemos: hasDemos
      }
    })
    
    return {
      allDisciplines: disciplines,
      disciplineGroups,
      disciplineToParent
    }
  }
  
  /**
   * Get parent discipline for a given discipline name
   */
  static getParentDiscipline(discipline: string): string | undefined {
    const upperDisc = discipline.toUpperCase().trim()
    return this.DISCIPLINE_RULES[upperDisc]
  }
  
  /**
   * Check if a discipline is valid (has a mapping)
   */
  static isValidDiscipline(discipline: string): boolean {
    const upperDisc = discipline.toUpperCase().trim()
    return upperDisc in this.DISCIPLINE_RULES
  }
  
  /**
   * Check if a discipline is a demo
   */
  static isDemo(discipline: string): boolean {
    return discipline.toUpperCase().includes('DEMO')
  }
  
  /**
   * Format discipline display name
   */
  static formatDisciplineName(discipline: string): string {
    // Convert to title case and handle special cases
    const formatted = discipline
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/I&e/g, 'I&E')
      .replace(/Demo/g, 'Demo')
      
    return formatted
  }
  
  /**
   * Get discipline summary for display
   */
  static getDisciplineSummary(projectDisciplines: ProjectDisciplines): string[] {
    const summary: string[] = []
    
    Object.entries(projectDisciplines.disciplineGroups).forEach(([parent, group]) => {
      const childList = group.childDisciplines
        .map(child => this.formatDisciplineName(child))
        .join(', ')
      
      summary.push(`${parent}: ${childList}`)
    })
    
    return summary
  }
}