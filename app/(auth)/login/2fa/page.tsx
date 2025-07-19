'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { AlertCircle, Shield, Smartphone } from 'lucide-react'
import Link from 'next/link'

interface TwoFactorInput {
  code: string
}

// Main component with Suspense wrapper
export default function TwoFactorPage() {
  return (
    <Suspense fallback={<TwoFactorLoading />}>
      <TwoFactorForm />
    </Suspense>
  )
}

// Loading state component
function TwoFactorLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
          </div>
          <p className="text-center mt-4 text-foreground/60">Loading 2FA verification...</p>
        </CardContent>
      </Card>
    </div>
  )
}

// Actual form component with useSearchParams
function TwoFactorForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const session = searchParams.get('session')
  
  const [isLoading, setIsLoading] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
  } = useForm<TwoFactorInput>()

  const code = watch('code')

  const onSubmit = async (data: TwoFactorInput) => {
    if (!session) {
      router.push('/login')
      return
    }
    
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: data.code,
          sessionId: session,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError('root', {
          type: 'manual',
          message: result.error || 'Invalid verification code',
        })
        return
      }

      // Success - redirect to dashboard
      router.push('/dashboard')
    } catch {
      setError('root', {
        type: 'manual',
        message: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-submit when 6 digits are entered
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '')
    if (value.length === 6) {
      handleSubmit(onSubmit)()
    }
  }

  if (!session) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {/* Company Logo */}
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary-600" />
          </div>
          
          <CardTitle className="text-2xl font-bold text-center">
            Two-Factor Authentication
          </CardTitle>
          <CardDescription className="text-center">
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Verification Code
              </label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                autoFocus
                {...register('code', {
                  required: 'Verification code is required',
                  pattern: {
                    value: /^[0-9]{6}$/,
                    message: 'Code must be 6 digits',
                  },
                  onChange: handleCodeChange,
                })}
                error={!!errors.code}
                className="text-center text-2xl tracking-widest"
              />
              {errors.code && (
                <p className="text-sm text-danger-500">{errors.code.message}</p>
              )}
            </div>

            {errors.root && (
              <div className="flex items-center gap-2 rounded-md bg-danger-50 p-3 text-sm text-danger-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p>{errors.root.message}</p>
              </div>
            )}

            {/* Backup code option */}
            <div className="text-center">
              <button
                type="button"
                className="text-sm text-primary-600 hover:text-primary-700"
                onClick={() => {
                  // TODO: Implement backup code flow
                  alert('Backup code feature coming soon')
                }}
              >
                Use a backup code instead
              </button>
            </div>

            <Button
              type="submit"
              className="w-full"
              loading={isLoading}
              disabled={isLoading || !code || code.length !== 6}
            >
              Verify
            </Button>

            <div className="flex items-center gap-2 rounded-md bg-info-50 p-3 text-sm text-info-700">
              <Smartphone className="h-4 w-4 flex-shrink-0" />
              <p>Open your authenticator app to view your code</p>
            </div>

            <Link href="/login">
              <Button variant="ghost" className="w-full">
                Cancel
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-foreground/80">
        <p className="mb-2">© {new Date().getFullYear()} Industrial Construction Services. All rights reserved.</p>
        <div className="space-x-4">
          <Link href="/privacy" className="hover:text-foreground/80">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-foreground/80">
            Terms of Service
          </Link>
          <Link href="/security" className="hover:text-foreground/80">
            Security
          </Link>
        </div>
      </div>
    </div>
  )
}