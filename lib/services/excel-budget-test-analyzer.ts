import * as XLSX from 'xlsx'
import { ExcelBudgetAnalyzer, SheetStructure, BudgetLineItem, WBSNode, ExcelBudgetData } from './excel-budget-analyzer'

export interface HeaderDetectionResult {
  [sheetName: string]: {
    headerRow: number
    columns: {
      [field: string]: {
        index: number
        headerText: string
        confidence: number
      }
    }
  }
}

export interface RawSheetData {
  headers: string[]
  rows: any[][]
  totalRows: number
}

export interface TransformationStep {
  step: string
  description: string
  timestamp: number
  data?: any
}

export interface CustomColumnMapping {
  [field: string]: number
}

export interface CustomMappings {
  [sheetName: string]: CustomColumnMapping
}

export interface AnalysisOptions {
  includeRawData?: boolean
  includeTransformationLog?: boolean
  validateOnly?: boolean
}

export interface TestAnalysisResult {
  budgetData: ExcelBudgetData
  validation: {
    errors: string[]
    warnings: string[]
    info: string[]
  }
  detectedHeaders: HeaderDetectionResult
  rawData?: { [sheetName: string]: RawSheetData }
  transformationLog?: TransformationStep[]
  appliedMappings: { [sheetName: string]: CustomColumnMapping }
  workbook?: XLSX.WorkBook
  budgetsSheetDisciplines?: any[]
  budgetsSheetRawData?: any[]
}

export interface ValidationResult {
  valid: boolean
  issues: string[]
}

export class ExcelBudgetTestAnalyzer extends ExcelBudgetAnalyzer {
  private detectedHeaders: HeaderDetectionResult = {}
  private rawSheetData: { [sheetName: string]: RawSheetData } = {}
  private columnMappings: { [sheetName: string]: CustomColumnMapping } = {}
  private transformationLog: TransformationStep[] = []
  private customMappings: CustomMappings | null = null
  private budgetsSheetDisciplines: any[] = []
  private budgetsSheetRawData: any[] = []

  constructor(disciplineMapping?: Record<string, string>, predefinedWBS?: any[]) {
    super(disciplineMapping, predefinedWBS)
  }

  private logTransformation(step: string, description: string, data?: any) {
    this.transformationLog.push({
      step,
      description,
      timestamp: Date.now(),
      data
    })
  }

  /**
   * Analyze workbook and store internal details for debugging
   */
  async analyzeWorkbook(workbook: XLSX.WorkBook): Promise<void> {
    this.resetInternalState()
    this.logTransformation('start', 'Beginning workbook analysis', { 
      sheets: workbook.SheetNames,
      allowedSheets: this.ALLOWED_SHEETS 
    })

    // Always analyze BUDGETS sheet first for disciplines
    if (workbook.Sheets['BUDGETS']) {
      await this.analyzeBudgetsSheet(workbook.Sheets['BUDGETS'])
    }

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      
      // Skip BUDGETS sheet as it's already analyzed
      if (sheetName === 'BUDGETS') {
        continue
      }
      
      // Always analyze INPUT sheet for special handling (deprecated but kept for compatibility)
      if (sheetName.toUpperCase() === 'INPUT' || sheetName.toUpperCase() === 'INPUTS') {
        await this.analyzeSheet(sheetName, worksheet)
        continue
      }
      
      // Only analyze allowed sheets for budget data
      if (!this.ALLOWED_SHEETS.includes(sheetName)) {
        this.logTransformation('skip_sheet', `Skipping non-allowed sheet: ${sheetName}`)
        continue
      }
      
      await this.analyzeSheet(sheetName, worksheet)
    }

