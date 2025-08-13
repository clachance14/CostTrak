'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Settings, Save, RotateCcw, CircleAlert, CircleCheck } from 'lucide-react'

interface ColumnMapping {
  [field: string]: number
}

interface SheetMapping {
  sheet_name: string
  category: string
  subcategory?: string
  column_mappings: ColumnMapping
}

interface SheetMappingEditorProps {
  analysisResult: any
  onMappingChange?: (mappings: { [sheetName: string]: ColumnMapping }) => void
}

// Define field types for each category
const FIELD_DEFINITIONS: Record<string, { fields: string[], displayNames: Record<string, string> }> = {
  'LABOR/DIRECT': {
    fields: ['wbs_code', 'description', 'crew_size', 'duration', 'manhours', 'rate', 'total_cost'],
    displayNames: {
      wbs_code: 'WBS Code',
      description: 'Description',
      crew_size: 'Crew Size',
      duration: 'Duration (days)',
      manhours: 'Manhours',
      rate: 'Rate ($/hr)',
      total_cost: 'Total Cost'
    }
  },
  'LABOR/INDIRECT': {
    fields: ['wbs_code', 'description', 'quantity', 'duration', 'rate', 'total_cost'],
    displayNames: {
      wbs_code: 'WBS Code',
      description: 'Description',
      quantity: 'Quantity',
      duration: 'Duration (months)',
      rate: 'Rate ($/month)',
      total_cost: 'Total Cost'
    }
  },
  'LABOR/STAFF': {
    fields: ['wbs_code', 'position', 'quantity', 'duration', 'monthly_rate', 'total_cost'],
    displayNames: {
      wbs_code: 'WBS Code',
      position: 'Position/Title',
      quantity: 'Quantity (FTEs)',
      duration: 'Duration (months)',
      monthly_rate: 'Monthly Rate',
      total_cost: 'Total Cost'
    }
  },
  'MATERIAL': {
    fields: ['wbs_code', 'description', 'quantity', 'unit', 'unit_price', 'total_cost', 'supplier'],
    displayNames: {
      wbs_code: 'WBS Code',
      description: 'Material Description',
      quantity: 'Quantity',
      unit: 'Unit of Measure',
      unit_price: 'Unit Price',
      total_cost: 'Total Cost',
      supplier: 'Supplier'
    }
  },
  'EQUIPMENT': {
    fields: ['wbs_code', 'description', 'quantity', 'duration', 'rate', 'total_cost', 'owned_rented'],
    displayNames: {
      wbs_code: 'WBS Code',
      description: 'Equipment Description',
      quantity: 'Quantity',
      duration: 'Duration (days)',
      rate: 'Daily Rate',
      total_cost: 'Total Cost',
      owned_rented: 'Owned/Rented'
    }
  },
  'EQUIPMENT/DISCIPLINE': {
    fields: ['wbs_code', 'discipline', 'description', 'quantity', 'duration', 'rate', 'total_cost'],
    displayNames: {
      wbs_code: 'WBS Code',
      discipline: 'Discipline',
      description: 'Equipment Description',
      quantity: 'Quantity',
      duration: 'Duration (days)',
      rate: 'Daily Rate',
      total_cost: 'Total Cost'
    }
  },
  'SUBCONTRACT': {
    fields: ['wbs_code', 'description', 'contractor', 'lump_sum', 'unit_price', 'total_cost'],
    displayNames: {
      wbs_code: 'WBS Code',
      description: 'Scope Description',
      contractor: 'Contractor Name',
      lump_sum: 'Lump Sum Amount',
      unit_price: 'Unit Price',
      total_cost: 'Total Cost'
    }
  },
  'SUBCONTRACT/SCAFFOLDING': {
    fields: ['wbs_code', 'description', 'area', 'duration', 'unit_rate', 'total_cost', 'contractor'],
    displayNames: {
      wbs_code: 'WBS Code',
      description: 'Scaffolding Description',
      area: 'Area (sq ft)',
      duration: 'Duration (days)',
      unit_rate: 'Rate ($/sq ft/day)',
      total_cost: 'Total Cost',
      contractor: 'Contractor'
    }
  },
  'OTHER/RISK': {
    fields: ['wbs_code', 'description', 'mitigation', 'cost_impact', 'total_cost'],
    displayNames: {
      wbs_code: 'WBS Code',
      description: 'Risk Description',
      mitigation: 'Mitigation Strategy',
      cost_impact: 'Cost Impact',
      total_cost: 'Total Cost'
    }
  },
  'SUMMARY': {
    fields: ['discipline', 'wbs_code', 'description', 'manhours', 'value'],
    displayNames: {
      discipline: 'Discipline',
      wbs_code: 'WBS Code',
      description: 'Description',
      manhours: 'Total Manhours',
      value: 'Total Value'
    }
  }
}

