'use client'

import React, { useEffect, useState } from 'react'
import { 
  Building, 
  DollarSign, 
  TrendingUp, 
  Users,
  Loader2,
  AlertCircle,
  Download,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { MetricCard } from '@/components/dashboard/metric-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { MonthlyForecastSheet } from '@/components/ops-manager/monthly-forecast-sheet'
import { RiskStatusBadge } from '@/components/ui/risk-status-badge'
import { ForecastEditModal } from '@/components/purchase-orders/forecast-edit-modal'
import { useUser } from '@/hooks/use-auth'

interface DivisionData {
  id: string
  name: string
  code: string
  totalProjects: number
  activeProjects: number
  totalContractValue: number
  activeContractValue: number
  totalCommitted: number
  totalInvoiced: number
  averageMargin: number
}

interface ProjectSummary {
  id: string
  jobNumber: string
  name: string
  division: string
  client: string
  status: string
  contractValue: number
  margin: number
  projectManager: string
}

interface ProjectFinancialOverview {
  id: string
  jobNumber: string
  name: string
  percentComplete: number
  revisedContract: number // BAC from COs
  actualCostToDate: number // from PO log
  costToComplete: number // ETC
  estimatedFinalCost: number // EAC = AC + ETC
  profitForecast: number
  marginPercent: number
  varianceAtCompletion: number // VAC
}

interface POTracking {
  id: string
  poNumber: string
  projectId: string
  projectName: string
  vendor: string
  scope: string
  poValue: number
  invoicedToDate: number
  remaining: number
  forecastedFinalCost: number
  forecastedOverrun: number
  riskStatus: 'normal' | 'at-risk' | 'over-budget'
  invoices: Invoice[]
}

interface Invoice {
  id: string
  invoiceNumber: string
  date: string
  lineItem: string
  value: number
  notes: string
}

export default function OpsManagerDashboard() {
  const { data: user } = useUser()
  const [divisions, setDivisions] = useState<DivisionData[]>([])
  const [allProjects, setAllProjects] = useState<ProjectSummary[]>([])
  const [projectFinancials, setProjectFinancials] = useState<ProjectFinancialOverview[]>([])
  const [poTrackingData, setPOTrackingData] = useState<POTracking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [expandedPOs, setExpandedPOs] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState('overview')
  const [selectedPO, setSelectedPO] = useState<POTracking | null>(null)
  const [showForecastModal, setShowForecastModal] = useState(false)
  
  const canEditForecast = user && ['controller', 'ops_manager'].includes(user.role)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  useEffect(() => {
    if (activeTab === 'financial' && projectFinancials.length === 0) {
      fetchProjectFinancials()
    }
    if (activeTab === 'purchase-orders' && poTrackingData.length === 0) {
      fetchPOTrackingData()
    }
  }, [activeTab, poTrackingData.length, projectFinancials.length])

  const fetchDashboardData = async () => {
    try {
      const supabase = createClient()
      
      // Get all divisions
      const { data: divisionsData, error: divisionsError } = await supabase
        .from('divisions')
        .select('*')
        .order('name')

      if (divisionsError) throw divisionsError

      // Fetch dashboard data for each division
      const divisionPromises = divisionsData.map(async (division) => {
        const response = await fetch(`/api/dashboards/division/${division.id}`)
        if (!response.ok) throw new Error(`Failed to fetch data for ${division.name}`)
        const result = await response.json()
        return {
          ...division,
          ...result.data.overview,
          projects: result.data.allProjects
        }
      })

      const divisionResults = await Promise.all(divisionPromises)
      
      // Extract division data and all projects
      const divisionMetrics: DivisionData[] = divisionResults.map(d => ({
        id: d.id,
        name: d.name,
        code: d.code,
        totalProjects: d.totalProjects,
        activeProjects: d.activeProjects,
        totalContractValue: d.totalContractValue,
        activeContractValue: d.activeContractValue,
        totalCommitted: d.totalCommitted,
        totalInvoiced: d.totalInvoiced,
        averageMargin: d.averageMargin
      }))

      const allProjectsData: ProjectSummary[] = divisionResults.flatMap(d => 
        d.projects.map((p: {
          id: string
          jobNumber: string
          name: string
          client: string
          status: string
          contractValue: number
          margin: number
          projectManager: string
        }) => ({
          id: p.id,
          jobNumber: p.jobNumber,
          name: p.name,
          division: d.name,
          client: p.client,
          status: p.status,
          contractValue: p.contractValue,
          margin: p.margin,
          projectManager: p.projectManager
        }))
      )

      setDivisions(divisionMetrics)
      setAllProjects(allProjectsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const fetchProjectFinancials = async () => {
    try {
      const supabase = createClient()
      
      // Fetch projects with financial data
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          job_number,
          name,
          percent_complete,
          revised_contract_amount,
          original_contract_amount,
          actual_cost_to_date,
          cost_to_complete,
          estimated_final_cost,
          profit_forecast,
          margin_percent,
          variance_at_completion,
          change_orders!change_orders_project_id_fkey(
            amount,
            status
          )
        `)
        .eq('status', 'active')
        .order('job_number')

      if (projectsError) throw projectsError

      // Calculate financial metrics
      const financialData: ProjectFinancialOverview[] = projects.map(project => {
        const approvedCOs = project.change_orders
          ?.filter((co: { status: string }) => co.status === 'approved')
          .reduce((sum: number, co: { amount: number }) => sum + (co.amount || 0), 0) || 0
        
        const revisedContract = (project.original_contract_amount || 0) + approvedCOs
        const actualCost = project.actual_cost_to_date || 0
        const costToComplete = project.cost_to_complete || 0
        const eac = actualCost + costToComplete
        const profitForecast = revisedContract - eac
        const marginPercent = revisedContract > 0 ? (profitForecast / revisedContract) * 100 : 0
        const vac = revisedContract - eac

        return {
          id: project.id,
          jobNumber: project.job_number,
          name: project.name,
          percentComplete: project.percent_complete || 0,
          revisedContract,
          actualCostToDate: actualCost,
          costToComplete,
          estimatedFinalCost: eac,
          profitForecast,
          marginPercent,
          varianceAtCompletion: vac
        }
      })

      setProjectFinancials(financialData)
    } catch (err) {
      console.error('Failed to fetch project financials:', err)
    }
  }

  const fetchPOTrackingData = async () => {
    try {
      const supabase = createClient()
      
      // Fetch POs with line items
      const { data: purchaseOrders, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          project_id,
          vendor_name,
          description,
          total_amount,
          committed_amount,
          forecasted_final_cost,
          forecasted_overrun,
          risk_status,
          status,
          projects!inner(
            id,
            name,
            job_number
          ),
          po_line_items(
            id,
            line_number,
            invoice_ticket,
            invoice_date,
            description,
            total_amount
          )
        `)
        .eq('status', 'approved')
        .order('po_number')

      if (poError) throw poError

      // Process PO data
      const poData: POTracking[] = purchaseOrders.map(po => {
        const poValue = po.committed_amount || po.total_amount || 0
        const invoicedToDate = po.po_line_items?.reduce(
          (sum: number, item: { total_amount?: number }) => sum + (item.total_amount || 0), 
          0
        ) || 0
        
        const remaining = poValue - invoicedToDate
        const forecastedFinal = po.forecasted_final_cost || poValue
        const forecastedOverrun = po.forecasted_overrun || (forecastedFinal - poValue)

        const invoices: Invoice[] = po.po_line_items?.map((item: { 
          id: string; 
          invoice_ticket?: string | null; 
          invoice_date?: string | null; 
          description?: string | null; 
          total_amount?: number | null 
        }) => ({
          id: item.id,
          invoiceNumber: item.invoice_ticket || '',
          date: item.invoice_date || '',
          lineItem: item.description || '',
          value: item.total_amount || 0,
          notes: ''
        })) || []

        return {
          id: po.id,
          poNumber: po.po_number,
          projectId: po.project_id,
          projectName: po.projects && 'name' in po.projects ? po.projects.name : '',
          vendor: po.vendor_name || '',
          scope: po.description || '',
          poValue,
          invoicedToDate,
          remaining,
          forecastedFinalCost: forecastedFinal,
          forecastedOverrun,
          riskStatus: po.risk_status || 'normal',
          invoices
        }
      })

      setPOTrackingData(poData)
    } catch (err) {
      console.error('Failed to fetch PO tracking data:', err)
    }
  }

  const togglePOExpansion = (poId: string) => {
    const newExpanded = new Set(expandedPOs)
    if (newExpanded.has(poId)) {
      newExpanded.delete(poId)
    } else {
      newExpanded.add(poId)
    }
    setExpandedPOs(newExpanded)
  }

  const exportFinancialData = async () => {
    try {
      // Prepare data based on active tab
      let csvContent = ''
      let filename = ''

      if (activeTab === 'overview') {
        // Export division summary
        csvContent = 'Division,Total Projects,Active Projects,Contract Value,Committed,Invoiced,Avg Margin %\n'
        divisions.forEach(div => {
          csvContent += `"${div.name}",${div.totalProjects},${div.activeProjects},${div.totalContractValue},${div.totalCommitted},${div.totalInvoiced},${div.averageMargin.toFixed(1)}\n`
        })
        filename = `ops-manager-divisions-${new Date().toISOString().split('T')[0]}.csv`
      } else if (activeTab === 'financial') {
        // Export project financial overview
        csvContent = 'Job #,Project Name,% Complete,Revised Contract,Actual Cost,Cost to Complete,EAC,Profit Forecast,Margin %,VAC\n'
        projectFinancials.forEach(project => {
          csvContent += `"${project.jobNumber}","${project.name}",${project.percentComplete},${project.revisedContract},${project.actualCostToDate},${project.costToComplete},${project.estimatedFinalCost},${project.profitForecast},${project.marginPercent.toFixed(1)},${project.varianceAtCompletion}\n`
        })
        filename = `project-financial-overview-${new Date().toISOString().split('T')[0]}.csv`
      } else if (activeTab === 'purchase-orders') {
        // Export PO tracking data
        csvContent = 'PO Number,Project,Vendor,Scope,PO Value,Invoiced,Remaining,Forecast Final,Overrun,Risk Status\n'
        poTrackingData.forEach(po => {
          csvContent += `"${po.poNumber}","${po.projectName}","${po.vendor}","${po.scope}",${po.poValue},${po.invoicedToDate},${po.remaining},${po.forecastedFinalCost},${po.forecastedOverrun},"${po.riskStatus}"\n`
        })
        filename = `po-tracking-${new Date().toISOString().split('T')[0]}.csv`
      }

      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Export failed:', error)
      setError('Failed to export data')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // Calculate totals across all divisions
  const totals = divisions.reduce((acc, div) => ({
    totalProjects: acc.totalProjects + div.totalProjects,
    activeProjects: acc.activeProjects + div.activeProjects,
    totalContractValue: acc.totalContractValue + div.totalContractValue,
    totalCommitted: acc.totalCommitted + div.totalCommitted
  }), { totalProjects: 0, activeProjects: 0, totalContractValue: 0, totalCommitted: 0 })

  // Filter projects if division is selected
  const displayProjects = selectedDivision 
    ? allProjects.filter(p => p.division === selectedDivision)
    : allProjects

  // Get at-risk projects
  const atRiskProjects = allProjects.filter(p => p.margin < 10 && p.status === 'active')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operations Manager Dashboard</h1>
          <p className="text-foreground/80">
            Monitor project health, track PO overruns, and manage forecasts across divisions
          </p>
        </div>
        <Button variant="outline" onClick={exportFinancialData}>
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="financial">Financial Tracking</TabsTrigger>
          <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
          <TabsTrigger value="forecasts">Monthly Forecasts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Projects"
          value={totals.totalProjects}
          description={`${totals.activeProjects} active`}
          icon={Building}
        />
        <MetricCard
          title="Total Contract Value"
          value={formatCurrency(totals.totalContractValue)}
          description="All divisions"
          icon={DollarSign}
        />
        <MetricCard
          title="Total Committed"
          value={formatCurrency(totals.totalCommitted)}
          description="Purchase orders"
          icon={TrendingUp}
        />
        <MetricCard
          title="Divisions"
          value={divisions.length}
          description="Under management"
          icon={Users}
        />
      </div>

      {/* Division Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Division Performance</CardTitle>
          <CardDescription>Comparative metrics across all divisions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Division</TableHead>
                <TableHead className="text-center">Total Projects</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-right">Contract Value</TableHead>
                <TableHead className="text-right">Committed</TableHead>
                <TableHead className="text-right">Invoiced</TableHead>
                <TableHead className="text-right">Avg Margin %</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divisions.map((division) => (
                <TableRow key={division.id}>
                  <TableCell className="font-medium">{division.name}</TableCell>
                  <TableCell className="text-center">{division.totalProjects}</TableCell>
                  <TableCell className="text-center">{division.activeProjects}</TableCell>
                  <TableCell className="text-right">{formatCurrency(division.totalContractValue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(division.totalCommitted)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(division.totalInvoiced)}</TableCell>
                  <TableCell className="text-right">
                    <span className={division.averageMargin < 10 ? 'text-orange-600 font-medium' : ''}>
                      {division.averageMargin.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={selectedDivision === division.name ? "primary" : "outline"}
                      onClick={() => setSelectedDivision(
                        selectedDivision === division.name ? null : division.name
                      )}
                    >
                      {selectedDivision === division.name ? "Show All" : "Filter"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {selectedDivision ? `${selectedDivision} Division Projects` : 'All Projects'}
              </CardTitle>
              <CardDescription>
                Showing {displayProjects.length} projects
              </CardDescription>
            </div>
            <Link href="/projects/new">
              <Button>
                <Building className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Contract Value</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
                <TableHead>Project Manager</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayProjects.slice(0, 10).map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.jobNumber}</TableCell>
                  <TableCell>{project.name}</TableCell>
                  <TableCell>{project.division}</TableCell>
                  <TableCell>{project.client}</TableCell>
                  <TableCell>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(project.contractValue)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={project.margin < 10 ? 'text-orange-600 font-medium' : ''}>
                      {project.margin.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell>{project.projectManager}</TableCell>
                  <TableCell>
                    <Link href={`/projects/${project.id}`}>
                      <Button size="sm" variant="ghost">View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {displayProjects.length > 10 && (
            <div className="mt-4 text-center">
              <Link href="/projects">
                <Button variant="outline">View All Projects</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

          {/* At Risk Projects Alert */}
          {atRiskProjects.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Attention:</strong> {atRiskProjects.length} project{atRiskProjects.length !== 1 ? 's' : ''} across divisions have margins below 10%:
                <ul className="mt-2 ml-4 list-disc">
                  {atRiskProjects.slice(0, 5).map(p => (
                    <li key={p.id}>
                      {p.jobNumber} - {p.name} ({p.division} Division, {p.margin.toFixed(1)}%)
                    </li>
                  ))}
                  {atRiskProjects.length > 5 && (
                    <li>... and {atRiskProjects.length - 5} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Financial Overview</CardTitle>
              <CardDescription>
                Comprehensive financial metrics for all active projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job #</TableHead>
                    <TableHead>Project Name</TableHead>
                    <TableHead className="text-center">% Complete</TableHead>
                    <TableHead className="text-right">Revised Contract</TableHead>
                    <TableHead className="text-right">Actual Cost</TableHead>
                    <TableHead className="text-right">Cost to Complete</TableHead>
                    <TableHead className="text-right">EAC</TableHead>
                    <TableHead className="text-right">Profit Forecast</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                    <TableHead className="text-right">VAC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectFinancials.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.jobNumber}</TableCell>
                      <TableCell>{project.name}</TableCell>
                      <TableCell className="text-center">{project.percentComplete}%</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.revisedContract)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.actualCostToDate)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.costToComplete)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.estimatedFinalCost)}</TableCell>
                      <TableCell className="text-right">
                        <span className={project.profitForecast < 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(project.profitForecast)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={project.marginPercent < 10 ? 'text-orange-600 font-medium' : ''}>
                          {project.marginPercent.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={project.varianceAtCompletion < 0 ? 'text-red-600' : ''}>
                          {formatCurrency(project.varianceAtCompletion)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchase-orders" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Order Tracking</CardTitle>
              <CardDescription>
                Monitor PO status, invoicing, and forecast overruns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">PO Value</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Forecast Final</TableHead>
                    <TableHead className="text-right">Overrun</TableHead>
                    <TableHead>Risk Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poTrackingData.map((po) => (
                    <React.Fragment key={po.id}>
                      <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => togglePOExpansion(po.id)}>
                        <TableCell>
                          {expandedPOs.has(po.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{po.poNumber}</TableCell>
                        <TableCell>{po.projectName}</TableCell>
                        <TableCell>{po.vendor}</TableCell>
                        <TableCell>{po.scope}</TableCell>
                        <TableCell className="text-right">{formatCurrency(po.poValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(po.invoicedToDate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(po.remaining)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(po.forecastedFinalCost)}</TableCell>
                        <TableCell className="text-right">
                          <span className={po.forecastedOverrun > 0 ? 'text-red-600 font-medium' : ''}>
                            {formatCurrency(po.forecastedOverrun)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div 
                            className="cursor-pointer" 
                            onClick={(e) => {
                              e.stopPropagation()
                              if (canEditForecast) {
                                setSelectedPO(po)
                                setShowForecastModal(true)
                              }
                            }}
                          >
                            <RiskStatusBadge status={po.riskStatus} />
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedPOs.has(po.id) && po.invoices.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="bg-gray-50 p-0">
                            <div className="p-4">
                              <h4 className="text-sm font-medium mb-2">Invoices</h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Line Item</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Notes</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {po.invoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                      <TableCell>{invoice.invoiceNumber}</TableCell>
                                      <TableCell>{invoice.date}</TableCell>
                                      <TableCell>{invoice.lineItem}</TableCell>
                                      <TableCell className="text-right">{formatCurrency(invoice.value)}</TableCell>
                                      <TableCell>{invoice.notes}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecasts" className="space-y-6">
          <MonthlyForecastSheet />
        </TabsContent>
      </Tabs>

      {/* Forecast Edit Modal */}
      {selectedPO && (
        <ForecastEditModal
          open={showForecastModal}
          onOpenChange={setShowForecastModal}
          purchaseOrder={{
            id: selectedPO.id,
            po_number: selectedPO.poNumber,
            vendor_name: selectedPO.vendor,
            risk_status: selectedPO.riskStatus
          }}
          onSuccess={() => {
            fetchPOTrackingData()
            setSelectedPO(null)
          }}
        />
      )}
    </div>
  )
}