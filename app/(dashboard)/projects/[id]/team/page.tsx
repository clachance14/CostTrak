'use client'

import { use, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft,
  Trash2,
  Edit2,
  UserPlus,
  Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { useUser } from '@/hooks/use-auth'
import { format } from 'date-fns'

interface TeamManagementPageProps {
  params: Promise<{ id: string }>
}

interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  is_active: boolean
}

interface ProjectAssignment {
  id: string
  project_id: string
  user_id: string
  role: 'primary_pm' | 'delegate_pm' | 'viewer'
  permissions: Record<string, boolean>
  assigned_by: string
  assigned_at: string
  expires_at: string | null
  notes: string | null
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
    role: string
  }
  assigned_by_user: {
    id: string
    email: string
    first_name: string
    last_name: string
  }
}

const PERMISSION_LABELS: Record<string, string> = {
  view_project: 'View Project',
  edit_project: 'Edit Project Details',
  import_budget: 'Import Budget Breakdowns',
  import_po: 'Import Purchase Orders',
  import_labor: 'Import Labor Data',
  manage_team: 'Manage Team Members'
}

const ASSIGNMENT_ROLE_LABELS: Record<string, string> = {
  primary_pm: 'Primary PM',
  delegate_pm: 'Delegated PM',
  viewer: 'Viewer'
}