// Default mappings from database
const DEFAULT_MAPPINGS: Record<string, SheetMapping> = {
  'BUDGETS': {
    sheet_name: 'BUDGETS',
    category: 'SUMMARY',
    column_mappings: { discipline: 1, wbs_code: 2, description: 3, manhours: 4, value: 5 }
  },
  'DIRECTS': {
    sheet_name: 'DIRECTS',
    category: 'LABOR',
    subcategory: 'DIRECT',
    column_mappings: { wbs_code: 0, description: 1, crew_size: 2, duration: 3, manhours: 4, rate: 5, total_cost: 6 }
  },
  'INDIRECTS': {
    sheet_name: 'INDIRECTS',
    category: 'LABOR',
    subcategory: 'INDIRECT',
    column_mappings: { wbs_code: 0, description: 1, quantity: 2, duration: 3, rate: 4, total_cost: 5 }
  },
  'STAFF': {
    sheet_name: 'STAFF',
    category: 'LABOR',
    subcategory: 'STAFF',
    column_mappings: { wbs_code: 0, position: 1, quantity: 2, duration: 3, monthly_rate: 4, total_cost: 5 }
  },
  'MATERIALS': {
    sheet_name: 'MATERIALS',
    category: 'MATERIAL',
    column_mappings: { wbs_code: 0, description: 1, quantity: 2, unit: 3, unit_price: 4, total_cost: 5, supplier: 6 }
  },
  'GENERAL EQUIPMENT': {
    sheet_name: 'GENERAL EQUIPMENT',
    category: 'EQUIPMENT',
    column_mappings: { wbs_code: 0, description: 1, quantity: 2, duration: 3, rate: 4, total_cost: 5, owned_rented: 6 }
  },
  'DISC. EQUIPMENT': {
    sheet_name: 'DISC. EQUIPMENT',
    category: 'EQUIPMENT',
    subcategory: 'DISCIPLINE',
    column_mappings: { wbs_code: 0, discipline: 1, description: 2, quantity: 3, duration: 4, rate: 5, total_cost: 6 }
  },
  'SUBS': {
    sheet_name: 'SUBS',
    category: 'SUBCONTRACT',
    column_mappings: { wbs_code: 0, description: 1, contractor: 2, lump_sum: 3, unit_price: 4, total_cost: 5 }
  },
  'SCAFFOLDING': {
    sheet_name: 'SCAFFOLDING',
    category: 'SUBCONTRACT',
    subcategory: 'SCAFFOLDING',
    column_mappings: { wbs_code: 0, description: 1, area: 2, duration: 3, unit_rate: 4, total_cost: 5, contractor: 6 }
  },
  'CONSTRUCTABILITY': {
    sheet_name: 'CONSTRUCTABILITY',
    category: 'OTHER',
    subcategory: 'RISK',
    column_mappings: { wbs_code: 0, description: 1, mitigation: 2, cost_impact: 3, total_cost: 4 }
  }
}

