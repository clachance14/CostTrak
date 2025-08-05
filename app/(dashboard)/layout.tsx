'use client'

import { useUser, useSignOut } from '@/hooks/use-auth'
import { LoadingPage } from '@/components/ui/loading'
import { Button } from '@/components/ui/button'
import { redirect, usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  FolderOpen, 
  FileText, 
  Calculator, 
  FileSpreadsheet,
  Settings,
  LogOut,
  User,
  Menu,
  X,
  TrendingUp
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
// Removed NotificationBell import - notifications feature removed
import { ThemeToggle, ThemeToggleSimple } from '@/components/ui/theme-toggle-wrapper'

// Navigation items for all users (project managers)
const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderOpen },
  { name: 'Purchase Orders', href: '/purchase-orders', icon: FileText },
  { name: 'Labor', href: '/labor', icon: Calculator },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: user, isLoading } = useUser()
  const signOut = useSignOut()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (isLoading) {
    return <LoadingPage />
  }

  if (!user) {
    redirect('/login')
  }

  const navigation = navigationItems

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-foreground">
          <div className="flex flex-1 flex-col overflow-y-auto pt-5 pb-4">
            <div className="flex flex-shrink-0 items-center px-4">
              <h1 className="text-xl font-semibold text-background">CostTrak</h1>
            </div>
            <nav className="mt-8 flex-1 space-y-1 px-2">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      pathname.startsWith(item.href)
                        ? 'bg-background/20 text-background'
                        : 'text-background/70 hover:bg-background/10 hover:text-background',
                      'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                    )}
                  >
                    <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex flex-shrink-0 bg-background/10 p-4">
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-background/20 flex items-center justify-center">
                  <User className="h-5 w-5 text-background/70" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-background">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-xs font-medium text-background/70">
                    {user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  onClick={() => signOut.mutate()}
                  className="text-background/70 hover:text-background"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div className="sticky top-0 z-10 bg-background shadow lg:hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <h1 className="text-xl font-semibold">CostTrak</h1>
          <div className="flex items-center gap-2">
            <ThemeToggleSimple />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-md p-2 text-foreground hover:bg-foreground/10"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-foreground/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-background">
            <div className="flex min-h-0 flex-1 flex-col pt-5 pb-4">
              <nav className="mt-5 flex-1 space-y-1 px-2">
                {navigation.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        pathname.startsWith(item.href)
                          ? 'bg-foreground/10 text-foreground'
                          : 'text-foreground/80 hover:bg-foreground/5 hover:text-foreground',
                        'group flex items-center px-2 py-2 text-base font-medium rounded-md'
                      )}
                    >
                      <Icon className="mr-4 h-6 w-6 flex-shrink-0" />
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>
            <div className="flex flex-shrink-0 border-t border-foreground/20 p-4">
              <div className="flex items-center">
                <div className="h-10 w-10 rounded-full bg-foreground/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-foreground" />
                </div>
                <div className="ml-3">
                  <p className="text-base font-medium text-foreground">
                    {user.first_name} {user.last_name}
                  </p>
                  <p className="text-sm font-medium text-foreground/70">
                    {user.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut.mutate()}
                className="ml-auto"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}