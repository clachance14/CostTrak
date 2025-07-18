'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Save, 
  AlertTriangle, 
  TrendingUp,
  Calendar,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getWeekEndingDate, formatWeekEnding } from '@/lib/validations/labor-forecast-v2'

interface CraftType {
  id: string
  name: string
  code: string
  laborCategory: 'direct' | 'indirect' | 'staff'
  runningAvgRate: number
}

interface LaborActual {
  id?: string
  craftTypeId: string
  craftName: string
  craftCode: string
  laborCategory: string
  totalCost: number
  totalHours: number
  ratePerHour: number
  runningAvgRate: number
}

interface ProjectInfo {
  id: string
  jobNumber: string
  name: string
}

const laborCategoryLabels = {
  direct: 'Direct Labor',
  indirect: 'Indirect Labor',
  staff: 'Staff'
}

export default function WeeklyLaborEntryPage() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project_id')
  const weekParam = searchParams.get('week')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [weekEnding, setWeekEnding] = useState<Date>(() => {
    if (weekParam) {
      return getWeekEndingDate(new Date(weekParam))
    }
    // Default to last Sunday
    const today = new Date()
    const lastSunday = new Date(today)
    lastSunday.setDate(today.getDate() - today.getDay())
    return lastSunday
  })
  
  // const [craftTypes, setCraftTypes] = useState<CraftType[]>([])
  const [laborEntries, setLaborEntries] = useState<Map<string, LaborActual>>(new Map())
  const [hasExistingData, setHasExistingData] = useState(false)
  
  // const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setError('No project selected')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch weekly actual data
      const response = await fetch(
        `/api/labor-forecasts/weekly-actuals?project_id=${projectId}&week_ending=${weekEnding.toISOString()}`
      )
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch data')
      }

      const data = await response.json()
      
      setProjectInfo(data.project)
      // setCraftTypes(data.craftTypes)
      
      // Build labor entries map
      const entriesMap = new Map<string, LaborActual>()
      
      // First, add all existing actuals
      data.actuals.forEach((actual: LaborActual) => {
        entriesMap.set(actual.craftTypeId, actual)
      })
      
      setHasExistingData(data.actuals.length > 0)
      
      // Then, add empty entries for craft types without data
      data.craftTypes.forEach((craft: CraftType) => {
        if (!entriesMap.has(craft.id)) {
          entriesMap.set(craft.id, {
            craftTypeId: craft.id,
            craftName: craft.name,
            craftCode: craft.code,
            laborCategory: craft.laborCategory,
            totalCost: 0,
            totalHours: 0,
            ratePerHour: 0,
            runningAvgRate: craft.runningAvgRate
          })
        }
      })
      
      setLaborEntries(entriesMap)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [projectId, weekEnding])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updateEntry = (craftTypeId: string, field: 'totalCost' | 'totalHours', value: string) => {
    const numValue = parseFloat(value) || 0
    
    setLaborEntries(prev => {
      const newEntries = new Map(prev)
      const entry = newEntries.get(craftTypeId)
      
      if (entry) {
        const updatedEntry = { ...entry }
        updatedEntry[field] = numValue
        
        // Recalculate rate per hour
        if (updatedEntry.totalHours > 0) {
          updatedEntry.ratePerHour = updatedEntry.totalCost / updatedEntry.totalHours
        } else {
          updatedEntry.ratePerHour = 0
        }
        
        newEntries.set(craftTypeId, updatedEntry)
      }
      
      return newEntries
    })
  }

  const handleSave = async () => {
    if (!projectId) return

    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      // Filter out entries with no data
      const entriesToSave = Array.from(laborEntries.values()).filter(
        entry => entry.totalCost > 0 || entry.totalHours > 0
      )

      if (entriesToSave.length === 0) {
        setError('Please enter at least one cost or hour value')
        return
      }

      const payload = {
        project_id: projectId,
        week_ending: weekEnding.toISOString(),
        entries: entriesToSave.map(entry => ({
          craft_type_id: entry.craftTypeId,
          total_cost: entry.totalCost,
          total_hours: entry.totalHours
        }))
      }

      const response = await fetch('/api/labor-forecasts/weekly-actuals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save data')
      }

      setSuccessMessage(
        `Successfully saved! ${data.summary.created} created, ${data.summary.updated} updated.`
      )
      setHasExistingData(true)

      // Refresh data to get updated rates
      fetchData()
    } catch (err) {
      console.error('Error saving:', err)
      setError(err instanceof Error ? err.message : 'Failed to save data')
    } finally {
      setSaving(false)
    }
  }

  // Calculate totals by category
  const calculateTotals = () => {
    const totals = {
      direct: { cost: 0, hours: 0 },
      indirect: { cost: 0, hours: 0 },
      staff: { cost: 0, hours: 0 },
      grand: { cost: 0, hours: 0 }
    }

    laborEntries.forEach(entry => {
      const category = entry.laborCategory as keyof typeof totals
      if (category in totals && category !== 'grand') {
        totals[category].cost += entry.totalCost
        totals[category].hours += entry.totalHours
        totals.grand.cost += entry.totalCost
        totals.grand.hours += entry.totalHours
      }
    })

    return totals
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!projectId || !projectInfo) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please select a project to enter labor data.</p>
          <Link href="/projects" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
            Go to Projects
          </Link>
        </div>
      </div>
    )
  }

  const totals = calculateTotals()

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <Link
          href={`/labor/forecasts?project_id=${projectId}`}
          className="inline-flex items-center text-sm text-foreground/80 hover:text-foreground/80 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Labor Forecasts
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Weekly Labor Entry</h1>
            <p className="text-foreground mt-1">
              Project {projectInfo.jobNumber} - {projectInfo.name}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-foreground" />
              <input
                type="date"
                value={weekEnding.toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = getWeekEndingDate(new Date(e.target.value))
                  setWeekEnding(newDate)
                }}
                className="px-3 py-2 border border-foreground/30 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-foreground">
                Week ending {formatWeekEnding(weekEnding)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {hasExistingData && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            This week has existing data. Your changes will update the current values.
          </p>
        </div>
      )}

      <div className="space-y-8">
        {/* Group entries by labor category */}
        {Object.entries(laborCategoryLabels).map(([category, label]) => {
          const categoryEntries = Array.from(laborEntries.values()).filter(
            entry => entry.laborCategory === category
          )
          
          if (categoryEntries.length === 0) return null

          return (
            <div key={category} className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="bg-background px-6 py-3 border-b">
                <h2 className="text-lg font-semibold text-foreground">{label}</h2>
              </div>
              
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-background">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                      Craft Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                      Total Cost ($)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                      Total Hours
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                      Rate/Hour
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                      Running Avg
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-foreground/80 uppercase tracking-wider">
                      Variance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categoryEntries.map(entry => {
                    const variance = entry.runningAvgRate > 0 && entry.ratePerHour > 0
                      ? ((entry.ratePerHour - entry.runningAvgRate) / entry.runningAvgRate) * 100
                      : 0

                    return (
                      <tr key={entry.craftTypeId}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">
                            {entry.craftName}
                          </div>
                          <div className="text-sm text-foreground/80">{entry.craftCode}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            value={entry.totalCost || ''}
                            onChange={(e) => updateEntry(entry.craftTypeId, 'totalCost', e.target.value)}
                            className="w-32 px-3 py-1 border border-foreground/30 rounded-md focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.5"
                            value={entry.totalHours || ''}
                            onChange={(e) => updateEntry(entry.craftTypeId, 'totalHours', e.target.value)}
                            className="w-32 px-3 py-1 border border-foreground/30 rounded-md focus:ring-2 focus:ring-blue-500"
                            placeholder="0.0"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                          {entry.ratePerHour > 0 ? formatCurrency(entry.ratePerHour) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground/80">
                          {entry.runningAvgRate > 0 ? formatCurrency(entry.runningAvgRate) : 'No data'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {variance !== 0 && (
                            <div className={`flex items-center ${variance > 10 ? 'text-red-600' : variance < -10 ? 'text-green-600' : 'text-foreground'}`}>
                              <TrendingUp className={`h-4 w-4 mr-1 ${variance < 0 ? 'rotate-180' : ''}`} />
                              {Math.abs(variance).toFixed(1)}%
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}

        {/* Summary totals */}
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Weekly Summary</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(laborCategoryLabels).map(([category, label]) => {
              const categoryTotals = totals[category as keyof typeof totals]
              if (!categoryTotals || (categoryTotals.cost === 0 && categoryTotals.hours === 0)) return null
              
              return (
                <div key={category} className="bg-background rounded-lg p-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">{label}</h4>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground/80">Cost:</span>
                      <span className="text-sm font-medium">{formatCurrency(categoryTotals.cost)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground/80">Hours:</span>
                      <span className="text-sm font-medium">{categoryTotals.hours.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">Grand Total</h4>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Cost:</span>
                  <span className="text-lg font-bold text-blue-900">{formatCurrency(totals.grand.cost)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-700">Hours:</span>
                  <span className="text-lg font-bold text-blue-900">{totals.grand.hours.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-4 pb-8">
          <Link
            href={`/labor/forecasts?project_id=${projectId}`}
            className="px-4 py-2 border border-foreground/30 rounded-lg text-foreground/80 hover:bg-background"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="h-5 w-5" />
            {saving ? 'Saving...' : 'Save Weekly Data'}
          </button>
        </div>
      </div>
    </div>
  )
}