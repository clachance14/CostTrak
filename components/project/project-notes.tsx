'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Edit, Save, X, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { useUser } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

interface ProjectNote {
  id: string
  content: string
  created_at: string
  created_by: {
    id: string
    first_name: string
    last_name: string
  }
  note_type: 'general' | 'cost_to_complete' | 'risk' | 'schedule'
}

interface ProjectNotesProps {
  notes: ProjectNote[]
  canEdit: boolean
  onNoteAdded?: (note: Partial<ProjectNote>) => void
  onNoteUpdated?: (noteId: string, content: string) => void
  className?: string
}

export function ProjectNotes({
  notes,
  canEdit,
  onNoteAdded,
  onNoteUpdated,
  className
}: ProjectNotesProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newNote, setNewNote] = useState('')
  const [editContent, setEditContent] = useState('')
  const [noteType, setNoteType] = useState<ProjectNote['note_type']>('general')
  const { data: user } = useUser()

  const handleAddNote = async () => {
    if (!newNote.trim() || !onNoteAdded) return

    await onNoteAdded({
      content: newNote,
      note_type: noteType,
      created_by: user ? {
        id: user.id,
        first_name: user.first_name || '',
        last_name: user.last_name || ''
      } : undefined
    })

    setNewNote('')
    setIsAdding(false)
    setNoteType('general')
  }

  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim() || !onNoteUpdated) return

    await onNoteUpdated(noteId, editContent)
    setEditingId(null)
    setEditContent('')
  }

  const getNoteTypeColor = (type: ProjectNote['note_type']) => {
    switch (type) {
      case 'cost_to_complete':
        return 'bg-blue-100 text-blue-800'
      case 'risk':
        return 'bg-red-100 text-red-800'
      case 'schedule':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getNoteTypeLabel = (type: ProjectNote['note_type']) => {
    switch (type) {
      case 'cost_to_complete':
        return 'Cost to Complete'
      case 'risk':
        return 'Risk'
      case 'schedule':
        return 'Schedule'
      default:
        return 'General'
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Project Notes
          </CardTitle>
          {canEdit && !isAdding && (
            <Button
              size="sm"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isAdding && (
          <div className="mb-4 p-4 border rounded-lg bg-gray-50">
            <div className="space-y-3">
              <div className="flex gap-2">
                {(['general', 'cost_to_complete', 'risk', 'schedule'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setNoteType(type)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      noteType === type
                        ? getNoteTypeColor(type)
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    )}
                  >
                    {getNoteTypeLabel(type)}
                  </button>
                ))}
              </div>
              <Textarea
                placeholder="Add a project note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                className="bg-white"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false)
                    setNewNote('')
                    setNoteType('general')
                  }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNote.trim()}
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save Note
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {notes.length === 0 && !isAdding ? (
            <p className="text-gray-500 text-center py-8">
              No project notes yet. {canEdit && 'Add one to provide context and updates.'}
            </p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      getNoteTypeColor(note.note_type)
                    )}>
                      {getNoteTypeLabel(note.note_type)}
                    </span>
                    <span className="text-sm text-gray-600">
                      {note.created_by.first_name} {note.created_by.last_name}
                    </span>
                    <span className="text-sm text-gray-400">•</span>
                    <span className="text-sm text-gray-600">
                      {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  {canEdit && user?.id === note.created_by.id && editingId !== note.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(note.id)
                        setEditContent(note.content)
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null)
                          setEditContent('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateNote(note.id)}
                        disabled={!editContent.trim()}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}