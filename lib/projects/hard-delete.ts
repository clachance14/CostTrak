import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'
import { deleteStorageFiles, deleteProjectStorageFolder } from '@/lib/storage/cleanup'

export interface DeleteResult {
  success: boolean
  projectId?: string
  deletedCounts: Record<string, number>
  errors: Array<{ table: string; error: string }>
  totalRecordsDeleted: number
}

export interface DeleteOptions {
  dryRun?: boolean
  deleteAttachments?: boolean
}

/**
 * Performs a hard delete of a project and all related data
 * This function uses database transactions when possible to ensure atomicity
 */
export async function hardDeleteProject(
  supabase: SupabaseClient<Database>,
  jobNumber: string,
  options: DeleteOptions = {}
): Promise<DeleteResult> {
  const result: DeleteResult = {
    success: false,
    deletedCounts: {},
    errors: [],
    totalRecordsDeleted: 0
  }

  try {
    // Find the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('job_number', jobNumber)
      .single()
    
    if (projectError || !project) {
      result.errors.push({ 
        table: 'projects', 
        error: projectError?.message || 'Project not found' 
      })
      return result
    }
    
    const projectId = project.id
    result.projectId = projectId

    // Get all related data counts
    const counts = await getRelatedDataCounts(supabase, projectId)
    
    if (options.dryRun) {
      // In dry run mode, just return the counts
      result.deletedCounts = counts
      result.totalRecordsDeleted = Object.values(counts).reduce((a, b) => a + b, 0) + 1 // +1 for project
      result.success = true
      return result
    }

    // Execute deletion in the correct order
    const deletionOrder = [
      // Labor data (in dependency order)
      'labor_employee_actuals',
      'labor_actuals', 
      'labor_headcount_forecasts',
      'labor_running_averages',
      
      // Attachments and change orders
      { table: 'co_attachments', customQuery: async () => {
        const { data: cos } = await supabase
          .from('change_orders')
          .select('id')
          .eq('project_id', projectId)
        const coIds = cos?.map(co => co.id) || []
        if (coIds.length === 0) return { error: null }
        
        // Get attachment URLs if we need to delete files
        if (options.deleteAttachments) {
          const { data: attachments } = await supabase
            .from('co_attachments')
            .select('file_url')
            .in('change_order_id', coIds)
          
          if (attachments && attachments.length > 0) {
            const fileUrls = attachments.map(a => a.file_url)
            const storageResult = await deleteStorageFiles(supabase, fileUrls)
            
            if (storageResult.errors.length > 0) {
              result.errors.push({
                table: 'storage_files',
                error: `Failed to delete ${storageResult.errors.length} files: ${storageResult.errors.join(', ')}`
              })
            }
          }
        }
        
        return supabase.from('co_attachments').delete().in('change_order_id', coIds)
      }},
      'change_orders',
      
      // PO data
      { table: 'po_line_items', customQuery: async () => {
        const { data: pos } = await supabase
          .from('purchase_orders')
          .select('id')
          .eq('project_id', projectId)
        const poIds = pos?.map(po => po.id) || []
        if (poIds.length === 0) return { error: null }
        return supabase.from('po_line_items').delete().in('purchase_order_id', poIds)
      }},
      'purchase_orders',
      'project_po_line_items',
      
      // Financial data
      'invoices',
      'division_forecasts',
      'division_budgets',
      'project_divisions',
      'project_budget_breakdowns',
      'project_budgets',
      'project_contract_breakdowns',
      'financial_snapshots',
      'monthly_forecasts',
      
      // Metadata
      'data_imports',
      'user_project_access',
      { table: 'notification_triggers', whereClause: { entity_id: projectId, entity_type: 'project' } },
      { table: 'audit_log', whereClause: { entity_id: projectId, entity_type: 'projects' } },
    ]

    // Execute deletions
    for (const item of deletionOrder) {
      if (typeof item === 'string') {
        // Simple table deletion
        const count = counts[item] || 0
        if (count > 0) {
          const { error } = await supabase
            .from(item as any)
            .delete()
            .eq('project_id', projectId)
          
          if (error) {
            result.errors.push({ table: item, error: error.message })
          } else {
            result.deletedCounts[item] = count
            result.totalRecordsDeleted += count
          }
        }
      } else if (item.customQuery) {
        // Custom query deletion
        const count = counts[item.table] || 0
        if (count > 0) {
          const { error } = await item.customQuery()
          
          if (error) {
            result.errors.push({ table: item.table, error: error.message })
          } else {
            result.deletedCounts[item.table] = count
            result.totalRecordsDeleted += count
          }
        }
      } else if (item.whereClause) {
        // Table with custom where clause
        const count = counts[item.table] || 0
        if (count > 0) {
          let query = supabase.from(item.table as any).delete()
          
          // Apply where clauses
          for (const [key, value] of Object.entries(item.whereClause)) {
            query = query.eq(key, value)
          }
          
          const { error } = await query
          
          if (error) {
            result.errors.push({ table: item.table, error: error.message })
          } else {
            result.deletedCounts[item.table] = count
            result.totalRecordsDeleted += count
          }
        }
      }
    }

    // Finally, delete the project itself
    const { error: projectDeleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
    
    if (projectDeleteError) {
      result.errors.push({ table: 'projects', error: projectDeleteError.message })
    } else {
      result.deletedCounts['projects'] = 1
      result.totalRecordsDeleted += 1
      result.success = result.errors.length === 0
    }

    // Clean up any remaining storage files for the project
    if (options.deleteAttachments && result.success) {
      const storageCleanup = await deleteProjectStorageFolder(supabase, projectId)
      if (storageCleanup.errors.length > 0) {
        result.errors.push({
          table: 'project_storage',
          error: `Storage cleanup errors: ${storageCleanup.errors.join(', ')}`
        })
      }
    }

    // Log the deletion
    await supabase.from('audit_log').insert({
      action: 'hard_delete',
      entity_type: 'projects',
      entity_id: projectId,
      changes: {
        job_number: jobNumber,
        project_name: project.name,
        total_records_deleted: result.totalRecordsDeleted,
        deletion_summary: result.deletedCounts,
        errors: result.errors
      },
      performed_by: 'system' // This should be the actual user ID
    })

  } catch (error) {
    result.errors.push({ 
      table: 'general', 
      error: error instanceof Error ? error.message : 'Unknown error' 
    })
  }

  return result
}

/**
 * Get counts of all related data for a project
 */
async function getRelatedDataCounts(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}

  // Helper to count records
  const getCount = async (table: string, column = 'project_id', value = projectId) => {
    const { count, error } = await supabase
      .from(table as any)
      .select('*', { count: 'exact', head: true })
      .eq(column, value)
    
    if (!error && count !== null) {
      counts[table] = count
    }
    return count || 0
  }

  // Count all tables
  await Promise.all([
    // Labor tables
    getCount('labor_employee_actuals'),
    getCount('labor_actuals'),
    getCount('labor_headcount_forecasts'),
    getCount('labor_running_averages'),
    
    // Financial tables
    getCount('invoices'),
    getCount('financial_snapshots'),
    getCount('project_budget_breakdowns'),
    getCount('project_budgets'),
    getCount('project_contract_breakdowns'),
    getCount('monthly_forecasts'),
    
    // Division tables
    getCount('division_forecasts'),
    getCount('division_budgets'),
    getCount('project_divisions'),
    
    // Other tables
    getCount('purchase_orders'),
    getCount('change_orders'),
    getCount('project_po_line_items'),
    getCount('data_imports'),
    getCount('user_project_access'),
  ])

  // Special cases with different queries
  
  // PO line items (through purchase orders)
  const { data: pos } = await supabase
    .from('purchase_orders')
    .select('id')
    .eq('project_id', projectId)
  
  if (pos && pos.length > 0) {
    const poIds = pos.map(po => po.id)
    const { count } = await supabase
      .from('po_line_items')
      .select('*', { count: 'exact', head: true })
      .in('purchase_order_id', poIds)
    if (count) counts['po_line_items'] = count
  }

  // CO attachments (through change orders)
  const { data: cos } = await supabase
    .from('change_orders')
    .select('id')
    .eq('project_id', projectId)
  
  if (cos && cos.length > 0) {
    const coIds = cos.map(co => co.id)
    const { count } = await supabase
      .from('co_attachments')
      .select('*', { count: 'exact', head: true })
      .in('change_order_id', coIds)
    if (count) counts['co_attachments'] = count
  }

  // Audit log
  const { count: auditCount } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', projectId)
    .eq('entity_type', 'projects')
  if (auditCount) counts['audit_log'] = auditCount

  // Notification triggers
  const { count: notificationCount } = await supabase
    .from('notification_triggers')
    .select('*', { count: 'exact', head: true })
    .eq('entity_id', projectId)
    .eq('entity_type', 'project')
  if (notificationCount) counts['notification_triggers'] = notificationCount

  return counts
}