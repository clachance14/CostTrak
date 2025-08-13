'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, DollarSign, Settings, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PerDiemConfig } from '@/components/project/per-diem-config'
import { PerDiemSummaryCard } from '@/components/project/per-diem-summary-card'
import { LaborPerDiemSection } from '@/components/labor/labor-per-diem-section'
import { PerDiemLaborBreakdown } from '@/components/project/budget-per-diem-row'

interface PerDiemExamplePageProps {
  params: Promise<{ id: string }>
}

export default function PerDiemExamplePage({ params }: PerDiemExamplePageProps) {
  const router = useRouter()
  const { id } = use(params)

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/projects/${id}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>
        <div className="flex items-center gap-3 mt-4">
          <DollarSign className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Per Diem Management</h1>
            <p className="text-muted-foreground mt-1">
              Complete per diem tracking and configuration example
            </p>
          </div>
        </div>
      </div>

      {/* Information Banner */}
      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Per Diem Feature Overview
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
          This page demonstrates all per diem components integrated into CostTrak:
        </p>
        <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 ml-4">
          <li>• <strong>Configuration:</strong> Set daily rates for Direct and Indirect/Staff labor</li>
          <li>• <strong>Automatic Calculation:</strong> Per diem calculated weekly (5 days) for all employees with hours</li>
          <li>• <strong>Labor Integration:</strong> Triggered automatically on labor import</li>
          <li>• <strong>Budget Tracking:</strong> Per diem costs count against labor budget</li>
          <li>• <strong>Analytics:</strong> View trends, breakdowns, and export data</li>
        </ul>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <PerDiemSummaryCard projectId={id} />
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Key Features
              </h3>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-1">Weekly Calculation</h4>
                  <p className="text-sm text-muted-foreground">
                    Per diem is calculated for 5 days per week when an employee has recorded hours
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-1">Category-Based Rates</h4>
                  <p className="text-sm text-muted-foreground">
                    Different rates for Direct vs Indirect/Staff employees
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-1">Automatic Processing</h4>
                  <p className="text-sm text-muted-foreground">
                    Calculated automatically when labor data is imported
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Budget Integration Example */}
          <div className="mt-6 p-4 border rounded-lg">
            <h3 className="font-semibold mb-3">Labor Budget Integration</h3>
            <PerDiemLaborBreakdown projectId={id} />
          </div>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="configuration" className="space-y-4">
          <PerDiemConfig projectId={id} />
          
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <h3 className="font-medium mb-2">Configuration Notes:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Changes to rates will trigger recalculation of all existing per diem</li>
              <li>• Per diem can be enabled/disabled at any time</li>
              <li>• Rates apply to all weeks in the project</li>
              <li>• Staff employees are treated as Indirect for per diem purposes</li>
            </ul>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <LaborPerDiemSection projectId={id} />
        </TabsContent>

        {/* Integration Tab */}
        <TabsContent value="integration" className="space-y-4">
          <div className="space-y-6">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Settings className="h-5 w-5" />
                API Integration
              </h3>
              <div className="space-y-2 font-mono text-sm">
                <p className="text-muted-foreground">Available endpoints:</p>
                <div className="p-3 bg-muted/50 rounded">
                  GET /api/projects/{id}/per-diem
                </div>
                <div className="p-3 bg-muted/50 rounded">
                  POST /api/projects/{id}/per-diem
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-3">Database Schema</h3>
              <div className="space-y-2 text-sm">
                <div className="p-3 bg-muted/50 rounded">
                  <strong>per_diem_costs</strong> - Stores calculated per diem entries
                </div>
                <div className="p-3 bg-muted/50 rounded">
                  <strong>projects</strong> - Extended with per_diem_enabled, per_diem_rate_direct, per_diem_rate_indirect
                </div>
                <div className="p-3 bg-muted/50 rounded">
                  <strong>per_diem_summary</strong> - View for aggregated per diem data
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-3">Calculation Logic</h3>
              <pre className="p-3 bg-muted/50 rounded text-xs overflow-x-auto">
{`// Triggered on labor_employee_actuals insert/update
IF employee has hours > 0 THEN
  IF employee.category = 'Direct' THEN
    rate = project.per_diem_rate_direct
  ELSE // Indirect or Staff
    rate = project.per_diem_rate_indirect
  END IF
  
  per_diem = rate * 5 days // Weekly calculation
END IF`}
              </pre>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}