'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { LoaderCircle, Save, CircleAlert } from 'lucide-react'

interface ProjectForecast {
  projectId: string
  jobNumber: string
  projectName: string
  reportingMonth: string
  percentComplete: number
  currentMonthRevenue: number
  nextMonthRevenue: number
  plusTwoMonthRevenue: number
  remainingBacklog: number
  notes: string
  lastUpdated?: string
  updatedBy?: string
}

export function MonthlyForecastSheet() {
  const [forecasts, setForecasts] = useState<ProjectForecast[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set())
  const [currentMonth] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 7) // YYYY-MM format
  })

  useEffect(() => {
    fetchForecastData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth])

  const fetchForecastData = async () => {
    try {
      setLoading(true)
      const supabase = createClient()

      // Fetch active projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          job_number,
          name,
          percent_complete,
          revised_contract_amount,
          actual_revenue_to_date
        `)
        .eq('status', 'active')
        .order('job_number')

      if (projectsError) throw projectsError

      // Fetch existing forecasts for current month
      const { data: existingForecasts, error: forecastsError } = await supabase
        .from('monthly_forecasts')
        .select('*')
        .eq('reporting_month', currentMonth)

      if (forecastsError && forecastsError.code !== 'PGRST116') throw forecastsError

      // Merge project data with forecasts
      const forecastMap = new Map(
        existingForecasts?.map(f => [f.project_id, f]) || []
      )

      const forecastData: ProjectForecast[] = projects.map(project => {
        const existing = forecastMap.get(project.id)
        const remainingRevenue = (project.revised_contract_amount || 0) - (project.actual_revenue_to_date || 0)

        return {
          projectId: project.id,
          jobNumber: project.job_number,
          projectName: project.name,
          reportingMonth: currentMonth,
          percentComplete: existing?.percent_complete || project.percent_complete || 0,
          currentMonthRevenue: existing?.current_month_revenue || 0,
          nextMonthRevenue: existing?.next_month_revenue || 0,
          plusTwoMonthRevenue: existing?.plus_two_month_revenue || 0,
          remainingBacklog: existing?.remaining_backlog || remainingRevenue,
          notes: existing?.notes || '',
          lastUpdated: existing?.updated_at,
          updatedBy: existing?.updated_by
        }
      })

      setForecasts(forecastData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch forecast data')
    } finally {
      setLoading(false)
    }
  }

  const handleCellChange = (projectId: string, field: keyof ProjectForecast, value: string | number) => {
    setForecasts(prev => prev.map(f => 
      f.projectId === projectId ? { ...f, [field]: value as ProjectForecast[keyof ProjectForecast] } : f
    ))
    setEditedCells(prev => new Set(prev).add(`${projectId}-${field}`))
  }

  const saveForecast = async (forecast: ProjectForecast) => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const forecastData = {
        project_id: forecast.projectId,
        reporting_month: forecast.reportingMonth,
        percent_complete: forecast.percentComplete,
        current_month_revenue: forecast.currentMonthRevenue,
        next_month_revenue: forecast.nextMonthRevenue,
        plus_two_month_revenue: forecast.plusTwoMonthRevenue,
        remaining_backlog: forecast.remainingBacklog,
        notes: forecast.notes,
        updated_by: user?.email || 'Unknown'
      }

      const { error } = await supabase
        .from('monthly_forecasts')
        .upsert(forecastData, {
          onConflict: 'project_id,reporting_month'
        })

      if (error) throw error

      // Clear edited cells for this project
      const newEditedCells = new Set(editedCells)
      Array.from(editedCells).forEach(cell => {
        if (cell.startsWith(forecast.projectId)) {
          newEditedCells.delete(cell)
        }
      })
      setEditedCells(newEditedCells)

      return true
    } catch (err) {
      console.error('Failed to save forecast:', err)
      return false
    }
  }

  const saveAllForecasts = async () => {
    setSaving(true)
    setError(null)
    
    try {
      const projectsToSave = forecasts.filter(f => 
        Array.from(editedCells).some(cell => cell.startsWith(f.projectId))
      )

      const results = await Promise.all(projectsToSave.map(saveForecast))
      const successCount = results.filter(r => r).length

      if (successCount === projectsToSave.length) {
        await fetchForecastData() // Refresh to get updated timestamps
      } else {
        setError(`Saved ${successCount} of ${projectsToSave.length} forecasts`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save forecasts')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoaderCircle className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const totalCurrentMonth = forecasts.reduce((sum, f) => sum + f.currentMonthRevenue, 0)
  const totalNextMonth = forecasts.reduce((sum, f) => sum + f.nextMonthRevenue, 0)
  const totalPlusTwoMonth = forecasts.reduce((sum, f) => sum + f.plusTwoMonthRevenue, 0)
  const totalBacklog = forecasts.reduce((sum, f) => sum + f.remainingBacklog, 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Monthly Revenue Forecast Entry</CardTitle>
            <CardDescription>
              Enter forecasts for {new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </CardDescription>
          </div>
          <Button 
            onClick={saveAllForecasts} 
            disabled={saving || editedCells.size === 0}
          >
            {saving ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes ({editedCells.size})
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <CircleAlert className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white">Job #</TableHead>
                  <TableHead>Project Name</TableHead>
                  <TableHead className="text-center">% Complete</TableHead>
                  <TableHead className="text-right">Current Month</TableHead>
                  <TableHead className="text-right">Next Month</TableHead>
                  <TableHead className="text-right">+2 Months</TableHead>
                  <TableHead className="text-right">Remaining Backlog</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecasts.map((forecast) => (
                  <TableRow key={forecast.projectId}>
                    <TableCell className="sticky left-0 bg-white font-medium">
                      {forecast.jobNumber}
                    </TableCell>
                    <TableCell>{forecast.projectName}</TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={forecast.percentComplete}
                        onChange={(e) => handleCellChange(
                          forecast.projectId, 
                          'percentComplete', 
                          parseInt(e.target.value) || 0
                        )}
                        className={`w-20 text-center ${
                          editedCells.has(`${forecast.projectId}-percentComplete`) ? 'border-blue-500' : ''
                        }`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        value={forecast.currentMonthRevenue}
                        onChange={(e) => handleCellChange(
                          forecast.projectId, 
                          'currentMonthRevenue', 
                          parseFloat(e.target.value) || 0
                        )}
                        className={`w-32 text-right ${
                          editedCells.has(`${forecast.projectId}-currentMonthRevenue`) ? 'border-blue-500' : ''
                        }`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        value={forecast.nextMonthRevenue}
                        onChange={(e) => handleCellChange(
                          forecast.projectId, 
                          'nextMonthRevenue', 
                          parseFloat(e.target.value) || 0
                        )}
                        className={`w-32 text-right ${
                          editedCells.has(`${forecast.projectId}-nextMonthRevenue`) ? 'border-blue-500' : ''
                        }`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        value={forecast.plusTwoMonthRevenue}
                        onChange={(e) => handleCellChange(
                          forecast.projectId, 
                          'plusTwoMonthRevenue', 
                          parseFloat(e.target.value) || 0
                        )}
                        className={`w-32 text-right ${
                          editedCells.has(`${forecast.projectId}-plusTwoMonthRevenue`) ? 'border-blue-500' : ''
                        }`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min="0"
                        value={forecast.remainingBacklog}
                        onChange={(e) => handleCellChange(
                          forecast.projectId, 
                          'remainingBacklog', 
                          parseFloat(e.target.value) || 0
                        )}
                        className={`w-32 text-right ${
                          editedCells.has(`${forecast.projectId}-remainingBacklog`) ? 'border-blue-500' : ''
                        }`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={forecast.notes}
                        onChange={(e) => handleCellChange(
                          forecast.projectId, 
                          'notes', 
                          e.target.value
                        )}
                        placeholder="Add notes..."
                        className={`w-48 ${
                          editedCells.has(`${forecast.projectId}-notes`) ? 'border-blue-500' : ''
                        }`}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {forecast.lastUpdated ? (
                        <div>
                          {new Date(forecast.lastUpdated).toLocaleDateString()}
                          <br />
                          <span className="text-xs">{forecast.updatedBy}</span>
                        </div>
                      ) : (
                        <Badge variant="secondary">Not saved</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-medium bg-gray-50">
                  <TableCell colSpan={3} className="text-right">Totals:</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalCurrentMonth)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalNextMonth)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalPlusTwoMonth)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalBacklog)}</TableCell>
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}