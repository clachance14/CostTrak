'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Users, Calendar } from 'lucide-react'

interface PhaseAllocation {
  phase: string
  role: string
  labor_category_id: string
  fte: number
  duration_months: number
  total_cost: number
  add_ons_cost: number
  perdiem_cost: number
  wbs_code?: string
}

interface PhaseAllocationsTableProps {
  allocations: PhaseAllocation[]
}

const phaseOrder = ['JOB_SET_UP', 'PRE_WORK', 'PROJECT_EXECUTION', 'JOB_CLOSE_OUT']
const phaseDisplayNames: Record<string, string> = {
  'JOB_SET_UP': 'Job Set Up',
  'PRE_WORK': 'Pre-Work',
  'PROJECT_EXECUTION': 'Project Execution',
  'JOB_CLOSE_OUT': 'Job Close Out'
}

export function PhaseAllocationsTable({ allocations }: PhaseAllocationsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set())
  const [showZeroFTE, setShowZeroFTE] = useState(false)

  // Group allocations by phase
  const phaseData = useMemo(() => {
    const grouped = allocations.reduce((acc, alloc) => {
      if (!acc[alloc.phase]) {
        acc[alloc.phase] = {
          allocations: [],
          totalFTE: 0,
          totalCost: 0,
          totalAddOns: 0,
          totalPerdiem: 0
        }
      }
      
      acc[alloc.phase].allocations.push(alloc)
      acc[alloc.phase].totalFTE += alloc.fte
      acc[alloc.phase].totalCost += alloc.total_cost
      acc[alloc.phase].totalAddOns += alloc.add_ons_cost
      acc[alloc.phase].totalPerdiem += alloc.perdiem_cost
      
      return acc
    }, {} as Record<string, any>)
    
    // Sort phases according to order
    const sorted: Array<[string, any]> = []
    phaseOrder.forEach(phase => {
      if (grouped[phase]) {
        sorted.push([phase, grouped[phase]])
      }
    })
    
    return sorted
  }, [allocations])

  // Funnel allocations based on search
  const filteredPhaseData = useMemo(() => {
    if (!searchTerm && showZeroFTE) return phaseData
    
    const searchLower = searchTerm.toLowerCase()
    
    return phaseData.map(([phase, data]) => {
      const filteredAllocations = data.allocations.filter((alloc: PhaseAllocation) => {
        const matchesSearch = !searchTerm || 
          alloc.role.toLowerCase().includes(searchLower) ||
          alloc.labor_category_id.toLowerCase().includes(searchLower)
        
        const matchesFTE = showZeroFTE || alloc.fte > 0
        
        return matchesSearch && matchesFTE
      })
      
      return [phase, {
        ...data,
        allocations: filteredAllocations
      }]
    }).filter(([_, data]) => data.allocations.length > 0)
  }, [phaseData, searchTerm, showZeroFTE])

  const togglePhase = (phase: string) => {
    const newExpanded = new Set(expandedPhases)
    if (newExpanded.has(phase)) {
      newExpanded.delete(phase)
    } else {
      newExpanded.add(phase)
    }
    setExpandedPhases(newExpanded)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Calculate totals
  const totals = useMemo(() => {
    return filteredPhaseData.reduce((acc, [_, data]) => {
      acc.fte += data.totalFTE
      acc.cost += data.totalCost
      acc.addOns += data.totalAddOns
      acc.perdiem += data.totalPerdiem
      return acc
    }, { fte: 0, cost: 0, addOns: 0, perdiem: 0 })
  }, [filteredPhaseData])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showZeroFTE}
              onChange={(e) => setShowZeroFTE(e.target.checked)}
              className="rounded"
            />
            Show zero FTE roles
          </label>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total FTE
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{totals.fte.toFixed(1)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Labor Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(totals.cost - totals.addOns - totals.perdiem)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">ADD ONS</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(totals.addOns)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Per Diem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatCurrency(totals.perdiem)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Phase Tables */}
      <div className="space-y-4">
        {filteredPhaseData.map(([phase, data]) => {
          const isExpanded = expandedPhases.has(phase) || filteredPhaseData.length === 1
          
          return (
            <Card key={phase}>
              <CardHeader 
                className="cursor-pointer"
                onClick={() => togglePhase(phase)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <CardTitle className="text-base">{phaseDisplayNames[phase] || phase}</CardTitle>
                    <Badge variant="secondary" className="ml-2">
                      <Calendar className="h-3 w-3 mr-1" />
                      {data.allocations[0]?.duration_months || 0} months
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">
                      {data.totalFTE.toFixed(1)} FTE
                    </span>
                    <span className="font-semibold">
                      {formatCurrency(data.totalCost)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">FTE</TableHead>
                        <TableHead className="text-right">Labor</TableHead>
                        <TableHead className="text-right">ADD ONS</TableHead>
                        <TableHead className="text-right">Per Diem</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.allocations.map((alloc: PhaseAllocation, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{alloc.role}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {alloc.labor_category_id}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {alloc.fte > 0 ? alloc.fte.toFixed(1) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(alloc.total_cost - alloc.add_ons_cost - alloc.perdiem_cost)}
                          </TableCell>
                          <TableCell className="text-right">
                            {alloc.add_ons_cost > 0 ? formatCurrency(alloc.add_ons_cost) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {alloc.perdiem_cost > 0 ? formatCurrency(alloc.perdiem_cost) : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {alloc.fte > 0 ? formatCurrency(alloc.total_cost) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      
                      {/* Phase Totals */}
                      <TableRow className="border-t-2">
                        <TableCell colSpan={2} className="font-semibold">
                          Phase Total
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {data.totalFTE.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(data.totalCost - data.totalAddOns - data.totalPerdiem)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(data.totalAddOns)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(data.totalPerdiem)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(data.totalCost)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* Grand Total */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grand Total (All Phases)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total FTE</p>
              <p className="text-lg font-semibold">{totals.fte.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Labor Cost</p>
              <p className="text-lg font-semibold">{formatCurrency(totals.cost - totals.addOns - totals.perdiem)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ADD ONS</p>
              <p className="text-lg font-semibold">{formatCurrency(totals.addOns)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Per Diem</p>
              <p className="text-lg font-semibold">{formatCurrency(totals.perdiem)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-lg font-semibold">{formatCurrency(totals.cost)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}