'use client'

import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Package, FolderOpen, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface WBSNode {
  code: string
  parent_code: string | null
  level: number
  description: string
  phase?: string
  cost_type?: string
  labor_category_id?: string
  path: string
  sort_order: number
  children_count: number
  budget_total?: number
  children?: WBSNode[]
}

interface WBS5LevelViewerProps {
  wbsStructure: WBSNode[]
}

const levelColors = [
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', // Level 1
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',       // Level 2
  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',    // Level 3
  'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',    // Level 4
  'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',        // Level 5
]

const levelNames = [
  'Project',
  'Phase',
  'Major Group',
  'Cost Category',
  'Line Item'
]

export function WBS5LevelViewer({ wbsStructure }: WBS5LevelViewerProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')

  // Toggle node expansion
  const toggleNode = (code: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(code)) {
      newExpanded.delete(code)
    } else {
      newExpanded.add(code)
    }
    setExpandedNodes(newExpanded)
  }

  // Funnel nodes based on search
  const filteredStructure = useMemo(() => {
    if (!searchTerm) return wbsStructure
    
    const searchLower = searchTerm.toLowerCase()
    
    const filterNodes = (nodes: WBSNode[]): WBSNode[] => {
      return nodes.reduce((acc: WBSNode[], node) => {
        const matchesSearch = 
          node.code.toLowerCase().includes(searchLower) ||
          node.description.toLowerCase().includes(searchLower)
        
        if (matchesSearch) {
          // Include node and all its children
          acc.push(node)
        } else if (node.children && node.children.length > 0) {
          // Check if any children match
          const filteredChildren = filterNodes(node.children)
          if (filteredChildren.length > 0) {
            acc.push({
              ...node,
              children: filteredChildren
            })
          }
        }
        
        return acc
      }, [])
    }
    
    return filterNodes(wbsStructure)
  }, [wbsStructure, searchTerm])

  // Expand all nodes
  const expandAll = () => {
    const allCodes = new Set<string>()
    const collectCodes = (nodes: WBSNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          allCodes.add(node.code)
          collectCodes(node.children)
        }
      })
    }
    collectCodes(wbsStructure)
    setExpandedNodes(allCodes)
  }

  // Collapse all nodes
  const collapseAll = () => {
    setExpandedNodes(new Set())
  }

  const renderNode = (node: WBSNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes.has(node.code)
    
    // Get icon based on level
    const getIcon = () => {
      if (hasChildren && !isExpanded) return <ChevronRight className="h-4 w-4" />
      if (hasChildren && isExpanded) return <ChevronDown className="h-4 w-4" />
      if (node.level === 3) return <Package className="h-3 w-3 text-muted-foreground" />
      if (node.level === 4) return <FolderOpen className="h-3 w-3 text-muted-foreground" />
      if (node.level === 5) return <FileText className="h-3 w-3 text-muted-foreground" />
      return <div className="w-4" />
    }

    return (
      <div key={node.code}>
        <div
          className={cn(
            "flex items-center justify-between py-2 px-3 hover:bg-muted/50 cursor-pointer rounded-md",
            depth > 0 && "ml-4 border-l-2 border-muted"
          )}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
          onClick={() => hasChildren && toggleNode(node.code)}
        >
          <div className="flex items-center gap-2 flex-1">
            {getIcon()}
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs font-mono",
                levelColors[node.level - 1]
              )}
            >
              {node.code}
            </Badge>
            <span className="text-sm">{node.description}</span>
            {node.phase && (
              <Badge variant="secondary" className="text-xs">
                {node.phase}
              </Badge>
            )}
            {node.cost_type && (
              <Badge variant="outline" className="text-xs">
                {node.cost_type}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4">
            {node.children_count > 0 && (
              <span className="text-xs text-muted-foreground">
                {node.children_count} items
              </span>
            )}
            {node.budget_total !== undefined && node.budget_total > 0 && (
              <span className="text-sm font-medium">
                ${node.budget_total.toLocaleString('en-US', { 
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0 
                })}
              </span>
            )}
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // Calculate statistics
  const stats = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]
    let totalBudget = 0
    
    const countNodes = (nodes: WBSNode[]) => {
      nodes.forEach(node => {
        if (node.level >= 1 && node.level <= 5) {
          counts[node.level - 1]++
        }
        if (node.budget_total) {
          totalBudget += node.budget_total
        }
        if (node.children) {
          countNodes(node.children)
        }
      })
    }
    
    countNodes(wbsStructure)
    
    return { counts, totalBudget }
  }, [wbsStructure])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search WBS codes or descriptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-primary hover:underline"
          >
            Expand All
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            onClick={collapseAll}
            className="text-sm text-primary hover:underline"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Level Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {levelNames.map((name, idx) => (
          <Card key={idx} className="p-3">
            <div className="text-xs text-muted-foreground">{name}</div>
            <div className="text-lg font-semibold">{stats.counts[idx]}</div>
            <Badge 
              variant="outline" 
              className={cn("text-xs mt-1", levelColors[idx])}
            >
              Level {idx + 1}
            </Badge>
          </Card>
        ))}
      </div>

      {/* WBS Tree */}
      <Card className="p-4">
        <div className="space-y-1">
          {filteredStructure.length > 0 ? (
            filteredStructure.map(node => renderNode(node))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              {searchTerm ? 'No matching WBS codes found' : 'No WBS structure available'}
            </div>
          )}
        </div>
      </Card>

      {/* Total Budget */}
      {stats.totalBudget > 0 && (
        <div className="text-right">
          <span className="text-sm text-muted-foreground">Total Budget: </span>
          <span className="text-lg font-semibold">
            ${stats.totalBudget.toLocaleString('en-US', { 
              minimumFractionDigits: 2,
              maximumFractionDigits: 2 
            })}
          </span>
        </div>
      )}
    </div>
  )
}