    this.logTransformation('complete', 'Workbook analysis complete')
  }

  private resetInternalState() {
    this.detectedHeaders = {}
    this.rawSheetData = {}
    this.columnMappings = {}
    this.transformationLog = []
    this.budgetsSheetDisciplines = []
    this.budgetsSheetRawData = []
  }

  /**
   * Analyze BUDGETS sheet for disciplines and cost types
   */
  private async analyzeBudgetsSheet(worksheet: XLSX.WorkSheet) {
    this.logTransformation('budgets_sheet_start', 'Analyzing BUDGETS sheet for disciplines')
    
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    this.budgetsSheetRawData = data
    
    // Store raw data for debugging
    this.rawSheetData['BUDGETS'] = {
      headers: data[0] ? data[0].map(h => String(h || '')) : [],
      rows: data,
      totalRows: data.length
    }
    
    // Extract disciplines using the 12-row block structure
    const disciplines = this.extractBudgetSheetDisciplines({ Sheets: { BUDGETS: worksheet }, SheetNames: ['BUDGETS'] })
    this.budgetsSheetDisciplines = disciplines
    
    this.logTransformation('budgets_sheet_disciplines', 'Extracted disciplines from BUDGETS sheet', {
      count: disciplines.length,
      disciplines: disciplines.map(d => ({
        name: d.discipline,
        manhours: d.manhours,
        value: d.value,
        categories: Object.keys(d.categories)
      }))
    })
    
    // Log detailed cost type extraction
    disciplines.forEach(disc => {
      Object.entries(disc.categories).forEach(([category, data]: [string, any]) => {
        if (data.value > 0) {
          this.logTransformation('cost_type_found', `Found ${category} for ${disc.discipline}`, {
            discipline: disc.discipline,
            costType: category,
            manhours: data.manhours,
            value: data.value,
            percentage: data.percentage
          })
        }
      })
    })
    
    this.logTransformation('budgets_sheet_complete', `BUDGETS sheet analysis complete: ${disciplines.length} disciplines found`)
  }

  private async analyzeSheet(sheetName: string, worksheet: XLSX.WorkSheet) {
    this.logTransformation('sheet_start', `Analyzing sheet: ${sheetName}`)

    // Get raw data
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]
    
    // Special handling for INPUT sheet - just store all data
    if (sheetName.toUpperCase() === 'INPUT' || sheetName.toUpperCase() === 'INPUTS') {
      this.rawSheetData[sheetName] = {
        headers: data[0] ? data[0].map(h => String(h || '')) : [],
        rows: data,
        totalRows: data.length
      }
      this.logTransformation('sheet_complete', `INPUT sheet stored with ${data.length} rows`)
      return
    }
    
    // Detect structure for other sheets
    const structure = this.detectSheetStructure(worksheet)
    
    // Store detected headers with confidence scores
    if (structure.headerRow >= 0 && data[structure.headerRow]) {
      const headerRow = data[structure.headerRow] as any[]
      const headers: { [field: string]: { index: number; headerText: string; confidence: number } } = {}
      
      Object.entries(structure.dataColumns).forEach(([field, index]) => {
        if (index !== undefined && headerRow[index] !== undefined) {
          headers[field] = {
            index,
            headerText: String(headerRow[index] || ''),
            confidence: this.calculateConfidence(field, String(headerRow[index] || ''))
          }
        }
      })
      
      this.detectedHeaders[sheetName] = {
        headerRow: structure.headerRow,
        columns: headers
      }
    }

    // Store raw data
    if (structure.headerRow >= 0) {
      const headers = data[structure.headerRow] as any[] || []
      const dataRows = data.slice(structure.dataStartRow, structure.dataEndRow + 1)
        .filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
      
      this.rawSheetData[sheetName] = {
        headers: headers.map(h => String(h || '')),
        rows: dataRows,
        totalRows: dataRows.length
      }
    } else {
      // No header row found, still store raw data
      this.rawSheetData[sheetName] = {
        headers: [],
        rows: data.filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== '')),
        totalRows: data.length
      }
    }

    // Store column mappings
    const mappings: CustomColumnMapping = {}
    Object.entries(structure.dataColumns).forEach(([field, index]) => {
      if (index !== undefined) {
        mappings[field] = index
      }
    })
    this.columnMappings[sheetName] = mappings

    this.logTransformation('sheet_complete', `Sheet ${sheetName} analysis complete`, {
      headerRow: structure.headerRow,
      dataRows: this.rawSheetData[sheetName]?.totalRows || 0,
      mappedColumns: Object.keys(mappings).length
    })
  }

  private calculateConfidence(field: string, headerText: string): number {
    const text = headerText.toLowerCase().trim()
    const fieldPatterns: Record<string, string[]> = {
      wbs: ['wbs', 'code', 'item'],
      description: ['description', 'desc', 'item', 'scope'],
      quantity: ['qty', 'quantity', 'quant'],
      unit: ['unit', 'um', 'measure'],
      rate: ['rate', 'price', 'cost'],
      hours: ['hours', 'hrs', 'manhours'],
      total: ['total', 'amount', 'extended']
    }
    
    const patterns = fieldPatterns[field] || []
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        return text === pattern ? 1.0 : 0.8
      }
    }
    
    return 0.3
  }

  /**
   * Get detected headers from last analysis
   */
  getDetectedHeaders(): HeaderDetectionResult {
    return this.detectedHeaders
  }

  /**
   * Get raw sheet data from last analysis
   */
  getRawSheetData(): { [sheetName: string]: RawSheetData } {
    return this.rawSheetData
  }

  /**
   * Get column mappings from last analysis
   */
  getColumnMappings(): { [sheetName: string]: CustomColumnMapping } {
    return this.columnMappings
  }

  /**
   * Get transformation log from last analysis
   */
  getTransformationLog(): TransformationStep[] {
    return this.transformationLog
  }

  /**
   * Get BUDGETS sheet disciplines from last analysis
   */
  getBudgetsSheetDisciplines(): any[] {
    return this.budgetsSheetDisciplines
  }

  /**
   * Get BUDGETS sheet raw data
   */
  getBudgetsSheetRawData(): any[] {
    return this.budgetsSheetRawData
  }

  /**
   * Analyze with custom column mappings
   */
  async analyzeWithCustomMappings(
    workbook: XLSX.WorkBook,
    customMappings: CustomMappings
  ): Promise<ExcelBudgetData> {
    this.customMappings = customMappings
    this.logTransformation('custom_mappings', 'Applying custom column mappings', customMappings)
    
    // Store original methods
    const originalDetectMethod = this.detectSheetStructure.bind(this)
    const originalExtractWBSCode = this.extractWBSCode.bind(this)
    
    // Override detectSheetStructure to use custom mappings
    this.detectSheetStructure = (worksheet: XLSX.WorkSheet) => {
      const structure = originalDetectMethod(worksheet)
      const sheetName = this.getCurrentSheetName(workbook, worksheet)
      
      if (sheetName && customMappings[sheetName]) {
        // Replace the dataColumns entirely with custom mappings
        structure.dataColumns = customMappings[sheetName]
        this.logTransformation('apply_custom_mapping', `Applied custom mapping for ${sheetName}`, customMappings[sheetName])
      }
      
      return structure
    }
    
    // Override extractWBSCode to handle non-standard WBS columns
    this.extractWBSCode = (value: unknown): string | undefined => {
      if (!value) return undefined
      const str = String(value).trim()
      
      // First try the standard WBS pattern
      const wbsMatch = str.match(/^\d{2,3}[-\.]\d{2,3}([-\.]\d{2,3})?/)
      if (wbsMatch) return wbsMatch[0]
      
      // If no standard pattern found and we're using custom mappings,
      // just return the raw value (for testing where description might be mapped to WBS)
      if (this.customMappings) {
        return str
      }
      
      return undefined
    }
    
    const result = await this.extractBudgetData(workbook)
    
    // Restore original methods
    this.detectSheetStructure = originalDetectMethod
    this.extractWBSCode = originalExtractWBSCode
    this.customMappings = null
    
    return result
  }

  private getCurrentSheetName(workbook: XLSX.WorkBook, worksheet: XLSX.WorkSheet): string | undefined {
    for (const [name, sheet] of Object.entries(workbook.Sheets)) {
      if (sheet === worksheet) return name
    }
    return undefined
  }

  /**
   * Validate mapping against sheet structure
   */
  validateMapping(
    sheetName: string,
    mapping: CustomColumnMapping,
    maxColumnIndex: number
  ): ValidationResult {
    const issues: string[] = []
    
    Object.entries(mapping).forEach(([field, index]) => {
      if (index < 0 || index >= maxColumnIndex) {
        issues.push(`Field '${field}' mapped to invalid column index ${index}`)
      }
    })
    
    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Analyze without saving to database
   */
  async analyzeWithoutSaving(
    workbook: XLSX.WorkBook,
    options: AnalysisOptions = {}
  ): Promise<TestAnalysisResult> {
    this.resetInternalState()
    
    // Perform analysis
    await this.analyzeWorkbook(workbook)
    
    let budgetData: ExcelBudgetData
    try {
      budgetData = await this.extractBudgetData(workbook)
    } catch (error) {
      // Handle errors gracefully
      budgetData = {
        summary: {},
        details: {},
        wbsStructure: [],
        totals: {
          labor: 0,
          material: 0,
          equipment: 0,
          subcontract: 0,
          other: 0,
          grand_total: 0
        },
        validation: {
          warnings: [],
          errors: [error instanceof Error ? error.message : 'Unknown error during extraction']
        }
      }
    }

    // Add BUDGETS sheet data to budgetData if available
    if (this.budgetsSheetDisciplines.length > 0) {
      budgetData.disciplineBudgets = this.budgetsSheetDisciplines
    }

    // Add additional validation
    const validation = {
      errors: [...budgetData.validation.errors],
      warnings: [...budgetData.validation.warnings],
      info: []
    }

    if (workbook.SheetNames.length === 0) {
      validation.errors.push('No sheets found in workbook')
    }

    // Check for malformed data
    for (const sheetName of Object.keys(this.rawSheetData)) {
      const sheetData = this.rawSheetData[sheetName]
      if (sheetData.totalRows === 0) {
        validation.warnings.push(`Sheet '${sheetName}' has no data rows`)
      }
      // Check if headers are empty or malformed
      if (sheetData.headers.length === 0 || sheetData.headers.every(h => !h)) {
        validation.warnings.push(`Sheet '${sheetName}' has no valid headers`)
      }
    }
    
    // Add warnings for sheets without mappings
    for (const sheetName of workbook.SheetNames) {
      if (!this.ALLOWED_SHEETS.includes(sheetName)) {
        validation.info.push(`Sheet '${sheetName}' was skipped (not in allowed list)`)
      } else if (!this.sheetMappings[sheetName]) {
        validation.warnings.push(`No mapping configuration found for sheet '${sheetName}'`)
      }
    }
    
    // Check for missing required sheets
    const missingSheets = this.ALLOWED_SHEETS.filter(
      sheet => !workbook.SheetNames.includes(sheet)
    )
    if (missingSheets.length > 0) {
      validation.warnings.push(`Missing required sheets: ${missingSheets.join(', ')}`)
    }

    // Build result - always include rawData and transformationLog by default
    const result: TestAnalysisResult = {
      budgetData,
      validation,
      detectedHeaders: this.detectedHeaders,
      rawData: this.rawSheetData,
      transformationLog: this.transformationLog,
      appliedMappings: this.columnMappings,
      workbook,
      budgetsSheetDisciplines: this.budgetsSheetDisciplines,
      budgetsSheetRawData: this.budgetsSheetRawData
    }

    // Only exclude if explicitly set to false
    if (options.includeRawData === false) {
      delete result.rawData
    }

    if (options.includeTransformationLog === false) {
      delete result.transformationLog
    }

    return result
  }
}