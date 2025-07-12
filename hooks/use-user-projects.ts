'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Project {
  id: string
  job_number: string
  name: string
  status: string
  division_id: string
  client_id: string
  original_contract: number
  revised_contract: number
  project_manager_id: string
}

export function useUserProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchUserProjects()
  }, [])

  const fetchUserProjects = async () => {
    try {
      const supabase = createClient()
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('Not authenticated')

      // Get user details
      const { data: userDetails, error: userDetailsError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userDetailsError || !userDetails) throw new Error('User not found')

      // Fetch projects based on role
      let query = supabase
        .from('projects')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      // If project manager, only get their projects
      if (userDetails.role === 'project_manager') {
        query = query.eq('project_manager_id', user.id)
      }

      const { data, error: projectsError } = await query

      if (projectsError) throw projectsError
      setProjects(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects')
    } finally {
      setLoading(false)
    }
  }

  return { projects, loading, error, refetch: fetchUserProjects }
}