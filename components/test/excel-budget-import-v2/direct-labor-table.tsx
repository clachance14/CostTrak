'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Hammer, HardHat, Wrench, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DirectLaborAllocation {
  discipline: string
  role: string
  labor_category_id: string
  manhours: number
  rate?: number
  total_cost: number
  wbs_code?: string
}

interface DirectLaborTableProps {
  allocations: DirectLaborAllocation[]
}

// Labor categories grouped by type
const laborCategoryGroups: Record<string, string[]> = {
  'Skilled Trades': [
    'Boiler Maker - Class A', 'Boiler Maker - Class B',
    'Carpenter - Class A', 'Carpenter - Class B',
    'Electrician - Class A', 'Electrician - Class B', 'Electrician - Class C',
    'Fitter - Class A', 'Fitter - Class B',
    'Instrument Tech - Class A', 'Instrument Tech - Class B', 'Instrument Tech - Class C',
    'Ironworker - Class A', 'Ironworker - Class B',
    'Millwright A', 'Millwright B',
    'Painter',
    'Welder - Class A', 'Welder - Class B'
  ],
  'Equipment Operators': [
    'Crane Operator A', 'Crane Operator B',
    'Equipment Operator - Class A', 'Equipment Operator - Class B', 'Equipment Operator - Class C',
    'Operating Engineer A', 'Operating Engineer B',
    'Operator A', 'Operator B'
  ],
  'Support Roles': [
    'Field Engineer A', 'Field Engineer B',
    'General Foreman', 'Piping Foreman', 'Supervisor',
    'Helper',
    'Laborer - Class A', 'Laborer - Class B',
    'Surveyor A', 'Surveyor B',
    'Warehouse'
  ]
}

