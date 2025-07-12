'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { useUser } from '@/hooks/use-auth'
import { format } from 'date-fns'
import type { Project, Division } from '@/types/api'

interface CountResult {
  count: number
}


export default function ProjectsPage() {
  const router = useRouter()
  const { data: user } = useUser()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [divisionFilter, setDivisionFilter] = useState<string>('')

  // Fetch projects
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', page, search, statusFilter, divisionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      })
      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)
      if (divisionFilter) params.append('division_id', divisionFilter)

      const response = await fetch(`/api/projects?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }
      return response.json()
    }
  })

  // Fetch divisions for filter
  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const response = await fetch('/api/divisions')
      if (!response.ok) return []
      const data = await response.json()
      return data.divisions || []
    }
  })

  const canCreateProject = user && ['controller', 'executive', 'ops_manager'].includes(user.role)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'planning': return 'bg-blue-100 text-blue-800'
      case 'on_hold': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
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

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600">Error loading projects</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage and track all projects</p>
        </div>
        {canCreateProject && (
          <Button onClick={() => router.push('/projects/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={divisionFilter}
            onChange={(e) => {
              setDivisionFilter(e.target.value)
              setPage(1)
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Divisions</option>
            {divisions?.map((div: Division) => (
              <option key={div.id} value={div.id}>
                {div.name} ({div.code})
              </option>
            ))}
          </select>

          <Button variant="outline" onClick={() => {
            setSearch('')
            setStatusFilter('')
            setDivisionFilter('')
            setPage(1)
          }}>
            Clear Filters
          </Button>
        </div>
      </Card>

      {/* Projects List */}
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-700">Loading projects...</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {data?.projects?.map((project: Project) => (
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
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Job #:</span> {project.job_number}
                      </div>
                      <div>
                        <span className="font-medium">Client:</span> {project.client?.name || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Division:</span> {project.division?.name || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">PM:</span> {project.project_manager ? `${project.project_manager.first_name} ${project.project_manager.last_name}` : 'N/A'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-gray-600">Contract:</span>
                        <p className="font-semibold">{formatCurrency(project.original_contract)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Revised:</span>
                        <p className="font-semibold">{formatCurrency(project.revised_contract)}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Start:</span>
                        <p className="font-semibold">{format(new Date(project.start_date), 'MMM d, yyyy')}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">End:</span>
                        <p className="font-semibold">{format(new Date(project.end_date), 'MMM d, yyyy')}</p>
                      </div>
                    </div>

                    <div className="flex gap-6 mt-3 text-xs text-gray-700">
                      <span>{(project.purchase_orders as CountResult[])?.[0]?.count || 0} POs</span>
                      <span>{(project.change_orders as CountResult[])?.[0]?.count || 0} COs</span>
                      <span>{(project.labor_forecasts as CountResult[])?.[0]?.count || 0} Labor Forecasts</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {data?.projects?.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-700">No projects found</p>
            </div>
          )}

          {/* Pagination */}
          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              
              <span className="text-sm text-gray-600">
                Page {page} of {data.pagination.totalPages}
              </span>
              
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page === data.pagination.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}