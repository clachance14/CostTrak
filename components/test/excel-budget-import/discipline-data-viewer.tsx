'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { Building2, HardHat, Users, Package, Wrench, FileText } from 'lucide-react'

interface DisciplineDataViewerProps {
  budgetData: any
  rawData?: any
  disciplineMapping?: any
}

interface CategorySummary {
  name: string
  total: number
  manhours: number
  itemCount: number
  subcategories: Record<string, { total: number; manhours: number; itemCount: number }>
}

interface DisciplineSummary {
  name: string
  categories: Record<string, CategorySummary>
  total: number
  manhours: number
  percentage: number
}

const CATEGORY_ICONS: Record<string, any> = {
  LABOR: Users,
  MATERIAL: Package,
  EQUIPMENT: Wrench,
  SUBCONTRACT: FileText,
  OTHER: Building2
}

const CATEGORY_COLORS: Record<string, string> = {
  LABOR: 'text-blue-600',
  MATERIAL: 'text-green-600',
  EQUIPMENT: 'text-orange-600',
  SUBCONTRACT: 'text-purple-600',
  OTHER: 'text-gray-600'
}

export function DisciplineDataViewer({ budgetData, rawData, disciplineMapping }: DisciplineDataViewerProps) {
  if (!budgetData) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            No budget data to display
          </p>
        </CardContent>
      </Card>
    )
  }

  // Extract disciplines using the mapping from INPUT sheet
  const extractDisciplines = (): string[] => {
    // If we have discipline mapping from INPUT sheet, use it
    if (disciplineMapping?.disciplineMapping?.disciplineGroups) {
      return Object.keys(disciplineMapping.disciplineMapping.disciplineGroups).sort()
    }
    
    // Otherwise fall back to extracting from budget data
    const disciplines = new Set<string>()
    
    // Check BUDGETS sheet for discipline data
    if (budgetData.details?.BUDGETS) {
      budgetData.details.BUDGETS.forEach((item: any) => {
        if (item.discipline) {
          disciplines.add(item.discipline)
        }
      })
    }

    // If no disciplines found, create default ones
    if (disciplines.size === 0) {
      return ['Mechanical', 'Civil', 'I&E', 'Fabrication']
    }

    return Array.from(disciplines).sort()
  }

  // Process data by discipline and category
  const processByDiscipline = (): Record<string, DisciplineSummary> => {
    const disciplines = extractDisciplines()
    const result: Record<string, DisciplineSummary> = {}
    
    // Initialize disciplines
    disciplines.forEach(disc => {
      result[disc] = {
        name: disc,
        categories: {},
        total: 0,
        manhours: 0,
        percentage: 0
      }
    })

    // Add a "General" category for items without discipline
    result['GENERAL'] = {
      name: 'GENERAL',
      categories: {},
      total: 0,
      manhours: 0,
      percentage: 0
    }

    // Process all budget items
    Object.entries(budgetData.details || {}).forEach(([sheetName, items]) => {
      (items as any[]).forEach(item => {
        // Map discipline using the mapping from INPUT sheet
        let mappedDiscipline = 'GENERAL'
        if (disciplineMapping?.disciplineMapping?.disciplineToParent && item.discipline) {
          mappedDiscipline = disciplineMapping.disciplineMapping.disciplineToParent[item.discipline.toUpperCase()] || item.discipline
        } else if (item.discipline) {
          mappedDiscipline = item.discipline
        }
        
        const discipline = mappedDiscipline
        const category = item.category || 'OTHER'
        const subcategory = item.subcategory || 'Unspecified'

        if (!result[discipline]) {
          result[discipline] = {
            name: discipline,
            categories: {},
            total: 0,
            manhours: 0,
            percentage: 0
          }
        }

        if (!result[discipline].categories[category]) {
          result[discipline].categories[category] = {
            name: category,
            total: 0,
            manhours: 0,
            itemCount: 0,
            subcategories: {}
          }
        }

        if (!result[discipline].categories[category].subcategories[subcategory]) {
          result[discipline].categories[category].subcategories[subcategory] = {
            total: 0,
            manhours: 0,
            itemCount: 0
          }
        }

        // Update totals
        const cost = item.total_cost || 0
        const hours = item.manhours || 0

        result[discipline].categories[category].total += cost
        result[discipline].categories[category].manhours += hours
        result[discipline].categories[category].itemCount += 1
        result[discipline].categories[category].subcategories[subcategory].total += cost
        result[discipline].categories[category].subcategories[subcategory].manhours += hours
        result[discipline].categories[category].subcategories[subcategory].itemCount += 1
        result[discipline].total += cost
        result[discipline].manhours += hours
      })
    })

    // Calculate percentages
    const grandTotal = Object.values(result).reduce((sum, disc) => sum + disc.total, 0)
    Object.values(result).forEach(disc => {
      disc.percentage = grandTotal > 0 ? (disc.total / grandTotal) * 100 : 0
    })

    // Remove empty disciplines
    Object.keys(result).forEach(key => {
      if (result[key].total === 0) {
        delete result[key]
      }
    })

    return result
  }

  const disciplineData = processByDiscipline()
  const disciplines = Object.keys(disciplineData).sort()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value))
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(budgetData.totals.grand_total)}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Manhours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(Object.values(disciplineData).reduce((sum, disc) => sum + disc.manhours, 0))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Disciplines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{disciplines.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Discipline Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Budget by Discipline</CardTitle>
          <CardDescription>
            Cost and manhour breakdown across disciplines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {disciplines.map(discipline => {
              const data = disciplineData[discipline]
              return (
                <div key={discipline} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardHat className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{discipline}</span>
                      <Badge variant="outline">{data.percentage.toFixed(1)}%</Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(data.total)}</div>
                      {data.manhours > 0 && (
                        <div className="text-sm text-muted-foreground">
                          {formatNumber(data.manhours)} hrs
                        </div>
                      )}
                    </div>
                  </div>
                  <Progress value={data.percentage} className="h-2" />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Breakdown by Discipline */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Breakdown</CardTitle>
          <CardDescription>
            Category and subcategory details for each discipline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={disciplines[0]} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Math.min(disciplines.length, 5)}, minmax(0, 1fr))` }}>
              {disciplines.map(discipline => (
                <TabsTrigger key={discipline} value={discipline}>
                  {discipline}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {disciplines.map(discipline => {
              const data = disciplineData[discipline]
              const categories = Object.entries(data.categories).sort((a, b) => b[1].total - a[1].total)
              
              return (
                <TabsContent key={discipline} value={discipline} className="space-y-4">
                  {/* Category Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map(([categoryName, categoryData]) => {
                      const Icon = CATEGORY_ICONS[categoryName] || Building2
                      const colorClass = CATEGORY_COLORS[categoryName] || 'text-gray-600'
                      
                      return (
                        <Card key={categoryName}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${colorClass}`} />
                              {categoryName}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div>
                                <div className="text-lg font-semibold">
                                  {formatCurrency(categoryData.total)}
                                </div>
                                {categoryData.manhours > 0 && (
                                  <div className="text-sm text-muted-foreground">
                                    {formatNumber(categoryData.manhours)} manhours
                                  </div>
                                )}
                              </div>
                              
                              {/* Subcategory breakdown */}
                              <div className="space-y-1">
                                {Object.entries(categoryData.subcategories)
                                  .sort((a, b) => b[1].total - a[1].total)
                                  .map(([subcat, subdata]) => (
                                    <div key={subcat} className="flex justify-between text-sm">
                                      <span className="text-muted-foreground">{subcat}</span>
                                      <span>{formatCurrency(subdata.total)}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>

                  {/* Cost Distribution Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Cost Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {categories.map(([categoryName, categoryData]) => {
                          const percentage = (categoryData.total / data.total) * 100
                          return (
                            <div key={categoryName} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{categoryName}</span>
                                <span>{percentage.toFixed(1)}%</span>
                              </div>
                              <Progress value={percentage} className="h-2" />
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}