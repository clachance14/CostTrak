'use client'

import { useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BudgetPerDiemRowProps {
  projectId: string
  className?: string
}

interface PerDiemData {
  total_per_diem_amount: number
  total_direct_per_diem: number
  total_indirect_per_diem: number
  per_diem_enabled: boolean
}

export function BudgetPerDiemRow({ projectId, className }: BudgetPerDiemRowProps) {
  const [data, setData] = useState<PerDiemData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPerDiemData()
  }, [projectId])

  const fetchPerDiemData = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/per-diem`)
      if (response.ok) {
        const perDiemData = await response.json()
        setData(perDiemData)
      }
    } catch (error) {
      console.error('Failed to fetch per diem data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data?.per_diem_enabled || data.total_per_diem_amount === 0) {
    return null
  }

  return (
    <tr className={cn("hover:bg-muted/50 transition-colors", className)}>
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Per Diem Costs</span>
        </div>
      </td>
      <td className="px-6 py-3 text-right">
        <span className="text-muted-foreground">—</span>
      </td>
      <td className="px-6 py-3 text-right">
        <span className="text-muted-foreground">—</span>
      </td>
      <td className="px-6 py-3 text-right font-medium">
        {formatCurrency(data.total_per_diem_amount)}
      </td>
      <td className="px-6 py-3 text-right">
        <span className="text-muted-foreground">—</span>
      </td>
      <td className="px-6 py-3 text-right font-medium">
        {formatCurrency(data.total_per_diem_amount)}
      </td>
      <td className="px-6 py-3 text-right">
        <span className="text-muted-foreground">—</span>
      </td>
    </tr>
  )
}

// Component to show per diem in labor budget breakdown
export function PerDiemLaborBreakdown({ projectId }: { projectId: string }) {
  const [data, setData] = useState<PerDiemData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPerDiemData()
  }, [projectId])

  const fetchPerDiemData = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/per-diem`)
      if (response.ok) {
        const perDiemData = await response.json()
        setData(perDiemData)
      }
    } catch (error) {
      console.error('Failed to fetch per diem data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !data?.per_diem_enabled || data.total_per_diem_amount === 0) {
    return null
  }

  return (
    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Per Diem Breakdown</span>
        </div>
        <span className="text-sm font-bold">{formatCurrency(data.total_per_diem_amount)}</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground ml-6">Direct Labor Per Diem</span>
          <span>{formatCurrency(data.total_direct_per_diem)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground ml-6">Indirect/Staff Per Diem</span>
          <span>{formatCurrency(data.total_indirect_per_diem)}</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t">
        <p className="text-xs text-muted-foreground">
          Per diem costs are calculated weekly (5 days) for all employees with recorded hours.
          These costs are tracked separately from regular labor wages.
        </p>
      </div>
    </div>
  )
}