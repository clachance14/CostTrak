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
import { formatWeekEnding, getWeekEndingDate, getWeekStartingDate } from '@/lib/validations/labor-forecast-v2'

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
  hoursPerWeek: number
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
  craftTypeId?: string
  laborCategory?: string
  totalHours: number
  totalCost: number
  actualHours?: number
  actualCost?: number
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
          const craftTypesResponse = await fetch('/api/craft-types', { credentials: 'include' })
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
        `/api/labor-forecasts/running-averages?project_id=${projectId}&weeks_back=${historicalWeeks}`,
        { credentials: 'include' }
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
      console.log(`[DEBUG] Fetching composite rate for project ${projectId} with ${historicalWeeks} weeks back`)
      const compositeResponse = await fetch(
        `/api/labor-forecasts/composite-rate?project_id=${projectId}&weeks_back=${historicalWeeks}`,
        { credentials: 'include' }
      )
      if (!compositeResponse.ok) {
        const errorText = await compositeResponse.text()
        console.error('[DEBUG] Composite rate fetch failed:', {
          status: compositeResponse.status,
          statusText: compositeResponse.statusText,
          errorText
        })
        // Don't throw error, just continue without composite rate
        setCompositeRateInfo(null)
      } else {
        const compositeData = await compositeResponse.json()
        console.log('[DEBUG] Composite rate response:', compositeData)
        console.log('[DEBUG] Composite rate info:', {
          overall: compositeData.compositeRate?.overall,
          totalHours: compositeData.compositeRate?.totalHours,
          totalCost: compositeData.compositeRate?.totalCost,
          weeksOfData: compositeData.compositeRate?.weeksOfData,
          categoryRates: compositeData.compositeRate?.categoryRates
        })
        setCompositeRateInfo(compositeData.compositeRate)
      }

      // Fetch historical actuals
      const actualsResponse = await fetch(
        `/api/labor-forecasts/weekly-actuals?project_id=${projectId}`,
        { credentials: 'include' }
      )
      if (!actualsResponse.ok) {
        const errorText = await actualsResponse.text()
        console.error('Actuals fetch failed:', {
          status: actualsResponse.status,
          statusText: actualsResponse.statusText,
          errorText
        })
        throw new Error(`Failed to fetch actuals: ${actualsResponse.status} ${actualsResponse.statusText}`)
      }
      const actualsData = await actualsResponse.json()
      
      // Debug logging
      console.log('[DEBUG] Actuals data from API:', actualsData)
      console.log('[DEBUG] Number of actuals:', actualsData.actuals?.length || 0)
      if (actualsData.actuals?.length > 0) {
        console.log('[DEBUG] First actual record:', actualsData.actuals[0])
        console.log('[DEBUG] Actual dates:', actualsData.actuals.map((a: { weekEnding: string }) => a.weekEnding))
        // Check data format
        const hasLaborCategory = actualsData.actuals.some((a: ActualData) => a.laborCategory)
        const hasCraftTypeId = actualsData.actuals.some((a: ActualData) => a.craftTypeId)
        console.log('[DEBUG] Data format - hasLaborCategory:', hasLaborCategory, 'hasCraftTypeId:', hasCraftTypeId)
      }

      // Calculate start date for forecast API based on actuals
      let forecastStartDate: Date
      if (actualsData.actuals?.length > 0) {
        const actualDates = actualsData.actuals.map((a: any) => new Date(a.weekEnding))
        const earliestActualDate = new Date(Math.min(...actualDates.map((d: Date) => d.getTime())))
        // Start 2 weeks before the earliest actual data
        forecastStartDate = new Date(earliestActualDate)
        forecastStartDate.setDate(forecastStartDate.getDate() - 14) // 2 weeks before
      } else {
        // No actuals, use default logic
        forecastStartDate = new Date()
        forecastStartDate.setDate(forecastStartDate.getDate() - historicalWeeks * 7)
      }
      const startDateParam = forecastStartDate.toISOString().split('T')[0]

      // Fetch headcount forecasts with calculated start date
      // Note: We need to fetch enough weeks to cover both historical and future forecast data
      const totalWeeksToFetch = Math.max(forecastWeeks + 52, 78) // At least 78 weeks to cover from March to following February
      console.log(`[DEBUG] Fetching forecast data starting from ${startDateParam} for ${totalWeeksToFetch} weeks`)
      const forecastResponse = await fetch(
        `/api/labor-forecasts/headcount?project_id=${projectId}&weeks_ahead=${totalWeeksToFetch}&start_date=${startDateParam}`,
        { credentials: 'include' }
      )
      if (!forecastResponse.ok) {
        const errorText = await forecastResponse.text()
        console.error('Forecast fetch failed:', {
          status: forecastResponse.status,
          statusText: forecastResponse.statusText,
          errorText
        })
        throw new Error(`Failed to fetch forecasts: ${forecastResponse.status} ${forecastResponse.statusText}`)
      }
      const forecastData = await forecastResponse.json()
      
      // Debug logging for forecast data
      console.log('[DEBUG] Forecast data from API:', forecastData)
      console.log('[DEBUG] Number of forecast weeks:', forecastData.weeks?.length || 0)
      if (forecastData.weeks?.length > 0) {
        console.log('[DEBUG] First forecast week:', forecastData.weeks[0])
        console.log('[DEBUG] Forecast week dates:', forecastData.weeks.map((w: any) => w.weekEnding))
        // Check the structure of entries
        const firstWeekWithData = forecastData.weeks.find((w: any) => 
          w.entries?.some((e: any) => e.headcount > 0)
        )
        if (firstWeekWithData) {
          console.log('[DEBUG] First week with headcount data:', firstWeekWithData.weekEnding)
          console.log('[DEBUG] Entry structure:', firstWeekWithData.entries[0])
        }
      }

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
      
      // Calculate weighted average rates by category from actuals
      const categoryRates = {
        direct: 0,
        indirect: 0,
        staff: 0
      }
      
      const categoryHours = {
        direct: 0,
        indirect: 0,
        staff: 0
      }
      
      const categoryCosts = {
        direct: 0,
        indirect: 0,
        staff: 0
      }
      
      // Sum up hours and costs by category from labor actuals
      // Handle both craft-type-based and category-based actuals
      if (actualsData.actuals && actualsData.actuals.length > 0) {
        // Check if we have category-based data
        const hasCategoryData = actualsData.actuals.some((a: ActualData) => a.laborCategory)
        
        if (hasCategoryData) {
          // New category-based approach
          console.log('[DEBUG] Processing category-based actuals')
          actualsData.actuals.forEach((actual: ActualData) => {
            if (actual.laborCategory && actual.laborCategory in categoryHours) {
              const category = actual.laborCategory as 'direct' | 'indirect' | 'staff'
              const hours = actual.actualHours || actual.totalHours || 0
              const cost = actual.actualCost || actual.totalCost || 0
              categoryHours[category] += hours
              categoryCosts[category] += cost
              console.log(`[DEBUG] Added ${hours} hours and $${cost} cost to ${category}`)
            }
          })
        } else {
          // Legacy craft-type-based approach
          console.log('[DEBUG] Processing craft-type-based actuals')
          loadedCraftTypes.forEach(craft => {
            const craftActuals = actualsData.actuals?.filter((a: ActualData) => a.craftTypeId === craft.id) || []
            const totalHours = craftActuals.reduce((sum, a) => sum + (a.actualHours || a.totalHours || 0), 0)
            const totalCost = craftActuals.reduce((sum, a) => sum + (a.actualCost || a.totalCost || 0), 0)
            
            categoryHours[craft.category] += totalHours
            categoryCosts[craft.category] += totalCost
          })
        }
      }
      
      // Calculate weighted average rate per category
      Object.keys(categoryRates).forEach(cat => {
        const category = cat as 'direct' | 'indirect' | 'staff'
        if (categoryHours[category] > 0) {
          categoryRates[category] = categoryCosts[category] / categoryHours[category]
        }
      })
      
      console.log('Category rates calculated:', {
        direct: { hours: categoryHours.direct, cost: categoryCosts.direct, rate: categoryRates.direct },
        indirect: { hours: categoryHours.indirect, cost: categoryCosts.indirect, rate: categoryRates.indirect },
        staff: { hours: categoryHours.staff, cost: categoryCosts.staff, rate: categoryRates.staff }
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
        const isActual = actualsMap.has(weekDateOnly) // Only mark as actual if we have data
        
        // Initialize categories
        const categories: WeekData['categories'] = {
          direct: { category: 'direct', headcount: 0, hours: 0, cost: 0, rate: categoryRates.direct },
          indirect: { category: 'indirect', headcount: 0, hours: 0, cost: 0, rate: categoryRates.indirect },
          staff: { category: 'staff', headcount: 0, hours: 0, cost: 0, rate: categoryRates.staff }
        }
        
        if (isActual) {
          // Process actuals for this week
          const weekActuals = actualsMap.get(weekDateOnly)!
          console.log(`Processing ${weekActuals.length} actuals for week ${weekDateOnly}`)
          
          weekActuals.forEach(actual => {
            // Handle category-based actuals
            if (actual.laborCategory) {
              const category = actual.laborCategory as 'direct' | 'indirect' | 'staff'
              if (category in categories) {
                const cat = categories[category]
                const hours = actual.actualHours || actual.totalHours || 0
                const cost = actual.actualCost || actual.totalCost || 0
                const oldHeadcount = cat.headcount
                cat.headcount += hours / HOURS_PER_PERSON
                cat.hours += hours
                cat.cost += cost
                cat.rate = cat.hours > 0 ? cat.cost / cat.hours : categoryRates[category]
                console.log(`[DEBUG] Category-based actual - Updated ${category}: headcount ${oldHeadcount.toFixed(2)} -> ${cat.headcount.toFixed(2)}, hours: ${hours}, cost: $${cost}`)
              }
            } 
            // Handle craft-type-based actuals (legacy)
            else if (actual.craftTypeId) {
              const craft = loadedCraftTypes.find(c => c.id === actual.craftTypeId)
              if (craft) {
                console.log(`Found craft ${craft.name} (${craft.category}) with ${actual.totalHours} hours`)
                const cat = categories[craft.category]
                const hours = actual.actualHours || actual.totalHours || 0
                const cost = actual.actualCost || actual.totalCost || 0
                const oldHeadcount = cat.headcount
                cat.headcount += hours / HOURS_PER_PERSON
                cat.hours += hours
                cat.cost += cost
                cat.rate = cat.hours > 0 ? cat.cost / cat.hours : categoryRates[craft.category]
                console.log(`Updated ${craft.category}: headcount ${oldHeadcount} -> ${cat.headcount}, hours: ${hours}`)
              } else {
                console.log(`WARNING: No craft found for craftTypeId: ${actual.craftTypeId}`)
                console.log('Available craft type IDs:', loadedCraftTypes.map(c => c.id))
              }
            }
          })
        } else {
          // Use forecast data when no actuals exist
          const forecastWeek = forecastData.weeks?.find((w: { weekEnding: string }) => {
            // Convert both dates to date-only format for comparison
            // Handle timezone differences by normalizing to local date strings
            const wDate = new Date(w.weekEnding)
            const wDateLocal = `${wDate.getFullYear()}-${String(wDate.getMonth() + 1).padStart(2, '0')}-${String(wDate.getDate()).padStart(2, '0')}`
            const targetDateLocal = `${weekDate.getFullYear()}-${String(weekDate.getMonth() + 1).padStart(2, '0')}-${String(weekDate.getDate()).padStart(2, '0')}`
            
            const match = wDateLocal === targetDateLocal
            if (match) {
              console.log(`[DEBUG] Date match found: API ${wDateLocal} === Frontend ${targetDateLocal}`)
            }
            return match
          })
          
          if (forecastWeek && forecastWeek.entries) {
            console.log(`[DEBUG] Found forecast data for week ${weekDateOnly}:`, forecastWeek)
            console.log(`[DEBUG] Number of entries: ${forecastWeek.entries.length}`)
            if (forecastWeek.entries.length > 0) {
              const sampleEntry = forecastWeek.entries[0]
              console.log('[DEBUG] Sample forecast entry structure:', {
                hasLaborCategory: !!sampleEntry.laborCategory,
                hasCraftTypeId: !!sampleEntry.craftTypeId,
                laborCategory: sampleEntry.laborCategory,
                headcount: sampleEntry.headcount,
                hoursPerPerson: sampleEntry.hoursPerPerson,
                totalHours: sampleEntry.totalHours
              })
            }
            
            // Count unique craft types per category to detect if data was distributed
            const craftTypesPerCategory = new Map<string, Set<string>>()
            forecastWeek.entries.forEach((entry: any) => {
              const craft = loadedCraftTypes.find(c => c.id === entry.craftTypeId)
              if (craft) {
                if (!craftTypesPerCategory.has(craft.category)) {
                  craftTypesPerCategory.set(craft.category, new Set())
                }
                craftTypesPerCategory.get(craft.category)!.add(craft.id)
              }
            })
            
            // Process forecast entries - handle both category-based and craft-type-based data
            forecastWeek.entries.forEach((entry: {
              craftTypeId?: string
              laborCategory?: string
              categoryName?: string
              headcount: number
              hoursPerPerson?: number
              totalHours: number
              forecastedCost: number
              avgRate?: number
            }) => {
              // Handle category-based entries (new format from headcount API)
              if (entry.laborCategory && entry.laborCategory in categories) {
                const category = entry.laborCategory as 'direct' | 'indirect' | 'staff'
                const cat = categories[category]
                const hoursToAdd = entry.totalHours || (entry.headcount * (entry.hoursPerPerson || HOURS_PER_PERSON))
                cat.headcount += entry.headcount
                cat.hours += hoursToAdd
                // Use the rate from the entry if available, otherwise use category rate
                const rate = entry.avgRate || categoryRates[category]
                cat.cost += hoursToAdd * rate
                console.log(`[DEBUG] Category-based forecast - Added ${entry.headcount} headcount to ${category} for week ${weekDateOnly}, hours: ${hoursToAdd}, rate: $${rate}`)
              }
              // Handle craft-type-based entries (legacy format)
              else if (entry.craftTypeId) {
                const craft = loadedCraftTypes.find(c => c.id === entry.craftTypeId)
                if (craft && entry.headcount > 0) {
                  const cat = categories[craft.category]
                  const hoursToAdd = entry.totalHours || (entry.headcount * HOURS_PER_PERSON)
                  cat.headcount += entry.headcount
                  cat.hours += hoursToAdd
                  // Always use category rate for forecast calculations
                  cat.cost += hoursToAdd * categoryRates[craft.category]
                  console.log(`Added ${entry.headcount} headcount to ${craft.category} for week ${weekDateOnly}, hours: ${hoursToAdd}, rate: ${categoryRates[craft.category]}`)
                }
              }
            })
          } else {
            console.log(`No forecast data found for week ${weekDateOnly}`)
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

        // Determine hours per week for this week
        let weekHoursPerPerson = HOURS_PER_PERSON // Default to 50
        
        // For forecast weeks, check if we have saved hours data
        if (!isActual && forecastData.weeks) {
          const forecastWeek = forecastData.weeks.find((w: { weekEnding: string }) => {
            const wDate = new Date(w.weekEnding).toISOString().split('T')[0]
            const targetDate = weekDate.toISOString().split('T')[0]
            return wDate === targetDate
          })
          
          if (forecastWeek && forecastWeek.entries && forecastWeek.entries.length > 0) {
            // Use hours from the first entry (they should all be the same for simplified data)
            const firstEntry = forecastWeek.entries[0]
            if (firstEntry.hoursPerPerson) {
              weekHoursPerPerson = firstEntry.hoursPerPerson
            }
          }
        }

        combinedWeeks.push({
          weekEnding: weekString,
          isActual,
          hoursPerWeek: weekHoursPerPerson,
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
        categoryEntry.hours = headcount * week.hoursPerWeek
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

  const updateHoursPerWeek = (weekIndex: number, value: string) => {
    const hours = parseFloat(value) || 50
    const cellKey = `${weekIndex}-hours`
    
    setEditedCells(prev => new Set(prev).add(cellKey))
    
    setWeeklyData(prev => {
      const newData = [...prev]
      const week = newData[weekIndex]
      
      week.hoursPerWeek = hours
      
      // Recalculate all category hours based on new hours per week
      Object.values(week.categories).forEach(cat => {
        cat.hours = cat.headcount * hours
        cat.cost = cat.hours * cat.rate
      })
      
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
          // Copy hours per week
          newData[i].hoursPerWeek = fromWeek.hoursPerWeek
          setEditedCells(prev => new Set(prev).add(`${i}-hours`))
          
          // Copy category values
          Object.keys(newData[i].categories).forEach(cat => {
            const category = cat as 'direct' | 'indirect' | 'staff'
            const fromCat = fromWeek.categories[category]
            const toCat = newData[i].categories[category]
            
            toCat.headcount = fromCat.headcount
            toCat.hours = toCat.headcount * newData[i].hoursPerWeek
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
      // Send category names as craft_type_id as expected by the API
      const forecastWeeks = weeklyData
        .filter(week => !week.isActual)
        .map(week => {
          const entries: any[] = []
          
          // Save one entry per category with the category name as craft_type_id
          Object.entries(week.categories).forEach(([cat, data]) => {
            if (data.headcount > 0) {
              entries.push({
                craft_type_id: cat, // Send category name: "direct", "indirect", or "staff"
                headcount: data.headcount,
                hours_per_person: week.hoursPerWeek
              })
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

      // Debug logging
      console.log('Saving forecast data:', {
        project_id: projectId,
        weeks: forecastWeeks.length,
        firstWeek: forecastWeeks[0],
        totalEntries: forecastWeeks.reduce((sum, week) => sum + week.entries.length, 0)
      })

      const response = await fetch('/api/labor-forecasts/headcount', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          weeks: forecastWeeks
        })
      })

      let data
      try {
        data = await response.json()
        console.log('API Response:', data)
      } catch (jsonError) {
        console.error('Failed to parse API response:', jsonError)
        console.log('Response status:', response.status)
        console.log('Response ok:', response.ok)
        throw new Error('Invalid response from server')
      }

      if (!response.ok) {
        console.error('API Error:', data.error || 'Unknown error')
        throw new Error(data.error || 'Failed to save data')
      }

      // Show detailed success message with what was actually saved
      const { summary } = data
      if (summary) {
        const parts = []
        if (summary.created > 0) parts.push(`${summary.created} created`)
        if (summary.updated > 0) parts.push(`${summary.updated} updated`)
        if (summary.deleted > 0) parts.push(`${summary.deleted} deleted`)
        
        if (parts.length > 0) {
          setSuccessMessage(`Forecast saved: ${parts.join(', ')}`)
        } else {
          setSuccessMessage('No changes were saved (all headcount values may be 0)')
        }
      } else {
        setSuccessMessage('Forecast saved successfully!')
      }
      
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
              <p className="text-2xl font-bold text-foreground">
                ${(() => {
                  const rate = compositeRateInfo?.overall || 0
                  console.log('[DEBUG] Displaying composite rate:', {
                    compositeRateInfo,
                    overall: compositeRateInfo?.overall,
                    displayedRate: rate.toFixed(2)
                  })
                  return rate.toFixed(2)
                })()}/hr
              </p>
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
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hours/Week
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
                          editedCells.has(`${weekIndex}-direct`) ? 'border-blue-500 bg-blue-50' : 
                          week.categories.direct.headcount > 0 ? 'border-gray-300 bg-green-50' : 'border-gray-300'
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
                          editedCells.has(`${weekIndex}-indirect`) ? 'border-blue-500 bg-blue-50' : 
                          week.categories.indirect.headcount > 0 ? 'border-gray-300 bg-green-50' : 'border-gray-300'
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
                          editedCells.has(`${weekIndex}-staff`) ? 'border-blue-500 bg-blue-50' : 
                          week.categories.staff.headcount > 0 ? 'border-gray-300 bg-green-50' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500`}
                        placeholder="0"
                      />
                    )}
                  </td>
                  
                  {/* Hours/Week */}
                  <td className="px-4 py-2 text-center">
                    {week.isActual ? (
                      <span className="text-sm text-gray-900">
                        {week.hoursPerWeek}
                      </span>
                    ) : (
                      <input
                        type="number"
                        step="1"
                        min="0"
                        max="80"
                        value={week.hoursPerWeek || ''}
                        onChange={(e) => updateHoursPerWeek(weekIndex, e.target.value)}
                        className={`w-16 px-2 py-1 text-sm text-center border rounded ${
                          editedCells.has(`${weekIndex}-hours`) ? 'border-blue-500 bg-blue-50' : 
                          (week.categories.direct.headcount > 0 || week.categories.indirect.headcount > 0 || week.categories.staff.headcount > 0) ? 'border-gray-300 bg-green-50' : 'border-gray-300'
                        } focus:ring-2 focus:ring-blue-500`}
                        placeholder="50"
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
          <div className="w-4 h-4 bg-green-50 border border-gray-300"></div>
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