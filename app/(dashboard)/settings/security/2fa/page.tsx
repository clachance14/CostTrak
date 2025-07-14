'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button, Input, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { AlertCircle, CheckCircle, Copy, Shield, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import speakeasy from 'speakeasy'

export default function TwoFactorSetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<'setup' | 'verify' | 'complete'>('setup')
  const [secret, setSecret] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verificationCode, setVerificationCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const generateSecret = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to generate 2FA secret')
        return
      }

      setSecret(data.secret)
      setBackupCodes(data.backupCodes)
      
      // Generate QR code
      const otpauthUrl = speakeasy.otpauthURL({
        secret: data.secret,
        label: 'CostTrak',
        issuer: 'Industrial Construction Services',
      })
      
      const qrCode = await QRCode.toDataURL(otpauthUrl)
      setQrCodeUrl(qrCode)
      
      setStep('verify')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const verifyAndEnable = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/auth/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret,
          code: verificationCode,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Invalid verification code')
        return
      }

      setStep('complete')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // TODO: Show toast notification
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            <CardTitle>Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {step === 'setup' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium">How it works</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
                  <li>Install an authenticator app on your phone (Google Authenticator, Authy, etc.)</li>
                  <li>Scan the QR code or enter the secret key manually</li>
                  <li>Enter the 6-digit code from your app to verify</li>
                  <li>Save your backup codes in a secure location</li>
                </ol>
              </div>

              <div className="rounded-md bg-warning-50 p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-warning-600 flex-shrink-0" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-warning-800">
                      Important: This action cannot be easily undone
                    </h3>
                    <p className="mt-1 text-sm text-warning-700">
                      Make sure you have access to an authenticator app before proceeding.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-md bg-danger-50 p-3 text-sm text-danger-700">
                  <AlertCircle className="h-4 w-4" />
                  <p>{error}</p>
                </div>
              )}

              <Button onClick={generateSecret} loading={isLoading}>
                <Smartphone className="mr-2 h-4 w-4" />
                Set Up Two-Factor Authentication
              </Button>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium">1. Scan QR Code</h3>
                <div className="flex justify-center">
                  {qrCodeUrl && (
                    <Image src={qrCodeUrl} alt="2FA QR Code" width={192} height={192} />
                  )}
                </div>
                
                <div className="text-center space-y-2">
                  <p className="text-sm text-foreground">
                    Can&apos;t scan? Enter this code manually:
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="px-2 py-1 bg-foreground/5 rounded text-sm">
                      {secret}
                    </code>
                    <button
                      onClick={() => copyToClipboard(secret)}
                      className="text-foreground/80 hover:text-foreground/80"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">2. Enter Verification Code</h3>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-widest"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-md bg-danger-50 p-3 text-sm text-danger-700">
                  <AlertCircle className="h-4 w-4" />
                  <p>{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('setup')}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  onClick={verifyAndEnable}
                  loading={isLoading}
                  disabled={verificationCode.length !== 6}
                >
                  Verify and Enable
                </Button>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="rounded-full bg-success-100 p-3">
                  <CheckCircle className="h-8 w-8 text-success-600" />
                </div>
              </div>

              <div className="text-center">
                <h3 className="font-medium text-lg mb-2">
                  Two-Factor Authentication Enabled!
                </h3>
                <p className="text-sm text-foreground">
                  Your account is now protected with two-factor authentication.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">Save Your Backup Codes</h3>
                <p className="text-sm text-foreground">
                  Store these codes in a secure place. You can use them to access your account if you lose your authenticator device.
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {backupCodes.map((code, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-2 bg-background rounded border"
                    >
                      <code className="text-sm">{code}</code>
                      <button
                        onClick={() => copyToClipboard(code)}
                        className="text-foreground/80 hover:text-foreground/80"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    const codes = backupCodes.join('\n')
                    const blob = new Blob([codes], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'costtrak-backup-codes.txt'
                    a.click()
                  }}
                >
                  Download Backup Codes
                </Button>
              </div>

              <Button onClick={() => router.push('/dashboard/settings/security')}>
                Done
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}