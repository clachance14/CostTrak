'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { NotificationDropdown } from './notification-dropdown'
import { cn } from '@/lib/utils/cn'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)

  // Fetch unread count
  const { data: unreadCount = 0, refetch: refetchCount } = useQuery({
    queryKey: ['notification-unread-count'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/unread-count')
      if (!response.ok) throw new Error('Failed to fetch unread count')
      const data = await response.json()
      return data.count
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Refetch count when dropdown is closed
  useEffect(() => {
    if (!isOpen) {
      refetchCount()
    }
  }, [isOpen, refetchCount])

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative"
          aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-96 p-0" 
        align="end"
        sideOffset={5}
      >
        <NotificationDropdown onClose={() => setIsOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}