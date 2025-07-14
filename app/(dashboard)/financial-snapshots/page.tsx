'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { format } from 'date-fns'
import { 
  Calendar, 
  Download, 
  RefreshCw, 
  TrendingUp,
  Building,
  Briefcase,
  DollarSign 
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface FinancialSnapshot {
  id: string
  snapshot_type: 'project' | 'division' | 'company'
  snapshot_date: string
  project_id: string | null
  division_id: string | null
  original_contract: number
  revised_contract: number
  total_committed: number
  forecasted_cost: number
  forecasted_profit: number
  profit_margin: number
  percent_complete: number
  project?: {
    job_number: string
    name: string
  }
  division?: {
    name: string
    code: string
  }
}

export default function FinancialSnapshotsPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState({
    snapshot_type: '',
    project_id: '',
    division_id: '',
    date_from: '',
    date_to: '',
  })

  // Fetch snapshots
  const { data: snapshotsData, isLoading } = useQuery({
    queryKey: ['financial-snapshots', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      
      const response = await fetch(`/api/financial-snapshots?${params}`)
      if (!response.ok) throw new Error('Failed to fetch snapshots')
      return response.json()
    },
  })

  // Fetch projects for filter
  const { data: projects } = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')
      const data = await response.json()
      return data.data
    },
  })

  // Fetch divisions for filter
  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: async () => {
      const response = await fetch('/api/divisions')
      if (!response.ok) throw new Error('Failed to fetch divisions')
      const data = await response.json()
      return data.data
    },
  })

  // Calculate snapshot mutation
  const calculateSnapshot = useMutation({
    mutationFn: async (data: {
      snapshot_type: 'project' | 'division' | 'company'
      project_id?: string
      division_id?: string
    }) => {
      const response = await fetch('/api/financial-snapshots/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to calculate snapshot')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-snapshots'] })
      toast({
        title: 'Success',
        description: 'Financial snapshot calculated successfully',
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const getSnapshotIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <Briefcase className="h-4 w-4" />
      case 'division':
        return <Building className="h-4 w-4" />
      case 'company':
        return <TrendingUp className="h-4 w-4" />
      default:
        return <DollarSign className="h-4 w-4" />
    }
  }

  const snapshots = snapshotsData?.data || []

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Financial Snapshots</h1>
        <p className="text-foreground/80">
          View and generate financial performance snapshots
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="snapshot_type">Snapshot Type</Label>
              <Select
                value={filters.snapshot_type}
                onValueChange={(value) =>
                  setFilters({ ...filters, snapshot_type: value })
                }
              >
                <SelectTrigger id="snapshot_type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="division">Division</SelectItem>
                  <SelectItem value="company">Company</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="project">Project</Label>
              <Select
                value={filters.project_id}
                onValueChange={(value) =>
                  setFilters({ ...filters, project_id: value })
                }
                disabled={filters.snapshot_type === 'division' || filters.snapshot_type === 'company'}
              >
                <SelectTrigger id="project">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All projects</SelectItem>
                  {projects?.map((project: { id: string; job_number: string; name: string }) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.job_number} - {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="division">Division</Label>
              <Select
                value={filters.division_id}
                onValueChange={(value) =>
                  setFilters({ ...filters, division_id: value })
                }
                disabled={filters.snapshot_type === 'project' || filters.snapshot_type === 'company'}
              >
                <SelectTrigger id="division">
                  <SelectValue placeholder="All divisions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All divisions</SelectItem>
                  {divisions?.map((division: { id: string; code: string; name: string }) => (
                    <SelectItem key={division.id} value={division.id}>
                      {division.code} - {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date_from">From Date</Label>
              <Input
                id="date_from"
                type="date"
                value={filters.date_from}
                onChange={(e) =>
                  setFilters({ ...filters, date_from: e.target.value })
                }
              />
            </div>

            <div>
              <Label htmlFor="date_to">To Date</Label>
              <Input
                id="date_to"
                type="date"
                value={filters.date_to}
                onChange={(e) =>
                  setFilters({ ...filters, date_to: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() =>
                setFilters({
                  snapshot_type: '',
                  project_id: '',
                  division_id: '',
                  date_from: '',
                  date_to: '',
                })
              }
            >
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                calculateSnapshot.mutate({ snapshot_type: 'company' })
              }
              disabled={calculateSnapshot.isPending}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Company Snapshot
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (divisions && divisions.length > 0) {
                  calculateSnapshot.mutate({
                    snapshot_type: 'division',
                    division_id: divisions[0].id,
                  })
                }
              }}
              disabled={calculateSnapshot.isPending || !divisions?.length}
            >
              <Building className="mr-2 h-4 w-4" />
              Division Snapshot
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (projects && projects.length > 0) {
                  calculateSnapshot.mutate({
                    snapshot_type: 'project',
                    project_id: projects[0].id,
                  })
                }
              }}
              disabled={calculateSnapshot.isPending || !projects?.length}
            >
              <Briefcase className="mr-2 h-4 w-4" />
              Project Snapshot
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Snapshots Table */}
      <Card>
        <CardHeader>
          <CardTitle>Snapshot History</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading snapshots...</div>
          ) : snapshots.length === 0 ? (
            <div className="text-center py-8 text-foreground/80">
              No snapshots found. Generate your first snapshot above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Contract</TableHead>
                    <TableHead className="text-right">Committed</TableHead>
                    <TableHead className="text-right">Forecasted</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead className="text-right">Complete</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((snapshot: FinancialSnapshot) => (
                    <TableRow key={snapshot.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSnapshotIcon(snapshot.snapshot_type)}
                          <span className="capitalize">
                            {snapshot.snapshot_type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {snapshot.project
                          ? `${snapshot.project.job_number} - ${snapshot.project.name}`
                          : snapshot.division
                          ? `${snapshot.division.code} - ${snapshot.division.name}`
                          : 'Company Wide'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(
                            new Date(snapshot.snapshot_date),
                            'MMM d, yyyy'
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(snapshot.revised_contract)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(snapshot.total_committed)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(snapshot.forecasted_cost)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            snapshot.forecasted_profit >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {formatCurrency(snapshot.forecasted_profit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            snapshot.profit_margin >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }
                        >
                          {snapshot.profit_margin.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {snapshot.percent_complete.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // TODO: Implement export functionality
                            toast({
                              title: 'Export',
                              description: 'Export functionality coming soon',
                            })
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}