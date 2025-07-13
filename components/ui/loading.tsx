import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
}

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
}

export function Loading({ size = 'md', className, text }: LoadingProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center', className)}>
      <Loader2 className={cn('animate-spin text-primary-600', sizeMap[size])} />
      {text && <p className="mt-2 text-sm text-foreground">{text}</p>}
    </div>
  )
}

export function LoadingPage() {
  return (
    <div className="flex h-screen items-center justify-center">
      <Loading size="lg" text="Loading..." />
    </div>
  )
}

export function LoadingSpinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />
}