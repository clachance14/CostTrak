'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
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

interface CategoryEntry {
  category: 'direct' | 'indirect' | 'staff'
  headcount: number
  hours: number
  cost: number
  rate: number
}

interface WeekData {
  weekEnding: string
  isActual: boolean
  categories: {
    direct: CategoryEntry
    indirect: CategoryEntry
    staff: CategoryEntry
  }
  totals: {
    headcount: number
    hours: number
    cost: number
    avgRate: number
  }
  cumulative: {
    hours: number
    cost: number
  }
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

interface ActualData {
  weekEnding: string
  craftTypeId: string
  totalHours: number
  totalCost: number
}

interface ForecastEntry {
  craftTypeId: string
  headcount: number
  totalHours: number
  forecastedCost: number
}

interface LaborForecastTabProps {
  projectId: string
  projectName: string
  jobNumber: string
}

const HOURS_PER_PERSON = 50

export function LaborForecastTab({ projectId }: LaborForecastTabProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  const [craftTypes, setCraftTypes] = useState<CraftType[]>([])
  const [weeklyData, setWeeklyData] = useState<WeekData[]>([])
  const [runningAverages, setRunningAverages] = useState<RunningAverage[]>([])
  const [compositeRateInfo, setCompositeRateInfo] = useState<CompositeRateInfo | null>(null)
  const [historicalWeeks] = useState(16) // Increased to ensure we capture July data
  const [forecastWeeks] = useState(26)
  
  // Track which cells have been edited
  const [editedCells, setEditedCells] = useState<Set<string>>(new Set())
  
  // Dropdown states
  const [openDropdowns, setOpenDropdowns] = useState<Set<number>>(new Set())
  const dropdownRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch craft types with better error handling and retry logic
      let loadedCraftTypes: CraftType[] = []
      // let craftTypesError: Error | null = null
      
      // Retry logic for craft types
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const craftTypesResponse = await fetch('/api/craft-types')
          console.log(`Craft types fetch attempt ${attempt}, status:`, craftTypesResponse.status)
          
          if (!craftTypesResponse.ok) {
            const errorText = await craftTypesResponse.text()
            console.error('Craft types fetch failed:', {
              attempt,
              status: craftTypesResponse.status,
              statusText: craftTypesResponse.statusText,
              body: errorText
            })
            
            if (craftTypesResponse.status === 401) {
              throw new Error('Authentication required. Please log in again.')
            } else if (craftTypesResponse.status === 500) {
              if (attempt < 3) {
                console.log(`Server error, retrying in ${attempt} second(s)...`)
                await new Promise(resolve => setTimeout(resolve, attempt * 1000))
                continue
              }
              throw new Error('Server error loading craft types. Please try again later.')
            } else {
              throw new Error(`Failed to fetch craft types: ${craftTypesResponse.statusText}`)
            }
          }
          
          const craftTypesData = await craftTypesResponse.json()
          console.log('Craft types API response:', craftTypesData)
          // Handle both possible response formats
          loadedCraftTypes = Array.isArray(craftTypesData) ? craftTypesData : (craftTypesData.craftTypes || [])
          setCraftTypes(loadedCraftTypes)
          // craftTypesError = null
          break // Success, exit retry loop
          
        } catch (error) {
          // craftTypesError = error instanceof Error ? error : new Error('Unknown error fetching craft types')
          console.error(`Error fetching craft types (attempt ${attempt}/3):`, error)
          
          // Only throw authentication errors immediately
          if (error instanceof Error && error.message.includes('Authentication')) {
            throw error
          }
          
          // For other errors, continue retrying
          if (attempt === 3) {
            // Final attempt failed, continue with empty craft types
            console.warn('All attempts to fetch craft types failed, continuing with empty list')
            setCraftTypes([])
          }
        }
      }

      // Fetch running averages
      let fetchedRunningAverages: RunningAverage[] = []
      const avgResponse = await fetch(
        `/api/labor-forecasts/running-averages?project_id=${projectId}&weeks_back=${historicalWeeks}`
      )
      if (!avgResponse.ok) {
        const errorText = await avgResponse.text()
        console.error('Running averages fetch failed:', avgResponse.status, errorText)
        // Don't throw - just continue with empty averages
        fetchedRunningAverages = []
      } else {
        const avgData = await avgResponse.json()
        fetchedRunningAverages = avgData.averages?.map((avg: { craftTypeId: string; avgRate: number; weeksOfData: number }) => ({
          craftTypeId: avg.craftTypeId,
          avgRate: avg.avgRate,
          weeksOfData: avg.weeksOfData
        })) || []
      }
      setRunningAverages(fetchedRunningAverages)

      // Fetch composite rate
      const compositeResponse = await fetch(
        `/api/labor-forecasts/composite-rate?project_id=${projectId}&weeks_back=${historicalWeeks}`
      )
      if (!compositeResponse.ok) {
        console.error('Composite rate fetch failed:', compositeResponse.status)
        // Don't throw error, just continue without composite rate
        setCompositeRateInfo(null)
      } else {
        const compositeData = await compositeResponse.json()
        setCompositeRateInfo(compositeData.compositeRate)
      }

      // Fetch historical actuals
      const actualsResponse = await fetch(
        `/api/labor-forecasts/weekly-actuals?project_id=${projectId}`
      )
      if (!actualsResponse.ok) throw new Error('Failed to fetch actuals')
      const actualsData = await actualsResponse.json()
      
      // Debug logging
      console.log('Actuals data from API:', actualsData)
      console.log('Number of actuals:', actualsData.actuals?.length || 0)
      if (actualsData.actuals?.length > 0) {
        console.log('First actual record:', actualsData.actuals[0])
        console.log('Actual dates:', actualsData.actuals.map((a: { weekEnding: string }) => a.weekEnding))
      }

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

      // Generate week dates based on actual data
      let startDate: Date
      const endDate = new Date()
      
      // Find the earliest actual data date
      if (actualsData.actuals?.length > 0) {
        const actualDates = actualsData.actuals.map((a: any) => new Date(a.weekEnding))
        const earliestActualDate = new Date(Math.min(...actualDates.map((d: Date) => d.getTime())))
        // Start 2 weeks before the earliest actual data
        startDate = new Date(earliestActualDate)
        startDate.setDate(startDate.getDate() - 14) // 2 weeks before
        console.log('Earliest actual date:', earliestActualDate.toISOString().split('T')[0])
        console.log('Start date (2 weeks before):', startDate.toISOString().split('T')[0])
      } else {
        // No actuals, use default logic
        startDate = new Date()
        startDate.setDate(startDate.getDate() - historicalWeeks * 7)
      }
      
      // Ensure dates are adjusted to Sunday
      const startDateSunday = getWeekEndingDate(startDate)
      const endDateSunday = getWeekEndingDate(endDate)
      
      const allWeeks = generateWeekDates(startDateSunday, endDateSunday, forecastWeeks, actualsData.actuals)
      
      // Debug logging for dates
      console.log('Generated week dates:', allWeeks.map(d => d.toISOString().split('T')[0]))
      console.log('Craft types loaded:', loadedCraftTypes.length, 'types')
      if (loadedCraftTypes.length > 0) {
        console.log('Sample craft type:', loadedCraftTypes[0])
      }
      
      // Calculate category average rates from running averages
      const categoryRates = {
        direct: 0,
        indirect: 0,
        staff: 0
      }
      
      const categoryCounts = {
        direct: 0,
        indirect: 0,
        staff: 0
      }
      
      // Calculate weighted average rates by category
      loadedCraftTypes.forEach(craft => {
        const runningAvg = fetchedRunningAverages.find(ra => ra.craftTypeId === craft.id)
        if (runningAvg && runningAvg.avgRate > 0) {
          categoryRates[craft.category] += runningAvg.avgRate
          categoryCounts[craft.category]++
        }
      })
      
      // Average the rates
      Object.keys(categoryRates).forEach(cat => {
        const category = cat as 'direct' | 'indirect' | 'staff'
        if (categoryCounts[category] > 0) {
          categoryRates[category] = categoryRates[category] / categoryCounts[category]
        }
      })

      // Create a map of actuals by week for faster lookup
      // Convert any Saturday dates to Sunday for consistency
      const actualsMap = new Map<string, any[]>()
      actualsData.actuals?.forEach((actual: ActualData) => {
        // Convert to Sunday if needed
        const actualDate = new Date(actual.weekEnding)
        const sundayDate = getWeekEndingDate(actualDate)
        const sundayDateOnly = sundayDate.toISOString().split('T')[0]
        
        if (!actualsMap.has(sundayDateOnly)) {
          actualsMap.set(sundayDateOnly, [])
        }
        actualsMap.get(sundayDateOnly)!.push(actual)
      })
      
      console.log('Actuals map keys (converted to Sunday):', Array.from(actualsMap.keys()).sort())
      console.log('All generated week dates:', allWeeks.map(d => d.toISOString().split('T')[0]))
      
      allWeeks.forEach((weekDate, weekIndex) => {
        const weekString = weekDate.toISOString()
        const weekDateOnly = weekDate.toISOString().split('T')[0] // Get YYYY-MM-DD format
        const isActual = weekDate <= new Date()
        
        // Initialize categories
        const categories: WeekData['categories'] = {
          direct: { category: 'direct', headcount: 0, hours: 0, cost: 0, rate: categoryRates.direct },
          indirect: { category: 'indirect', headcount: 0, hours: 0, cost: 0, rate: categoryRates.indirect },
          staff: { category: 'staff', headcount: 0, hours: 0, cost: 0, rate: categoryRates.staff }
        }
        
        if (isActual && actualsMap.has(weekDateOnly)) {
          // Process actuals for this week
          const weekActuals = actualsMap.get(weekDateOnly)!
          console.log(`Processing ${weekActuals.length} actuals for week ${weekDateOnly}`)
          
          weekActuals.forEach(actual => {
            const craft = loadedCraftTypes.find(c => c.id === actual.craftTypeId)
            if (craft) {
              console.log(`Found craft ${craft.name} (${craft.category}) with ${actual.totalHours} hours`)
              const cat = categories[craft.category]
              const oldHeadcount = cat.headcount
              cat.headcount += actual.totalHours / HOURS_PER_PERSON
              cat.hours += actual.totalHours
              cat.cost += actual.totalCost
              cat.rate = cat.hours > 0 ? cat.cost / cat.hours : categoryRates[craft.category]
              console.log(`Updated ${craft.category}: headcount ${oldHeadcount} -> ${cat.headcount}, hours: ${actual.totalHours}`)
            } else {
              console.log(`WARNING: No craft found for craftTypeId: ${actual.craftTypeId}`)
              console.log('Available craft type IDs:', loadedCraftTypes.map(c => c.id))
            }
          })
        } else if (isActual && weekIndex === 0) {
          console.log(`No actuals found for week ${weekDateOnly}`)
        } else {
          // Sum forecasts by category
          const forecastWeek = forecastData.weeks?.find((w: { weekEnding: string }) => w.weekEnding === weekString)
          if (forecastWeek) {
            forecastWeek.entries?.forEach((entry: ForecastEntry) => {
              const craft = loadedCraftTypes.find(c => c.id === entry.craftTypeId)
              if (craft && entry.headcount > 0) {
                const cat = categories[craft.category]
                cat.headcount += entry.headcount
                cat.hours += entry.totalHours
                cat.cost += entry.forecastedCost
              }
            })
          }
        }

        // Calculate totals
        const weekTotals = Object.values(categories).reduce((totals, cat) => ({
          headcount: totals.headcount + cat.headcount,
          hours: totals.hours + cat.hours,
          cost: totals.cost + cat.cost
        }), { headcount: 0, hours: 0, cost: 0 })

        // Calculate composite rate
        const avgRate = weekTotals.hours > 0 ? weekTotals.cost / weekTotals.hours : 0

        cumulativeHours += weekTotals.hours
        cumulativeCost += weekTotals.cost

        combinedWeeks.push({
          weekEnding: weekString,
          isActual,
          categories,
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
    } catch (err) {
      console.error('Error fetching data:', err)
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

  const generateWeekDates = (startDate: Date, currentDate: Date, weeksAhead: number, actuals?: any[]) => {
    const weeks = []
    // Ensure start date is a Sunday
    const date = getWeekEndingDate(new Date(startDate))
    const endDateSunday = getWeekEndingDate(new Date(currentDate))
    
    // Debug logging
    console.log('=== generateWeekDates Debug ===')
    console.log('Start date input:', startDate.toISOString().split('T')[0])
    console.log('Current date input:', currentDate.toISOString().split('T')[0])
    console.log('Start date Sunday:', date.toISOString().split('T')[0])
    console.log('End date Sunday:', endDateSunday.toISOString().split('T')[0])
    console.log('Weeks ahead:', weeksAhead)
    
    // If we have actuals, also ensure we include all actual dates
    const actualDates = new Set<string>()
    if (actuals && actuals.length > 0) {
      actuals.forEach((actual: ActualData) => {
        const actualDate = getWeekEndingDate(new Date(actual.weekEnding))
        actualDates.add(actualDate.toISOString().split('T')[0])
      })
      console.log('Unique actual week endings:', Array.from(actualDates).sort())
    }
    
    // Historical weeks
    let weekCount = 0
    while (date <= endDateSunday) {
      const weekDate = new Date(date)
      weeks.push(weekDate)
      console.log(`Historical week ${weekCount}: ${weekDate.toISOString().split('T')[0]}`)
      date.setDate(date.getDate() + 7)
      weekCount++
    }
    
    console.log(`Total historical weeks: ${weekCount}`)
    
    // Check if we missed any actual dates and add them
    if (actualDates.size > 0) {
      const generatedDates = new Set(weeks.map(d => d.toISOString().split('T')[0]))
      actualDates.forEach(actualDateStr => {
        if (!generatedDates.has(actualDateStr)) {
          console.log(`Adding missing actual date: ${actualDateStr}`)
          weeks.push(new Date(actualDateStr))
        }
      })
      // Sort weeks chronologically
      weeks.sort((a, b) => a.getTime() - b.getTime())
    }
    
    // Future weeks (ensure we start from the last date in weeks array)
    const lastDate = new Date(weeks[weeks.length - 1])
    for (let i = 0; i < weeksAhead; i++) {
      lastDate.setDate(lastDate.getDate() + 7)
      const weekDate = new Date(lastDate)
      weeks.push(weekDate)
      if (i < 5 || weekDate.toISOString().split('T')[0].includes('2025-07')) {
        console.log(`Future week ${i}: ${weekDate.toISOString().split('T')[0]}`)
      }
    }
    
    // Check specifically for July 13, 2025
    const july13 = new Date('2025-07-13')
    const hasJuly13 = weeks.some(w => w.toISOString().split('T')[0] === '2025-07-13')
    console.log('Contains July 13, 2025?', hasJuly13)
    if (!hasJuly13) {
      console.log('July 13, 2025 would be week ending:', getWeekEndingDate(july13).toISOString().split('T')[0])
    }
    
    console.log(`Total weeks generated: ${weeks.length}`)
    console.log('=== End generateWeekDates Debug ===')
    
    return weeks
  }

  const updateHeadcount = (weekIndex: number, category: 'direct' | 'indirect' | 'staff', value: string) => {
    const headcount = parseFloat(value) || 0
    const cellKey = `${weekIndex}-${category}`
    
    setEditedCells(prev => new Set(prev).add(cellKey))
    
    setWeeklyData(prev => {
      const newData = [...prev]
      const week = newData[weekIndex]
      const categoryEntry = week.categories[category]
      
      if (categoryEntry) {
        categoryEntry.headcount = headcount
        categoryEntry.hours = headcount * HOURS_PER_PERSON
        categoryEntry.cost = categoryEntry.hours * categoryEntry.rate
        
        // Recalculate week totals
        week.totals = Object.values(week.categories).reduce((totals, cat) => ({
          headcount: totals.headcount + cat.headcount,
          hours: totals.hours + cat.hours,
          cost: totals.cost + cat.cost,
          avgRate: 0
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
      const endIndex = toEnd ? newData.length : Math.min(fromIndex + 4, newData.length)
      
      for (let i = fromIndex + 1; i < endIndex; i++) {
        if (!newData[i].isActual) {
          // Copy category values
          Object.keys(newData[i].categories).forEach(cat => {
            const category = cat as 'direct' | 'indirect' | 'staff'
            const fromCat = fromWeek.categories[category]
            const toCat = newData[i].categories[category]
            
            toCat.headcount = fromCat.headcount
            toCat.hours = toCat.headcount * HOURS_PER_PERSON
            toCat.cost = toCat.hours * toCat.rate
            setEditedCells(prev => new Set(prev).add(`${i}-${category}`))
          })
          
          // Recalculate totals
          newData[i].totals = Object.values(newData[i].categories).reduce((totals, cat) => ({
            headcount: totals.headcount + cat.headcount,
            hours: totals.hours + cat.hours,
            cost: totals.cost + cat.cost,
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
          Object.values(week.categories).forEach(cat => {
            cat.headcount = 0
            cat.hours = 0
            cat.cost = 0
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
    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      // Prepare forecast data (only non-actual weeks)
      // We need to convert categories back to individual craft types for saving
      const forecastWeeks = weeklyData
        .filter(week => !week.isActual)
        .map(week => {
          const entries: any[] = []
          
          // For each category with headcount, distribute evenly among craft types
          Object.entries(week.categories).forEach(([cat, data]) => {
            if (data.headcount > 0) {
              const categoryCrafts = craftTypes.filter(ct => ct.category === cat)
              if (categoryCrafts.length > 0) {
                // Distribute headcount evenly among craft types in this category
                const headcountPerCraft = data.headcount / categoryCrafts.length
                categoryCrafts.forEach(craft => {
                  entries.push({
                    craft_type_id: craft.id,
                    headcount: headcountPerCraft,
                    hours_per_person: HOURS_PER_PERSON
                  })
                })
              }
            }
          })
          
          return {
            week_ending: week.weekEnding,
            entries
          }
        })
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
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-foreground">Loading labor forecast data...</p>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Labor Forecast</h2>
          <p className="text-foreground/60 mt-1">
            Enter headcount by craft type to forecast labor costs
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">{error}</p>
              {error.includes('Authentication') && (
                <p className="text-red-600 text-sm mt-1">
                  Your session may have expired. Please refresh the page or log in again.
                </p>
              )}
              {error.includes('Server error') && (
                <p className="text-red-600 text-sm mt-1">
                  The server is experiencing issues. We&apos;ll retry automatically. If the problem persists, please contact support.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Direct Labor
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Indirect Labor
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff
                </th>
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
                  {/* Direct Labor */}
                  <td className="px-4 py-2 text-center">
                    {week.isActual ? (
                      <span className="text-sm text-gray-900">
                        {week.categories.direct.headcount.toFixed(1)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={week.categories.direct.headcount || ''}
                        onChange={(e) => updateHeadcount(weekIndex, 'direct', e.target.value)}
                        className={`w-20 px-2 py-1 text-sm text-center border rounded ${
                          editedCells.has(`${weekIndex}-direct`) ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500`}
                        placeholder="0"
                      />
                    )}
                  </td>
                  
                  {/* Indirect Labor */}
                  <td className="px-4 py-2 text-center">
                    {week.isActual ? (
                      <span className="text-sm text-gray-900">
                        {week.categories.indirect.headcount.toFixed(1)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={week.categories.indirect.headcount || ''}
                        onChange={(e) => updateHeadcount(weekIndex, 'indirect', e.target.value)}
                        className={`w-20 px-2 py-1 text-sm text-center border rounded ${
                          editedCells.has(`${weekIndex}-indirect`) ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500`}
                        placeholder="0"
                      />
                    )}
                  </td>
                  
                  {/* Staff */}
                  <td className="px-4 py-2 text-center">
                    {week.isActual ? (
                      <span className="text-sm text-gray-900">
                        {week.categories.staff.headcount.toFixed(1)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={week.categories.staff.headcount || ''}
                        onChange={(e) => updateHeadcount(weekIndex, 'staff', e.target.value)}
                        className={`w-20 px-2 py-1 text-sm text-center border rounded ${
                          editedCells.has(`${weekIndex}-staff`) ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500`}
                        placeholder="0"
                      />
                    )}
                  </td>
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
      <div className="flex items-center gap-6 text-sm text-gray-600">
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