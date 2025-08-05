'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { LoadingPage } from '@/components/ui/loading'
import { useUser } from '@/hooks/use-auth'
import { formatCurrency, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Calendar,
  DollarSign,
  FileText,
  Plus,
  TrendingUp,
  Upload,
  Clock,
  Building2,
} from 'lucide-react'
import Link from 'next/link'

interface DashboardData {
  metrics: {
    activeProjects: number
    totalContractValue: number
    totalCommitted: number
    companyMargin: number
  }
  projects: Array<{
    id: string
    name: string
    jobNumber: string
    contractValue: number
    currentCosts: number
    committedCosts: number
    remainingToSpend: number
    status: string
  }>
}

export default function DashboardPage() {
  const supabase = createClient()
  const { data: user } = useUser()

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard-comprehensive'],
    queryFn: async (): Promise<DashboardData> => {
      // Fetch all data in parallel for performance
      const [
        metricsResult,
        projectsResult
      ] = await Promise.all([
        // Metrics queries
        fetchMetrics(),
        // Projects
        fetchProjects()
      ])

      return {
        metrics: metricsResult,
        projects: projectsResult
      }
    },
    refetchInterval: 60000 // Refresh every minute
  })

  async function fetchMetrics() {
    try {
      // Active projects count
      const { count: activeProjects, error: countError } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .is('deleted_at', null)

      if (countError) {
        console.error('Error fetching project count:', JSON.stringify(countError, null, 2))
      }

      // Total contract value
      const { data: contractData, error: contractError } = await supabase
        .from('projects')
        .select('original_contract')
        .eq('status', 'active')
        .is('deleted_at', null)

      if (contractError) {
        console.error('Error fetching contract data:', JSON.stringify(contractError, null, 2))
      }

      const totalContractValue = contractData?.reduce((sum, p) => sum + (p.original_contract || 0), 0) || 0

      // Total committed (vendor POs)
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .select('total_amount')

      if (poError) {
        console.error('Error fetching purchase orders:', JSON.stringify(poError, null, 2))
      }

      const totalCommitted = poData?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0

      // Company margin
      const companyMargin = totalContractValue > 0 
        ? ((totalContractValue - totalCommitted) / totalContractValue) * 100 
        : 0

      return {
        activeProjects: activeProjects || 0,
        totalContractValue,
        totalCommitted,
        companyMargin
      }
    } catch (error) {
      console.error('Error in fetchMetrics:', error)
      return {
        activeProjects: 0,
        totalContractValue: 0,
        totalCommitted: 0,
        companyMargin: 0
      }
    }
  }


  async function fetchProjects() {
    try {
      // First, fetch just the projects
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          job_number,
          original_contract,
          status
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10)

      if (projectsError) {
        console.error('Error fetching projects:', JSON.stringify(projectsError, null, 2))
        return []
      }

      if (!projects || projects.length === 0) {
        console.log('No projects found')
        return []
      }

      // Fetch related data separately
      const projectIds = projects.map(p => p.id)
      
      // Fetch purchase orders
      const { data: purchaseOrders } = await supabase
        .from('purchase_orders')
        .select('project_id, total_amount, invoiced_amount')
        .in('project_id', projectIds)

      // Fetch labor actuals
      const { data: laborActuals } = await supabase
        .from('labor_employee_actuals')
        .select('project_id, actual_cost')
        .in('project_id', projectIds)

      // Fetch labor forecasts
      const { data: laborForecasts } = await supabase
        .from('labor_headcount_forecasts')
        .select('project_id, forecasted_cost')
        .in('project_id', projectIds)

      // Map the data
      return projects.map(project => {
        // Filter related data for this project
        const projectPOs = purchaseOrders?.filter(po => po.project_id === project.id) || []
        const projectLabor = laborActuals?.filter(la => la.project_id === project.id) || []
        const projectForecasts = laborForecasts?.filter(lf => lf.project_id === project.id) || []

        // Calculate current costs (actual labor + invoiced POs)
        const laborActualCosts = projectLabor.reduce(
          (sum, la) => sum + (la.actual_cost || 0), 
          0
        )

        const vendorInvoicedCosts = projectPOs.reduce(
          (sum, po) => sum + (po.invoiced_amount || 0), 
          0
        )

        const currentCosts = laborActualCosts + vendorInvoicedCosts

        // Calculate committed costs (total PO values + forecasted labor)
        const totalPOValues = projectPOs.reduce(
          (sum, po) => sum + (po.total_amount || 0), 
          0
        )

        const forecastedLaborCosts = projectForecasts.reduce(
          (sum, lf) => sum + (lf.forecasted_cost || 0), 
          0
        )

        const committedCosts = totalPOValues + forecastedLaborCosts

        // Calculate remaining to spend
        const remainingToSpend = project.original_contract ? project.original_contract - currentCosts : 0

        return {
          id: project.id,
          name: project.name,
          jobNumber: project.job_number,
          contractValue: project.original_contract || 0,
          currentCosts,
          committedCosts,
          remainingToSpend,
          status: project.status
        }
      })
    } catch (error) {
      console.error('Error in fetchProjects:', error)
      return []
    }
  }


  if (isLoading) return <LoadingPage />

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const getMarginColor = (margin: number) => {
    if (margin >= 15) return 'text-green-600'
    if (margin >= 10) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
      case 'on_hold':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">On Hold</Badge>
      case 'completed':
        return <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">Completed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.first_name || 'Project Manager'}
          </h1>
          <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4" />
            {currentDate}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/projects/new">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Link>
          <Link href="/purchase-orders/import">
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import Vendor POs
            </Button>
          </Link>
          <Link href="/labor/import">
            <Button variant="outline">
              <Clock className="h-4 w-4 mr-2" />
              Import Labor Hours
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Projects</CardTitle>
            <Building2 className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {dashboardData?.metrics.activeProjects || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Contract Value</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(dashboardData?.metrics.totalContractValue || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Committed</CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(dashboardData?.metrics.totalCommitted || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Company Margin</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              'text-3xl font-bold',
              getMarginColor(dashboardData?.metrics.companyMargin || 0)
            )}>
              {(dashboardData?.metrics.companyMargin || 0).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Projects Table */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
          <Link href="/projects">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Job #</TableHead>
                  <TableHead className="text-right">Contract</TableHead>
                  <TableHead className="text-right">Current Costs</TableHead>
                  <TableHead className="text-right">Committed</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboardData?.projects && dashboardData.projects.length > 0 ? (
                  dashboardData.projects.map((project) => (
                    <TableRow 
                      key={project.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => window.location.href = `/projects/${project.id}`}
                    >
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell className="text-gray-600">{project.jobNumber}</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.contractValue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.currentCosts)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.committedCosts)}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          'font-medium',
                          project.remainingToSpend < 0 ? 'text-red-600' : 'text-gray-900'
                        )}>
                          {formatCurrency(project.remainingToSpend)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      No projects found. Create a new project to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}