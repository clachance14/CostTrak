'use client'

import { 
  Shield,
  Users,
  Building,
  Calculator,
  Eye,
  UserCheck,
  ChevronRight,
  Info,
  BarChart3
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

interface RoleDashboard {
  title: string
  role: string
  description: string
  features: string[]
  href: string
  icon: React.ElementType
  color: string
}

const roleDashboards: RoleDashboard[] = [
  {
    title: 'Executive Dashboard',
    role: 'executive',
    description: 'High-level company overview and strategic metrics',
    features: [
      'Company-wide financial summary',
      'Division performance metrics',
      'Portfolio health indicators',
      'Executive reports'
    ],
    href: '/dashboard/executive',
    icon: BarChart3,
    color: 'bg-purple-500'
  },
  {
    title: 'Controller Admin',
    role: 'controller',
    description: 'Full system administration and oversight',
    features: [
      'User management',
      'System configuration',
      'Audit logs',
      'All role permissions'
    ],
    href: '/dashboard/controller-admin',
    icon: Shield,
    color: 'bg-red-500'
  },
  {
    title: 'Operations Manager',
    role: 'ops_manager',
    description: 'Division-level project and resource management',
    features: [
      'Division project overview',
      'Resource allocation',
      'Budget tracking',
      'Team performance'
    ],
    href: '/dashboard/ops-manager',
    icon: Building,
    color: 'bg-blue-500'
  },
  {
    title: 'Project Manager',
    role: 'project_manager',
    description: 'Individual project management and tracking',
    features: [
      'Project details and status',
      'Purchase order management',
      'Labor tracking',
      'Change order creation'
    ],
    href: '/dashboard/project-manager',
    icon: UserCheck,
    color: 'bg-green-500'
  },
  {
    title: 'Accounting',
    role: 'accounting',
    description: 'Financial data entry and reporting',
    features: [
      'Invoice processing',
      'Financial reports',
      'Budget reconciliation',
      'Export capabilities'
    ],
    href: '/dashboard/accounting',
    icon: Calculator,
    color: 'bg-amber-500'
  },
  {
    title: 'Viewer',
    role: 'viewer',
    description: 'Read-only access to project information',
    features: [
      'View project status',
      'Access reports',
      'Review financials',
      'No edit permissions'
    ],
    href: '/dashboard/viewer',
    icon: Eye,
    color: 'bg-background0'
  }
]

export default function ControllerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Role Testing Dashboard</h1>
        <p className="text-foreground/80">
          Test CostTrak workflows from different user perspectives
        </p>
      </div>

      {/* Testing Mode Alert */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Controller Testing Mode
          </CardTitle>
          <CardDescription>
            As a controller, you have access to all role-based dashboards for testing purposes. 
            Click any role below to experience their workflow.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Role Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {roleDashboards.map((dashboard) => {
          const Icon = dashboard.icon
          return (
            <Link key={dashboard.role} href={dashboard.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${dashboard.color} text-white`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <Badge variant="outline">{dashboard.role.replace('_', ' ')}</Badge>
                  </div>
                  <CardTitle className="text-xl">{dashboard.title}</CardTitle>
                  <CardDescription>{dashboard.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm font-medium mb-2">Key Features:</p>
                    <ul className="space-y-1">
                      {dashboard.features.map((feature, index) => (
                        <li key={index} className="text-sm text-foreground/80 flex items-start gap-2">
                          <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button className="w-full mt-4" variant="outline">
                    Open {dashboard.title}
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Admin Functions</CardTitle>
          <CardDescription>Core administrative tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/projects">
              <Button variant="outline">
                <Building className="mr-2 h-4 w-4" />
                All Projects
              </Button>
            </Link>
            <Link href="/purchase-orders">
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Purchase Orders
              </Button>
            </Link>
            <Link href="/change-orders">
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Change Orders
              </Button>
            </Link>
            <Link href="/labor-forecasts">
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                Labor Forecasts
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}