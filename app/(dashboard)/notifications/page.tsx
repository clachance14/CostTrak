'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { 
  Bell, 
  Check, 
  Trash2,
  Search,
  AlertCircle,
  TrendingUp,
  FileText,
  DollarSign,
  Calendar,
  User,
  Upload,
  Bell as Megaphone,
  Loader2
} from 'lucide-react'
import Link from 'next/link'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils/cn'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  is_read: boolean
  created_at: string
  action_url?: string
  related_entity_type?: string
  metadata?: Record<string, unknown>
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([])
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications-page', priorityFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '100',
        ...(priorityFilter && { priority: priorityFilter }),
        ...(typeFilter && { type: typeFilter }),
      })
      const response = await fetch(`/api/notifications?${params}`)
      if (!response.ok) throw new Error('Failed to fetch notifications')
      return response.json()
    },
  })

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      await Promise.all(
        notificationIds.map(id =>
          fetch(`/api/notifications/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_read: true }),
          })
        )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] })
      queryClient.invalidateQueries({ queryKey: ['notification-unread-count'] })
      setSelectedNotifications([])
      toast({
        title: 'Success',
        description: 'Notifications marked as read',
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      await Promise.all(
        notificationIds.map(id =>
          fetch(`/api/notifications/${id}`, {
            method: 'DELETE',
          })
        )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] })
      setSelectedNotifications([])
      setDeleteConfirmOpen(false)
      toast({
        title: 'Success',
        description: 'Notifications deleted',
      })
    },
  })

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to mark all as read')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-page'] })
      queryClient.invalidateQueries({ queryKey: ['notification-unread-count'] })
      toast({
        title: 'Success',
        description: 'All notifications marked as read',
      })
    },
  })

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'change_order_created':
      case 'change_order_updated':
        return <FileText className="h-5 w-5" />
      case 'po_import_complete':
      case 'po_threshold_exceeded':
        return <DollarSign className="h-5 w-5" />
      case 'labor_variance_alert':
      case 'budget_threshold_alert':
        return <AlertCircle className="h-5 w-5" />
      case 'project_deadline_approaching':
        return <Calendar className="h-5 w-5" />
      case 'financial_snapshot_ready':
        return <TrendingUp className="h-5 w-5" />
      case 'user_assigned_project':
      case 'user_role_changed':
        return <User className="h-5 w-5" />
      case 'document_uploaded':
        return <Upload className="h-5 w-5" />
      case 'system_announcement':
        return <Megaphone className="h-5 w-5" />
      default:
        return <Bell className="h-5 w-5" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-blue-100 text-blue-800'
      case 'low': return 'bg-foreground/5 text-foreground'
      default: return 'bg-foreground/5 text-foreground'
    }
  }

  const toggleNotificationSelection = (id: string) => {
    setSelectedNotifications(prev =>
      prev.includes(id)
        ? prev.filter(n => n !== id)
        : [...prev, id]
    )
  }

  const selectAll = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([])
    } else {
      setSelectedNotifications(filteredNotifications.map((n: Notification) => n.id))
    }
  }

  const notifications = notificationsData?.data || []
  
  const filteredNotifications = notifications.filter((notification: Notification) =>
    notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notification.message.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const unreadCount = filteredNotifications.filter((n: Notification) => !n.is_read).length
  const hasSelection = selectedNotifications.length > 0

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="text-foreground/80">
          Manage your notifications and stay updated
        </p>
      </div>

      {/* Filters and Actions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-foreground" />
              <Input
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All types</SelectItem>
                  <SelectItem value="change_order_created">Change Orders</SelectItem>
                  <SelectItem value="po_import_complete">Purchase Orders</SelectItem>
                  <SelectItem value="labor_variance_alert">Labor Alerts</SelectItem>
                  <SelectItem value="budget_threshold_alert">Budget Alerts</SelectItem>
                  <SelectItem value="project_deadline_approaching">Deadlines</SelectItem>
                  <SelectItem value="financial_snapshot_ready">Financial Snapshots</SelectItem>
                  <SelectItem value="document_uploaded">Documents</SelectItem>
                  <SelectItem value="system_announcement">Announcements</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {hasSelection && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAsReadMutation.mutate(selectedNotifications)}
                    disabled={markAsReadMutation.isPending}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Mark as read ({selectedNotifications.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete ({selectedNotifications.length})
                  </Button>
                </>
              )}
              {unreadCount > 0 && !hasSelection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Mark all as read
                </Button>
              )}
            </div>
            
            <div className="text-sm text-foreground/80">
              {filteredNotifications.length} notifications
              {unreadCount > 0 && ` (${unreadCount} unread)`}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-12 text-foreground/80">
              No notifications found
            </div>
          ) : (
            <div className="divide-y">
              <div className="p-4 bg-background border-b">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.length === filteredNotifications.length}
                    onChange={selectAll}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Select all</span>
                </label>
              </div>
              
              {filteredNotifications.map((notification: Notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 hover:bg-background transition-colors',
                    !notification.is_read && 'bg-blue-50/30'
                  )}
                >
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification.id)}
                      onChange={() => toggleNotificationSelection(notification.id)}
                      className="mt-1 rounded"
                    />
                    
                    <div className={cn(
                      'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                      getPriorityColor(notification.priority).replace('text-', 'bg-').replace('-800', '-100'),
                      getPriorityColor(notification.priority).replace('bg-', 'text-')
                    )}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-medium">{notification.title}</h3>
                          <p className="text-sm text-foreground/80 mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 mt-2">
                            <Badge className={getPriorityColor(notification.priority)}>
                              {notification.priority}
                            </Badge>
                            <span className="text-xs text-foreground/80">
                              {formatDistanceToNow(new Date(notification.created_at), { 
                                addSuffix: true 
                              })}
                            </span>
                          </div>
                        </div>
                        
                        {notification.action_url && (
                          <Link href={notification.action_url}>
                            <Button variant="outline" size="sm">
                              View
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                    
                    {!notification.is_read && (
                      <div className="flex-shrink-0 mt-2">
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notifications</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedNotifications.length} notification(s)?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(selectedNotifications)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}