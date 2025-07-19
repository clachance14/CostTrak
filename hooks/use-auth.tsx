'use client'

import { createClient } from '@/lib/supabase/client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { Database } from '@/types/database.generated'

type UserWithRole = Database['public']['Tables']['profiles']['Row'] | null

const ALLOWED_EMAIL_DOMAIN = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN || 'ics.ac'

export function useUser() {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['user', 'profile'],
    queryFn: async () => {
      // Get auth user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) return null
      
      // Get user profile with role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        
      if (profileError || !profile) return null
      
      return profile as UserWithRole
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })
}

export function useSignIn() {
  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      // Validate input
      const validated = loginSchema.parse(input)
      
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      })
      
      if (error) {
        // Check for specific error types
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password')
        }
        throw error
      }
      
      // Check if user profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
        
      if (profileError || !profile) {
        // User exists in auth but not in profiles - this is a first login
        // We'll handle this in the success callback
        return { user: data.user, profile: null }
      }
      
      return { user: data.user, profile }
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['user'] })
      
      if (!data.profile) {
        // First login - redirect to profile setup
        router.push('/setup-profile')
      } else {
        // Route based on role
        const roleRoutes: Record<string, string> = {
          executive: '/dashboard/executive',
          controller: '/dashboard/controller',
          ops_manager: '/dashboard/ops-manager',
          project_manager: '/dashboard/project-manager',
          accounting: '/dashboard/accounting',
          viewer: '/dashboard/viewer',
        }
        
        const route = roleRoutes[data.profile.role] || '/dashboard'
        router.push(route)
      }
    },
    onError: (error) => {
      console.error('Sign in error:', error)
    },
  })
}

export function useSignOut() {
  const supabase = createClient()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.clear()
      router.push('/login')
    },
  })
}

export function useCheckAuth() {
  const supabase = createClient()
  
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}