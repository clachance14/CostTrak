'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-auth'
import { LoadingPage } from '@/components/ui/loading'

export default function DashboardPage() {
  const router = useRouter()
  const { data: user, isLoading } = useUser()

  useEffect(() => {
    if (user) {
      // Redirect to role-specific dashboard
      const roleRoutes: Record<string, string> = {
        executive: '/dashboard/executive',
        controller: '/dashboard/controller',
        ops_manager: '/dashboard/ops-manager',
        project_manager: '/dashboard/project-manager',
        accounting: '/dashboard/accounting',
        viewer: '/dashboard/viewer',
      }
      
      const route = roleRoutes[user.role]
      if (route) {
        router.replace(route)
      }
    }
  }, [user, router])

  if (isLoading || user) {
    return <LoadingPage />
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Welcome to CostTrak</h2>
      <p className="text-gray-800">Redirecting to your dashboard...</p>
    </div>
  )
}