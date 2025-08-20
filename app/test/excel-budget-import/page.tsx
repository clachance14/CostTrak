'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CircleAlert, FileSpreadsheet, Upload, ChevronRight } from 'lucide-react'
import { FileUploadZone } from '@/components/test/excel-budget-import/file-upload-zone'
import { RawDataViewer } from '@/components/test/excel-budget-import/raw-data-viewer'
import { SheetMappingEditor } from '@/components/test/excel-budget-import/sheet-mapping-editor'
import { DisciplineDataViewer } from '@/components/test/excel-budget-import/discipline-data-viewer'
import { DisciplineSelector } from '@/components/test/excel-budget-import/discipline-selector'
import { WBSStructurePreview } from '@/components/test/excel-budget-import/wbs-structure-preview'
import { ValidationResults } from '@/components/test/excel-budget-import/validation-results'
import { BudgetSheetDisciplineViewer } from '@/components/test/excel-budget-import/budget-sheet-discipline-viewer'
import { CostTypeAnalysisViewer } from '@/components/test/excel-budget-import/cost-type-analysis-viewer'
import { ImportDebugPanel } from '@/components/test/excel-budget-import/import-debug-panel'

interface WizardStep {
  id: string
  title: string
  description: string
  component: React.ComponentType<any>
}

const steps: WizardStep[] = [
  {
    id: 'upload',
    title: 'Upload Excel File',
    description: 'Select your budget coversheet file',
    component: FileUploadZone
  },
  {
    id: 'raw-data',
    title: 'Review Raw Data',
    description: 'View extracted data from all sheets',
    component: RawDataViewer
  },
  {
    id: 'budgets-sheet',
    title: 'BUDGETS Sheet Analysis',
    description: 'View disciplines extracted from BUDGETS sheet',
    component: BudgetSheetDisciplineViewer
  },
  {
    id: 'cost-types',
    title: 'Cost Type Analysis',
    description: 'Analyze budget by cost types (Perdiem, Materials, etc.)',
    component: CostTypeAnalysisViewer
  },
  {
    id: 'debug-panel',
    title: 'Import Debug',
    description: 'Detailed import process log and validation',
    component: ImportDebugPanel
  },
  {
    id: 'mapping',
    title: 'Configure Mappings',
    description: 'Map Excel columns to database fields for each sheet',
    component: SheetMappingEditor
  },
  {
    id: 'discipline-view',
    title: 'Discipline Analysis',
    description: 'View costs and manhours by discipline and category',
    component: DisciplineDataViewer
  },
  {
    id: 'wbs-preview',
    title: 'WBS Structure',
    description: 'Preview hierarchical WBS organization',
    component: WBSStructurePreview
  },
  {
    id: 'validation',
    title: 'Validation Results',
    description: 'Review warnings and errors',
    component: ValidationResults
  }
]

export default function ExcelBudgetImportTestPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [customMappings, setCustomMappings] = useState<any>(null)
  const [inputSheetData, setInputSheetData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsReanalysis, setNeedsReanalysis] = useState(false)

  const CurrentStepComponent = steps[currentStep].component

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleStepClick = (index: number) => {
    // Allow going to any step after file is uploaded
    if (index === 0 || (analysisResult && index > 0)) {
      setCurrentStep(index)
    }
  }

  // Re-analyze with discipline mapping
  const reanalyzeWithDisciplineMapping = async (disciplineData: any) => {
    if (!uploadedFile) return
    
    setLoading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)
      
      // Add discipline mapping if available
      if (disciplineData?.disciplineMapping?.disciplineToParent) {
        formData.append('disciplineMapping', JSON.stringify(disciplineData.disciplineMapping.disciplineToParent))
      }
      
      // Add predefined WBS structure if available
      if (disciplineData?.wbsStructure) {
        formData.append('predefinedWBS', JSON.stringify(disciplineData.wbsStructure))
      }
      
      const response = await fetch('/api/test/excel-budget-analysis', {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze file')
      }
      
      if (result.success) {
        setAnalysisResult(result.data)
        setInputSheetData(disciplineData)
        handleNext() // Move to next step
      } else {
        throw new Error(result.error || 'Analysis failed')
      }
    } catch (err) {
      console.error('Re-analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to re-analyze file')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Excel Budget Import Testing Tool</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Debug and configure Excel budget imports without affecting production data
          </p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-yellow-50 dark:bg-yellow-950/20 border-b border-yellow-200 dark:border-yellow-900">
        <div className="container mx-auto px-4 py-3">
          <Alert className="border-0 bg-transparent p-0">
            <CircleAlert className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-400">Test Environment</AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-500">
              This is a testing tool. No data will be saved to the production database.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center cursor-pointer"
                  onClick={() => handleStepClick(index)}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-medium
                        ${index === currentStep
                          ? 'bg-primary text-primary-foreground'
                          : analysisResult && index > 0
                          ? 'bg-primary/20 text-primary hover:bg-primary/30'
                          : index === 0
                          ? 'bg-primary/20 text-primary hover:bg-primary/30'
                          : 'bg-muted text-muted-foreground'
                        }
                        ${(index === 0 || (analysisResult && index > 0)) ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}
                      `}
                    >
                      {index + 1}
                    </div>
                    <span className="text-xs mt-1 text-center max-w-[100px]">
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Current Step Content */}
          <Card>
            <CardHeader>
              <CardTitle>{steps[currentStep].title}</CardTitle>
              <CardDescription>{steps[currentStep].description}</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <CircleAlert className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {currentStep === 0 ? (
                <CurrentStepComponent
                  onFileChange={setUploadedFile}
                  onAnalysisComplete={setAnalysisResult}
                  loading={loading}
                  setLoading={setLoading}
                  error={error}
                  setError={setError}
                />
              ) : steps[currentStep].id === 'mapping' ? (
                <CurrentStepComponent
                  analysisResult={analysisResult}
                  onMappingChange={setCustomMappings}
                />
              ) : steps[currentStep].id === 'discipline-view' ? (
                <CurrentStepComponent
                  budgetData={analysisResult?.budgetData}
                  rawData={analysisResult?.rawData}
                  disciplineMapping={inputSheetData}
                />
              ) : steps[currentStep].id === 'wbs-preview' ? (
                <CurrentStepComponent
                  budgetData={analysisResult?.budgetData}
                />
              ) : steps[currentStep].id === 'validation' ? (
                <CurrentStepComponent
                  budgetData={analysisResult?.budgetData}
                  analysisResult={analysisResult}
                />
              ) : (
                <CurrentStepComponent
                  analysisResult={analysisResult}
                />
              )}
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            <Button
              onClick={handleNext}
              disabled={currentStep === steps.length - 1 || (currentStep === 0 && !analysisResult)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}