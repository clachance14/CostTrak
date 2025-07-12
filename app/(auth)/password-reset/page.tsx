'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { passwordResetSchema, type PasswordResetInput } from '@/lib/validations/auth'
import { AlertCircle, ArrowLeft, CheckCircle, Mail } from 'lucide-react'
import Link from 'next/link'

export default function PasswordResetPage() {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<PasswordResetInput>({
    resolver: zodResolver(passwordResetSchema),
  })

  const onSubmit = async (data: PasswordResetInput) => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        setError('root', {
          type: 'manual',
          message: result.error || 'Failed to send reset email',
        })
        return
      }

      setIsSubmitted(true)
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: 'An unexpected error occurred. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const allowedDomain = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || 'ics.ac'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          {/* Company Logo */}
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-600">CT</span>
          </div>
          
          <CardTitle className="text-2xl font-bold text-center">
            {isSubmitted ? 'Check Your Email' : 'Reset Your Password'}
          </CardTitle>
          <CardDescription className="text-center">
            {isSubmitted 
              ? 'We\'ve sent password reset instructions to your email'
              : `Enter your @${allowedDomain} email address`
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {isSubmitted ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-success-100 p-3">
                  <CheckCircle className="h-8 w-8 text-success-600" />
                </div>
              </div>
              
              <div className="space-y-2 text-center text-sm text-gray-800">
                <p>If an account exists with this email, you'll receive instructions shortly.</p>
                <p>Please check your spam folder if you don't see the email.</p>
              </div>
              
              <div className="flex items-center gap-2 rounded-md bg-info-50 p-3 text-sm text-info-700">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <p>Reset links expire after 1 hour for security</p>
              </div>
              
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder={`name@${allowedDomain}`}
                  autoComplete="email"
                  autoFocus
                  {...register('email')}
                  error={!!errors.email}
                />
                {errors.email && (
                  <p className="text-sm text-danger-500">{errors.email.message}</p>
                )}
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
                Send Reset Instructions
              </Button>

              <Link href="/login">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-700">
        <p className="mb-2">© {new Date().getFullYear()} Industrial Construction Services. All rights reserved.</p>
        <div className="space-x-4">
          <Link href="/privacy" className="hover:text-gray-700">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-gray-700">
            Terms of Service
          </Link>
          <Link href="/security" className="hover:text-gray-700">
            Security
          </Link>
        </div>
      </div>
    </div>
  )
}