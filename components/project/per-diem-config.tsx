'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { AlertCircle, DollarSign, Users, Calculator, Save, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/utils'

interface PerDiemConfigProps {
  projectId: string
  initialConfig?: {
    per_diem_enabled: boolean
    per_diem_rate_direct: number
    per_diem_rate_indirect: number
  }
  onConfigUpdate?: () => void
}

export function PerDiemConfig({ projectId, initialConfig, onConfigUpdate }: PerDiemConfigProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [config, setConfig] = useState({
    enabled: initialConfig?.per_diem_enabled || false,
    directRate: initialConfig?.per_diem_rate_direct || 0,
    indirectRate: initialConfig?.per_diem_rate_indirect || 0,
  })
  const [hasChanges, setHasChanges] = useState(false)

  // Calculate weekly amounts
  const weeklyDirect = config.directRate * 5
  const weeklyIndirect = config.indirectRate * 5

  useEffect(() => {
    const changed = 
      config.enabled !== initialConfig?.per_diem_enabled ||
      config.directRate !== initialConfig?.per_diem_rate_direct ||
      config.indirectRate !== initialConfig?.per_diem_rate_indirect
    setHasChanges(changed)
  }, [config, initialConfig])

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/per-diem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enable',
          enabled: config.enabled,
          directRate: config.directRate,
          indirectRate: config.indirectRate,
        }),
      })

      if (!response.ok) throw new Error('Failed to update per diem configuration')

      const data = await response.json()
      
      toast({
        title: 'Per Diem Configuration Updated',
        description: data.recalculation 
          ? `Configuration saved. ${data.recalculation.records_processed} records processed.`
          : 'Configuration saved successfully.',
      })

      setHasChanges(false)
      onConfigUpdate?.()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update per diem configuration',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/per-diem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recalculate' }),
      })

      if (!response.ok) throw new Error('Failed to recalculate per diem')

      const data = await response.json()
      
      toast({
        title: 'Per Diem Recalculated',
        description: `Processed ${data.result.records_processed} records. Total: ${formatCurrency(data.result.total_per_diem_amount)}`,
      })

      onConfigUpdate?.()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to recalculate per diem',
        variant: 'destructive',
      })
    } finally {
      setRecalculating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Per Diem Configuration
        </CardTitle>
        <CardDescription>
          Configure daily per diem rates for direct and indirect labor. Per diem is calculated automatically
          for each week an employee has recorded hours (5 days per week).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="per-diem-enabled" className="text-base">
              Enable Per Diem
            </Label>
            <div className="text-sm text-muted-foreground">
              Automatically calculate per diem costs for all labor entries
            </div>
          </div>
          <Switch
            id="per-diem-enabled"
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
          />
        </div>

        {/* Rate Configuration */}
        {config.enabled && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Direct Rate */}
              <div className="space-y-2">
                <Label htmlFor="direct-rate" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Direct Labor Rate
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="direct-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={config.directRate}
                    onChange={(e) => setConfig({ ...config, directRate: parseFloat(e.target.value) || 0 })}
                    className="pl-8"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Daily rate • Weekly: {formatCurrency(weeklyDirect)}
                </p>
              </div>

              {/* Indirect Rate */}
              <div className="space-y-2">
                <Label htmlFor="indirect-rate" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Indirect/Staff Labor Rate
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="indirect-rate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={config.indirectRate}
                    onChange={(e) => setConfig({ ...config, indirectRate: parseFloat(e.target.value) || 0 })}
                    className="pl-8"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Daily rate • Weekly: {formatCurrency(weeklyIndirect)}
                </p>
              </div>
            </div>

            {/* Info Alert */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Per diem is calculated weekly (5 days) for each employee with recorded hours.
                Rates apply to all weeks in the project. Changes will trigger a recalculation
                of all existing labor data.
              </AlertDescription>
            </Alert>

            {/* Example Calculation */}
            <div className="rounded-lg bg-muted/50 p-4">
              <h4 className="mb-2 font-medium flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Example Weekly Calculation
              </h4>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Direct Employee (5 days):</span>
                  <span className="font-medium">{formatCurrency(weeklyDirect)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Indirect Employee (5 days):</span>
                  <span className="font-medium">{formatCurrency(weeklyIndirect)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-medium">
                  <span>Monthly (4.33 weeks, 10 employees):</span>
                  <span>{formatCurrency((weeklyDirect * 5 + weeklyIndirect * 5) * 4.33)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={loading || !hasChanges}
            className="flex-1"
          >
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Saving...' : 'Save Configuration'}
          </Button>
          
          {config.enabled && (
            <Button
              onClick={handleRecalculate}
              disabled={recalculating}
              variant="outline"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
              {recalculating ? 'Recalculating...' : 'Recalculate'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}