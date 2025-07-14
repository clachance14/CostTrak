'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Project {
  id: string
  job_number: string
  name: string
  status: 'planning' | 'active' | 'completed' | 'on_hold' | 'cancelled'
  division_id: string
  client_id: string | null
  original_contract_amount: number
  revised_contract_amount: number
  project_manager_id: string | null
  start_date: string
  end_date: string | null
  created_at: string
  updated_at: string
  // Related data
  division?: {
    id: string
    name: string
    code: string
  }
  client?: {
    id: string
    name: string
  }
  project_manager?: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
  // Calculated fields
  total_po_amount?: number
  approved_change_orders?: number
  percent_complete?: number
  projected_profit_margin?: number
  cost_to_complete?: number
}

export function useUserProjects() {
  const [data, setData] = useState<Project[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetchUserProjects()
  }, [])

  const fetchUserProjects = async () => {
    try {
      setIsLoading(true)
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

      // Fetch projects with related data
      let query = supabase
        .from('projects')
        .select(`
          *,
          division:divisions(id, name, code),
          client:clients(id, name),
          project_manager:profiles!project_manager_id(id, first_name, last_name, email),
          purchase_orders(total_amount),
          change_orders(amount, status),
          financial_snapshots(
            percent_complete,
            profit_margin,
            cost_to_complete,
            total_po_committed,
            approved_change_orders
          )
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      // If project manager, only get their projects
      if (userDetails.role === 'project_manager') {
        query = query.eq('project_manager_id', user.id)
      }

      const { data: projects, error: projectsError } = await query

      if (projectsError) throw projectsError

      // Process projects to include aggregated data
      const processedProjects = projects?.map(project => {
        // Calculate total PO amount
        const totalPoAmount = project.purchase_orders?.reduce(
          (sum: number, po: any) => sum + (po.total_amount || 0), 
          0
        ) || 0

        // Get approved change orders total
        const approvedChangeOrders = project.change_orders?.filter(
          (co: any) => co.status === 'approved'
        ).reduce(
          (sum: number, co: any) => sum + (co.amount || 0),
          0
        ) || 0

        // Get latest financial snapshot data
        const latestSnapshot = project.financial_snapshots?.[0]

        return {
          ...project,
          original_contract_amount: project.original_contract || 0,
          revised_contract_amount: project.revised_contract || 0,
          total_po_amount: totalPoAmount,
          approved_change_orders: approvedChangeOrders,
          percent_complete: latestSnapshot?.percent_complete || 0,
          projected_profit_margin: latestSnapshot?.profit_margin || 0,
          cost_to_complete: latestSnapshot?.cost_to_complete || 0
        }
      }) || []

      setData(processedProjects)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch projects'))
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }

  return { 
    data, 
    isLoading, 
    error, 
    refetch: fetchUserProjects 
  }
}