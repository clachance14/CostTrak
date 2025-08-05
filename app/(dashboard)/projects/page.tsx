'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  LayoutGrid as Grid3x3, 
  Table,
  Eye,
  Edit,
  FileText,
  DollarSign,
  Users,
  Building,
  Download,
  Settings,
  Upload,
  MoreHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { SortableTableHeader } from '@/components/ui/sortable-table-header'
import type { SortDirection } from '@/components/ui/sortable-table-header'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUser } from '@/hooks/use-auth'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/api'

interface CountResult {
  count: number
}

type ViewMode = 'table' | 'cards'
type SortField = 'job_number' | 'name' | 'status' | 'original_contract' | 'revised_contract' | 'start_date' | 'end_date'

interface SortConfig {
  field: SortField | null
  direction: SortDirection
}

interface ColumnFilter {
  column: string
  values: string[]
}

export default function ProjectsPage() {
  const router = useRouter()
  const { data: user } = useUser()
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<string>('20')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: null, direction: null })
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([])

  // Sort handler
  const handleSort = (field: string) => {
    const sortField = field as SortField
    setSortConfig(current => {
      if (current.field === sortField) {
        const newDirection = current.direction === 'asc' ? 'desc' : 
                           current.direction === 'desc' ? null : 'asc'
        return { field: newDirection ? sortField : null, direction: newDirection }
      } else {
        return { field: sortField, direction: 'asc' }
      }
    })
  }

  // Handle column filter changes
  const handleFilterChange = (column: string, values: string[]) => {
    setColumnFilters(current => {
      const filtered = current.filter(f => f.column !== column)
      if (values.length > 0) {
        return [...filtered, { column, values }]
      }
      return filtered
    })
  }

  // Fetch projects
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', page, limit, search, statusFilter, columnFilters, sortConfig],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit
      })
      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)
      
      // Apply column filters
      columnFilters.forEach(filter => {
        if (filter.values.length > 0) {
          params.append(`filter_${filter.column}`, filter.values.join(','))
        }
      })
      
      if (sortConfig.field && sortConfig.direction) {
        params.append('sort_by', sortConfig.field)
        params.append('sort_direction', sortConfig.direction)
      }

      const response = await fetch(`/api/projects?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }
      return response.json()
    }
  })


  const canCreateProject = user && user.role === 'project_manager'
  const canImportBudget = !!user

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'on_hold': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-foreground/5 text-foreground'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-foreground/5 text-foreground'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const clearAllFilters = () => {
    setSearch('')
    setStatusFilter('')
    setColumnFilters([])
    setSortConfig({ field: null, direction: null })
    setPage(1)
  }

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (search) count++
    if (statusFilter) count++
    count += columnFilters.length
    if (sortConfig.field) count++
    return count
  }, [search, statusFilter, columnFilters.length, sortConfig.field])

  const handleExport = () => {
    if (!data?.projects) return
    
    const headers = ['Job Number', 'Project Name', 'Status', 'Client', 'Project Manager', 'Original Contract', 'Revised Contract', 'Start Date', 'End Date']
    const rows = data.projects.map((project: Project) => [
      project.job_number,
      project.name,
      project.status,
      project.client?.name || '',
      project.project_manager ? `${project.project_manager.first_name} ${project.project_manager.last_name}` : '',
      project.original_contract,
      project.revised_contract,
      format(new Date(project.start_date), 'yyyy-MM-dd'),
      format(new Date(project.end_date), 'yyyy-MM-dd')
    ])
    
    const csvContent = [headers, ...rows]
      .map(row => row.map((cell: string | number) => `"${cell}"`).join(','))
      .join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `projects-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Calculate project progress
  const calculateProgress = (project: Project) => {
    const start = new Date(project.start_date).getTime()
    const end = new Date(project.end_date).getTime()
    const now = new Date().getTime()
    
    if (now < start) return 0
    if (now > end) return 100
    
    const total = end - start
    const elapsed = now - start
    return Math.round((elapsed / total) * 100)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Projects</h1>
          <p className="text-foreground mt-1">Manage and track all projects</p>
        </div>
        <div className="flex gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-foreground/10 rounded-lg p-1 border border-foreground/30">
            <button
              onClick={() => setViewMode('cards')}
              className={cn(
                "px-3 py-1.5 rounded-md font-medium transition-colors flex items-center",
                viewMode === 'cards' 
                  ? 'bg-white shadow-sm text-foreground border border-foreground/30' 
                  : 'text-foreground/80 hover:bg-foreground/5 hover:text-foreground'
              )}
            >
              <Grid3x3 className="h-4 w-4 mr-2 text-foreground/80" />
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "px-3 py-1.5 rounded-md font-medium transition-colors flex items-center",
                viewMode === 'table' 
                  ? 'bg-white shadow-sm text-foreground border border-foreground/30' 
                  : 'text-foreground/80 hover:bg-foreground/5 hover:text-foreground'
              )}
            >
              <Table className="h-4 w-4 mr-2 text-foreground/80" />
              Table
            </button>
          </div>
          
          {activeFiltersCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center px-4 py-2 border-2 border-orange-500 rounded-md font-medium text-orange-700 bg-white hover:bg-orange-50 transition-colors"
            >
              <Settings className="h-4 w-4 mr-2 text-orange-600" />
              Clear All ({activeFiltersCount})
            </button>
          )}
          
          <button
            onClick={handleExport}
            className="inline-flex items-center px-4 py-2 border-2 border-foreground/40 rounded-md font-medium text-foreground/80 bg-white hover:bg-background hover:text-foreground transition-colors"
          >
            <Download className="h-4 w-4 mr-2 text-foreground/70" />
            Export
          </button>
          
          {canImportBudget && (
            <Button 
              onClick={() => router.push('/project-budgets/import')}
              variant="outline"
              className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Budget
            </Button>
          )}
          
          {canCreateProject && (
            <Button 
              onClick={() => router.push('/projects/new')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground/80" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9 border-2 border-foreground/40 font-medium"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="w-full px-3 py-2 border-2 border-foreground/40 text-foreground bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            className="w-full px-3 py-2 border-2 border-foreground/40 text-foreground/80 bg-white rounded-md font-medium hover:bg-background hover:text-foreground transition-colors"
            onClick={() => {
              setSearch('')
              setStatusFilter('')
              setPage(1)
            }}>
            Clear Filters
          </button>
        </div>
        
        {/* Table View Controls */}
        {viewMode === 'table' && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground/80">Show:</label>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(e.target.value)
                    setPage(1)
                  }}
                  className="px-2 py-1 border-2 border-foreground/40 text-foreground bg-white rounded text-sm font-medium"
                >
                  <option value="20">20 entries</option>
                  <option value="50">50 entries</option>
                  <option value="100">100 entries</option>
                  <option value="all">All entries</option>
                </select>
              </div>
              {data?.pagination && (
                <div className="text-sm text-foreground/80">
                  Showing {data.projects?.length || 0} of {data.pagination.total} entries
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              {activeFiltersCount > 0 && (
                <div className="text-sm text-blue-600 font-medium">
                  {activeFiltersCount} filter{activeFiltersCount !== 1 ? 's' : ''} active
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Projects List */}
      {error ? (
        <Card className="p-8">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading projects</p>
            <p className="text-foreground mb-4">There was a problem loading the projects. Please try again.</p>
            <button
              className="inline-flex items-center px-4 py-2 border-2 border-foreground/40 rounded-md font-medium text-foreground/80 bg-white hover:bg-background hover:text-foreground transition-colors"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="text-center py-8">
          <p className="text-foreground/80">Loading projects...</p>
        </div>
      ) : !data?.projects || data.projects.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <div className="mx-auto w-24 h-24 bg-foreground/5 rounded-full flex items-center justify-center mb-6">
              <Building className="h-12 w-12 text-foreground/60" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">No projects yet</h2>
            <p className="text-foreground/80 mb-8 max-w-md mx-auto">
              Get started by creating your first project. You can track contracts, purchase orders, and labor forecasts for each project.
            </p>
            {canCreateProject ? (
              <Button 
                onClick={() => router.push('/projects/new')} 
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Your First Project
              </Button>
            ) : (
              <p className="text-foreground/70 text-sm">
                Contact your administrator to create projects.
              </p>
            )}
          </div>
        </Card>
      ) : viewMode === 'table' ? (
        // Table View
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background">
                <tr>
                  <SortableTableHeader
                    sortKey="job_number"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    filterable={true}
                    currentFilters={columnFilters}
                    onFilterChange={handleFilterChange}
                  >
                    Job Number
                  </SortableTableHeader>
                  <SortableTableHeader
                    sortKey="name"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    filterable={true}
                    currentFilters={columnFilters}
                    onFilterChange={handleFilterChange}
                  >
                    Project Name
                  </SortableTableHeader>
                  <SortableTableHeader
                    sortKey="status"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    filterable={true}
                    currentFilters={columnFilters}
                    onFilterChange={handleFilterChange}
                  >
                    Status
                  </SortableTableHeader>
                  <th className="px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider">
                    Client
                  </th>
                  <SortableTableHeader
                    sortKey="project_manager_name"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    filterable={true}
                    currentFilters={columnFilters}
                    onFilterChange={handleFilterChange}
                  >
                    Project Manager
                  </SortableTableHeader>
                  <SortableTableHeader
                    sortKey="original_contract"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    filterable={true}
                    currentFilters={columnFilters}
                    onFilterChange={handleFilterChange}
                    align="right"
                  >
                    Original Contract
                  </SortableTableHeader>
                  <SortableTableHeader
                    sortKey="revised_contract"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    filterable={true}
                    currentFilters={columnFilters}
                    onFilterChange={handleFilterChange}
                    align="right"
                  >
                    Revised Contract
                  </SortableTableHeader>
                  <SortableTableHeader
                    sortKey="start_date"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    filterable={true}
                    currentFilters={columnFilters}
                    onFilterChange={handleFilterChange}
                  >
                    Start Date
                  </SortableTableHeader>
                  <SortableTableHeader
                    sortKey="end_date"
                    currentSort={sortConfig}
                    onSort={handleSort}
                    filterable={true}
                    currentFilters={columnFilters}
                    onFilterChange={handleFilterChange}
                  >
                    End Date
                  </SortableTableHeader>
                  <th className="px-6 py-3 text-right text-xs font-medium text-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.projects?.map((project: Project) => (
                  <tr key={project.id} className="hover:bg-background">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-foreground">
                      {project.job_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link 
                        href={`/projects/${project.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                        {project.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-foreground">
                      -
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-foreground">
                      {project.project_manager ? 
                        `${project.project_manager.first_name} ${project.project_manager.last_name}` : 
                        '-'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-foreground">
                      {formatCurrency(project.original_contract)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-foreground">
                      {formatCurrency(project.revised_contract)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {format(new Date(project.start_date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                      {format(new Date(project.end_date), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/projects/${project.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canCreateProject && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/projects/${project.id}/edit`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {user?.role === 'project_manager' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        // Enhanced Card View
        <>
          <div className="grid gap-4">
            {data?.projects?.map((project: Project) => {
              const progress = calculateProgress(project)
              const changeOrderAmount = 0 // Change orders removed from system
              
              return (
                <Card key={project.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <Link 
                          href={`/projects/${project.id}`}
                          className="text-xl font-semibold text-blue-600 hover:text-blue-800"
                        >
                          {project.name}
                        </Link>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                          {project.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {project.status === 'active' && (
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-foreground/10 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-foreground/80">{progress}%</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-foreground">
                        <div>
                          <span className="font-medium">Job #:</span> {project.job_number}
                        </div>
                        <div>
                          <span className="font-medium">Client:</span> N/A
                        </div>
                        <div>
                          <span className="font-medium">PM:</span> {project.project_manager ? `${project.project_manager.first_name} ${project.project_manager.last_name}` : 'N/A'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-foreground">Contract:</span>
                          <p className="font-semibold">{formatCurrency(project.original_contract)}</p>
                        </div>
                        <div>
                          <span className="text-foreground">Revised:</span>
                          <p className="font-semibold">{formatCurrency(project.revised_contract)}</p>
                        </div>
                        <div>
                          <span className="text-foreground">Change Orders:</span>
                          <p className={`font-semibold ${changeOrderAmount > 0 ? 'text-green-600' : changeOrderAmount < 0 ? 'text-red-600' : ''}`}>
                            {changeOrderAmount > 0 && '+'}{formatCurrency(changeOrderAmount)}
                          </p>
                        </div>
                        <div>
                          <span className="text-foreground">Start:</span>
                          <p className="font-semibold">{format(new Date(project.start_date), 'MMM d, yyyy')}</p>
                        </div>
                        <div>
                          <span className="text-foreground">End:</span>
                          <p className="font-semibold">{format(new Date(project.end_date), 'MMM d, yyyy')}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex gap-6 text-xs text-foreground/80">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {(project.purchase_orders as CountResult[])?.[0]?.count || 0} POs
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {(project.change_orders as CountResult[])?.[0]?.count || 0} COs
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {(project.labor_forecasts as CountResult[])?.[0]?.count || 0} Labor Forecasts
                          </span>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/projects/${project.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </Button>
                          {canCreateProject && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/projects/${project.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Button>
                          )}
                          {user?.role === 'project_manager' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && viewMode === 'cards' && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <button
                className="inline-flex items-center px-4 py-2 border-2 border-foreground/40 rounded-md font-medium text-foreground/80 bg-white hover:bg-background hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 text-foreground/80 mr-1" />
                Previous
              </button>
              
              <span className="text-sm text-foreground font-medium">
                Page {page} of {data.pagination.totalPages}
              </span>
              
              <button
                className="inline-flex items-center px-4 py-2 border-2 border-foreground/40 rounded-md font-medium text-foreground/80 bg-white hover:bg-background hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setPage(page + 1)}
                disabled={page === data.pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 text-foreground/80 ml-1" />
              </button>
            </div>
          )}
        </>
      )}

    </div>
  )
}