'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, FileText, TrendingUp, Users, Package, Clock, Shield, LucideIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ContractSummaryCard } from './contract-summary-card'

interface FinancialData {
  originalContract: number
  changeOrdersTotal: number
  changeOrdersCount: number
  revisedContract: number
  totalCommitted: number
  commitmentPercentage: number
  laborCosts: number
  laborBudget: number
  laborForecastedTotal: number
  laborRemainingForecast: number
  materialCosts: number
  materialInvoiced: number
  materialBudget: number
  remainingBudget: number
  burnRate: number
  projectHealth: {
    status: 'good' | 'warning' | 'critical'
    riskCount: number
  }
}

interface FinancialSummaryCardsProps {
  data: FinancialData
}

interface FinancialCard {
  title: string
  value: string
  icon: LucideIcon
  subtitle: string
  trend?: { direction: string; color: string } | null
  variance?: string | number
  status?: string
  customContent?: boolean
  actualCost?: number
  remainingForecast?: number
  budget?: number
}

export function FinancialSummaryCards({ data }: FinancialSummaryCardsProps) {
  const financialCards: FinancialCard[] = [
    {
      title: 'Total Committed',
      value: formatCurrency(data.totalCommitted),
      icon: Package,
      subtitle: `${data.commitmentPercentage.toFixed(1)}% of budget`,
      trend: null,
      status: data.commitmentPercentage > 80 ? 'warning' : 'normal',
    },
    {
      title: 'Labor Costs',
      value: formatCurrency(data.laborForecastedTotal || data.laborCosts),
      icon: Users,
      subtitle: 'Total Forecasted Cost',
      customContent: true,
      actualCost: data.laborCosts,
      remainingForecast: data.laborRemainingForecast || 0,
      budget: data.laborBudget,
      variance: (data.laborForecastedTotal || data.laborCosts) - data.laborBudget,
      status: (data.laborForecastedTotal || data.laborCosts) > data.laborBudget ? 'over' : (data.laborForecastedTotal || data.laborCosts) > data.laborBudget * 0.95 ? 'warning' : 'good',
    },
    {
      title: 'Committed PO Costs',
      value: formatCurrency(data.materialCosts),
      icon: Package,
      subtitle: 'Total Committed Cost',
      customContent: true,
      actualCost: data.materialInvoiced,
      remainingForecast: data.materialCosts - data.materialInvoiced,
      budget: data.materialBudget,
      variance: data.materialCosts - data.materialBudget,
      status: data.materialCosts > data.materialBudget ? 'over' : data.materialCosts > data.materialBudget * 0.95 ? 'warning' : 'good',
    },
    {
      title: 'Remaining Budget',
      value: formatCurrency(data.remainingBudget),
      icon: Clock,
      subtitle: `Burn rate: ${formatCurrency(data.burnRate)}/week`,
      trend: null,
      status: data.remainingBudget < 0 ? 'critical' : 'normal',
    },
    {
      title: 'Project Health',
      value: data.projectHealth.status.charAt(0).toUpperCase() + data.projectHealth.status.slice(1),
      icon: Shield,
      subtitle: `${data.projectHealth.riskCount} risk indicators`,
      status: data.projectHealth.status,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <ContractSummaryCard
        originalContract={data.originalContract}
        changeOrdersTotal={data.changeOrdersTotal}
        changeOrdersCount={data.changeOrdersCount}
        revisedContract={data.revisedContract}
      />
      {financialCards.map((item, index) => {
        const Icon = item.icon
        return (
          <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{item.title}</CardTitle>
              <Icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              {(item.title === 'Labor Costs' || item.title === 'Committed PO Costs') && item.customContent ? (
                <>
                  <div className="space-y-3">
                    <div>
                      <div className={`text-3xl font-bold ${
                        item.status === 'over' ? 'text-red-600' : 
                        item.status === 'warning' ? 'text-yellow-600' : 
                        'text-gray-900'
                      }`}>
                        {item.value}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{item.subtitle}</p>
                    </div>
                    
                    <div className="space-y-1 pt-2 border-t border-gray-100">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Actual to Date</span>
                        <span className="font-medium">{formatCurrency(item.actualCost || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{item.title === 'Labor Costs' ? 'Remaining Forecast' : 'Remaining'}</span>
                        <span className="font-medium text-gray-500">{formatCurrency(item.remainingForecast || 0)}</span>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-gray-100">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Budget</span>
                        <span className="font-medium">{formatCurrency(item.budget || 0)}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">Variance</span>
                        <span className={`font-medium ${
                          (item.variance || 0) <= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(Math.abs(Number(item.variance) || 0))} {(Number(item.variance) || 0) <= 0 ? 'under' : 'over'}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`text-2xl font-bold ${
                    item.title === 'Remaining Budget' && data.remainingBudget < 0 ? 'text-red-600' : 
                    item.title === 'Project Health' ? 
                      item.status === 'good' ? 'text-green-600' : 
                      item.status === 'warning' ? 'text-yellow-600' : 
                      'text-red-600' : 
                    'text-gray-900'
                  }`}>
                    {item.value}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-500">{item.subtitle}</p>
                    {item.trend && <TrendingUp className={`h-3 w-3 ${item.trend.color}`} />}
                  </div>
                  {item.variance && (
                    <p className={`text-xs mt-1 ${
                      data.laborBudget - data.laborCosts >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      Variance: {item.variance}
                    </p>
                  )}
                  {item.title === 'Project Health' && (
                    <Badge 
                      variant="secondary" 
                      className={`mt-2 ${
                        item.status === 'good' ? 'bg-green-100 text-green-800' :
                        item.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}
                    >
                      {item.value}
                    </Badge>
                  )}
                  {item.title === 'Total Committed' && item.status === 'warning' && (
                    <Badge variant="secondary" className="mt-2 bg-yellow-100 text-yellow-800">
                      High Usage
                    </Badge>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}