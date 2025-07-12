'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'
import { LoadingPage } from '@/components/ui/loading'

type User = Database['public']['Tables']['profiles']['Row']
type AuthState = {
  user: User | null
  loading: boolean
  error: Error | null
}

type AuthContextType = AuthState & {
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  })
  const router = useRouter()
  const supabase = createClient()

  const fetchUser = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }))
      
      // Get authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        setState({ user: null, loading: false, error: null })
        return
      }

      // Get user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError) {
        // User exists in auth but not in profiles
        console.error('Profile fetch error:', profileError)
        setState({ user: null, loading: false, error: profileError })
        return
      }

      setState({ user: profile, loading: false, error: null })
    } catch (error) {
      console.error('Auth error:', error)
      setState({ user: null, loading: false, error: error as Error })
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchUser()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await fetchUser()
      } else if (event === 'SIGNED_OUT') {
        setState({ user: null, loading: false, error: null })
        router.push('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const refreshUser = async () => {
    await fetchUser()
  }

  return (
    <AuthContext.Provider value={{ ...state, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// HOC for protecting pages
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    allowedRoles?: User['role'][]
    redirectTo?: string
  }
) {
  return function ProtectedComponent(props: P) {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!loading && !user) {
        router.push(options?.redirectTo || '/login')
      } else if (!loading && user && options?.allowedRoles) {
        if (!options.allowedRoles.includes(user.role)) {
          router.push('/unauthorized')
        }
      }
    }, [user, loading, router])

    if (loading) {
      return <LoadingPage />
    }

    if (!user) {
      return null
    }

    if (options?.allowedRoles && !options.allowedRoles.includes(user.role)) {
      return null
    }

    return <Component {...props} />
  }
}