'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Users, CircleCheck, Info } from 'lucide-react'
import { InputSheetAnalyzer, InputSheetData } from '@/lib/services/input-sheet-analyzer'
import { DisciplineMapper } from '@/lib/services/discipline-mapper'

interface DisciplineSelectorProps {
  analysisResult: any
  onDisciplinesConfirmed?: (disciplines: any) => void
}

export function DisciplineSelector({ analysisResult, onDisciplinesConfirmed }: DisciplineSelectorProps) {
  const [inputData, setInputData] = useState<InputSheetData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (analysisResult?.sheetNames) {
      analyzeInputSheet()
    } else {
      setLoading(false)
    }
  }, [analysisResult])

  const analyzeInputSheet = async () => {
    setLoading(true)
    try {
      console.log('DisciplineSelector: Analyzing INPUT sheet')
      console.log('Available sheets:', analysisResult?.sheetNames)
      console.log('Raw data keys:', Object.keys(analysisResult?.rawData || {}))
      
      // Check if we have raw data for INPUT sheet
      const inputSheetData = analysisResult?.rawData?.INPUT || analysisResult?.rawData?.INPUTS
      console.log('INPUT sheet data found:', !!inputSheetData)
      
      if (inputSheetData) {
        // Process raw data directly
        const analyzer = new InputSheetAnalyzer()
        const data = analyzer.processRawData(inputSheetData, analysisResult.sheetNames)
        
        if (data) {
          setInputData(data)
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

  const handleConfirm = () => {
    if (!inputData || !onDisciplinesConfirmed) return
    
    onDisciplinesConfirmed({
      disciplines: inputData.disciplines,
      disciplineMapping: inputData.projectDisciplines,
      wbsStructure: inputData.wbsStructure
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Analyzing INPUT sheet for disciplines...
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!inputData || !inputData.hasData) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No INPUT sheet found or no disciplines detected. 
              Default discipline structure will be used.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const { projectDisciplines } = inputData

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Discipline Structure
              </CardTitle>
              <CardDescription>
                Disciplines detected from the INPUT sheet
              </CardDescription>
            </div>
            <Button onClick={handleConfirm}>
              <CircleCheck className="h-4 w-4 mr-2" />
              Confirm Disciplines
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Disciplines</p>
              <p className="text-2xl font-bold">{inputData.disciplines.length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Parent Groups</p>
              <p className="text-2xl font-bold">{Object.keys(projectDisciplines.disciplineGroups).length}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Has Demo Work</p>
              <p className="text-2xl font-bold">
                {Object.values(projectDisciplines.disciplineGroups).some(g => g.includesDemos) ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant="outline" className="mt-1">Ready</Badge>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Demo items will be included in their parent discipline totals but remain visible as separate line items in the WBS structure.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Discipline Groups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Discipline Groupings
          </CardTitle>
          <CardDescription>
            How disciplines will be organized in the budget
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(projectDisciplines.disciplineGroups).map(([parent, group]) => (
              <div key={parent} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{parent}</h3>
                  {group.includesDemos && (
                    <Badge variant="secondary">Includes Demo</Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.childDisciplines.map((child, idx) => (
                    <Badge 
                      key={idx} 
                      variant={child.includes('DEMO') ? 'outline' : 'default'}
                    >
                      {DisciplineMapper.formatDisciplineName(child)}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* WBS Structure Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            WBS Structure Preview
          </CardTitle>
          <CardDescription>
            Work Breakdown Structure that will be created from disciplines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            {inputData.wbsStructure?.map((parent) => (
              <div key={parent.code} className="space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <Badge variant="outline">{parent.code}</Badge>
                  <span>{parent.description}</span>
                </div>
                {parent.children?.map((child) => (
                  <div key={child.code} className="flex items-center gap-2 ml-8 text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{child.code}</Badge>
                    <span>{child.description}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Raw Disciplines List */}
      <Card>
        <CardHeader>
          <CardTitle>All Disciplines from INPUT Sheet</CardTitle>
          <CardDescription>
            Complete list as found in Column B
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] w-full border rounded-md p-4">
            <div className="space-y-2">
              {inputData.disciplines.map((discipline, idx) => (
                <div key={idx} className="flex items-center justify-between py-1">
                  <span className="font-mono text-sm">{discipline}</span>
                  <span className="text-sm text-muted-foreground">
                    → {projectDisciplines.disciplineToParent[discipline]}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}