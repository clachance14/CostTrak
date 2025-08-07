'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { LoadingPage } from '@/components/ui/loading'
import { useUser } from '@/hooks/use-auth'
import { formatCurrency, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  DollarSign,
  FileText,
  Plus,
  TrendingUp,
  Upload,
  Clock,
  Building2,
  MoreVertical,
  Edit,
  Eye,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
    margin: number
    status: string
  }>
}

export default function DashboardPage() {
  const supabase = createClient()
  const { data: user } = useUser()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

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
  
  // Quick status update mutation
  const updateProjectStatus = useMutation({
    mutationFn: async ({ projectId, status }: { projectId: string; status: string }) => {
      const response = await fetch(`/api/projects/${projectId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update status')
      }
      
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-comprehensive'] })
    }
  })
  
  // Filter projects based on search and status
  const filteredProjects = useMemo(() => {
    if (!dashboardData?.projects) return []
    
    let filtered = dashboardData.projects
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.jobNumber.toLowerCase().includes(query)
      )
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter)
    }
    
    return filtered
  }, [dashboardData?.projects, searchQuery, statusFilter])
  
  // Calculate filtered metrics
  const filteredMetrics = useMemo(() => {
    if (!filteredProjects || filteredProjects.length === 0) {
      return {
        activeProjects: 0,
        totalContractValue: 0,
        totalCommitted: 0,
        companyMargin: 0
      }
    }
    
    const activeProjects = filteredProjects.filter(p => p.status === 'active').length
    const totalContractValue = filteredProjects.reduce((sum, p) => sum + p.contractValue, 0)
    const totalCommitted = filteredProjects.reduce((sum, p) => sum + p.committedCosts, 0)
    const companyMargin = totalContractValue > 0 
      ? ((totalContractValue - totalCommitted) / totalContractValue) * 100 
      : 0
    
    return {
      activeProjects,
      totalContractValue,
      totalCommitted,
      companyMargin
    }
  }, [filteredProjects])

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

      // Total contract value and change orders
      const { data: contractData, error: contractError } = await supabase
        .from('projects')
        .select('id, original_contract')
        .eq('status', 'active')
        .is('deleted_at', null)

      if (contractError) {
        console.error('Error fetching contract data:', JSON.stringify(contractError, null, 2))
      }

      const totalOriginalContract = contractData?.reduce((sum, p) => sum + (p.original_contract || 0), 0) || 0
      
      // Get approved change orders for total contract value
      let totalChangeOrders = 0
      if (contractData && contractData.length > 0) {
        const projectIds = contractData.map(p => p.id)
        const { data: changeOrders } = await supabase
          .from('change_orders')
          .select('amount')
          .eq('status', 'approved')
          .in('project_id', projectIds)
        
        totalChangeOrders = changeOrders?.reduce((sum, co) => sum + (co.amount || 0), 0) || 0
      }
      
      const totalContractValue = totalOriginalContract + totalChangeOrders

      // Calculate total forecasted final cost
      // This will be calculated from the projects data to ensure consistency
      const projects = await fetchProjects()
      const totalCommitted = projects.reduce((sum, p) => sum + p.committedCosts, 0)

      // Company margin based on forecasted final cost
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
      
      // Fetch purchase orders with committed amounts
      const { data: purchaseOrders } = await supabase
        .from('purchase_orders')
        .select('project_id, total_amount, invoiced_amount, committed_amount')
        .in('project_id', projectIds)
        .eq('status', 'approved')

      // Fetch labor actuals with burden
      const { data: laborActuals } = await supabase
        .from('labor_employee_actuals')
        .select('project_id, st_wages, ot_wages, total_cost_with_burden')
        .in('project_id', projectIds)

      // Fetch labor forecasts with proper fields
      const { data: laborForecasts } = await supabase
        .from('labor_headcount_forecasts')
        .select('project_id, week_ending, headcount, avg_weekly_hours, craft_type_id')
        .in('project_id', projectIds)

      // Get weeks that have actuals to exclude from forecast
      const { data: actualWeeks } = await supabase
        .from('labor_employee_actuals')
        .select('project_id, week_ending')
        .in('project_id', projectIds)

      // Fetch approved change orders
      const { data: changeOrders } = await supabase
        .from('change_orders')
        .select('project_id, amount')
        .eq('status', 'approved')
        .in('project_id', projectIds)

      // Map the data
      return projects.map(project => {
        // Filter related data for this project
        const projectPOs = purchaseOrders?.filter(po => po.project_id === project.id) || []
        const projectLabor = laborActuals?.filter(la => la.project_id === project.id) || []
        const projectForecasts = laborForecasts?.filter(lf => lf.project_id === project.id) || []
        const projectChangeOrders = changeOrders?.filter(co => co.project_id === project.id) || []

        // Calculate labor actual costs with burden
        const laborActualCosts = projectLabor.reduce(
          (sum, la) => sum + (la.total_cost_with_burden || 
            ((la.st_wages || 0) + (la.ot_wages || 0)) * 1.28), 
          0
        )

        // Calculate PO actuals (using total_amount to match PO Breakdown)
        const poActualCosts = projectPOs.reduce(
          (sum, po) => sum + (po.total_amount || 0), 
          0
        )

        // Current costs = labor actuals + PO actuals
        const currentCosts = laborActualCosts + poActualCosts

        // Calculate committed PO costs
        const committedPOCosts = projectPOs.reduce(
          (sum, po) => sum + (po.committed_amount || 0), 
          0
        )

        // Create a set of weeks that have actual data for this project
        const projectActualWeeks = new Set(
          actualWeeks
            ?.filter(w => w.project_id === project.id)
            .map(w => new Date(w.week_ending).toISOString().split('T')[0]) || []
        )

        // Filter forecasts to only include weeks without actuals
        const futureForecasts = projectForecasts.filter(f => {
          const weekEndingDate = new Date(f.week_ending).toISOString().split('T')[0]
          return !projectActualWeeks.has(weekEndingDate)
        })

        // Calculate remaining forecast using a reasonable hourly rate
        // Using $50/hr as default (this matches the overview page logic)
        const defaultRate = 50
        const forecastedLaborCosts = futureForecasts.reduce(
          (sum, f) => sum + (f.headcount * (f.avg_weekly_hours || 50) * defaultRate), 
          0
        )

        // Total forecasted labor = actuals + remaining forecast
        const totalForecastedLabor = laborActualCosts + forecastedLaborCosts

        // Committed costs = total forecasted labor + committed PO costs
        const committedCosts = totalForecastedLabor + committedPOCosts

        // Calculate approved change orders total
        const approvedChangeOrdersTotal = projectChangeOrders.reduce(
          (sum, co) => sum + (co.amount || 0),
          0
        )

        // Calculate revised contract (original + approved change orders)
        const revisedContract = (project.original_contract || 0) + approvedChangeOrdersTotal

        // Calculate remaining (uncommitted value) = Contract - Committed
        const remainingToSpend = revisedContract - committedCosts
        
        // Calculate project margin percentage
        const margin = revisedContract > 0 
          ? ((revisedContract - committedCosts) / revisedContract) * 100
          : 0

        return {
          id: project.id,
          name: project.name,
          jobNumber: project.job_number,
          contractValue: revisedContract,
          currentCosts,
          committedCosts,
          remainingToSpend,
          margin,
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

      {/* Key Metrics Row - Now using filtered metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Projects {filteredProjects.length !== dashboardData?.projects?.length && '(Filtered)'}
            </CardTitle>
            <Building2 className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {filteredMetrics.activeProjects}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Contract Value {filteredProjects.length !== dashboardData?.projects?.length && '(Filtered)'}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(filteredMetrics.totalContractValue)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Forecasted Final Cost {filteredProjects.length !== dashboardData?.projects?.length && '(Filtered)'}
            </CardTitle>
            <FileText className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(filteredMetrics.totalCommitted)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Company Margin {filteredProjects.length !== dashboardData?.projects?.length && '(Filtered)'}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              'text-3xl font-bold',
              getMarginColor(filteredMetrics.companyMargin)
            )}>
              {filteredMetrics.companyMargin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Projects Table with Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-[200px]"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            
            <Link href="/projects">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>
        </div>
        
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job #</TableHead>
                  <TableHead>Project Name</TableHead>
                  <TableHead className="text-right">Contract</TableHead>
                  <TableHead className="text-right">Current Costs</TableHead>
                  <TableHead className="text-right">Forecasted Final</TableHead>
                  <TableHead className="text-right">Margin %</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.length > 0 ? (
                  filteredProjects.map((project) => (
                    <TableRow 
                      key={project.id} 
                      className="hover:bg-muted/50"
                    >
                      <TableCell className="font-medium text-gray-900">{project.jobNumber}</TableCell>
                      <TableCell 
                        className="font-medium cursor-pointer hover:text-blue-600"
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        {project.name}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(project.contractValue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.currentCosts)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(project.committedCosts)}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          'font-medium',
                          getMarginColor(project.margin)
                        )}>
                          {project.margin.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          'font-medium',
                          project.remainingToSpend < 0 ? 'text-red-600' : 'text-gray-900'
                        )}>
                          {formatCurrency(project.remainingToSpend)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Project
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}/edit`)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs">Quick Status Update</DropdownMenuLabel>
                            <DropdownMenuItem 
                              onClick={() => updateProjectStatus.mutate({ 
                                projectId: project.id, 
                                status: 'active' 
                              })}
                              disabled={project.status === 'active'}
                            >
                              <span className="ml-6">Active</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateProjectStatus.mutate({ 
                                projectId: project.id, 
                                status: 'on_hold' 
                              })}
                              disabled={project.status === 'on_hold'}
                            >
                              <span className="ml-6">On Hold</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => updateProjectStatus.mutate({ 
                                projectId: project.id, 
                                status: 'completed' 
                              })}
                              disabled={project.status === 'completed'}
                            >
                              <span className="ml-6">Completed</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      {searchQuery || statusFilter !== 'all' 
                        ? 'No projects match your filters.'
                        : 'No projects found. Create a new project to get started.'}
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