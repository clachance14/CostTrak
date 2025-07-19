'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { newPasswordSchema, type NewPasswordInput } from '@/lib/validations/auth'
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock } from 'lucide-react'
import Link from 'next/link'

// Main component with Suspense wrapper
export default function PasswordResetConfirmPage() {
  return (
    <Suspense fallback={<PasswordResetLoading />}>
      <PasswordResetForm />
    </Suspense>
  )
}

// Loading state component
function PasswordResetLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
          </div>
          <p className="text-center mt-4 text-foreground/60">Loading password reset...</p>
        </CardContent>
      </Card>
    </div>
  )
}

// Actual form component with useSearchParams
function PasswordResetForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
  })

  const password = watch('password')

  useEffect(() => {
    if (!token) {
      router.push('/password-reset')
    }
  }, [token, router])

  const onSubmit = async (data: NewPasswordInput) => {
    if (!token) return
    
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError('root', {
          type: 'manual',
          message: result.error || 'Failed to reset password',
        })
        return
      }

      setIsSuccess(true)
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch {
      setError('root', {
        type: 'manual',
        message: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Password strength indicator
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { strength: 0, label: '' }
    
    let strength = 0
    if (pass.length >= 8) strength++
    if (/[a-z]/.test(pass) && /[A-Z]/.test(pass)) strength++
    if (/\d/.test(pass)) strength++
    if (/[@$!%*?&]/.test(pass)) strength++

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
    return { strength, label: labels[strength] }
  }

  const passwordStrength = getPasswordStrength(password || '')

  if (!token) {
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {/* Company Logo */}
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-600">CT</span>
          </div>
          
          <CardTitle className="text-2xl font-bold text-center">
            {isSuccess ? 'Password Reset Successful' : 'Create New Password'}
          </CardTitle>
          <CardDescription className="text-center">
            {isSuccess 
              ? 'Your password has been successfully reset'
              : 'Enter a new password for your account'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {isSuccess ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-success-100 p-3">
                  <CheckCircle className="h-8 w-8 text-success-600" />
                </div>
              </div>
              
              <div className="text-center text-sm text-foreground">
                <p>Redirecting to login page...</p>
              </div>
              
              <Link href="/login">
                <Button className="w-full">
                  Go to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    {...register('password')}
                    error={!!errors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-danger-500">{errors.password.message}</p>
                )}
                
                {/* Password Strength Indicator */}
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            level <= passwordStrength.strength
                              ? passwordStrength.strength <= 2
                                ? 'bg-warning-500'
                                : 'bg-success-500'
                              : 'bg-foreground/10'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${
                      passwordStrength.strength <= 2 ? 'text-warning-600' : 'text-success-600'
                    }`}>
                      {passwordStrength.label}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    {...register('confirmPassword')}
                    error={!!errors.confirmPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-danger-500">{errors.confirmPassword.message}</p>
                )}
              </div>

              {/* Password Requirements */}
              <div className="rounded-md bg-background p-3 text-xs text-foreground">
                <p className="font-medium mb-1">Password must contain:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>At least 8 characters</li>
                  <li>Uppercase and lowercase letters</li>
                  <li>At least one number</li>
                  <li>At least one special character (@$!%*?&)</li>
                </ul>
              </div>

              {errors.root && (
                <div className="flex items-center gap-2 rounded-md bg-danger-50 p-3 text-sm text-danger-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <p>{errors.root.message}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                loading={isLoading}
                disabled={isLoading}
              >
                <Lock className="mr-2 h-4 w-4" />
                Reset Password
              </Button>
            </form>
          )}
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