export default function TeamManagementPage({ params }: TeamManagementPageProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: user } = useUser()
  const { id: projectId } = use(params)
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<ProjectAssignment | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<'delegate_pm' | 'viewer'>('viewer')
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, boolean>>({
    view_project: true,
    edit_project: false,
    import_budget: false,
    import_po: false,
    import_labor: false,
    manage_team: false
  })
  const [notes, setNotes] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Fetch project details
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}`)
      if (!response.ok) throw new Error('Failed to fetch project')
      const data = await response.json()
      return data.project
    }
  })

  // Fetch project assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery<ProjectAssignment[]>({
    queryKey: ['project-assignments', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/assignments`)
      if (!response.ok) throw new Error('Failed to fetch assignments')
      return response.json()
    }
  })

  // Fetch available users
  const { data: availableUsers = [] } = useQuery<User[]>({
    queryKey: ['available-users'],
    queryFn: async () => {
      const response = await fetch('/api/users')
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      // Filter out users already assigned and the current project manager
      const assignedUserIds = assignments.map((a) => a.user_id)
      return data.users.filter((u: User) => 
        !assignedUserIds.includes(u.id) && 
        u.id !== project?.project_manager_id &&
        u.is_active
      )
    },
    enabled: !!project && !!assignments
  })

  // Check if current user can manage team
  const canManageTeam = user && (
    user.role === 'controller' || 
    project?.project_manager_id === user.id
  )

  // Create assignment mutation
  const createAssignment = useMutation({
    mutationFn: async (data: {
      user_id: string;
      role: string;
      permissions: Record<string, boolean>;
      notes?: string;
    }) => {
      const response = await fetch(`/api/projects/${projectId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create assignment')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assignments', projectId] })
      queryClient.invalidateQueries({ queryKey: ['available-users'] })
      setIsAddDialogOpen(false)
      resetForm()
    }
  })

  // Update assignment mutation
  const updateAssignment = useMutation({
    mutationFn: async ({ assignmentId, data }: { assignmentId: string, data: {
      role?: string;
      permissions?: Record<string, boolean>;
      notes?: string;
    } }) => {
      const response = await fetch(`/api/projects/${projectId}/assignments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, ...data })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update assignment')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assignments', projectId] })
      setEditingAssignment(null)
      resetForm()
    }
  })

  // Delete assignment mutation
  const deleteAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const response = await fetch(`/api/projects/${projectId}/assignments?assignmentId=${assignmentId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete assignment')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assignments', projectId] })
      queryClient.invalidateQueries({ queryKey: ['available-users'] })
      setDeleteConfirmId(null)
    }
  })

  const resetForm = () => {
    setSelectedUserId('')
    setSelectedRole('viewer')
    setSelectedPermissions({
      view_project: true,
      edit_project: false,
      import_budget: false,
      import_po: false,
      import_labor: false,
      manage_team: false
    })
    setNotes('')
  }

  const handleEditClick = (assignment: ProjectAssignment) => {
    setEditingAssignment(assignment)
    setSelectedRole(assignment.role === 'primary_pm' ? 'delegate_pm' : assignment.role)
    setSelectedPermissions(assignment.permissions as Record<string, boolean>)
    setNotes(assignment.notes || '')
  }

  const handleSubmit = () => {
    if (editingAssignment) {
      updateAssignment.mutate({
        assignmentId: editingAssignment.id,
        data: {
          role: selectedRole,
          permissions: selectedPermissions,
          notes
        }
      })
    } else {
      createAssignment.mutate({
        user_id: selectedUserId,
        role: selectedRole,
        permissions: selectedPermissions,
        notes
      })
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'primary_pm': return 'bg-purple-100 text-purple-800'
      case 'delegate_pm': return 'bg-blue-100 text-blue-800'
      case 'viewer': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/projects/${projectId}/overview`)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Team Management</h1>
            <p className="text-foreground/80">
              {project?.job_number} - {project?.name}
            </p>
          </div>
        </div>
        {canManageTeam && (
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Team Member
          </Button>
        )}
      </div>

      {/* Project Manager Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Project Manager</CardTitle>
        </CardHeader>
        <CardContent>
          {project?.project_manager ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {project.project_manager.first_name} {project.project_manager.last_name}
                </p>
                <p className="text-sm text-foreground/60">{project.project_manager.email}</p>
              </div>
              <Badge className="bg-purple-100 text-purple-800">Primary PM</Badge>
            </div>
          ) : (
            <p className="text-foreground/60">No project manager assigned</p>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {assignmentsLoading ? (
            <div className="text-center py-8">
              <p className="text-foreground/60">Loading team members...</p>
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-foreground/60">No team members assigned</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <p className="font-medium">
                          {assignment.user.first_name} {assignment.user.last_name}
                        </p>
                        <Badge className={getRoleBadgeColor(assignment.role)}>
                          {ASSIGNMENT_ROLE_LABELS[assignment.role]}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground/60">{assignment.user.email}</p>
                      
                      {/* Permissions */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {Object.entries(assignment.permissions)
                          .filter(([, hasPermission]) => hasPermission)
                          .map(([perm]) => (
                            <Badge key={perm} variant="outline" className="text-xs">
                              {PERMISSION_LABELS[perm] || perm}
                            </Badge>
                          ))}
                      </div>
                      
                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-foreground/60 mt-2">
                        <span>
                          Assigned by {assignment.assigned_by_user.first_name} {assignment.assigned_by_user.last_name}
                        </span>
                        <span>
                          {format(new Date(assignment.assigned_at), 'MMM d, yyyy')}
                        </span>
                        {assignment.expires_at && (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <Clock className="h-3 w-3" />
                            Expires {format(new Date(assignment.expires_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                      
                      {assignment.notes && (
                        <p className="text-sm text-foreground/60 mt-2 italic">
                          Note: {assignment.notes}
                        </p>
                      )}
                    </div>
                    
                    {canManageTeam && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(assignment)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(assignment.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Assignment Dialog */}
      <Dialog open={isAddDialogOpen || !!editingAssignment} onOpenChange={(open) => {
        if (!open) {
          setIsAddDialogOpen(false)
          setEditingAssignment(null)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAssignment ? 'Edit Team Member' : 'Add Team Member'}
            </DialogTitle>
            <DialogDescription>
              {editingAssignment 
                ? 'Update permissions for this team member'
                : 'Grant access to this project for a team member'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* User Selection (only for new assignments) */}
            {!editingAssignment && (
              <div className="space-y-2">
                <Label htmlFor="user">User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as 'delegate_pm' | 'viewer')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delegate_pm">Delegated PM</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Permissions */}
            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="space-y-2 border rounded-lg p-4">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={selectedPermissions[key] || false}
                      onCheckedChange={(checked) => 
                        setSelectedPermissions(prev => ({ ...prev, [key]: !!checked }))
                      }
                      disabled={key === 'view_project'} // Always required
                    />
                    <Label htmlFor={key} className="font-normal cursor-pointer">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this assignment..."
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false)
                setEditingAssignment(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={(!editingAssignment && !selectedUserId) || 
                       createAssignment.isPending || 
                       updateAssignment.isPending}
            >
              {editingAssignment ? 'Update' : 'Add'} Team Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this team member from the project? 
              They will lose all access to this project.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirmId && deleteAssignment.mutate(deleteConfirmId)}
              disabled={deleteAssignment.isPending}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}