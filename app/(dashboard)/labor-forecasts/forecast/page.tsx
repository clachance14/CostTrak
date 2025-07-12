'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Save, 
  AlertTriangle,
  Users,
  DollarSign,
  Clock,
  Copy,
  TrendingUp,
  Calculator
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getWeekEndingDate, formatWeekEnding } from '@/lib/validations/labor-forecast-v2'
import { createClient } from '@/lib/supabase/client'

interface CraftType {
  id: string
  name: string
  code: string
  laborCategory: 'direct' | 'indirect' | 'staff'
  avgRate: number
}

interface HeadcountEntry {
  craftTypeId: string
  craftName: string
  craftCode: string
  laborCategory: string
  headcount: number
  hoursPerPerson: number
  totalHours: number
  avgRate: number
  forecastedCost: number
}

interface WeekData {
  weekEnding: string
  entries: HeadcountEntry[]
  totals: {
    headcount: number
    totalHours: number
    forecastedCost: number
  }
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

const HOURS_PER_PERSON = 50 // Standard work week

export default function HeadcountForecastPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project_id')
  const weeksAheadParam = searchParams.get('weeks') || '8'
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [weeksAhead, setWeeksAhead] = useState(parseInt(weeksAheadParam, 10))
  const [craftTypes, setCraftTypes] = useState<CraftType[]>([])
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([])
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null)
  
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setError('No project selected')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Fetch headcount forecast data
      const response = await fetch(
        `/api/labor-forecasts/headcount?project_id=${projectId}&weeks_ahead=${weeksAhead}`
      )
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch data')
      }

      const data = await response.json()
      
      setProjectInfo(data.project)
      setCraftTypes(data.craftTypes)
      setWeeklyData(data.weeks)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [projectId, weeksAhead])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const updateHeadcount = (weekIndex: number, craftTypeId: string, value: string) => {
    const headcount = parseInt(value, 10) || 0
    
    setWeeklyData(prev => {
      const newData = [...prev]
      const week = newData[weekIndex]
      const entry = week.entries.find(e => e.craftTypeId === craftTypeId)
      
      if (entry) {
        entry.headcount = headcount
        entry.totalHours = headcount * entry.hoursPerPerson
        entry.forecastedCost = entry.totalHours * entry.avgRate
        
        // Recalculate week totals
        week.totals = week.entries.reduce((totals, e) => ({
          headcount: totals.headcount + e.headcount,
          totalHours: totals.totalHours + e.totalHours,
          forecastedCost: totals.forecastedCost + e.forecastedCost
        }), { headcount: 0, totalHours: 0, forecastedCost: 0 })
      }
      
      return newData
    })
  }

  const copyFromWeek = (fromIndex: number, toIndex: number) => {
    setWeeklyData(prev => {
      const newData = [...prev]
      const fromWeek = newData[fromIndex]
      const toWeek = newData[toIndex]
      
      // Copy headcount values
      toWeek.entries.forEach(entry => {
        const fromEntry = fromWeek.entries.find(e => e.craftTypeId === entry.craftTypeId)
        if (fromEntry) {
          entry.headcount = fromEntry.headcount
          entry.totalHours = entry.headcount * entry.hoursPerPerson
          entry.forecastedCost = entry.totalHours * entry.avgRate
        }
      })
      
      // Recalculate totals
      toWeek.totals = toWeek.entries.reduce((totals, e) => ({
        headcount: totals.headcount + e.headcount,
        totalHours: totals.totalHours + e.totalHours,
        forecastedCost: totals.forecastedCost + e.forecastedCost
      }), { headcount: 0, totalHours: 0, forecastedCost: 0 })
      
      return newData
    })
  }

  const handleSave = async () => {
    if (!projectId) return

    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      // Prepare data for save
      const weeks = weeklyData.map(week => ({
        week_ending: week.weekEnding,
        entries: week.entries
          .filter(entry => entry.headcount > 0)
          .map(entry => ({
            craft_type_id: entry.craftTypeId,
            headcount: entry.headcount,
            hours_per_person: entry.hoursPerPerson
          }))
      })).filter(week => week.entries.length > 0)

      if (weeks.length === 0) {
        setError('Please enter at least one headcount value')
        return
      }

      const payload = {
        project_id: projectId,
        weeks
      }

      const response = await fetch('/api/labor-forecasts/headcount', {
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

      // Refresh data
      fetchData()
    } catch (err) {
      console.error('Error saving:', err)
      setError(err instanceof Error ? err.message : 'Failed to save data')
    } finally {
      setSaving(false)
    }
  }

  const calculateGrandTotals = () => {
    return weeklyData.reduce((totals, week) => ({
      headcount: totals.headcount + week.totals.headcount,
      totalHours: totals.totalHours + week.totals.totalHours,
      forecastedCost: totals.forecastedCost + week.totals.forecastedCost
    }), { headcount: 0, totalHours: 0, forecastedCost: 0 })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!projectId || !projectInfo) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Please select a project to create headcount forecast.</p>
          <Link href="/projects" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
            Go to Projects
          </Link>
        </div>
      </div>
    )
  }

  const grandTotals = calculateGrandTotals()

  return (
    <div className="p-8 max-w-full">
      <div className="mb-8">
        <Link
          href={`/labor-forecasts?project_id=${projectId}`}
          className="inline-flex items-center text-sm text-gray-700 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Labor Forecasts
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Headcount Forecast</h1>
            <p className="text-gray-600 mt-1">
              Project {projectInfo.jobNumber} - {projectInfo.name}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Weeks ahead:</label>
              <select
                value={weeksAhead}
                onChange={(e) => setWeeksAhead(parseInt(e.target.value, 10))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="4">4 weeks</option>
                <option value="8">8 weeks</option>
                <option value="12">12 weeks</option>
                <option value="16">16 weeks</option>
              </select>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Headcount</p>
              <p className="text-2xl font-bold text-gray-900">{grandTotals.headcount}</p>
            </div>
            <Users className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900">{grandTotals.totalHours.toLocaleString()}</p>
            </div>
            <Clock className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Forecasted Cost</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(grandTotals.forecastedCost)}</p>
            </div>
            <DollarSign className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Weekly Cost</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(grandTotals.forecastedCost / weeksAhead)}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Weekly Tabs */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="border-b">
          <div className="flex overflow-x-auto">
            {weeklyData.map((week, index) => (
              <button
                key={week.weekEnding}
                onClick={() => setSelectedWeekIndex(index)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 ${
                  selectedWeekIndex === index
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-700 hover:text-gray-700'
                }`}
              >
                Week {index + 1}
                <br />
                <span className="text-xs">{formatWeekEnding(new Date(week.weekEnding))}</span>
              </button>
            ))}
          </div>
        </div>

        {selectedWeekIndex !== null && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Week ending {formatWeekEnding(new Date(weeklyData[selectedWeekIndex].weekEnding))}
              </h3>
              {selectedWeekIndex > 0 && (
                <button
                  onClick={() => copyFromWeek(selectedWeekIndex - 1, selectedWeekIndex)}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <Copy className="h-4 w-4" />
                  Copy from previous week
                </button>
              )}
            </div>

            {/* Group by labor category */}
            {Object.entries(laborCategoryLabels).map(([category, label]) => {
              const categoryEntries = weeklyData[selectedWeekIndex].entries.filter(
                entry => entry.laborCategory === category
              )
              
              if (categoryEntries.length === 0) return null

              return (
                <div key={category} className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">{label}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryEntries.map(entry => (
                      <div key={entry.craftTypeId} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900">{entry.craftName}</p>
                            <p className="text-sm text-gray-700">{entry.craftCode}</p>
                          </div>
                          {entry.avgRate > 0 && (
                            <span className="text-sm text-gray-700">
                              ${entry.avgRate.toFixed(2)}/hr
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={entry.headcount || ''}
                            onChange={(e) => updateHeadcount(selectedWeekIndex, entry.craftTypeId, e.target.value)}
                            className="w-20 px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                          />
                          <span className="text-sm text-gray-600">people</span>
                        </div>
                        
                        {entry.headcount > 0 && (
                          <div className="mt-2 text-sm text-gray-600">
                            <p>{entry.totalHours} hrs = {formatCurrency(entry.forecastedCost)}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Week totals */}
            <div className="mt-6 pt-6 border-t">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Week Headcount</p>
                  <p className="text-xl font-bold">{weeklyData[selectedWeekIndex].totals.headcount}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Week Hours</p>
                  <p className="text-xl font-bold">{weeklyData[selectedWeekIndex].totals.totalHours.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Week Cost</p>
                  <p className="text-xl font-bold">{formatCurrency(weeklyData[selectedWeekIndex].totals.forecastedCost)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex justify-end gap-4 mt-6 pb-8">
        <Link
          href={`/labor-forecasts?project_id=${projectId}`}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Save className="h-5 w-5" />
          {saving ? 'Saving...' : 'Save Forecast'}
        </button>
      </div>
    </div>
  )
}