'use client'

import { useEffect, useState } from 'react'
import { 
  Building, 
  DollarSign, 
  TrendingUp, 
  Users,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { MetricCard } from '@/components/dashboard/metric-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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

export default function OpsManagerDashboard() {
  const [divisions, setDivisions] = useState<DivisionData[]>([])
  const [allProjects, setAllProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Operations Manager Dashboard</h1>
        <p className="text-gray-700">
          Cross-division operational overview
        </p>
      </div>

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
    </div>
  )
}