'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileText, Hash, Users, DollarSign, Settings, Eye, EyeOff, Check } from 'lucide-react'
import { InputSheetAnalyzer, InputSheetData, InputFieldInfo } from '@/lib/services/input-sheet-analyzer'
import * as XLSX from 'xlsx'

interface InputSheetViewerProps {
  analysisResult: any
  file?: File
  onFieldsSelected?: (selectedFields: Record<string, any>) => void
}

const CATEGORY_ICONS = {
  project: FileText,
  discipline: Users,
  rate: DollarSign,
  parameter: Hash,
  unknown: Settings
}

const CATEGORY_COLORS = {
  project: 'bg-blue-100 text-blue-800',
  discipline: 'bg-green-100 text-green-800',
  rate: 'bg-yellow-100 text-yellow-800',
  parameter: 'bg-purple-100 text-purple-800',
  unknown: 'bg-gray-100 text-gray-800'
}

export function InputSheetViewer({ analysisResult, file, onFieldsSelected }: InputSheetViewerProps) {
  const [inputData, setInputData] = useState<InputSheetData | null>(null)
  const [fieldInfo, setFieldInfo] = useState<InputFieldInfo[]>([])
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set())
  const [showRawData, setShowRawData] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('InputSheetViewer - analysisResult:', analysisResult)
    if (analysisResult?.sheetNames) {
      analyzeInputSheet()
    } else {
      setLoading(false)
    }
  }, [analysisResult])

  const analyzeInputSheet = async () => {
    setLoading(true)
    try {
      console.log('Analyzing INPUT sheet...')
      console.log('Available sheets:', analysisResult?.sheetNames)
      console.log('Raw data keys:', Object.keys(analysisResult?.rawData || {}))
      
      // Check if we have raw data for INPUT sheet
      const inputSheetData = analysisResult?.rawData?.INPUT || analysisResult?.rawData?.INPUTS
      console.log('INPUT sheet data found:', !!inputSheetData)
      
      if (inputSheetData) {
        // Process raw data directly
        const analyzer = new InputSheetAnalyzer()
        const data = analyzer.processRawData(inputSheetData, analysisResult.sheetNames)
        console.log('Processed data:', data)
        
        if (data) {
          setInputData(data)
          const fields = analyzer.getFieldInfo(data)
          setFieldInfo(fields)
          
          // Auto-select high confidence fields
          const autoSelected = new Set<string>()
          fields.forEach(field => {
            if (field.confidence >= 0.8) {
              autoSelected.add(field.fieldName)
            }
          })
          setSelectedFields(autoSelected)
        }
      } else {
        // No INPUT sheet found
        console.log('No INPUT sheet found in raw data')
        setInputData(null)
      }
    } catch (error) {
      console.error('Error analyzing INPUT sheet:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleFieldSelection = (fieldName: string) => {
    const newSelected = new Set(selectedFields)
    if (newSelected.has(fieldName)) {
      newSelected.delete(fieldName)
    } else {
      newSelected.add(fieldName)
    }
    setSelectedFields(newSelected)
  }

  const handleSaveSelection = () => {
    if (!inputData || !onFieldsSelected) return
    
    const selected: Record<string, any> = {}
    
    // Add selected key-value pairs
    selectedFields.forEach(fieldName => {
      if (inputData.keyValuePairs[fieldName] !== undefined) {
        selected[fieldName] = inputData.keyValuePairs[fieldName]
      }
    })
    
    // Add disciplines if selected
    if (selectedFields.has('Disciplines')) {
      selected.disciplines = inputData.disciplines
    }
    
    // Add rates
    Object.entries(inputData.rates).forEach(([rateName, rateValue]) => {
      if (selectedFields.has(rateName)) {
        selected[rateName] = rateValue
      }
    })
    
    onFieldsSelected(selected)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Analyzing INPUT sheet...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!inputData) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No INPUT sheet found in the uploaded file
          </p>
        </CardContent>
      </Card>
    )
  }

  const groupedFields = fieldInfo.reduce((acc, field) => {
    if (!acc[field.category]) {
      acc[field.category] = []
    }
    acc[field.category].push(field)
    return acc
  }, {} as Record<string, InputFieldInfo[]>)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>INPUT Sheet Analysis</CardTitle>
              <CardDescription>
                Select the fields you want to extract from the INPUT sheet
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRawData(!showRawData)}
              >
                {showRawData ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showRawData ? 'Hide' : 'Show'} Raw Data
              </Button>
              <Button
                onClick={handleSaveSelection}
                disabled={selectedFields.size === 0}
              >
                <Check className="h-4 w-4 mr-2" />
                Save Selection ({selectedFields.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Rows</p>
              <p className="text-2xl font-bold">{inputData.rawData.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Key-Value Pairs</p>
              <p className="text-2xl font-bold">{Object.keys(inputData.keyValuePairs).length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Disciplines</p>
              <p className="text-2xl font-bold">{inputData.disciplines.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rates</p>
              <p className="text-2xl font-bold">{Object.keys(inputData.rates).length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categorized Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Extracted Fields by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={Object.keys(groupedFields)[0]}>
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Object.keys(groupedFields).length}, minmax(0, 1fr))` }}>
              {Object.keys(groupedFields).map(category => {
                const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] || Settings
                return (
                  <TabsTrigger key={category} value={category} className="capitalize">
                    <Icon className="h-4 w-4 mr-2" />
                    {category}
                  </TabsTrigger>
                )
              })}
            </TabsList>
            
            {Object.entries(groupedFields).map(([category, fields]) => (
              <TabsContent key={category} value={category}>
                <div className="space-y-2">
                  {fields.map(field => (
                    <div
                      key={field.fieldName}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedFields.has(field.fieldName)}
                          onCheckedChange={() => toggleFieldSelection(field.fieldName)}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{field.fieldName}</span>
                            <Badge className={CATEGORY_COLORS[field.category as keyof typeof CATEGORY_COLORS]}>
                              {field.category}
                            </Badge>
                            <Badge variant="outline">
                              {Math.round(field.confidence * 100)}% confidence
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Value: {typeof field.value === 'object' 
                              ? JSON.stringify(field.value) 
                              : String(field.value)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Disciplines */}
      {inputData.disciplines.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detected Disciplines</CardTitle>
              <Checkbox
                checked={selectedFields.has('Disciplines')}
                onCheckedChange={() => toggleFieldSelection('Disciplines')}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {inputData.disciplines.map((discipline, idx) => (
                <Badge key={idx} variant="secondary" className="text-sm">
                  {discipline}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Data View */}
      {showRawData && (
        <Card>
          <CardHeader>
            <CardTitle>Raw INPUT Sheet Data</CardTitle>
            <CardDescription>
              Complete data as extracted from the Excel file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Row</TableHead>
                    {inputData.rawData[0]?.map((_, idx) => (
                      <TableHead key={idx}>Col {idx + 1}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inputData.rawData.map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      <TableCell className="font-medium">{rowIdx + 1}</TableCell>
                      {row.map((cell, cellIdx) => (
                        <TableCell key={cellIdx} className="text-sm">
                          {cell !== null && cell !== undefined ? String(cell) : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}