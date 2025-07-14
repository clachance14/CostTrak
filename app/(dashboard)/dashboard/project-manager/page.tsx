'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useUserProjects } from '@/hooks/use-user-projects'
import { useUser } from '@/hooks/use-auth'
import { LoadingPage } from '@/components/ui/loading'
import { formatCurrency, formatPercentage } from '@/lib/utils'
import Link from 'next/link'

interface RevenueForecast {
  projectId: string
  currentMonth: number
  nextMonth: number
  monthPlus2: number
  remainingBacklog: number
  notes: string
}

interface RiskyPO {
  id: string
  po_number: string
  project: { name: string }
  vendor_name: string
  committed_amount: number
  invoiced_amount: number
  remaining_amount: number
  forecast_amount: number
  status: string
}

interface FinancialSnapshot {
  revised_contract?: number
  total_committed?: number
  cost_to_complete?: number
  forecasted_cost?: number
  forecasted_profit?: number
  profit_margin?: number
  percent_complete?: number
}

interface ProjectWithSnapshots {
  financial_snapshots?: FinancialSnapshot[]
}
import { 
  Building, 
  FileText,
  Package,
  Plus
} from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ProjectManagerDashboard() {
  const { data: user, isLoading: userLoading } = useUser()
  const { data: projects, isLoading: projectsLoading, error } = useUserProjects()

  // Declare all states and effects at the top
  const [revenueForecasts, setRevenueForecasts] = useState<RevenueForecast[]>([])
  const [riskyPOs, setRiskyPOs] = useState<RiskyPO[]>([])
  const [poLoading, setPOLoading] = useState(true)
  const [showPOWatchlist, setShowPOWatchlist] = useState(false)

  // Update revenueForecasts when projects change
  useEffect(() => {
    if (projects) {
      const activeProjects = projects.filter(p => p.status === 'active')
      setRevenueForecasts(activeProjects.map(p => ({
        projectId: p.id,
        currentMonth: 0,
        nextMonth: 0,
        monthPlus2: 0,
        remainingBacklog: 0,
        notes: ''
      })))
    }
  }, [projects])

  // Fetch risky POs
  useEffect(() => {
    const fetchRiskyPOs = async () => {
      const supabase = createClient()
      const projectIds = projects?.map(p => p.id) || []
      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('*, project:projects(name, job_number)')
        .in('project_id', projectIds)
        .eq('status', 'approved')

      const filtered = pos?.filter(po => 
        (po.invoiced_amount > 0.9 * po.committed_amount) || 
        (po.forecast_amount > po.committed_amount)
      ) || []
      setRiskyPOs(filtered)
      setPOLoading(false)
    }
    if (projects?.length) fetchRiskyPOs()
  }, [projects])

  // Now handle loading and error states
  if (userLoading || projectsLoading) {
    return <LoadingPage />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardHeader>
            <CardTitle>Error Loading Projects</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const activeProjects = projects?.filter(p => p.status === 'active') || []

  // Calculate aggregate metrics
  // const totalContractValue = activeProjects.reduce((sum, p) => sum + (p.revised_contract_amount || p.original_contract_amount || 0), 0)
  // const totalCommitted = activeProjects.reduce((sum, p) => sum + (p.total_po_amount || 0), 0)
  // const averageProfit = activeProjects.length > 0 
  //   ? activeProjects.reduce((sum, p) => sum + (p.projected_profit_margin || 0), 0) / activeProjects.length
  //   : 0

  // Handler for updating revenue forecast (local; add mutation to save)
  const updateForecast = (projectId: string, field: keyof RevenueForecast, value: number | string) => {
    setRevenueForecasts(prev => prev.map(f => 
      f.projectId === projectId ? { ...f, [field]: value } : f
    ))
    // TODO: Add mutation to save to backend
  }

  return (
    <div className="space-y-10 px-4 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Project Manager Dashboard</h1>
          <p className="text-foreground mt-1 text-lg">
            Welcome back, {user ? `${user.first_name} ${user.last_name}` : 'Project Manager'}
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Financial Health Table */}
      <Card className="shadow-sm border-foreground/20">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Project Financial Health</CardTitle>
          <CardDescription className="text-foreground/80">Financial overview of your active projects</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name / Number</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>% Complete</TableHead>
                <TableHead>Revised Contract (BAC)</TableHead>
                <TableHead>Actual Cost to Date</TableHead>
                <TableHead>Cost to Complete (ETC)</TableHead>
                <TableHead>Estimated Final Cost (EAC)</TableHead>
                <TableHead>Profit Forecast</TableHead>
                <TableHead>Variance at Completion (VAC)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeProjects.map(project => {
                const snapshot = (project as ProjectWithSnapshots).financial_snapshots?.[0] // Latest snapshot
                const bac = snapshot?.revised_contract || 0
                const actualCost = snapshot?.total_committed || 0
                const etc = snapshot?.cost_to_complete || 0
                const eac = snapshot?.forecasted_cost || 0
                const profit = snapshot?.forecasted_profit || 0
                const margin = snapshot?.profit_margin || 0
                const vac = bac - eac
                const badgeVariant = margin >= 10 ? 'default' : margin >= 5 ? 'secondary' : 'destructive'

                return (
                  <TableRow key={project.id}>
                    <TableCell>{project.name} / #{project.job_number}</TableCell>
                    <TableCell>{project.division?.name}</TableCell>
                    <TableCell>{formatPercentage(snapshot?.percent_complete || 0)}</TableCell>
                    <TableCell>{formatCurrency(bac)}</TableCell>
                    <TableCell>{formatCurrency(actualCost)}</TableCell>
                    <TableCell>{formatCurrency(etc)}</TableCell>
                    <TableCell>{formatCurrency(eac)}</TableCell>
                    <TableCell>
                      {formatCurrency(profit)} 
                      <Badge variant={badgeVariant} className="ml-2">
                        {formatPercentage(margin)}
                      </Badge>
                    </TableCell>
                    <TableCell className={vac >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatCurrency(vac)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {activeProjects.length === 0 && (
            <div className="text-center py-8 text-foreground/70">No active projects</div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Forecasting Grid */}
      <Card className="shadow-sm border-foreground/20">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Revenue Forecasting</CardTitle>
          <CardDescription className="text-foreground/80">Enter monthly revenue forecasts for your projects</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Current Month</TableHead>
                <TableHead>Next Month</TableHead>
                <TableHead>Month +2</TableHead>
                <TableHead>Remaining Backlog</TableHead>
                <TableHead>Notes / Risks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeProjects.map((project, idx) => {
                const forecast = revenueForecasts[idx]
                return (
                  <TableRow key={project.id}>
                    <TableCell>{project.name}</TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={forecast.currentMonth} 
                        onChange={e => updateForecast(project.id, 'currentMonth', parseFloat(e.target.value) || 0)} 
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={forecast.nextMonth} 
                        onChange={e => updateForecast(project.id, 'nextMonth', parseFloat(e.target.value) || 0)} 
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={forecast.monthPlus2} 
                        onChange={e => updateForecast(project.id, 'monthPlus2', parseFloat(e.target.value) || 0)} 
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        value={forecast.remainingBacklog} 
                        onChange={e => updateForecast(project.id, 'remainingBacklog', parseFloat(e.target.value) || 0)} 
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        value={forecast.notes} 
                        onChange={e => updateForecast(project.id, 'notes', e.target.value)} 
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <Button className="mt-4" onClick={() => alert('Save forecasts (implement mutation)')}>Save Forecasts</Button>
        </CardContent>
      </Card>

      {/* PO Watchlist Section */}
      <Card className="shadow-sm border-foreground/20">
        <CardHeader className="cursor-pointer" onClick={() => setShowPOWatchlist(!showPOWatchlist)}>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl font-semibold text-foreground">PO Watchlist ({riskyPOs.length} high-risk)</CardTitle>
            {showPOWatchlist ? <ChevronUp /> : <ChevronDown />}
          </div>
          <CardDescription className="text-foreground/80">POs at risk of overrun</CardDescription>
        </CardHeader>
        {showPOWatchlist && (
          <CardContent>
            {poLoading ? (
              <LoadingPage />
            ) : riskyPOs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>PO Value</TableHead>
                    <TableHead>Invoiced to Date</TableHead>
                    <TableHead>Forecasted Final Cost</TableHead>
                    <TableHead>Forecasted Overrun</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskyPOs.map(po => {
                    const overrun = (po.forecast_amount || 0) - (po.committed_amount || 0)
                    return (
                      <TableRow key={po.id}>
                        <TableCell>{po.po_number}</TableCell>
                        <TableCell>{po.project?.name}</TableCell>
                        <TableCell>{po.vendor_name}</TableCell>
                        <TableCell>{formatCurrency(po.committed_amount)}</TableCell>
                        <TableCell>{formatCurrency(po.invoiced_amount)}</TableCell>
                        <TableCell>{formatCurrency(po.forecast_amount)}</TableCell>
                        <TableCell className={overrun > 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(overrun)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-foreground/70">No high-risk POs</div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Quick Actions */}
      <Card className="shadow-sm border-foreground/20">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Quick Actions</CardTitle>
          <CardDescription className="text-foreground/80">Forecasting and project tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Button variant="outline" className="w-full justify-start" onClick={() => alert('Submit Forecast (implement)')}>
              <FileText className="mr-2 h-4 w-4" />
              Submit Forecast
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => alert('Update PO Forecast (implement)')}>
              <Package className="mr-2 h-4 w-4" />
              Update PO Forecast
            </Button>
            <Link href="/projects">
              <Button variant="outline" className="w-full justify-start">
                <Building className="mr-2 h-4 w-4" />
                View All Projects
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}