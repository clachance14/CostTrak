import * as XLSX from 'xlsx'
import { DisciplineMapper, ProjectDisciplines } from './discipline-mapper'

export interface InputSheetData {
  rawData: any[][]
  headers: string[]
  disciplines: string[]
  projectDisciplines: ProjectDisciplines
  wbsStructure: WBSNode[]
  hasData: boolean
}

export interface WBSNode {
  code: string
  parent_code?: string
  level: number
  description: string
  discipline?: string
  children: WBSNode[]
  budget_total: number
  manhours_total?: number
  material_cost?: number
}


export class InputSheetAnalyzer {
  /**
   * Build WBS structure from disciplines
   */
  private buildWBSFromDisciplines(projectDisciplines: ProjectDisciplines): WBSNode[] {
    const wbsNodes: WBSNode[] = []
    let codeCounter = 1
    
    // Create WBS nodes for each discipline group
    Object.entries(projectDisciplines.disciplineGroups).forEach(([groupName, mapping]) => {
      const parentCode = String(codeCounter).padStart(2, '0')
      const parentNode: WBSNode = {
        code: parentCode,
        parent_code: undefined,
        level: 1,
        description: groupName.toUpperCase(),
        discipline: groupName,
        children: [],
        budget_total: 0,
        manhours_total: 0,
        material_cost: 0
      }
      
      // Add child nodes for each discipline in the group
      let childCounter = 1
      mapping.childDisciplines.forEach(childDiscipline => {
        const childCode = `${parentCode}.${String(childCounter).padStart(2, '0')}`
        
        const childNode: WBSNode = {
          code: childCode,
          parent_code: parentCode,
          level: 2,
          description: childDiscipline,
          discipline: groupName,
          children: [],
          budget_total: 0,
          manhours_total: 0,
          material_cost: 0
        }
        
        parentNode.children.push(childNode)
        childCounter++
      })
      
      wbsNodes.push(parentNode)
      codeCounter++
    })
    
    return wbsNodes
  }
  
  /**
   * Process raw data from the INPUT sheet (when workbook is not available)
   */
  processRawData(rawSheetData: any, allSheetNames: string[]): InputSheetData | null {
    console.log('InputSheetAnalyzer.processRawData called with:', rawSheetData)
    
    if (!rawSheetData || !rawSheetData.rows || rawSheetData.rows.length === 0) {
      console.log('No raw data found')
      return null
    }
    
    // Use headers and rows from raw data
    const headers = rawSheetData.headers || []
    const rawData = rawSheetData.rows
    
    console.log('Headers:', headers)
    console.log('Raw data length:', rawData.length)
    console.log('First 3 rows of raw data:', rawData.slice(0, 3))
    
    // Extract disciplines from columns AG/AH (now includes only disciplines with flag=1)
    const disciplines = DisciplineMapper.extractDisciplinesFromInput(rawData)
    
    console.log('Included disciplines from INPUT sheet:', disciplines)
    
    // Create discipline mapping
    const projectDisciplines = DisciplineMapper.createDisciplineMapping(disciplines)
    
    // Build WBS structure from disciplines
    const wbsStructure = this.buildWBSFromDisciplines(projectDisciplines)
    
    // Initialize result
    const result: InputSheetData = {
      rawData,
      headers,
      disciplines,
      projectDisciplines,
      wbsStructure,
      hasData: disciplines.length > 0
    }
    
    return result
  }
  /**
   * Extract all data from the INPUT sheet
   */
  extractInputSheetData(workbook: XLSX.WorkBook): InputSheetData | null {
    // Find the INPUT sheet (case-insensitive)
    const inputSheetName = workbook.SheetNames.find(name => 
      name.toUpperCase() === 'INPUT' || name.toUpperCase() === 'INPUTS'
    )
    
    if (!inputSheetName) {
      console.log('No INPUT sheet found in workbook')
      return null
    }
    
    const worksheet = workbook.Sheets[inputSheetName]
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
    
    // Extract headers (first row with multiple non-empty cells)
    const headers = this.extractHeaders(rawData)
    
    // Extract disciplines from columns AG/AH (now includes only disciplines with flag=1)
    const disciplines = DisciplineMapper.extractDisciplinesFromInput(rawData)
    
    console.log('Included disciplines from INPUT sheet:', disciplines)
    
    // Create discipline mapping
    const projectDisciplines = DisciplineMapper.createDisciplineMapping(disciplines)
    
    // Build WBS structure from disciplines
    const wbsStructure = this.buildWBSFromDisciplines(projectDisciplines)
    
    // Initialize result
    const result: InputSheetData = {
      rawData,
      headers,
      disciplines,
      projectDisciplines,
      wbsStructure,
      hasData: disciplines.length > 0
    }
    
    return result
  }
  
  
  private extractHeaders(data: any[][]): string[] {
    // First row is typically headers in INPUT sheet
    if (data.length > 0 && data[0]) {
      return data[0].map(cell => String(cell || ''))
    }
    return []
  }
}