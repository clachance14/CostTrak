import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { ExcelBudgetTestAnalyzer } from '../excel-budget-test-analyzer'
import { ExcelBudgetAnalyzer } from '../excel-budget-analyzer'

// Mock the admin client
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [
            {
              sheet_name: 'DIRECTS',
              category: 'LABOR',
              subcategory: 'DIRECT',
              column_mappings: { wbs_code: 0, description: 1, total_cost: 6 },
              is_active: true
            }
          ]
        }))
      }))
    }))
  }))
}))

describe('ExcelBudgetTestAnalyzer', () => {
  let analyzer: ExcelBudgetTestAnalyzer
  let mockWorkbook: XLSX.WorkBook

  beforeEach(() => {
    analyzer = new ExcelBudgetTestAnalyzer()
    
    // Create a mock workbook with test data
    const ws = XLSX.utils.aoa_to_sheet([
      ['WBS Code', 'Description', 'Quantity', 'Unit', 'Rate', 'Hours', 'Total Cost'],
      ['01-100', 'Site Preparation', 100, 'EA', 50, 200, 5000],
      ['01-200', 'Foundation Work', 200, 'CY', 150, 400, 30000],
      ['', '', '', '', '', '', ''],
      ['Total', '', '', '', '', '', 35000]
    ])
    
    mockWorkbook = {
      SheetNames: ['DIRECTS'],
      Sheets: {
        'DIRECTS': ws
      }
    }
  })

  describe('Extended functionality', () => {
    it('should extend ExcelBudgetAnalyzer', () => {
      expect(analyzer).toBeInstanceOf(ExcelBudgetAnalyzer)
    })

    it('should expose detected headers via getDetectedHeaders()', async () => {
      await analyzer.analyzeWorkbook(mockWorkbook)
      const headers = analyzer.getDetectedHeaders()
      
      expect(headers).toHaveProperty('DIRECTS')
      expect(headers.DIRECTS).toEqual({
        headerRow: 0,
        columns: expect.objectContaining({
          wbs: { index: 0, headerText: 'WBS Code', confidence: expect.any(Number) },
          description: { index: 1, headerText: 'Description', confidence: expect.any(Number) },
          quantity: { index: 2, headerText: 'Quantity', confidence: expect.any(Number) },
          unit: { index: 3, headerText: 'Unit', confidence: expect.any(Number) },
          rate: { index: 4, headerText: 'Rate', confidence: expect.any(Number) },
          hours: { index: 5, headerText: 'Hours', confidence: expect.any(Number) },
          total: { index: 6, headerText: 'Total Cost', confidence: expect.any(Number) }
        })
      })
    })

    it('should return raw sheet data with getRawSheetData()', async () => {
      await analyzer.analyzeWorkbook(mockWorkbook)
      const rawData = analyzer.getRawSheetData()
      
      expect(rawData).toHaveProperty('DIRECTS')
      expect(rawData.DIRECTS).toEqual({
        headers: ['WBS Code', 'Description', 'Quantity', 'Unit', 'Rate', 'Hours', 'Total Cost'],
        rows: expect.arrayContaining([
          ['01-100', 'Site Preparation', 100, 'EA', 50, 200, 5000],
          ['01-200', 'Foundation Work', 200, 'CY', 150, 400, 30000]
        ]),
        totalRows: expect.any(Number)
      })
    })

    it('should provide column mappings via getColumnMappings()', async () => {
      await analyzer.analyzeWorkbook(mockWorkbook)
      const mappings = analyzer.getColumnMappings()
      
      expect(mappings).toHaveProperty('DIRECTS')
      expect(mappings.DIRECTS).toEqual({
        wbs: 0,
        description: 1,
        quantity: 2,
        unit: 3,
        rate: 4,
        hours: 5,
        total: 6
      })
    })

    it('should generate transformation logs', async () => {
      await analyzer.analyzeWorkbook(mockWorkbook)
      const logs = analyzer.getTransformationLog()
      
      expect(logs).toBeInstanceOf(Array)
      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0]).toHaveProperty('step')
      expect(logs[0]).toHaveProperty('description')
      expect(logs[0]).toHaveProperty('timestamp')
      expect(logs[0]).toHaveProperty('data')
    })
  })

  describe('Custom mapping functionality', () => {
    it('should apply custom column mappings', async () => {
      const customMappings = {
        'DIRECTS': {
          wbs: 1,
          description: 0,
          total: 6
        }
      }
      
      const result = await analyzer.analyzeWithCustomMappings(mockWorkbook, customMappings)
      
      expect(result.details.DIRECTS[0]).toMatchObject({
        wbs_code: 'Site Preparation', // Now using column 1
        description: '01-100', // Now using column 0
        total_cost: 5000
      })
    })

    it('should validate custom mappings against sheet structure', () => {
      const validMappings = {
        wbs: 0,
        description: 1,
        total: 6
      }
      
      const invalidMappings = {
        wbs: 10, // Invalid column index
        description: 1,
        total: 6
      }
      
      expect(analyzer.validateMapping('DIRECTS', validMappings, 7)).toEqual({
        valid: true,
        issues: []
      })
      
      expect(analyzer.validateMapping('DIRECTS', invalidMappings, 7)).toEqual({
        valid: false,
        issues: expect.arrayContaining([
          expect.stringContaining('wbs')
        ])
      })
    })
  })

  describe('Analysis without database operations', () => {
    it('should perform analysis without saving to database', async () => {
      const result = await analyzer.analyzeWithoutSaving(mockWorkbook)
      
      expect(result).toHaveProperty('budgetData')
      expect(result).toHaveProperty('validation')
      expect(result).toHaveProperty('detectedHeaders')
      expect(result).toHaveProperty('rawData')
      expect(result).toHaveProperty('transformationLog')
      expect(result).not.toHaveProperty('saved')
    })

    it('should include debugging information in analysis result', async () => {
      const result = await analyzer.analyzeWithoutSaving(mockWorkbook, {
        includeRawData: true,
        includeTransformationLog: true
      })
      
      expect(result.rawData).toBeDefined()
      expect(result.transformationLog).toBeDefined()
      expect(result.transformationLog.length).toBeGreaterThan(0)
    })
  })

  describe('Error handling', () => {
    it('should handle empty workbooks gracefully', async () => {
      const emptyWorkbook = {
        SheetNames: [],
        Sheets: {}
      }
      
      const result = await analyzer.analyzeWithoutSaving(emptyWorkbook)
      
      expect(result.validation.errors).toContain('No sheets found in workbook')
    })

    it('should handle malformed sheet data', async () => {
      const malformedWs = XLSX.utils.aoa_to_sheet([
        [null, undefined, '', NaN],
        ['', '', '', '']
      ])
      
      const malformedWorkbook = {
        SheetNames: ['BAD_SHEET'],
        Sheets: { 'BAD_SHEET': malformedWs }
      }
      
      const result = await analyzer.analyzeWithoutSaving(malformedWorkbook)
      
      expect(result.validation.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      // Create a large dataset
      const largeData = [
        ['WBS Code', 'Description', 'Total Cost']
      ]
      
      for (let i = 1; i <= 10000; i++) {
        largeData.push([`01-${i}`, `Item ${i}`, i * 100])
      }
      
      const largeWs = XLSX.utils.aoa_to_sheet(largeData)
      const largeWorkbook = {
        SheetNames: ['LARGE'],
        Sheets: { 'LARGE': largeWs }
      }
      
      const startTime = Date.now()
      await analyzer.analyzeWithoutSaving(largeWorkbook)
      const endTime = Date.now()
      
      expect(endTime - startTime).toBeLessThan(5000) // Should complete in under 5 seconds
    })
  })
})