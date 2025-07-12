'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { LoadingPage } from '@/components/ui/loading'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'

export default function SetupProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  // Check if profile already exists
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile-check'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Profile query error:', error)
        throw error
      }

      console.log('Profile data:', data)
      return data
    },
  })

  useEffect(() => {
    if (profile) {
      // Profile already exists, redirect to dashboard
      router.push('/dashboard')
    }
  }, [profile, router])

  if (isLoading) {
    return <LoadingPage />
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error Loading Profile</CardTitle>
            <CardDescription className="text-red-600">
              {error.message}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Profile Setup Required</CardTitle>
          <CardDescription>
            Your account has been created but needs to be configured by an administrator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-900">
              Please contact your system administrator to complete your profile setup. 
              They will need to:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
              <li>Assign your role (Project Manager, Viewer, etc.)</li>
              <li>Set your division assignment if applicable</li>
              <li>Grant project access permissions</li>
            </ul>
            <div className="pt-4 border-t">
              <p className="text-sm font-medium">
                Once your profile is configured, you&apos;ll be able to access CostTrak.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}