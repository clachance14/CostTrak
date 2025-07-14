"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, AlertCircle, Shield, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useSignIn } from "@/hooks/use-auth"
import { loginSchema, type LoginInput } from "@/lib/validations/auth"
import Link from "next/link"

export default function LoginScreen() {
  const signIn = useSignIn()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [requiresCaptcha] = useState(false)
  const [remainingAttempts] = useState<number | null>(null)
  const [lockedUntil] = useState<Date | null>(null)
  
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    setValue,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  // Load remembered email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail')
    if (savedEmail) {
      setValue('email', savedEmail)
      setRememberMe(true)
    }
  }, [setValue])

  const onSubmit = async (data: LoginInput) => {
    try {
      // Handle remember me
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', data.email)
      } else {
        localStorage.removeItem('rememberedEmail')
      }

      // Use the auth hook directly for sign in
      await signIn.mutateAsync(data)
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: error.message || 'Invalid email or password',
      })
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-foreground rounded-lg flex items-center justify-center">
              <span className="text-background font-bold text-xl">CT</span>
            </div>
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-foreground">Welcome to CostTrak</CardTitle>
              <CardDescription className="text-foreground/70">Sign in with your @ics.ac email address</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-medium">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@ics.ac"
                  {...register('email')}
                  className={`placeholder:text-foreground/50 ${errors.email ? 'border-red-500' : ''}`}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register('password')}
                    className={`pr-10 placeholder:text-foreground/50 ${errors.password ? 'border-red-500' : ''}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-foreground/40" />
                    ) : (
                      <Eye className="h-4 w-4 text-foreground/40" />
                    )}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe} 
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)} 
                  />
                  <Label htmlFor="remember" className="text-sm text-foreground font-medium">
                    Remember me
                  </Label>
                </div>
                <Link 
                  href="/password-reset" 
                  className="text-sm text-foreground/70 hover:text-foreground font-medium hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Forgot your password?
                </Link>
              </div>

              {/* Security Alerts */}
              {errors.root && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.root.message}</AlertDescription>
                </Alert>
              )}

              {remainingAttempts !== null && remainingAttempts <= 2 && !lockedUntil && (
                <Alert className="border-orange-500/20 bg-orange-500/10">
                  <Shield className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-foreground">
                    {remainingAttempts} login attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                  </AlertDescription>
                </Alert>
              )}

              {lockedUntil && (
                <Alert variant="destructive">
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    Account locked until {lockedUntil.toLocaleTimeString()}
                  </AlertDescription>
                </Alert>
              )}

              {/* CAPTCHA Placeholder */}
              {requiresCaptcha && (
                <div className="rounded-md border border-foreground/20 bg-foreground/5 p-4 text-center">
                  <p className="text-sm text-foreground/70 mb-2">Please verify you&apos;re human</p>
                  <div className="h-20 bg-foreground/10 rounded flex items-center justify-center">
                    <span className="text-foreground/70">CAPTCHA coming soon</span>
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full bg-foreground hover:bg-foreground/90 text-background font-medium py-2 h-11" 
                disabled={isSubmitting || signIn.isPending || !!lockedUntil}
              >
                {isSubmitting || signIn.isPending ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="text-center">
              <p className="text-sm text-foreground/70">
                Need help? Contact your system administrator
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-foreground/60 space-y-2">
          <p>© {new Date().getFullYear()} Industrial Construction Services. All rights reserved.</p>
          <div className="flex justify-center space-x-4">
            <Link href="/privacy">
              <Button variant="ghost" className="px-0 text-foreground/60 hover:text-foreground/80 text-sm h-auto">
                Privacy Policy
              </Button>
            </Link>
            <Link href="/terms">
              <Button variant="ghost" className="px-0 text-foreground/60 hover:text-foreground/80 text-sm h-auto">
                Terms of Service
              </Button>
            </Link>
            <Link href="/security">
              <Button variant="ghost" className="px-0 text-foreground/60 hover:text-foreground/80 text-sm h-auto">
                Security
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}