'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface ClientPOUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  currentPONumber?: string
  currentRepresentative?: string
  onUpdate: () => void
}

export function ClientPOUpdateDialog({
  open,
  onOpenChange,
  projectId,
  currentPONumber,
  currentRepresentative,
  onUpdate
}: ClientPOUpdateDialogProps) {
  const [loading, setLoading] = useState(false)
  const [poNumber, setPONumber] = useState(currentPONumber || '')
  const [representative, setRepresentative] = useState(currentRepresentative || '')
  const [notes, setNotes] = useState('')

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/contract`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_po_number: poNumber || undefined,
          client_representative: representative || undefined
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update client PO')
      }

      onUpdate()
      onOpenChange(false)
      // Reset form
      setNotes('')
    } catch (error) {
      console.error('Error updating client PO:', error)
      alert(error instanceof Error ? error.message : 'Failed to update client PO')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Client PO Information</DialogTitle>
          <DialogDescription>
            Update the client PO number and representative for invoicing purposes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="po-number">Client PO Number</Label>
            <Input
              id="po-number"
              value={poNumber}
              onChange={(e) => setPONumber(e.target.value)}
              placeholder="Enter client PO number"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="representative">Client Representative</Label>
            <Input
              id="representative"
              value={representative}
              onChange={(e) => setRepresentative(e.target.value)}
              placeholder="Enter client representative name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this revision"
              className="h-20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !poNumber}>
            {loading ? 'Updating...' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}