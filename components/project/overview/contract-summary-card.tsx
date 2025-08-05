'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface ContractSummaryCardProps {
  originalContract: number
  changeOrdersTotal: number
  changeOrdersCount: number
  revisedContract: number
}

export function ContractSummaryCard({
  originalContract,
  changeOrdersTotal,
  changeOrdersCount,
  revisedContract
}: ContractSummaryCardProps) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">Contract Summary</CardTitle>
        <FileText className="h-4 w-4 text-gray-400" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(revisedContract)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Revised Contract</p>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Original</span>
              <span className="font-medium">{formatCurrency(originalContract)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-600">Changes</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-green-600">
                  +{formatCurrency(changeOrdersTotal)}
                </span>
                <span className="text-green-600">●</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}