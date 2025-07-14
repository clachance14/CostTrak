'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RiskStatusBadge } from '@/components/ui/risk-status-badge'
import { Loader2 } from 'lucide-react'

interface ForecastEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchaseOrder: {
    id: string
    po_number: string
    vendor_name: string
    risk_status: 'normal' | 'at-risk' | 'over-budget'
  }
  onSuccess?: () => void
}

export function ForecastEditModal({ 
  open, 
  onOpenChange, 
  purchaseOrder,
  onSuccess 
}: ForecastEditModalProps) {
  const [riskStatus, setRiskStatus] = useState<string>(purchaseOrder.risk_status)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!riskStatus || riskStatus === purchaseOrder.risk_status) {
      onOpenChange(false)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/forecast`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          risk_status: riskStatus,
          reason: reason.trim() || null
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update forecast')
      }

      // Success
      onSuccess?.()
      onOpenChange(false)
      setReason('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Risk Status</DialogTitle>
          <DialogDescription>
            Update the risk status for PO {purchaseOrder.po_number} - {purchaseOrder.vendor_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Risk Status</Label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="risk-status"
                  value="normal"
                  checked={riskStatus === 'normal'}
                  onChange={(e) => setRiskStatus(e.target.value)}
                  className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <RiskStatusBadge status="normal" />
                    <span className="text-sm text-gray-600">No issues anticipated</span>
                  </div>
                </div>
              </label>
              <label className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="risk-status"
                  value="at-risk"
                  checked={riskStatus === 'at-risk'}
                  onChange={(e) => setRiskStatus(e.target.value)}
                  className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <RiskStatusBadge status="at-risk" />
                    <span className="text-sm text-gray-600">Potential cost overrun identified</span>
                  </div>
                </div>
              </label>
              <label className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name="risk-status"
                  value="over-budget"
                  checked={riskStatus === 'over-budget'}
                  onChange={(e) => setRiskStatus(e.target.value)}
                  className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <RiskStatusBadge status="over-budget" />
                    <span className="text-sm text-gray-600">Confirmed overrun expected</span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {riskStatus !== purchaseOrder.risk_status && (
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason for Change {riskStatus !== 'normal' && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                id="reason"
                placeholder={riskStatus === 'normal' 
                  ? "Optional: Explain why the risk has been resolved..." 
                  : "Required: Explain the reason for this risk status..."
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[80px]"
                required={riskStatus !== 'normal'}
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || riskStatus === purchaseOrder.risk_status || 
              (riskStatus !== 'normal' && !reason.trim())}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Risk Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}