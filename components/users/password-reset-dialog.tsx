'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Copy, Key, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface PasswordResetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
  } | null
}

export function PasswordResetDialog({ open, onOpenChange, user }: PasswordResetDialogProps) {
  const [isResetting, setIsResetting] = useState(false)
  const [resetResult, setResetResult] = useState<{
    success: boolean
    temporaryPassword?: string
    message: string
  } | null>(null)
  const { toast } = useToast()

  const handleReset = async () => {
    if (!user) return

    setIsResetting(true)
    setResetResult(null)

    try {
      const response = await fetch('/api/auth/admin-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset password')
      }

      setResetResult({
        success: true,
        temporaryPassword: result.temporary_password,
        message: result.message,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password'
      setResetResult({
        success: false,
        message,
      })
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsResetting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied',
      description: 'Password copied to clipboard',
    })
  }

  const handleClose = () => {
    if (!resetResult?.temporaryPassword) {
      onOpenChange(false)
      setResetResult(null)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Reset password for {user.first_name} {user.last_name} ({user.email})
          </DialogDescription>
        </DialogHeader>

        {!resetResult ? (
          <>
            <div className="py-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  This will generate a new temporary password for the user. 
                  They will be required to change it on their next login.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleClose()}
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReset}
                disabled={isResetting}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Reset Password
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="space-y-4 py-4">
            {resetResult.success ? (
              <>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Success!</AlertTitle>
                  <AlertDescription>
                    Password has been reset successfully.
                  </AlertDescription>
                </Alert>

                {resetResult.temporaryPassword && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <Key className="h-4 w-4 text-orange-600" />
                    <AlertTitle className="text-orange-900">New Temporary Password</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <div className="font-mono text-lg bg-white p-3 rounded border">
                        {resetResult.temporaryPassword}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(resetResult.temporaryPassword!)}
                        className="w-full"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Password
                      </Button>
                      <p className="text-sm text-orange-800 mt-2">
                        Please share this password securely with {user.first_name}. 
                        They will be required to change it on their next login.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{resetResult.message}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  setResetResult(null)
                }}
              >
                {resetResult.temporaryPassword ? 'Close' : 'OK'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}