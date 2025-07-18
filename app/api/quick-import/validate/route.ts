import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const importType = formData.get('importType') as string

    if (!file || !importType) {
      return NextResponse.json(
        { error: 'File and import type are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate file type
    const fileName = file.name.toLowerCase()
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')
    const isCsv = fileName.endsWith('.csv')

    if (!isExcel && !isCsv) {
      return NextResponse.json({
        valid: false,
        errors: ['File must be Excel (.xlsx, .xls) or CSV (.csv) format']
      })
    }

    // Read and analyze file structure
    let headers: string[] = []
    let sampleData: any[] = []
    const errors: string[] = []
    const warnings: string[] = []

    if (isExcel) {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      
      if (data.length > 0) {
        headers = (data[0] as any[]).map(h => String(h).trim())
        sampleData = data.slice(1, 6) // Get first 5 data rows
      }
    } else {
      // CSV
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length > 0) {
        headers = lines[0].split(',').map(h => h.trim())
        sampleData = lines.slice(1, 6).map(line => 
          line.split(',').map(v => v.trim())
        )
      }
    }

    // Validate based on import type
    if (importType === 'labor') {
      // Required fields for labor import
      const requiredFields = ['week ending', 'hours', 'cost']
      const optionalFields = ['employee', 'craft', 'craft type']
      
      const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
      
      requiredFields.forEach(field => {
        const normalized = field.replace(/[^a-z0-9]/g, '')
        if (!normalizedHeaders.some(h => h.includes(normalized))) {
          errors.push(`Missing required field: ${field}`)
        }
      })

      optionalFields.forEach(field => {
        const normalized = field.replace(/[^a-z0-9]/g, '')
        if (!normalizedHeaders.some(h => h.includes(normalized))) {
          warnings.push(`Missing optional field: ${field} (will use defaults)`)
        }
      })

      // Check for valid date format in week ending
      if (sampleData.length > 0) {
        const weekEndingIndex = normalizedHeaders.findIndex(h => h.includes('weekending'))
        if (weekEndingIndex >= 0) {
          const sampleDate = sampleData[0][weekEndingIndex]
          if (sampleDate && isNaN(Date.parse(String(sampleDate)))) {
            warnings.push('Week ending dates may need reformatting')
          }
        }
      }
    } else if (importType === 'po') {
      // Required fields for PO import
      const requiredFields = ['po number', 'vendor', 'amount']
      const optionalFields = ['description', 'scope', 'order date']
      
      const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
      
      requiredFields.forEach(field => {
        const normalized = field.replace(/[^a-z0-9]/g, '')
        if (!normalizedHeaders.some(h => h.includes(normalized))) {
          // Special handling for common variations
          if (field === 'po number' && !normalizedHeaders.some(h => h === 'po' || h === 'ponumber')) {
            errors.push(`Missing required field: ${field}`)
          } else if (field === 'amount' && !normalizedHeaders.some(h => h.includes('total') || h.includes('value'))) {
            errors.push(`Missing required field: ${field}`)
          } else if (field === 'vendor' && !normalizedHeaders.some(h => h.includes('vendor'))) {
            errors.push(`Missing required field: ${field}`)
          }
        }
      })

      // Check for numeric amounts
      if (sampleData.length > 0) {
        const amountIndex = normalizedHeaders.findIndex(h => 
          h.includes('amount') || h.includes('total') || h.includes('value')
        )
        if (amountIndex >= 0) {
          const invalidAmounts = sampleData.filter(row => {
            const amount = row[amountIndex]
            return amount && isNaN(parseFloat(String(amount).replace(/[$,]/g, '')))
          })
          if (invalidAmounts.length > 0) {
            warnings.push('Some amount values may need cleaning (remove $ and commas)')
          }
        }
      }
    }

    // General validation
    if (headers.length === 0) {
      errors.push('No headers found in file')
    }
    
    if (sampleData.length === 0) {
      errors.push('No data rows found in file')
    }

    const validation = {
      valid: errors.length === 0,
      errors,
      warnings,
      file_info: {
        name: file.name,
        size: file.size,
        type: isExcel ? 'excel' : 'csv',
        rows: sampleData.length,
        columns: headers.length
      },
      headers,
      sample_data: sampleData.slice(0, 3) // Return first 3 rows as sample
    }

    return NextResponse.json(validation)
  } catch (error: any) {
    console.error('Error validating file:', error)
    return NextResponse.json(
      { 
        valid: false,
        errors: [error.message || 'Failed to validate file'],
        warnings: [],
        file_info: null,
        headers: [],
        sample_data: []
      },
      { status: 500 }
    )
  }
}