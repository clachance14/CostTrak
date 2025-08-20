'use client'

import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Key, Bell, Shield, ChevronRight, Lock } from 'lucide-react'
import Link from 'next/link'

interface SettingCard {
  title: string
  description: string
  icon: React.ElementType
  href: string
  requiredRole?: string
  available: boolean
}

const settingsCards: SettingCard[] = [
  {
    title: 'User Management',
    description: 'Add users, manage roles, and send invitations',
    icon: Users,
    href: '/settings/users',
    requiredRole: 'project_manager',
    available: true,
  },
  {
    title: 'Security',
    description: 'Password policies and two-factor authentication',
    icon: Shield,
    href: '/settings/security',
    available: false,
  },
  {
    title: 'Notifications',
    description: 'Email preferences and alert settings',
    icon: Bell,
    href: '/settings/notifications',
    available: false,
  },
  {
    title: 'Access Control',
    description: 'Permissions and project access rules',
    icon: Key,
    href: '/settings/access',
    available: false,
  },
]

export default function SettingsPage() {
  const { data: user } = useUser()
  const router = useRouter()
  
  const userRole = user?.role || 'viewer'

  const canAccessSetting = (setting: SettingCard) => {
    if (!setting.available) return false
    if (!setting.requiredRole) return true
    return userRole === setting.requiredRole || userRole === 'project_manager'
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your application settings and preferences
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsCards.map((setting) => {
          const Icon = setting.icon
          const isAccessible = canAccessSetting(setting)
          const isAvailable = setting.available

          return (
            <Card 
              key={setting.href} 
              className={`
                ${!isAvailable ? 'opacity-60' : ''}
                ${isAccessible && isAvailable ? 'hover:shadow-lg transition-shadow cursor-pointer' : ''}
              `}
              onClick={() => {
                if (isAccessible && isAvailable) {
                  router.push(setting.href)
                }
              }}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`
                      p-2 rounded-lg
                      ${isAvailable ? 'bg-primary/10' : 'bg-muted'}
                    `}>
                      <Icon className={`
                        h-5 w-5
                        ${isAvailable ? 'text-primary' : 'text-muted-foreground'}
                      `} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{setting.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {setting.description}
                      </CardDescription>
                    </div>
                  </div>
                  <div>
                    {!isAvailable ? (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                        Coming Soon
                      </span>
                    ) : !isAccessible ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
              {setting.requiredRole && !isAccessible && isAvailable && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Requires {setting.requiredRole} role
                  </p>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {userRole === 'project_manager' && (
        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Project Manager Notice:</strong> You have full access to user management. 
            More configuration options will be available in future updates.
          </p>
        </div>
      )}
    </div>
  )
}