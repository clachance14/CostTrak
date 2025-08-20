'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { UserFormDialog } from '@/components/users/user-form-dialog'
import { PasswordResetDialog } from '@/components/users/password-reset-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  RefreshCw,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useUser } from '@/hooks/use-auth'

interface UserData {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  created_at: string
  last_login_at: string | null
  is_active: boolean
  force_password_change: boolean
  invite_status?: string
  invited_at?: string
  accepted_at?: string | null
}

const roleLabels: Record<string, string> = {
  controller: 'Controller',
  executive: 'Executive',
  ops_manager: 'Operations Manager',
  project_manager: 'Project Manager',
  accounting: 'Accounting',
  viewer: 'Viewer',
}

const roleColors: Record<string, string> = {
  controller: 'bg-purple-100 text-purple-800',
  executive: 'bg-blue-100 text-blue-800',
  ops_manager: 'bg-green-100 text-green-800',
  project_manager: 'bg-yellow-100 text-yellow-800',
  accounting: 'bg-orange-100 text-orange-800',
  viewer: 'bg-gray-100 text-gray-800',
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [selectedUserForReset, setSelectedUserForReset] = useState<UserData | null>(null)
  const [resendingInvite, setResendingInvite] = useState<string | null>(null)
  const { data: user } = useUser()
  const { toast } = useToast()
  const router = useRouter()

  // Check if current user is a project manager
  const isProjectManager = user?.role === 'project_manager'

  useEffect(() => {
    fetchUsers()
  }, [])

  useEffect(() => {
    // Filter users based on search term
    const filtered = users.filter(
      (user) =>
        user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredUsers(filtered)
  }, [searchTerm, users])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users')
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      const data = await response.json()
      setUsers(data.users)
      setFilteredUsers(data.users)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const resendInvite = async (userId: string) => {
    setResendingInvite(userId)
    try {
      const response = await fetch('/api/auth/resend-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to resend invite')
      }

      toast({
        title: 'Success',
        description: result.message,
      })

      // Refresh user list
      fetchUsers()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to resend invite',
        variant: 'destructive',
      })
    } finally {
      setResendingInvite(null)
    }
  }

  const getStatusIcon = (user: UserData) => {
    // Consider users with profiles as active even if last_login_at is null
    // This handles existing users from before login tracking was added
    if (user.last_login_at || user.created_at) {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    }
    if (user.invite_status === 'pending') {
      return <Clock className="h-4 w-4 text-yellow-600" />
    }
    if (user.invite_status === 'expired') {
      return <XCircle className="h-4 w-4 text-red-600" />
    }
    return <AlertCircle className="h-4 w-4 text-gray-400" />
  }

  const getStatusLabel = (user: UserData) => {
    // Consider users with profiles as active even if last_login_at is null
    // This handles existing users from before login tracking was added
    if (user.last_login_at) {
      return 'Active'
    }
    if (user.created_at && !user.invite_status) {
      // User has a profile but no login timestamp - likely an existing user
      return 'Active (Legacy)'
    }
    if (user.invite_status === 'pending') {
      return 'Invite Pending'
    }
    if (user.invite_status === 'expired') {
      return 'Invite Expired'
    }
    return 'Not Activated'
  }

  if (!isProjectManager) {
    return (
      <div className="container mx-auto py-10">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access user management. Only project managers can manage users.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage user accounts, roles, and permissions
        </p>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <User className="h-4 w-4 mr-2 text-muted-foreground" />
                      {user.first_name} {user.last_name}
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge className={roleColors[user.role] || 'bg-gray-100 text-gray-800'}>
                      {roleLabels[user.role] || user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(user)}
                      <span className="text-sm">{getStatusLabel(user)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.last_login_at ? (
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true })}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {user.invite_status === 'pending' && (
                          <DropdownMenuItem
                            onClick={() => resendInvite(user.id)}
                            disabled={resendingInvite === user.id}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            {resendingInvite === user.id ? (
                              <>
                                <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              'Resend Invite'
                            )}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            toast({
                              title: 'Coming Soon',
                              description: 'User editing functionality will be available soon',
                            })
                          }}
                        >
                          Edit User
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUserForReset(user)
                            setShowResetDialog(true)
                          }}
                        >
                          Reset Password
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <UserFormDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={fetchUsers}
      />

      <PasswordResetDialog
        open={showResetDialog}
        onOpenChange={(open) => {
          setShowResetDialog(open)
          if (!open) {
            setSelectedUserForReset(null)
          }
        }}
        user={selectedUserForReset}
      />
    </div>
  )
}