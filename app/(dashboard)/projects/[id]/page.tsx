'use client'

import { use } from 'react'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Trash2, FileText, DollarSign, Clock, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useUser } from '@/hooks/use-auth'
import { format } from 'date-fns'

interface ProjectPO {
  id: string
  po_number: string
  vendor_name: string
  description: string
  amount: number
  status: string
  created_at: string
}

interface ProjectCO {
  id: string
  co_number: string
  description: string
  amount: number
  status: string
  created_at: string
}

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const router = useRouter()
  const { data: user } = useUser()
  const { id } = use(params)

  // Fetch project details
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch project')
      }
      const data = await response.json()
      return data.project
    }
  })

  const canEdit = user && ['controller', 'executive', 'ops_manager', 'project_manager'].includes(user.role)
  const canDelete = user?.role === 'controller'

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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        router.push('/projects')
      } else {
        alert('Failed to delete project')
      }
    } catch {
      alert('Error deleting project')
    }
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-600">Error loading project</p>
          <Button
            variant="outline"
            onClick={() => router.push('/projects')}
            className="mt-4"
          >
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-700">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-700">Project not found</p>
          <Button
            variant="outline"
            onClick={() => router.push('/projects')}
            className="mt-4"
          >
            Back to Projects
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/projects')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-gray-600">Job #{project.job_number}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                {project.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="outline"
              onClick={() => router.push(`/projects/${id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              onClick={handleDelete}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Details */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Project Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Client</p>
                <p className="font-medium">{project.client.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Division</p>
                <p className="font-medium">{project.division.name} ({project.division.code})</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Project Manager</p>
                <p className="font-medium">
                  {project.project_manager.first_name} {project.project_manager.last_name}
                </p>
                <p className="text-sm text-gray-700">{project.project_manager.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created By</p>
                <p className="font-medium">
                  {project.created_by_user.first_name} {project.created_by_user.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Start Date</p>
                <p className="font-medium">{format(new Date(project.start_date), 'MMMM d, yyyy')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">End Date</p>
                <p className="font-medium">{format(new Date(project.end_date), 'MMMM d, yyyy')}</p>
              </div>
            </div>
            
            {project.description && (
              <div className="mt-4">
                <p className="text-sm text-gray-600">Description</p>
                <p className="mt-1">{project.description}</p>
              </div>
            )}
          </Card>

          {/* Location */}
          {(project.address || project.city || project.state) && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Location</h2>
              <div className="space-y-1">
                {project.address && <p>{project.address}</p>}
                {(project.city || project.state || project.zip_code) && (
                  <p>
                    {project.city && `${project.city}, `}
                    {project.state} {project.zip_code}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Recent Activity */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {(project.purchase_orders as ProjectPO[])?.slice(0, 3).map((po) => (
                <div key={po.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">PO #{po.po_number}</p>
                    <p className="text-sm text-gray-600">{po.vendor_name} - {po.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(po.amount)}</p>
                    <p className="text-sm text-gray-700">{format(new Date(po.created_at), 'MMM d')}</p>
                  </div>
                </div>
              ))}
              
              {(project.change_orders as ProjectCO[])?.slice(0, 3).map((co) => (
                <div key={co.id} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">CO #{co.co_number}</p>
                    <p className="text-sm text-gray-600">{co.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(co.amount)}</p>
                    <p className="text-sm text-gray-700">{format(new Date(co.created_at), 'MMM d')}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Financial Summary</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Original Contract</p>
                <p className="text-2xl font-bold">{formatCurrency(project.original_contract)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Revised Contract</p>
                <p className="text-2xl font-bold">{formatCurrency(project.revised_contract)}</p>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-gray-600">Change Orders</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(project.revised_contract - project.original_contract)}
                </p>
              </div>
            </div>
          </Card>

          {/* Quick Stats */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center text-gray-600">
                  <FileText className="h-4 w-4 mr-2" />
                  Purchase Orders
                </span>
                <span className="font-semibold">{project.purchase_orders?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center text-gray-600">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Change Orders
                </span>
                <span className="font-semibold">{project.change_orders?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center text-gray-600">
                  <Clock className="h-4 w-4 mr-2" />
                  Labor Forecasts
                </span>
                <span className="font-semibold">{project.labor_forecasts?.length || 0}</span>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => router.push(`/projects/${id}/purchase-orders`)}
              >
                <FileText className="h-4 w-4 mr-2" />
                View Purchase Orders
              </Button>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => router.push(`/change-orders?project_id=${id}`)}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                View Change Orders
              </Button>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => router.push(`/labor-forecasts?project_id=${id}`)}
              >
                <Users className="h-4 w-4 mr-2" />
                View Labor Forecasts
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}