'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, Activity, FileText, CircleAlert, Upload, CircleCheck } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface LaborTrendData {
  week: string
  headcount: number
}

interface ActivityItem {
  id: string
  type: 'change_order' | 'import' | 'alert' | 'approval'
  title: string
  timestamp: string
  metadata?: any
}

interface ProjectHealthDashboardProps {
  budgetData: {
    spent: number
    committed: number
    budget: number
  }
  laborTrends: LaborTrendData[]
  currentHeadcount: number
  peakHeadcount: number
  recentActivity: ActivityItem[]
}

export function ProjectHealthDashboard({ 
  budgetData, 
  laborTrends, 
  currentHeadcount, 
  peakHeadcount,
  recentActivity 
}: ProjectHealthDashboardProps) {
  const spentPercentage = (budgetData.spent / budgetData.budget) * 100
  const committedPercentage = (budgetData.committed / budgetData.budget) * 100

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'change_order':
        return FileText
      case 'import':
        return Upload
      case 'alert':
        return CircleAlert
      case 'approval':
        return CircleCheck
      default:
        return Activity
    }
  }

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'change_order':
        return 'text-blue-600'
      case 'import':
        return 'text-green-600'
      case 'alert':
        return 'text-yellow-600'
      case 'approval':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <Collapsible defaultOpen={false} className="mb-6">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow group">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Financial Breakdown & Activity</h3>
          <span className="text-sm text-gray-500">
            Latest: {recentActivity.length > 0 ? formatDistanceToNow(new Date(recentActivity[0].timestamp), { addSuffix: true }) : 'No recent activity'}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Budget Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Budget Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Spent: {formatCurrency(budgetData.spent)}</span>
                  <span>Budget: {formatCurrency(budgetData.budget)}</span>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <Progress value={spentPercentage} className="h-6 bg-gray-200" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium">
                        Spent ({spentPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <Progress 
                      value={committedPercentage} 
                      className="h-6 bg-gray-200"
                      style={{
                        '--progress-background': 'rgb(251 146 60)',
                      } as any}
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium">
                        Committed ({committedPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>Remaining</span>
                    <span className="font-medium">
                      {formatCurrency(budgetData.budget - budgetData.committed)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Labor Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Labor Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={laborTrends} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <XAxis 
                      dataKey="week" 
                      axisLine={false} 
                      tickLine={false}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis hide />
                    <Line
                      type="monotone"
                      dataKey="headcount"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-600">
                  Current headcount: <span className="font-medium">{currentHeadcount} workers</span>
                </p>
                <p className="text-xs text-gray-600">
                  Peak headcount: <span className="font-medium">{peakHeadcount} workers</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => {
                    const Icon = getActivityIcon(activity.type)
                    const color = getActivityColor(activity.type)
                    return (
                      <div key={activity.id} className="flex items-start space-x-2">
                        <Icon className={`h-4 w-4 mt-0.5 ${color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">
                            {activity.title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-gray-500 text-center py-4">
                    No recent activity
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}