'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { 
  Bell, 
  CheckCheck, 
  TrendingUp,
  FileText,
  DollarSign,
  Calendar,
  User,
  FileUp,
  Megaphone,
  Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

interface NotificationDropdownProps {
  onClose?: () => void
}

// Helper function to get notification icon based on type
function getNotificationIcon(type?: string) {
  switch (type) {
    case 'project':
      return <FileText className="h-4 w-4" />
    case 'purchase_order':
      return <DollarSign className="h-4 w-4" />
    case 'change_order':
      return <TrendingUp className="h-4 w-4" />
    case 'labor_forecast':
      return <Calendar className="h-4 w-4" />
    case 'financial_snapshot':
      return <FileUp className="h-4 w-4" />
    case 'user':
      return <User className="h-4 w-4" />
    case 'system':
      return <Megaphone className="h-4 w-4" />
    default:
      return <Bell className="h-4 w-4" />
  }
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('unread')

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery({
    queryKey: ['notifications-dropdown', activeTab],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: '20',
        ...(activeTab === 'unread' && { is_read: 'false' }),
      })
      const response = await fetch(`/api/notifications?${params}`)
      if (!response.ok) throw new Error('Failed to fetch notifications')
      return response.json()
    },
  })

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      })
      if (!response.ok) throw new Error('Failed to mark as read')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-dropdown'] })
      queryClient.invalidateQueries({ queryKey: ['notification-unread-count'] })
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
      queryClient.invalidateQueries({ queryKey: ['notifications-dropdown'] })
      queryClient.invalidateQueries({ queryKey: ['notification-unread-count'] })
    },
  })


  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markAsReadMutation.mutateAsync(notification.id)
    }
    if (notification.action_url) {
      onClose?.()
    }
  }

  const notifications = notificationsData?.data || []
  const hasUnread = notifications.some((n: Notification) => !n.is_read)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        {hasUnread && activeTab === 'unread' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0 h-[400px]">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-8 text-foreground/80">
                {activeTab === 'unread' 
                  ? 'No unread notifications' 
                  : 'No notifications'}
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification: Notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 hover:bg-background cursor-pointer transition-colors',
                      !notification.is_read && 'bg-blue-50/50'
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {notification.action_url ? (
                      <Link href={notification.action_url}>
                        <NotificationItem notification={notification} />
                      </Link>
                    ) : (
                      <NotificationItem notification={notification} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <div className="p-4 border-t">
        <Link href="/notifications" onClick={onClose}>
          <Button variant="outline" className="w-full">
            View all notifications
          </Button>
        </Link>
      </div>
    </div>
  )
}

function NotificationItem({ notification }: { notification: Notification }) {
  return (
    <div className="flex gap-3">
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        getPriorityColor(notification.priority)
      )}>
        {getNotificationIcon(notification.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{notification.title}</p>
        <p className="text-sm text-foreground/80 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-foreground/80 mt-1">
          {formatDistanceToNow(new Date(notification.created_at), { 
            addSuffix: true 
          })}
        </p>
      </div>
      {!notification.is_read && (
        <div className="flex-shrink-0">
          <div className="w-2 h-2 bg-blue-600 rounded-full" />
        </div>
      )}
    </div>
  )
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'critical': return 'text-red-600 bg-red-50'
    case 'high': return 'text-orange-600 bg-orange-50'
    case 'medium': return 'text-blue-600 bg-blue-50'
    case 'low': return 'text-foreground bg-background'
    default: return 'text-foreground bg-background'
  }
}