export function SheetMappingEditor({ analysisResult, onMappingChange }: SheetMappingEditorProps) {
  const [customMappings, setCustomMappings] = useState<Record<string, ColumnMapping>>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [activeSheet, setActiveSheet] = useState<string>('')

  useEffect(() => {
    // Initialize with default mappings
    const initialMappings: Record<string, ColumnMapping> = {}
    Object.keys(DEFAULT_MAPPINGS).forEach(sheetName => {
      initialMappings[sheetName] = { ...DEFAULT_MAPPINGS[sheetName].column_mappings }
    })
    setCustomMappings(initialMappings)
    
    // Set first allowed sheet as active if available
    if (analysisResult?.sheetNames?.length > 0) {
      const firstAllowedSheet = analysisResult.sheetNames.find((name: string) => 
        DEFAULT_MAPPINGS[name]
      )
      if (firstAllowedSheet) {
        setActiveSheet(firstAllowedSheet)
      }
    }
  }, [analysisResult])

  const handleMappingChange = (sheetName: string, field: string, columnIndex: number) => {
    setCustomMappings(prev => ({
      ...prev,
      [sheetName]: {
        ...prev[sheetName],
        [field]: columnIndex
      }
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    if (onMappingChange) {
      onMappingChange(customMappings)
    }
    setHasChanges(false)
  }

  const handleReset = (sheetName: string) => {
    if (DEFAULT_MAPPINGS[sheetName]) {
      setCustomMappings(prev => ({
        ...prev,
        [sheetName]: { ...DEFAULT_MAPPINGS[sheetName].column_mappings }
      }))
      setHasChanges(true)
    }
  }

  const getSheetData = (sheetName: string) => {
    if (!analysisResult?.rawData?.[sheetName]) return null
    return analysisResult.rawData[sheetName]
  }

  const getCategoryKey = (sheetName: string) => {
    const mapping = DEFAULT_MAPPINGS[sheetName]
    if (!mapping) return null
    return mapping.subcategory 
      ? `${mapping.category}/${mapping.subcategory}`
      : mapping.category
  }

  const getFieldDefinitions = (sheetName: string) => {
    const categoryKey = getCategoryKey(sheetName)
    return categoryKey ? FIELD_DEFINITIONS[categoryKey] : null
  }

  const getSampleValue = (sheetData: any, columnIndex: number, rowIndex: number = 0) => {
    if (!sheetData?.rows?.[rowIndex]) return '-'
    const value = sheetData.rows[rowIndex][columnIndex]
    return value !== null && value !== undefined ? String(value) : '-'
  }

  if (!analysisResult) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Upload a file to configure column mappings
          </p>
        </CardContent>
      </Card>
    )
  }

  const allowedSheets = analysisResult.sheetNames.filter((name: string) => DEFAULT_MAPPINGS[name])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Column Mapping Configuration
            </CardTitle>
            <CardDescription>
              Map Excel columns to data fields for each sheet
            </CardDescription>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} size="sm">
              <Save className="h-4 w-4 mr-2" />
              Apply Changes
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeSheet} onValueChange={setActiveSheet}>
          <TabsList className="grid grid-cols-5 w-full">
            {allowedSheets.slice(0, 5).map((sheetName: string) => (
              <TabsTrigger key={sheetName} value={sheetName}>
                {sheetName}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {allowedSheets.length > 5 && (
            <TabsList className="grid grid-cols-5 w-full mt-2">
              {allowedSheets.slice(5, 10).map((sheetName: string) => (
                <TabsTrigger key={sheetName} value={sheetName}>
                  {sheetName}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
          
          {allowedSheets.map((sheetName: string) => {
            const sheetData = getSheetData(sheetName)
            const fieldDefs = getFieldDefinitions(sheetName)
            const mapping = customMappings[sheetName] || {}
            const sheetInfo = DEFAULT_MAPPINGS[sheetName]
            
            return (
              <TabsContent key={sheetName} value={sheetName} className="space-y-4">
                {/* Sheet Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{sheetInfo.category}</Badge>
                    {sheetInfo.subcategory && (
                      <Badge variant="secondary">{sheetInfo.subcategory}</Badge>
                    )}
                    {sheetData && (
                      <span className="text-sm text-muted-foreground">
                        {sheetData.totalRows} data rows, {sheetData.headers.length} columns
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReset(sheetName)}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset to Default
                  </Button>
                </div>

                {/* Column Mappings */}
                {fieldDefs && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Field Mappings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {fieldDefs.fields.map(field => (
                        <div key={field} className="space-y-2">
                          <Label>{fieldDefs.displayNames[field]}</Label>
                          <div className="flex items-center gap-2">
                            <Select
                              value={mapping[field] !== undefined ? String(mapping[field]) : 'none'}
                              onValueChange={(value) => {
                                if (value === 'none') {
                                  // Remove the mapping
                                  setCustomMappings(prev => {
                                    const newMappings = { ...prev }
                                    if (newMappings[sheetName]) {
                                      const { [field]: _, ...rest } = newMappings[sheetName]
                                      newMappings[sheetName] = rest
                                    }
                                    return newMappings
                                  })
                                } else {
                                  handleMappingChange(sheetName, field, parseInt(value))
                                }
                              }}
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select column" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Not mapped</SelectItem>
                                {sheetData?.headers.map((header: string, idx: number) => (
                                  <SelectItem key={idx} value={String(idx)}>
                                    Col {idx + 1}: {header || '(empty)'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {mapping[field] !== undefined && sheetData && (
                              <span className="text-sm text-muted-foreground">
                                Sample: {getSampleValue(sheetData, mapping[field])}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Data Preview */}
                {sheetData && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Data Preview (first 5 rows)</h4>
                    <ScrollArea className="h-[200px] w-full border rounded-md">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-background border-b">
                          <tr>
                            {sheetData.headers.map((header: string, idx: number) => {
                              const isMapped = Object.values(mapping).includes(idx)
                              return (
                                <th 
                                  key={idx} 
                                  className={`text-left p-2 text-xs font-medium ${
                                    isMapped ? 'text-primary' : 'text-muted-foreground'
                                  }`}
                                >
                                  Col {idx + 1}
                                  {isMapped && <CircleCheck className="inline h-3 w-3 ml-1" />}
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {sheetData.rows.slice(0, 5).map((row: any[], rowIdx: number) => (
                            <tr key={rowIdx} className="border-b">
                              {row.map((cell: any, cellIdx: number) => (
                                <td key={cellIdx} className="p-2 text-xs">
                                  {cell !== null && cell !== undefined ? String(cell) : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                )}

                {!sheetData && (
                  <Alert>
                    <CircleAlert className="h-4 w-4" />
                    <AlertDescription>
                      No data available for this sheet. It may be missing from the uploaded file.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            )
          })}
        </Tabs>
      </CardContent>
    </Card>
  )
}