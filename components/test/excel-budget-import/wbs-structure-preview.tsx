'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  ChevronRight, 
  ChevronDown, 
  FolderOpen, 
  FolderClosed, 
  FileText,
  Info,
  CircleAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WBSNode {
  code: string
  parent_code?: string
  level: number
  description?: string
  children: WBSNode[]
  budget_total: number
  itemCount?: number
}

interface WBSStructurePreviewProps {
  budgetData: any
  onNext?: () => void
}

// Component to render a single WBS node
function WBSTreeNode({ 
  node, 
  depth = 0,
  isLast = false 
}: { 
  node: WBSNode
  depth?: number
  isLast?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2) // Expand first 2 levels by default
  const hasChildren = node.children && node.children.length > 0
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }
  
  const getNodeIcon = () => {
    if (!hasChildren) return <FileText className="h-4 w-4 text-muted-foreground" />
    return isExpanded ? 
      <FolderOpen className="h-4 w-4 text-primary" /> : 
      <FolderClosed className="h-4 w-4 text-muted-foreground" />
  }
  
  const getIndentation = () => {
    const baseIndent = depth * 24
    return baseIndent + 8
  }
  
  return (
    <div>
      <div 
        className={cn(
          "flex items-center py-2 px-2 hover:bg-muted/50 rounded-sm cursor-pointer transition-colors",
          depth === 0 && "font-semibold"
        )}
        style={{ paddingLeft: `${getIndentation()}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {/* Expand/Collapse Icon */}
        {hasChildren && (
          <div className="mr-1">
            {isExpanded ? 
              <ChevronDown className="h-4 w-4" /> : 
              <ChevronRight className="h-4 w-4" />
            }
          </div>
        )}
        {!hasChildren && <div className="w-5" />}
        
        {/* Node Icon */}
        <div className="mr-2">
          {getNodeIcon()}
        </div>
        
        {/* WBS Code */}
        <Badge variant="outline" className="mr-3 font-mono text-xs">
          {node.code}
        </Badge>
        
        {/* Description */}
        <div className="flex-1 truncate">
          <span className={cn(
            "text-sm",
            !node.description && "text-muted-foreground italic"
          )}>
            {node.description || 'No description'}
          </span>
        </div>
        
        {/* Item Count */}
        {node.itemCount && node.itemCount > 0 && (
          <Badge variant="secondary" className="mr-3 text-xs">
            {node.itemCount} {node.itemCount === 1 ? 'item' : 'items'}
          </Badge>
        )}
        
        {/* Budget Total */}
        <div className="text-sm font-medium">
          {formatCurrency(node.budget_total)}
        </div>
      </div>
      
      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="border-l border-muted ml-6">
          {node.children.map((child, index) => (
            <WBSTreeNode 
              key={child.code} 
              node={child} 
              depth={depth + 1}
              isLast={index === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function WBSStructurePreview({ budgetData, onNext }: WBSStructurePreviewProps) {
  const [expandAll, setExpandAll] = useState(false)
  
  if (!budgetData || !budgetData.wbsStructure) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert>
            <CircleAlert className="h-4 w-4" />
            <AlertDescription>
              No WBS structure found. Please ensure your budget data contains WBS codes.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }
  
  const { wbsStructure, details, totals } = budgetData
  
  // Calculate statistics
  const totalWBSNodes = countNodes(wbsStructure)
  const maxDepth = getMaxDepth(wbsStructure)
  const itemsWithWBS = Object.values(details || {}).flat().filter((item: any) => item.wbs_code).length
  const totalItems = Object.values(details || {}).flat().length
  const wbsCoverage = totalItems > 0 ? Math.round((itemsWithWBS / totalItems) * 100) : 0
  
  // Helper functions
  function countNodes(nodes: WBSNode[]): number {
    return nodes.reduce((count, node) => {
      return count + 1 + (node.children ? countNodes(node.children) : 0)
    }, 0)
  }
  
  function getMaxDepth(nodes: WBSNode[], currentDepth = 0): number {
    if (!nodes || nodes.length === 0) return currentDepth
    return Math.max(...nodes.map(node => 
      getMaxDepth(node.children, currentDepth + 1)
    ))
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }
  
  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total WBS Codes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWBSNodes}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Max Depth</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{maxDepth} levels</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>WBS Coverage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wbsCoverage}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {itemsWithWBS} of {totalItems} items
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Budget</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totals.grand_total)}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* WBS Tree View */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>WBS Hierarchy</CardTitle>
              <CardDescription>
                Work Breakdown Structure organized by code hierarchy
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandAll(!expandAll)}
            >
              {expandAll ? 'Collapse All' : 'Expand All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-1">
              {wbsStructure.map((node: WBSNode, index: number) => (
                <WBSTreeNode 
                  key={node.code} 
                  node={node}
                  isLast={index === wbsStructure.length - 1}
                />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          The WBS structure is automatically built from the WBS codes found in your budget data. 
          Items without WBS codes will still be imported but won't appear in this hierarchy view.
        </AlertDescription>
      </Alert>
      
      {/* Navigation */}
      {onNext && (
        <div className="flex justify-end">
          <Button onClick={onNext}>
            Continue to Validation
          </Button>
        </div>
      )}
    </div>
  )
}