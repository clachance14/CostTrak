import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

type NotificationType = Database['public']['Enums']['notification_type']
type NotificationPriority = 'low' | 'medium' | 'high' | 'critical'

interface NotificationData {
  userId: string
  title: string
  message: string
  type: NotificationType
  priority?: NotificationPriority
  relatedEntityType?: string
  relatedEntityId?: string
  actionUrl?: string
  expiresAt?: string
  metadata?: Record<string, unknown>
}

export class NotificationService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Create a single notification
   */
  async create(data: NotificationData): Promise<string> {
    const { data: result, error } = await this.supabase.rpc('create_notification', {
      p_user_id: data.userId,
      p_title: data.title,
      p_message: data.message,
      p_type: data.type,
      p_priority: data.priority || 'medium',
      p_related_entity_type: data.relatedEntityType,
      p_related_entity_id: data.relatedEntityId,
      p_action_url: data.actionUrl,
      p_expires_at: data.expiresAt,
      p_metadata: data.metadata || {},
    })

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`)
    }

    return result as string
  }

  /**
   * Create multiple notifications
   */
  async createBatch(notifications: NotificationData[]): Promise<string[]> {
    const results = await Promise.all(
      notifications.map(notification => this.create(notification))
    )
    return results
  }

  /**
   * Notify about change order creation
   */
  async notifyChangeOrderCreated(params: {
    changeOrder: {
      id: string
      co_number: string
      project_id: string
      amount: number
      description: string
    }
    project: {
      id: string
      job_number: string
      name: string
      division_id: string
    }
    createdBy: string
  }) {
    const { changeOrder, project, createdBy } = params
    
    // Get users to notify (ops managers in the division and controllers)
    const { data: users } = await this.supabase
      .from('profiles')
      .select('id, first_name, last_name, role')
      .or(`division_id.eq.${project.division_id},role.eq.controller`)
      .neq('id', createdBy)

    if (!users || users.length === 0) return

    const notifications = users.map(user => ({
      userId: user.id,
      title: 'New Change Order Created',
      message: `Change Order ${changeOrder.co_number} for ${this.formatCurrency(changeOrder.amount)} has been created for project ${project.job_number} - ${project.name}`,
      type: 'change_order' as NotificationType,
      priority: changeOrder.amount > 100000 ? 'high' as NotificationPriority : 'medium' as NotificationPriority,
      relatedEntityType: 'change_order',
      relatedEntityId: changeOrder.id,
      actionUrl: `/change-orders/${changeOrder.id}`,
      metadata: {
        project_id: project.id,
        amount: changeOrder.amount,
      }
    }))

    await this.createBatch(notifications)
  }

  /**
   * Notify about PO import completion
   */
  async notifyPOImportComplete(params: {
    projectId: string
    projectName: string
    importedCount: number
    totalAmount: number
    importedBy: string
  }) {
    const { projectId, projectName, importedCount, totalAmount, importedBy } = params

    await this.create({
      userId: importedBy,
      title: 'Purchase Order Import Complete',
      message: `Successfully imported ${importedCount} purchase orders totaling ${this.formatCurrency(totalAmount)} for project ${projectName}`,
      type: 'purchase_order',
      priority: 'low',
      relatedEntityType: 'project',
      relatedEntityId: projectId,
      actionUrl: `/purchase-orders?project_id=${projectId}`,
      metadata: {
        imported_count: importedCount,
        total_amount: totalAmount,
      }
    })
  }

  /**
   * Notify about labor variance alerts
   */
  async notifyLaborVarianceAlert(params: {
    projectId: string
    projectName: string
    craftType: string
    variance: number
    weekEnding: string
    projectManagerId: string
  }) {
    const { projectId, projectName, craftType, variance, weekEnding, projectManagerId } = params

    await this.create({
      userId: projectManagerId,
      title: 'Labor Cost Variance Alert',
      message: `${craftType} labor costs are ${variance}% over forecast for week ending ${weekEnding} on project ${projectName}`,
      type: 'labor',
      priority: variance > 20 ? 'high' : 'medium',
      relatedEntityType: 'project',
      relatedEntityId: projectId,
      actionUrl: `/labor-forecasts?project_id=${projectId}`,
      metadata: {
        craft_type: craftType,
        variance_percentage: variance,
        week_ending: weekEnding,
      }
    })
  }

  /**
   * Notify about approaching project deadlines
   */
  async notifyProjectDeadlineApproaching(params: {
    project: {
      id: string
      job_number: string
      name: string
      end_date: string
      project_manager_id: string
    }
    daysUntilDeadline: number
  }) {
    const { project, daysUntilDeadline } = params

    const priority: NotificationPriority = 
      daysUntilDeadline <= 7 ? 'high' :
      daysUntilDeadline <= 30 ? 'medium' : 'low'

    await this.create({
      userId: project.project_manager_id,
      title: 'Project Deadline Approaching',
      message: `Project ${project.job_number} - ${project.name} is due in ${daysUntilDeadline} days`,
      type: 'project',
      priority,
      relatedEntityType: 'project',
      relatedEntityId: project.id,
      actionUrl: `/projects/${project.id}`,
      metadata: {
        days_until_deadline: daysUntilDeadline,
        end_date: project.end_date,
      }
    })
  }

  /**
   * Notify about budget threshold alerts
   */
  async notifyBudgetThresholdAlert(params: {
    project: {
      id: string
      job_number: string
      name: string
      project_manager_id: string
      division_id: string
    }
    budgetPercentage: number
    totalCommitted: number
    revisedContract: number
  }) {
    const { project, budgetPercentage, totalCommitted, revisedContract } = params

    // Notify project manager and ops managers
    const { data: users } = await this.supabase
      .from('profiles')
      .select('id')
      .or(`id.eq.${project.project_manager_id},and(division_id.eq.${project.division_id},role.eq.ops_manager)`)

    if (!users) return

    const notifications = users.map(user => ({
      userId: user.id,
      title: 'Budget Threshold Alert',
      message: `Project ${project.job_number} has reached ${budgetPercentage.toFixed(1)}% of budget (${this.formatCurrency(totalCommitted)} of ${this.formatCurrency(revisedContract)})`,
      type: 'financial' as NotificationType,
      priority: budgetPercentage >= 95 ? 'critical' as NotificationPriority : 'high' as NotificationPriority,
      relatedEntityType: 'project',
      relatedEntityId: project.id,
      actionUrl: `/projects/${project.id}`,
      metadata: {
        budget_percentage: budgetPercentage,
        total_committed: totalCommitted,
        revised_contract: revisedContract,
      }
    }))

    await this.createBatch(notifications)
  }

  /**
   * Notify about financial snapshot completion
   */
  async notifyFinancialSnapshotReady(params: {
    snapshotId: string
    snapshotType: 'project' | 'division' | 'company'
    entityName: string
    createdBy: string
    notifyUsers: string[]
  }) {
    const { snapshotId, snapshotType, entityName, notifyUsers } = params

    const notifications = notifyUsers.map(userId => ({
      userId,
      title: 'Financial Snapshot Ready',
      message: `New ${snapshotType} financial snapshot available for ${entityName}`,
      type: 'financial' as NotificationType,
      priority: 'low' as NotificationPriority,
      relatedEntityType: 'financial_snapshot',
      relatedEntityId: snapshotId,
      actionUrl: `/financial-snapshots/${snapshotId}`,
      metadata: {
        snapshot_type: snapshotType,
        entity_name: entityName,
      }
    }))

    await this.createBatch(notifications)
  }

  /**
   * Notify about user assignment to project
   */
  async notifyUserAssignedToProject(params: {
    userId: string
    project: {
      id: string
      job_number: string
      name: string
    }
    role: string
  }) {
    const { userId, project, role } = params

    await this.create({
      userId,
      title: 'Assigned to New Project',
      message: `You have been assigned as ${role} to project ${project.job_number} - ${project.name}`,
      type: 'user',
      priority: 'medium',
      relatedEntityType: 'project',
      relatedEntityId: project.id,
      actionUrl: `/projects/${project.id}`,
      metadata: {
        assigned_role: role,
      }
    })
  }

  /**
   * Notify about document uploads
   */
  async notifyDocumentUploaded(params: {
    document: {
      id: string
      name: string
      category: string
    }
    entityType: string
    entityName: string
    uploadedBy: string
    notifyUsers: string[]
  }) {
    const { document, entityType, entityName, uploadedBy, notifyUsers } = params

    const notifications = notifyUsers
      .filter(userId => userId !== uploadedBy)
      .map(userId => ({
        userId,
        title: 'New Document Uploaded',
        message: `New ${document.category} document "${document.name}" uploaded to ${entityType} ${entityName}`,
        type: 'document' as NotificationType,
        priority: 'low' as NotificationPriority,
        relatedEntityType: 'document',
        relatedEntityId: document.id,
        actionUrl: `/documents/${document.id}`,
        metadata: {
          document_name: document.name,
          document_category: document.category,
          entity_type: entityType,
          entity_name: entityName,
        }
      }))

    if (notifications.length > 0) {
      await this.createBatch(notifications)
    }
  }

  /**
   * Create a system announcement
   */
  async createSystemAnnouncement(params: {
    title: string
    message: string
    priority?: NotificationPriority
    targetRoles?: string[]
    expiresAt?: string
  }) {
    const { title, message, priority = 'medium', targetRoles, expiresAt } = params

    // Get target users
    let query = this.supabase.from('profiles').select('id').eq('is_active', true)
    
    if (targetRoles && targetRoles.length > 0) {
      query = query.in('role', targetRoles)
    }

    const { data: users } = await query

    if (!users || users.length === 0) return

    const notifications = users.map(user => ({
      userId: user.id,
      title,
      message,
      type: 'system' as NotificationType,
      priority,
      expiresAt,
      metadata: {
        announcement: true,
      }
    }))

    await this.createBatch(notifications)
  }

  /**
   * Utility function to format currency
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }
}