export function DirectLaborTable({ allocations }: DirectLaborTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('all')
  const [selectedGroup, setSelectedGroup] = useState<string>('all')
  const [showZeroHours, setShowZeroHours] = useState(false)

  // Get unique disciplines
  const disciplines = useMemo(() => {
    const unique = new Set(allocations.map(a => a.discipline))
    return Array.from(unique).sort()
  }, [allocations])

  // Group allocations by role across disciplines
  const roleData = useMemo(() => {
    const grouped = allocations.reduce((acc, alloc) => {
      if (!acc[alloc.role]) {
        acc[alloc.role] = {
          category: alloc.labor_category_id,
          group: Object.entries(laborCategoryGroups).find(([_, roles]) => 
            roles.includes(alloc.role)
          )?.[0] || 'Other',
          disciplines: {},
          totalManhours: 0,
          totalCost: 0,
          avgRate: 0
        }
      }
      
      acc[alloc.role].disciplines[alloc.discipline] = {
        manhours: alloc.manhours,
        cost: alloc.total_cost,
        rate: alloc.rate || (alloc.manhours > 0 ? alloc.total_cost / alloc.manhours : 0)
      }
      
      acc[alloc.role].totalManhours += alloc.manhours
      acc[alloc.role].totalCost += alloc.total_cost
      
      return acc
    }, {} as Record<string, any>)
    
    // Calculate average rates
    Object.values(grouped).forEach((role: any) => {
      if (role.totalManhours > 0) {
        role.avgRate = role.totalCost / role.totalManhours
      }
    })
    
    return grouped
  }, [allocations])

  // Filter data
  const filteredRoles = useMemo(() => {
    const searchLower = searchTerm.toLowerCase()
    
    return Object.entries(roleData).filter(([roleName, data]) => {
      // Search filter
      const matchesSearch = !searchTerm || 
        roleName.toLowerCase().includes(searchLower) ||
        data.category.toLowerCase().includes(searchLower)
      
      // Group filter
      const matchesGroup = selectedGroup === 'all' || data.group === selectedGroup
      
      // Hours filter
      const hasHours = showZeroHours || data.totalManhours > 0
      
      // Discipline filter
      const matchesDiscipline = selectedDiscipline === 'all' || 
        (data.disciplines[selectedDiscipline] && 
         (showZeroHours || data.disciplines[selectedDiscipline].manhours > 0))
      
      return matchesSearch && matchesGroup && hasHours && matchesDiscipline
    })
  }, [roleData, searchTerm, selectedGroup, selectedDiscipline, showZeroHours])

  // Calculate totals
  const totals = useMemo(() => {
    const result = filteredRoles.reduce((acc, [_, data]) => {
      if (selectedDiscipline === 'all') {
        acc.manhours += data.totalManhours
        acc.cost += data.totalCost
      } else if (data.disciplines[selectedDiscipline]) {
        acc.manhours += data.disciplines[selectedDiscipline].manhours
        acc.cost += data.disciplines[selectedDiscipline].cost
      }
      return acc
    }, { manhours: 0, cost: 0 })
    
    result.avgRate = result.manhours > 0 ? result.cost / result.manhours : 0
    
    return result
  }, [filteredRoles, selectedDiscipline])

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value))
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatRate = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Get icon for labor group
  const getGroupIcon = (group: string) => {
    switch (group) {
      case 'Skilled Trades': return <Hammer className="h-4 w-4" />
      case 'Equipment Operators': return <Wrench className="h-4 w-4" />
      case 'Support Roles': return <HardHat className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search roles or categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={selectedDiscipline} onValueChange={setSelectedDiscipline}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="All Disciplines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Disciplines</SelectItem>
            {disciplines.map(disc => (
              <SelectItem key={disc} value={disc}>{disc}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="All Groups" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {Object.keys(laborCategoryGroups).map(group => (
              <SelectItem key={group} value={group}>{group}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            checked={showZeroHours}
            onChange={(e) => setShowZeroHours(e.target.checked)}
            className="rounded"
          />
          Show zero hours
        </label>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total Manhours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatNumber(totals.manhours)}</div>
            <p className="text-xs text-muted-foreground">
              {filteredRoles.length} roles
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatRate(totals.avgRate)}</div>
            <p className="text-xs text-muted-foreground">per hour</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(totals.cost)}</div>
            <p className="text-xs text-muted-foreground">direct labor only</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Group</TableHead>
                {selectedDiscipline === 'all' ? (
                  <>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead className="text-right">Avg Rate</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoles.map(([roleName, data]) => {
                const disciplineData = selectedDiscipline === 'all' 
                  ? { manhours: data.totalManhours, rate: data.avgRate, cost: data.totalCost }
                  : data.disciplines[selectedDiscipline] || { manhours: 0, rate: 0, cost: 0 }
                
                return (
                  <TableRow key={roleName}>
                    <TableCell className="font-medium">{roleName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">
                        {data.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getGroupIcon(data.group)}
                        <span className="text-sm">{data.group}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {disciplineData.manhours > 0 ? formatNumber(disciplineData.manhours) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {disciplineData.rate > 0 ? formatRate(disciplineData.rate) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {disciplineData.cost > 0 ? formatCurrency(disciplineData.cost) : '-'}
                    </TableCell>
                  </TableRow>
                )
              })}
              
              {/* Totals Row */}
              {filteredRoles.length > 0 && (
                <TableRow className="border-t-2">
                  <TableCell colSpan={3} className="font-semibold">
                    Total ({filteredRoles.length} roles)
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatNumber(totals.manhours)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatRate(totals.avgRate)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(totals.cost)}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          {filteredRoles.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No direct labor allocations found matching your filters
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discipline Breakdown (when showing all) */}
      {selectedDiscipline === 'all' && disciplines.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hours by Discipline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {disciplines.map(disc => {
                const discTotal = allocations
                  .filter(a => a.discipline === disc)
                  .reduce((sum, a) => sum + a.manhours, 0)
                
                const percentage = totals.manhours > 0 ? (discTotal / totals.manhours) * 100 : 0
                
                return (
                  <div key={disc} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{disc}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatNumber(discTotal)} hours
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}