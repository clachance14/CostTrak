'use client'

import { useEffect, useState } from 'react'
import { 
  DollarSign, 
  TrendingUp,
  Receipt,
  AlertTriangle,
  FileText,
  Download,
  Calculator,
  PiggyBank,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { MetricCard } from '@/components/dashboard/metric-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface FinancialMetrics {
  totalRevenue: number
  totalCommitted: number
  totalInvoiced: number
  totalOutstanding: number
  cashPosition: number
  projectedProfit: number
  averageMargin: number
  budgetUtilization: number
}

interface ProjectFinancials {
  id: string
  jobNumber: string
  name: string
  division: string
  revisedContract: number
  committedCosts: number
  invoicedAmount: number
  outstandingAmount: number
  margin: number
  status: string
}

interface DivisionSummary {
  division: string
  revenue: number
  committed: number
  invoiced: number
  margin: number
  projectCount: number
}

export default function AccountingDashboard() {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null)
  const [projects, setProjects] = useState<ProjectFinancials[]>([])
  const [divisionSummary, setDivisionSummary] = useState<DivisionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchFinancialData()
  }, [])

  const fetchFinancialData = async () => {
    try {
      const supabase = createClient()
      
      // Fetch all projects with financial data
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select(`
          *,
          divisions!inner(name),
          purchase_orders(committed_amount, invoiced_amount)
        `)
        .is('deleted_at', null)

      if (projectsError) throw projectsError

      // Process project financials
      const projectFinancials: ProjectFinancials[] = projectsData?.map(project => {
        const totalCommitted = project.purchase_orders?.reduce(
          (sum: number, po: { committed_amount?: number }) => sum + (po.committed_amount || 0), 0
        ) || 0
        const totalInvoiced = project.purchase_orders?.reduce(
          (sum: number, po: { invoiced_amount?: number }) => sum + (po.invoiced_amount || 0), 0
        ) || 0
        const revenue = project.revised_contract || project.original_contract || 0
        const margin = revenue > 0 ? ((revenue - totalCommitted) / revenue) * 100 : 0

        return {
          id: project.id,
          jobNumber: project.job_number,
          name: project.name,
          division: project.divisions?.name || 'Unknown',
          revisedContract: revenue,
          committedCosts: totalCommitted,
          invoicedAmount: totalInvoiced,
          outstandingAmount: totalCommitted - totalInvoiced,
          margin: margin,
          status: project.status
        }
      }) || []

      setProjects(projectFinancials)

      // Calculate overall metrics
      const totalRevenue = projectFinancials.reduce((sum, p) => sum + p.revisedContract, 0)
      const totalCommitted = projectFinancials.reduce((sum, p) => sum + p.committedCosts, 0)
      const totalInvoiced = projectFinancials.reduce((sum, p) => sum + p.invoicedAmount, 0)
      const totalOutstanding = projectFinancials.reduce((sum, p) => sum + p.outstandingAmount, 0)
      const activeProjects = projectFinancials.filter(p => p.status === 'active')
      const averageMargin = activeProjects.length > 0
        ? activeProjects.reduce((sum, p) => sum + p.margin, 0) / activeProjects.length
        : 0

      const financialMetrics: FinancialMetrics = {
        totalRevenue,
        totalCommitted,
        totalInvoiced,
        totalOutstanding,
        cashPosition: totalInvoiced * 0.9, // Simplified: 90% of invoiced as cash
        projectedProfit: totalRevenue - totalCommitted,
        averageMargin,
        budgetUtilization: totalRevenue > 0 ? (totalCommitted / totalRevenue) * 100 : 0
      }

      setMetrics(financialMetrics)

      // Calculate division summary
      const divisionMap = projectFinancials.reduce((acc: Record<string, DivisionSummary>, project) => {
        if (!acc[project.division]) {
          acc[project.division] = {
            division: project.division,
            revenue: 0,
            committed: 0,
            invoiced: 0,
            margin: 0,
            projectCount: 0
          }
        }
        
        acc[project.division].revenue += project.revisedContract
        acc[project.division].committed += project.committedCosts
        acc[project.division].invoiced += project.invoicedAmount
        acc[project.division].projectCount++
        
        return acc
      }, {})

      // Calculate division margins
      Object.values(divisionMap).forEach(division => {
        division.margin = division.revenue > 0 
          ? ((division.revenue - division.committed) / division.revenue) * 100 
          : 0
      })

      setDivisionSummary(Object.values(divisionMap))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch financial data')
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

  // Identify projects needing attention
  const attentionProjects = projects.filter(p => p.margin < 10 && p.status === 'active')
  const highOutstandingProjects = projects.filter(p => p.outstandingAmount > 100000)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Accounting Dashboard</h1>
        <p className="text-foreground/80">
          Financial overview and reporting
        </p>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Financial reports and exports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button>
              <FileText className="mr-2 h-4 w-4" />
              Generate P&L Report
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Invoices
            </Button>
            <Button variant="outline">
              <Calculator className="mr-2 h-4 w-4" />
              Budget Analysis
            </Button>
            <Button variant="outline">
              <Receipt className="mr-2 h-4 w-4" />
              AR Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Financial Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(metrics?.totalRevenue || 0)}
          description="All projects"
          icon={DollarSign}
        />
        <MetricCard
          title="Total Committed"
          value={formatCurrency(metrics?.totalCommitted || 0)}
          description="Purchase orders"
          icon={TrendingUp}
        />
        <MetricCard
          title="Total Invoiced"
          value={formatCurrency(metrics?.totalInvoiced || 0)}
          description="Billed to date"
          icon={Receipt}
        />
        <MetricCard
          title="Outstanding"
          value={formatCurrency(metrics?.totalOutstanding || 0)}
          description="Awaiting payment"
          icon={AlertTriangle}
          className={metrics && metrics.totalOutstanding > 500000 ? "border-orange-200" : ""}
        />
      </div>

      {/* Additional Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Cash Position"
          value={formatCurrency(metrics?.cashPosition || 0)}
          description="Estimated available"
          icon={PiggyBank}
        />
        <MetricCard
          title="Projected Profit"
          value={formatCurrency(metrics?.projectedProfit || 0)}
          description="Revenue - Committed"
          icon={TrendingUp}
          trend={{
            value: 5.2,
            isPositive: true
          }}
        />
        <MetricCard
          title="Average Margin"
          value={`${metrics?.averageMargin.toFixed(1) || 0}%`}
          description="Active projects"
          icon={Calculator}
        />
        <MetricCard
          title="Budget Utilization"
          value={`${metrics?.budgetUtilization.toFixed(1) || 0}%`}
          description="Committed vs Revenue"
          icon={TrendingUp}
        />
      </div>

      {/* Division Financial Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Division Financial Summary</CardTitle>
          <CardDescription>Revenue and costs by division</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Division</TableHead>
                <TableHead className="text-center">Projects</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Committed</TableHead>
                <TableHead className="text-right">Invoiced</TableHead>
                <TableHead className="text-right">Margin %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {divisionSummary.map((division) => (
                <TableRow key={division.division}>
                  <TableCell className="font-medium">{division.division}</TableCell>
                  <TableCell className="text-center">{division.projectCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(division.revenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(division.committed)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(division.invoiced)}</TableCell>
                  <TableCell className="text-right">
                    <span className={division.margin < 10 ? 'text-orange-600 font-medium' : ''}>
                      {division.margin.toFixed(1)}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-center">
                  {divisionSummary.reduce((sum, d) => sum + d.projectCount, 0)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(divisionSummary.reduce((sum, d) => sum + d.revenue, 0))}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(divisionSummary.reduce((sum, d) => sum + d.committed, 0))}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(divisionSummary.reduce((sum, d) => sum + d.invoiced, 0))}
                </TableCell>
                <TableCell className="text-right">
                  {metrics?.averageMargin.toFixed(1)}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Projects with High Outstanding Amounts */}
      <Card>
        <CardHeader>
          <CardTitle>Projects with High Outstanding Balances</CardTitle>
          <CardDescription>Projects with over $100k in unbilled commitments</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Division</TableHead>
                <TableHead className="text-right">Committed</TableHead>
                <TableHead className="text-right">Invoiced</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {highOutstandingProjects.slice(0, 10).map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.jobNumber}</TableCell>
                  <TableCell>{project.name}</TableCell>
                  <TableCell>{project.division}</TableCell>
                  <TableCell className="text-right">{formatCurrency(project.committedCosts)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(project.invoicedAmount)}</TableCell>
                  <TableCell className="text-right font-medium text-orange-600">
                    {formatCurrency(project.outstandingAmount)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/projects/${project.id}`}>
                      <Button size="sm" variant="ghost">View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Margin Alerts */}
      {attentionProjects.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Low Margin Alert:</strong> {attentionProjects.length} active project{attentionProjects.length !== 1 ? 's' : ''} have margins below 10%:
            <ul className="mt-2 ml-4 list-disc">
              {attentionProjects.slice(0, 5).map(p => (
                <li key={p.id}>
                  {p.jobNumber} - {p.name} ({p.margin.toFixed(1)}% margin, {formatCurrency(p.revisedContract - p.committedCosts)} at risk)
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}