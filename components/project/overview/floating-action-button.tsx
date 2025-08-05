'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Upload, FileText, Download, Bell } from 'lucide-react'

interface FloatingActionButtonProps {
  projectId: string
}

export function FloatingActionButton({ projectId }: FloatingActionButtonProps) {
  const router = useRouter()

  const handleImportBudget = () => {
    router.push(`/projects/${projectId}/budget-import-coversheet`)
  }

  const handleImportLabor = () => {
    router.push('/labor/import')
  }

  const handleImportPOs = () => {
    router.push('/purchase-orders/import')
  }

  const handleNewChangeOrder = () => {
    // TODO: Implement change order modal or navigation
    console.log('New change order')
  }

  const handleExportReport = () => {
    // TODO: Implement export functionality
    console.log('Export report')
  }

  const handleSetAlert = () => {
    // TODO: Implement alert configuration
    console.log('Set alert')
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="lg" className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-shadow">
            <Plus className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleImportBudget}>
            <Upload className="mr-2 h-4 w-4" />
            Import Budget
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportLabor}>
            <Upload className="mr-2 h-4 w-4" />
            Import Labor
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportPOs}>
            <Upload className="mr-2 h-4 w-4" />
            Import POs
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleNewChangeOrder}>
            <FileText className="mr-2 h-4 w-4" />
            New Change Order
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSetAlert}>
            <Bell className="mr-2 h-4 w-4" />
            Set Alert
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}