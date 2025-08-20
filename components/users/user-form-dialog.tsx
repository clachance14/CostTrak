'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { userRegistrationSchema } from '@/lib/validations/auth'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Copy, Mail, Key, CheckCircle, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type FormData = z.infer<typeof userRegistrationSchema>

interface UserFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function UserFormDialog({ open, onOpenChange, onSuccess }: UserFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [creationResult, setCreationResult] = useState<{
    success: boolean
    message: string
    temporaryPassword?: string
  } | null>(null)
  const { toast } = useToast()

  const form = useForm<FormData>({
    resolver: zodResolver(userRegistrationSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      role: 'project_manager',
      creation_method: 'invite',
      password: undefined,
    },
  })

  const creationMethod = form.watch('creation_method')

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    setCreationResult(null)

    try {
      const response = await fetch('/api/auth/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user')
      }

      setCreationResult({
        success: true,
        message: result.message,
        temporaryPassword: result.temporary_password,
      })

      if (!result.temporary_password) {
        // If no temporary password, close dialog after showing success
        setTimeout(() => {
          onOpenChange(false)
          onSuccess?.()
          form.reset()
          setCreationResult(null)
        }, 3000)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create user'
      setCreationResult({
        success: false,
        message,
      })
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copied',
      description: 'Password copied to clipboard',
    })
  }

  const handleClose = () => {
    if (!creationResult?.temporaryPassword) {
      onOpenChange(false)
      form.reset()
      setCreationResult(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account. You can either send an email invitation or set a temporary password.
          </DialogDescription>
        </DialogHeader>

        {creationResult ? (
          <div className="space-y-4 py-4">
            {creationResult.success ? (
              <>
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Success!</AlertTitle>
                  <AlertDescription>{creationResult.message}</AlertDescription>
                </Alert>

                {creationResult.temporaryPassword && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <Key className="h-4 w-4 text-orange-600" />
                    <AlertTitle className="text-orange-900">Temporary Password</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <div className="font-mono text-lg bg-white p-3 rounded border">
                        {creationResult.temporaryPassword}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(creationResult.temporaryPassword!)}
                        className="w-full"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Password
                      </Button>
                      <p className="text-sm text-orange-800 mt-2">
                        Please share this password securely with the user. They will be required to change it on first login.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{creationResult.message}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  form.reset()
                  setCreationResult(null)
                  if (creationResult.success) {
                    onSuccess?.()
                  }
                }}
              >
                {creationResult.temporaryPassword ? 'Close' : 'OK'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="user@ics.ac" {...field} />
                    </FormControl>
                    <FormDescription>Must be an @ics.ac email address</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="controller">Controller</SelectItem>
                        <SelectItem value="executive">Executive</SelectItem>
                        <SelectItem value="ops_manager">Operations Manager</SelectItem>
                        <SelectItem value="project_manager">Project Manager</SelectItem>
                        <SelectItem value="accounting">Accounting</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="creation_method"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Creation Method</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-2"
                      >
                        <div className="flex items-start space-x-3">
                          <RadioGroupItem value="invite" id="invite" className="mt-1" />
                          <label htmlFor="invite" className="cursor-pointer">
                            <div className="font-medium flex items-center">
                              <Mail className="h-4 w-4 mr-2" />
                              Send Email Invitation
                            </div>
                            <p className="text-sm text-muted-foreground">
                              User will receive an email to set their own password (Recommended)
                            </p>
                          </label>
                        </div>
                        <div className="flex items-start space-x-3">
                          <RadioGroupItem value="password" id="password" className="mt-1" />
                          <label htmlFor="password" className="cursor-pointer">
                            <div className="font-medium flex items-center">
                              <Key className="h-4 w-4 mr-2" />
                              Generate Temporary Password
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Create account with a temporary password you can share
                            </p>
                          </label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {creationMethod === 'password' && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Password (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Leave blank to auto-generate"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        If left blank, a secure password will be generated automatically
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose()}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}