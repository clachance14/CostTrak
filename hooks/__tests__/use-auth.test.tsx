import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useUser, useSignIn, useSignOut, useCheckAuth } from '../use-auth'
import type { ReactNode } from 'react'

// Mock dependencies
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  })),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
  })),
}))

// Test wrapper component
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useAuth hooks', () => {
  let mockSupabase: any
  let mockRouter: any

  beforeEach(() => {
    vi.clearAllMocks()
    const { createClient } = require('@/lib/supabase/client')
    mockSupabase = createClient()
    
    const { useRouter } = require('next/navigation')
    mockRouter = useRouter()
  })

  describe('useUser', () => {
    it('should return null when no user is authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toBeNull()
    })

    it('should return user profile when authenticated', async () => {
      const mockUser = { id: 'user-123', email: 'test@ics.ac' }
      const mockProfile = {
        id: 'user-123',
        email: 'test@ics.ac',
        first_name: 'Test',
        last_name: 'User',
        role: 'project_manager',
        division_id: 'div-123',
      }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().single.mockResolvedValue({
        data: mockProfile,
        error: null,
      })

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockProfile)
      expect(mockSupabase.from).toHaveBeenCalledWith('profiles')
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('id', 'user-123')
    })

    it('should return null when profile fetch fails', async () => {
      const mockUser = { id: 'user-123', email: 'test@ics.ac' }

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: new Error('Profile not found'),
      })

      const { result } = renderHook(() => useUser(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toBeNull()
    })
  })

  describe('useSignIn', () => {
    it('should sign in successfully and redirect based on role', async () => {
      const mockUser = { id: 'user-123', email: 'test@ics.ac' }
      const mockProfile = {
        id: 'user-123',
        email: 'test@ics.ac',
        role: 'project_manager',
      }

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().single.mockResolvedValue({
        data: mockProfile,
        error: null,
      })

      const { result } = renderHook(() => useSignIn(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync({
        email: 'test@ics.ac',
        password: 'password123',
      })

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@ics.ac',
        password: 'password123',
      })

      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard/project-manager')
    })

    it('should redirect to profile setup for new users', async () => {
      const mockUser = { id: 'user-123', email: 'newuser@ics.ac' }

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      })

      mockSupabase.from().single.mockResolvedValue({
        data: null,
        error: new Error('Profile not found'),
      })

      const { result } = renderHook(() => useSignIn(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync({
        email: 'newuser@ics.ac',
        password: 'password123',
      })

      expect(mockRouter.push).toHaveBeenCalledWith('/setup-profile')
    })

    it('should handle invalid credentials error', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: null,
        error: new Error('Invalid login credentials'),
      })

      const { result } = renderHook(() => useSignIn(), {
        wrapper: createWrapper(),
      })

      await expect(
        result.current.mutateAsync({
          email: 'test@ics.ac',
          password: 'wrongpass',
        })
      ).rejects.toThrow('Invalid email or password')
    })

    it('should validate email domain before sign in', async () => {
      const { result } = renderHook(() => useSignIn(), {
        wrapper: createWrapper(),
      })

      await expect(
        result.current.mutateAsync({
          email: 'test@gmail.com',
          password: 'password123',
        })
      ).rejects.toThrow('@ics.ac domain')
    })

    it('should redirect to correct dashboard based on role', async () => {
      const roles = [
        { role: 'executive', route: '/dashboard/executive' },
        { role: 'controller', route: '/dashboard/controller' },
        { role: 'ops_manager', route: '/dashboard/ops-manager' },
        { role: 'accounting', route: '/dashboard/accounting' },
        { role: 'viewer', route: '/dashboard/viewer' },
      ]

      for (const { role, route } of roles) {
        vi.clearAllMocks()
        
        mockSupabase.auth.signInWithPassword.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        mockSupabase.from().single.mockResolvedValue({
          data: { id: 'user-123', role },
          error: null,
        })

        const { result } = renderHook(() => useSignIn(), {
          wrapper: createWrapper(),
        })

        await result.current.mutateAsync({
          email: 'test@ics.ac',
          password: 'password123',
        })

        expect(mockRouter.push).toHaveBeenCalledWith(route)
      }
    })
  })

  describe('useSignOut', () => {
    it('should sign out successfully and redirect to login', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: null,
      })

      const { result } = renderHook(() => useSignOut(), {
        wrapper: createWrapper(),
      })

      await result.current.mutateAsync()

      expect(mockSupabase.auth.signOut).toHaveBeenCalled()
      expect(mockRouter.push).toHaveBeenCalledWith('/login')
    })

    it('should handle sign out errors', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: new Error('Sign out failed'),
      })

      const { result } = renderHook(() => useSignOut(), {
        wrapper: createWrapper(),
      })

      await expect(result.current.mutateAsync()).rejects.toThrow('Sign out failed')
    })
  })

  describe('useCheckAuth', () => {
    it('should return session when authenticated', async () => {
      const mockSession = {
        user: { id: 'user-123', email: 'test@ics.ac' },
        access_token: 'token123',
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      })

      const { result } = renderHook(() => useCheckAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toEqual(mockSession)
    })

    it('should return null when no session exists', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      })

      const { result } = renderHook(() => useCheckAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data).toBeNull()
    })

    it('should handle session fetch errors', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: null,
        error: new Error('Session fetch failed'),
      })

      const { result } = renderHook(() => useCheckAuth(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(new Error('Session fetch failed'))
    })
  })
})