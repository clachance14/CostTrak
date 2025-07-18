'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Save, 
  AlertTriangle,
  Users,
  DollarSign,
  TrendingUp,
  Calendar,
  Download,
  Copy,
  RefreshCw,
  ChevronDown,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { formatWeekEnding, getWeekEndingDate } from '@/lib/validations/labor-forecast-v2'

interface CraftType {
  id: string
  name: string
  code: string
  category: 'direct' | 'indirect' | 'staff'
}

interface WeekData {
  weekEnding: string
  isActual: boolean
  entries: {
    craftTypeId: string
    headcount: number
    hours: number
    cost: number
    rate: number
  }[]
  totals: {
    headcount: number
    hours: number
    cost: number
    avgRate: number // Composite rate
  }
  cumulative: {
    hours: number
    cost: number
  }
}

interface ProjectInfo {
  id: string
  jobNumber: string
  name: string
}

interface RunningAverage {
  craftTypeId: string
  avgRate: number
  weeksOfData: number
}

interface CompositeRateInfo {
  overall: number
  recent: number
  totalHours: number
  totalCost: number
  weeksOfData: number
  categoryRates: {
    category: string
    rate: number
    hours: number
    cost: number
  }[]
}

const HOURS_PER_PERSON = 50

export default function ComprehensiveLaborForecastPage() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('project_id')
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [craftTypes, setCraftTypes] = useState<CraftType[]>([])
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([])
  const [runningAverages, setRunningAverages] = useState<RunningAverage[]>([])
  const [compositeRateInfo, setCompositeRateInfo] = useState<CompositeRateInfo | null>(null)
  const [historicalWeeks] = useState(12)
  const [forecastWeeks] = useState(26)
  
  // Track which cells have been edited
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set())
  
  // Dropdown states
  const [openDropdowns, setOpenDropdowns] = useState<Set<number>>(new Set())
  const dropdownRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  
  const fetchData = useCallback(async () => {
    if (!projectId) {
      console.error('No project ID provided in URL parameters')
      setError('No project selected. Please select a project from the projects page.')
      setLoading(false)
      return
    }

    console.log('Starting data fetch for project:', projectId)

    try {
      setLoading(true)
      setError(null)

      // Fetch project info
      console.log('Fetching project with ID:', projectId)
      const projectResponse = await fetch(`/api/projects/${projectId}`)
      
      if (!projectResponse.ok) {
        const errorText = await projectResponse.text()
        console.error('Project fetch failed:', {
          status: projectResponse.status,
          statusText: projectResponse.statusText,
          error: errorText
        })
        
        if (projectResponse.status === 401) {
          throw new Error('Unauthorized - Please log in again')
        } else if (projectResponse.status === 404) {
          throw new Error('Project not found')
        } else if (projectResponse.status === 403) {
          throw new Error('You do not have permission to view this project')
        } else {
          throw new Error(`Failed to fetch project: ${projectResponse.status} ${projectResponse.statusText}`)
        }
      }
      
      const data = await projectResponse.json()
      console.log('Project data received:', data)
      
      if (!data.project) {
        throw new Error('Invalid project data structure')
      }
      
      const projectData = data.project
      setProjectInfo({
        id: projectData.id,
        jobNumber: projectData.job_number,
        name: projectData.name
      })

      // Fetch craft types
      const craftTypesResponse = await fetch('/api/craft-types')
      if (!craftTypesResponse.ok) throw new Error('Failed to fetch craft types')
      const craftTypesData: any[] = await craftTypesResponse.json()
      setCraftTypes(craftTypesData.filter(ct => ct.is_active))

      // Fetch running averages
      const avgResponse = await fetch(
        `/api/labor-forecasts/running-averages?project_id=${projectId}&weeks_back=${historicalWeeks}`
      )
      if (!avgResponse.ok) throw new Error('Failed to fetch running averages')
      const avgData = await avgResponse.json()
      setRunningAverages(avgData.averages.map((avg: { craftTypeId: string; avgRate: number; weeksOfData: number }) => ({
        craftTypeId: avg.craftTypeId,
        avgRate: avg.avgRate,
        weeksOfData: avg.weeksOfData
      })))

      // Fetch composite rate
      const compositeResponse = await fetch(
        `/api/labor-forecasts/composite-rate?project_id=${projectId}&weeks_back=${historicalWeeks}`
      )
      if (!compositeResponse.ok) throw new Error('Failed to fetch composite rate')
      const compositeData = await compositeResponse.json()
      setCompositeRateInfo(compositeData.compositeRate)

      // Fetch historical actuals
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - historicalWeeks * 7)
      
      // Ensure dates are adjusted to Sunday
      const startDateSunday = getWeekEndingDate(startDate)
      const endDateSunday = getWeekEndingDate(endDate)
      
      const actualsResponse = await fetch(
        `/api/labor-forecasts/weekly-actuals?project_id=${projectId}`
      )
      if (!actualsResponse.ok) throw new Error('Failed to fetch actuals')
      const actualsData = await actualsResponse.json()

      // Fetch headcount forecasts
      const forecastResponse = await fetch(
        `/api/labor-forecasts/headcount?project_id=${projectId}&weeks_ahead=${forecastWeeks}`
      )
      if (!forecastResponse.ok) throw new Error('Failed to fetch forecasts')
      const forecastData = await forecastResponse.json()

      // Combine actuals and forecasts into unified weekly data
      const combinedWeeks: WeekData[] = []
      let cumulativeHours = 0
      let cumulativeCost = 0

      // Process historical weeks
      const allWeeks = generateWeekDates(startDateSunday, endDateSunday, forecastWeeks)
      
      allWeeks.forEach(weekDate => {
        const weekString = weekDate.toISOString()
        const isActual = weekDate <= new Date()
        
        const weekEntries = craftTypesData
          .filter(ct => ct.is_active)
          .map(craft => {
            if (isActual) {
              // Look for actual data
              const actual = actualsData.actuals?.find((a: { weekEnding: string; craftTypeId: string; totalHours: number; totalCost: number }) => 
                a.weekEnding === weekString && a.craftTypeId === craft.id
              )
              if (actual) {
                return {
                  craftTypeId: craft.id,
                  headcount: actual.totalHours / HOURS_PER_PERSON,
                  hours: actual.totalHours,
                  cost: actual.totalCost,
                  rate: actual.totalHours > 0 ? actual.totalCost / actual.totalHours : 0
                }
              }
            } else {
              // Look for forecast data
              const forecastWeek = forecastData.weeks?.find((w: { weekEnding: string; entries: any[] }) => 
                w.weekEnding === weekString
              )
              const forecastEntry = forecastWeek?.entries.find((e: { craftTypeId: string; headcount: number; totalHours: number; forecastedCost: number; avgRate: number }) => 
                e.craftTypeId === craft.id
              )
              if (forecastEntry && forecastEntry.headcount > 0) {
                return {
                  craftTypeId: craft.id,
                  headcount: forecastEntry.headcount,
                  hours: forecastEntry.totalHours,
                  cost: forecastEntry.forecastedCost,
                  rate: forecastEntry.avgRate
                }
              }
            }
            
            // No data for this craft/week
            return {
              craftTypeId: craft.id,
              headcount: 0,
              hours: 0,
              cost: 0,
              rate: 0
            }
          })

        // Calculate totals
        const weekTotals = weekEntries.reduce((totals, entry) => ({
          headcount: totals.headcount + entry.headcount,
          hours: totals.hours + entry.hours,
          cost: totals.cost + entry.cost
        }), { headcount: 0, hours: 0, cost: 0 })

        // Calculate composite rate
        const avgRate = weekTotals.hours > 0 ? weekTotals.cost / weekTotals.hours : 0

        cumulativeHours += weekTotals.hours
        cumulativeCost += weekTotals.cost

        combinedWeeks.push({
          weekEnding: weekString,
          isActual,
          entries: weekEntries,
          totals: {
            ...weekTotals,
            avgRate
          },
          cumulative: {
            hours: cumulativeHours,
            cost: cumulativeCost
          }
        })
      })

      setWeeklyData(combinedWeeks)
      console.log('Data fetch completed successfully')
    } catch (err) {
      console.error('Error fetching data:', err)
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        projectId,
        error: err
      })
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [projectId, historicalWeeks, forecastWeeks])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const isClickInsideDropdown = Array.from(dropdownRefs.current.values()).some(
        ref => ref && ref.contains(event.target as Node)
      )
      
      if (!isClickInsideDropdown) {
        setOpenDropdowns(new Set())
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const generateWeekDates = (startDate: Date, currentDate: Date, weeksAhead: number) => {
    const weeks = []
    // Ensure start date is a Sunday
    const date = getWeekEndingDate(new Date(startDate))
    const endDateSunday = getWeekEndingDate(new Date(currentDate))
    
    // Debug logging
    console.log('=== Comprehensive generateWeekDates Debug ===')
    console.log('Start date input:', startDate.toISOString().split('T')[0])
    console.log('Current date input:', currentDate.toISOString().split('T')[0])
    console.log('Start date Sunday:', date.toISOString().split('T')[0], '- Day:', date.getDay())
    console.log('End date Sunday:', endDateSunday.toISOString().split('T')[0], '- Day:', endDateSunday.getDay())
    console.log('Weeks ahead:', weeksAhead)
    
    // Historical weeks
    let weekCount = 0
    while (date <= endDateSunday) {
      const weekDate = new Date(date)
      weeks.push(weekDate)
      console.log(`Historical week ${weekCount}: ${weekDate.toISOString().split('T')[0]} - Day: ${weekDate.getDay()}`)
      date.setDate(date.getDate() + 7)
      weekCount++
    }
    
    console.log(`Total historical weeks: ${weekCount}`)
    
    // Future weeks
    for (let i = 0; i < weeksAhead; i++) {
      const weekDate = new Date(date)
      weeks.push(weekDate)
      if (i < 5 || weekDate.toISOString().split('T')[0].includes('2025-07')) {
        console.log(`Future week ${i}: ${weekDate.toISOString().split('T')[0]} - Day: ${weekDate.getDay()}`)
      }
      date.setDate(date.getDate() + 7)
    }
    
    // Check specifically for July 13, 2025
    const july13 = new Date('2025-07-13')
    const hasJuly13 = weeks.some(w => w.toISOString().split('T')[0] === '2025-07-13')
    console.log('Contains July 13, 2025?', hasJuly13)
    if (!hasJuly13) {
      console.log('July 13, 2025 is a:', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][july13.getDay()])
      console.log('Week ending for July 13, 2025:', getWeekEndingDate(july13).toISOString().split('T')[0])
    }
    
    console.log(`Total weeks generated: ${weeks.length}`)
    console.log('First week day:',  weeks[0]?.getDay(), '(0=Sunday)')
    console.log('Last week day:', weeks[weeks.length - 1]?.getDay(), '(0=Sunday)')
    console.log('=== End Comprehensive generateWeekDates Debug ===')
    
    return weeks
  }

  const updateHeadcount = (weekIndex: number, craftTypeId: string, value: string) => {
    const headcount = parseFloat(value) || 0
    const cellKey = `${weekIndex}-${craftTypeId}`
    
    setEditedCells(prev => new Set(prev).add(cellKey))
    
    setWeeklyData(prev => {
      const newData = [...prev]
      const week = newData[weekIndex]
      const entry = week.entries.find(e => e.craftTypeId === craftTypeId)
      
      if (entry) {
        const avgRate = runningAverages.find(ra => ra.craftTypeId === craftTypeId)?.avgRate || 0
        entry.headcount = headcount
        entry.hours = headcount * HOURS_PER_PERSON
        entry.cost = entry.hours * avgRate
        entry.rate = avgRate
        
        // Recalculate week totals
        week.totals = week.entries.reduce((totals, e) => ({
          headcount: totals.headcount + e.headcount,
          hours: totals.hours + e.hours,
          cost: totals.cost + e.cost,
          avgRate: 0 // Will calculate after
        }), { headcount: 0, hours: 0, cost: 0, avgRate: 0 })
        
        week.totals.avgRate = week.totals.hours > 0 ? week.totals.cost / week.totals.hours : 0
        
        // Recalculate cumulative totals
        let cumulativeHours = 0
        let cumulativeCost = 0
        newData.forEach(w => {
          cumulativeHours += w.totals.hours
          cumulativeCost += w.totals.cost
          w.cumulative = {
            hours: cumulativeHours,
            cost: cumulativeCost
          }
        })
      }
      
      return newData
    })
  }

  const copyWeekForward = (fromIndex: number, toEnd: boolean = true) => {
    setWeeklyData(prev => {
      const newData = [...prev]
      const fromWeek = newData[fromIndex]
      
      // Copy to subsequent forecast weeks
      const endIndex = toEnd ? newData.length : Math.min(fromIndex + 4, newData.length) // Copy 4 weeks if not to end
      
      for (let i = fromIndex + 1; i < endIndex; i++) {
        if (!newData[i].isActual) {
          newData[i].entries.forEach(entry => {
            const fromEntry = fromWeek.entries.find(e => e.craftTypeId === entry.craftTypeId)
            if (fromEntry) {
              entry.headcount = fromEntry.headcount
              entry.hours = entry.headcount * HOURS_PER_PERSON
              entry.cost = entry.hours * entry.rate
              setEditedCells(prev => new Set(prev).add(`${i}-${entry.craftTypeId}`))
            }
          })
          
          // Recalculate totals
          newData[i].totals = newData[i].entries.reduce((totals, e) => ({
            headcount: totals.headcount + e.headcount,
            hours: totals.hours + e.hours,
            cost: totals.cost + e.cost,
            avgRate: 0
          }), { headcount: 0, hours: 0, cost: 0, avgRate: 0 })
          
          newData[i].totals.avgRate = newData[i].totals.hours > 0 
            ? newData[i].totals.cost / newData[i].totals.hours : 0
        }
      }
      
      // Recalculate cumulative
      let cumulativeHours = 0
      let cumulativeCost = 0
      newData.forEach(w => {
        cumulativeHours += w.totals.hours
        cumulativeCost += w.totals.cost
        w.cumulative = {
          hours: cumulativeHours,
          cost: cumulativeCost
        }
      })
      
      return newData
    })
  }

  const clearAllForecasts = () => {
    if (!confirm('Are you sure you want to clear all forecast data? This will not affect historical actuals.')) {
      return
    }
    
    setWeeklyData(prev => {
      const newData = [...prev]
      
      newData.forEach(week => {
        if (!week.isActual) {
          week.entries.forEach(entry => {
            entry.headcount = 0
            entry.hours = 0
            entry.cost = 0
          })
          
          // Reset totals
          week.totals = {
            headcount: 0,
            hours: 0,
            cost: 0,
            avgRate: 0
          }
        }
      })
      
      // Recalculate cumulative
      let cumulativeHours = 0
      let cumulativeCost = 0
      newData.forEach(w => {
        cumulativeHours += w.totals.hours
        cumulativeCost += w.totals.cost
        w.cumulative = {
          hours: cumulativeHours,
          cost: cumulativeCost
        }
      })
      
      setEditedCells(new Set())
      return newData
    })
  }

  const handleSave = async () => {
    if (!projectId) return

    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      // Prepare forecast data (only non-actual weeks)
      const forecastWeeks = weeklyData
        .filter(week => !week.isActual)
        .map(week => ({
          week_ending: week.weekEnding,
          entries: week.entries
            .filter(entry => entry.headcount > 0)
            .map(entry => ({
              craft_type_id: entry.craftTypeId,
              headcount: entry.headcount,
              hours_per_person: HOURS_PER_PERSON
            }))
        }))
        .filter(week => week.entries.length > 0)

      if (forecastWeeks.length === 0) {
        setError('No forecast data to save')
        return
      }

      const response = await fetch('/api/labor-forecasts/headcount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          weeks: forecastWeeks
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save data')
      }

      setSuccessMessage(`Forecast saved successfully!`)
      setEditedCells(new Set())
    } catch (err) {
      console.error('Error saving:', err)
      setError(err instanceof Error ? err.message : 'Failed to save data')
    } finally {
      setSaving(false)
    }
  }

  const exportToExcel = async () => {
    // TODO: Implement Excel export
    alert('Excel export will be implemented soon')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-foreground">Loading labor forecast data...</p>
        </div>
      </div>
    )
  }

  if (!projectId || !projectInfo) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
            <div>
              <p className="text-yellow-800 font-medium">
                {!projectId ? 'No project selected' : 'Unable to load project information'}
              </p>
              <p className="text-yellow-700 text-sm mt-1">
                {error || 'Please select a project to view the comprehensive labor forecast.'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <Link 
              href="/projects" 
              className="inline-flex items-center px-4 py-2 border border-yellow-600 text-yellow-700 rounded-md hover:bg-yellow-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Projects
            </Link>
            <Link 
              href="/labor/forecasts" 
              className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
            >
              Back to Labor Forecasts
            </Link>
          </div>
        </div>
      </div>
    )
  }


  const totalForecastCost = weeklyData
    .filter(w => !w.isActual)
    .reduce((sum, w) => sum + w.totals.cost, 0)

  const totalForecastHours = weeklyData
    .filter(w => !w.isActual)
    .reduce((sum, w) => sum + w.totals.hours, 0)

  return (
    <div className="p-8 max-w-full">
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
            <h1 className="text-3xl font-bold text-foreground">Comprehensive Labor Forecast</h1>
            <p className="text-foreground mt-1">
              Project {projectInfo.jobNumber} - {projectInfo.name}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={clearAllForecasts}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Clear Forecasts
            </button>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 border border-foreground/30 rounded-lg hover:bg-background flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
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
              <p className="text-sm font-medium text-foreground">Composite Rate</p>
              <p className="text-2xl font-bold text-foreground">${compositeRateInfo?.overall.toFixed(2) || '0.00'}/hr</p>
              <p className="text-xs text-foreground/60 mt-1">
                {compositeRateInfo?.weeksOfData || 0} weeks of data
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-foreground" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Forecast Hours</p>
              <p className="text-2xl font-bold text-foreground">{totalForecastHours.toLocaleString()}</p>
              <p className="text-xs text-foreground/60 mt-1">Next {forecastWeeks} weeks</p>
            </div>
            <Calendar className="h-8 w-8 text-foreground" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Forecast Cost</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalForecastCost)}</p>
              <p className="text-xs text-foreground/60 mt-1">Total forecast</p>
            </div>
            <DollarSign className="h-8 w-8 text-foreground" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Avg Weekly Burn</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(totalForecastCost / forecastWeeks)}
              </p>
              <p className="text-xs text-foreground/60 mt-1">Forecast period</p>
            </div>
            <Users className="h-8 w-8 text-foreground" />
          </div>
        </div>
      </div>

      {/* Main Forecast Table */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Week Ending
                </th>
                {craftTypes.map(craft => (
                  <th key={craft.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {craft.code}
                    <div className="text-xs font-normal normal-case">
                      {craft.category}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">
                  Total HC
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">
                  Hours
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">
                  Cost
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-100">
                  Rate
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                  Cum Hours
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                  Cum Cost
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {weeklyData.map((week, weekIndex) => (
                <tr key={weekIndex} className={week.isActual ? 'bg-gray-50' : ''}>
                  <td className="sticky left-0 z-10 px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 bg-white border-r">
                    {formatWeekEnding(new Date(week.weekEnding))}
                    {week.isActual && (
                      <span className="ml-2 text-xs text-gray-500">(Actual)</span>
                    )}
                  </td>
                  {craftTypes.map(craft => {
                    const entry = week.entries.find(e => e.craftTypeId === craft.id)
                    const cellKey = `${weekIndex}-${craft.id}`
                    const isEdited = editedCells.has(cellKey)
                    
                    return (
                      <td key={craft.id} className="px-4 py-2 text-center">
                        {week.isActual ? (
                          <span className="text-sm text-gray-900">
                            {entry?.headcount ? entry.headcount.toFixed(1) : '-'}
                          </span>
                        ) : (
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={entry?.headcount || ''}
                            onChange={(e) => updateHeadcount(weekIndex, craft.id, e.target.value)}
                            className={`w-16 px-2 py-1 text-sm text-center border rounded ${
                              isEdited ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                            } focus:ring-2 focus:ring-blue-500`}
                            placeholder="0"
                          />
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-2 text-center text-sm font-medium bg-gray-50">
                    {week.totals.headcount.toFixed(1)}
                  </td>
                  <td className="px-4 py-2 text-center text-sm bg-gray-50">
                    {week.totals.hours.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-center text-sm bg-gray-50">
                    {formatCurrency(week.totals.cost)}
                  </td>
                  <td className="px-4 py-2 text-center text-sm bg-gray-50">
                    ${week.totals.avgRate.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-center text-sm bg-blue-50">
                    {week.cumulative.hours.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-center text-sm bg-blue-50">
                    {formatCurrency(week.cumulative.cost)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {!week.isActual && week.totals.headcount > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => {
                            setOpenDropdowns(prev => {
                              const newSet = new Set(prev)
                              if (newSet.has(weekIndex)) {
                                newSet.delete(weekIndex)
                              } else {
                                newSet.clear()
                                newSet.add(weekIndex)
                              }
                              return newSet
                            })
                          }}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          title="Copy options"
                        >
                          <Copy className="h-4 w-4" />
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        {openDropdowns.has(weekIndex) && (
                          <div
                            ref={el => {
                              if (el) dropdownRefs.current.set(weekIndex, el)
                            }}
                            className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200"
                          >
                            <button
                              onClick={() => {
                                copyWeekForward(weekIndex, false)
                                setOpenDropdowns(new Set())
                              }}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              Copy to next 4 weeks
                            </button>
                            <button
                              onClick={() => {
                                copyWeekForward(weekIndex, true)
                                setOpenDropdowns(new Set())
                              }}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              Copy to all remaining weeks
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center gap-6 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-50 border border-gray-300"></div>
          <span>Historical Actuals</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-white border border-gray-300"></div>
          <span>Forecast</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-50 border border-blue-500"></div>
          <span>Edited Cell</span>
        </div>
      </div>
    </div>
  )
}