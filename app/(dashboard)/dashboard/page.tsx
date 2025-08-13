'use client'

import { useState, useMemo, useEffect } from 'react'
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
  AlertTriangle,
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
  
  // Funnel states
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    // Load from localStorage, default to 'active' to show active projects by default
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('dashboard-status-filter')
        return stored || 'active'
      } catch (error) {
        console.error('Error loading status filter:', error)
      }
    }
    return 'active'
  })

  // Save status filter to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dashboard-status-filter', statusFilter)
      } catch (error) {
        console.error('Error saving status filter:', error)
      }
    }
  }, [statusFilter])

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
  
  // Funnel projects based on search and status
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
      // Note: base_margin_percentage will be null if column doesn't exist yet
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
      // Note: Supabase "Max Rows Returned" setting should be set to 10000+ to get all records
      const { data: laborActuals, error: laborError } = await supabase
        .from('labor_employee_actuals')
        .select('project_id, st_wages, ot_wages, total_cost_with_burden')
        .in('project_id', projectIds)
      
      if (laborError) {
        console.error('Error fetching labor actuals:', laborError)
      }
      
      // Fetch per diem costs
      const { data: perDiemCosts, error: perDiemError } = await supabase
        .from('per_diem_costs')
        .select('project_id, amount')
        .in('project_id', projectIds)
      
      if (perDiemError) {
        console.error('Error fetching per diem costs:', perDiemError)
      }
      
      // Debug logging for labor data
      const project5772 = projects.find(p => p.job_number === '5772')
      if (project5772) {
        const labor5772 = laborActuals?.filter(la => la.project_id === project5772.id) || []
        console.log('Labor fetch debug for 5772:', {
          totalLaborRecords: laborActuals?.length || 0,
          project5772Id: project5772.id,
          labor5772Records: labor5772.length,
          firstFewRecords: labor5772.slice(0, 3)
        })
      }

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
        // Funnel related data for this project
        const projectPOs = purchaseOrders?.filter(po => po.project_id === project.id) || []
        const projectLabor = laborActuals?.filter(la => la.project_id === project.id) || []
        const projectForecasts = laborForecasts?.filter(lf => lf.project_id === project.id) || []
        const projectChangeOrders = changeOrders?.filter(co => co.project_id === project.id) || []
        const projectPerDiem = perDiemCosts?.filter(pd => pd.project_id === project.id) || []

        // Calculate labor actual costs with burden
        // IMPORTANT: total_cost_with_burden already includes the burden
        const laborActualCosts = projectLabor.reduce(
          (sum, la) => {
            // Use total_cost_with_burden if available (it's the correct burdened cost)
            if (la.total_cost_with_burden !== null && la.total_cost_with_burden !== undefined) {
              return sum + la.total_cost_with_burden
            }
            // Fallback: calculate burden as wages * 1.28 (28% burden)
            const wages = (la.st_wages || 0) + (la.ot_wages || 0)
            return sum + (wages * 1.28)
          }, 
          0
        )

        // Calculate per diem costs for this project
        const perDiemTotal = projectPerDiem.reduce(
          (sum, pd) => sum + (pd.amount || 0),
          0
        )

        // Calculate PO committed costs (using committed_amount for accuracy)
        const committedPOCosts = projectPOs.reduce(
          (sum, po) => sum + (po.committed_amount || po.total_amount || 0), 
          0
        )
        
        // Calculate PO invoiced costs
        const poInvoicedCosts = projectPOs.reduce(
          (sum, po) => sum + (po.invoiced_amount || 0), 
          0
        )

        // Current costs = labor actuals + PO invoiced + per diem (what's actually been spent)
        const currentCosts = laborActualCosts + poInvoicedCosts + perDiemTotal

        // Create a set of weeks that have actual data for this project
        const projectActualWeeks = new Set(
          actualWeeks
            ?.filter(w => w.project_id === project.id)
            .map(w => new Date(w.week_ending).toISOString().split('T')[0]) || []
        )

        // Funnel forecasts to only include weeks without actuals
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

        // Calculate approved change orders total
        const approvedChangeOrdersTotal = projectChangeOrders.reduce(
          (sum, co) => sum + (co.amount || 0),
          0
        )

        // Calculate revised contract (original + approved change orders)
        const revisedContract = (project.original_contract || 0) + approvedChangeOrdersTotal
        
        // Calculate total committed (labor + POs + per diem)
        const totalCommitted = laborActualCosts + committedPOCosts + perDiemTotal
        
        // Calculate spend percentage
        const spendPercentage = revisedContract > 0 ? (totalCommitted / revisedContract) * 100 : 0
        
        // Apply 20% threshold logic for forecasted final costs
        let committedCosts: number
        // Use 15% as default if base_margin_percentage column doesn't exist yet
        const baseMarginPercentage = (project as any).base_margin_percentage || 15
        
        // Debug logging for projects
        if (project.job_number === '5772' || project.job_number === '5800') {
          console.log(`Project ${project.job_number} Labor Details:`, {
            laborRecords: projectLabor.length,
            firstRecord: projectLabor[0] ? {
              st_wages: projectLabor[0].st_wages,
              ot_wages: projectLabor[0].ot_wages,
              total_cost_with_burden: projectLabor[0].total_cost_with_burden,
              calculated: projectLabor[0].total_cost_with_burden || ((projectLabor[0].st_wages || 0) + (projectLabor[0].ot_wages || 0)) * 1.28
            } : null,
            sumOfBurden: projectLabor.reduce((sum, la) => sum + (la.total_cost_with_burden || 0), 0),
            sumOfWages: projectLabor.reduce((sum, la) => sum + ((la.st_wages || 0) + (la.ot_wages || 0)), 0)
          })
          console.log(`Project ${project.job_number} Debug:`, {
            laborActualCosts,
            committedPOCosts,
            totalCommitted,
            revisedContract,
            spendPercentage: spendPercentage.toFixed(1) + '%',
            baseMarginPercentage,
            method: spendPercentage < 20 ? 'margin-based' : 'committed-based'
          })
        }
        
        if (spendPercentage < 20) {
          // Under 20% spent: use margin-based calculation
          committedCosts = revisedContract * (1 - baseMarginPercentage / 100)
        } else {
          // 20% or more spent: use actual committed value
          committedCosts = totalCommitted
        }
        
        // CRITICAL: Forecasted final can never be less than what's already spent
        // If we've spent $4.4M, our forecast must be at least $4.4M
        committedCosts = Math.max(committedCosts, currentCosts)
        
        // More debug logging
        if (project.job_number === '5772' || project.job_number === '5800') {
          const expectedValue = project.job_number === '5772' ? 1100636 : 
                               project.job_number === '5800' ? 329469 : 0 // 5800 should be 387846 * 0.85
          console.log(`Project ${project.job_number} Final:`, {
            committedCosts,
            expectedValue,
            shouldUseMargin: spendPercentage < 20,
            marginBasedValue: revisedContract * (1 - baseMarginPercentage / 100)
          })
        }

        // Calculate remaining budget = Contract - Current Actual Costs
        // This shows true remaining budget based on what's actually been spent
        const remainingToSpend = revisedContract - currentCosts
        
        // Calculate project margin percentage based on forecasted final costs
        // This shows expected margin at completion (can be negative if overrun)
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

  const getStatusBadge = (status: string, remainingBudget?: number) => {
    // Check for budget overrun first
    if (remainingBudget !== undefined && remainingBudget < 0 && status === 'active') {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Overrun
        </Badge>
      )
    }
    
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
                        <div className="flex items-center justify-end gap-1">
                          {project.remainingToSpend < 0 && (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                          <span className={cn(
                            'font-medium',
                            project.remainingToSpend < 0 ? 'text-red-600 font-semibold' : 'text-gray-900'
                          )}>
                            {formatCurrency(project.remainingToSpend)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(project.status, project.remainingToSpend)}</TableCell>
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