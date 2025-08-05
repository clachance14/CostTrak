# Project Delete Functionality

## Overview

This document describes the delete functionality added to the CostTrak project management system.

## Features Added

### 1. Soft Delete
- **Description**: Marks a project as deleted by setting `deleted_at` timestamp and status to 'cancelled'
- **Access**: Controllers only
- **Data Preservation**: All project data is preserved and can be restored if needed
- **UI Location**: Available in dropdown menu on project detail and list pages

### 2. Hard Delete  
- **Description**: Permanently removes a project and all related data from the database
- **Access**: Controllers only
- **Confirmation**: Requires typing a confirmation code
- **Preview**: Shows affected records before deletion
- **Options**: Can choose to delete or preserve file attachments

## Components Created

### `/components/project/soft-delete-dialog.tsx`
- Confirmation dialog for soft delete operation
- Shows project details (job number, name)
- Explains that project will be archived
- Success notification on completion

### `/components/project/hard-delete-dialog.tsx`
- Already existed in codebase
- Shows detailed preview of affected records
- Requires confirmation code
- Option to delete attachments
- Comprehensive error handling

## UI Updates

### Project Overview Page (`/app/(dashboard)/projects/[id]/overview/page.tsx`)
- Added "More Actions" dropdown menu (⋯ icon)
- Located next to Edit/Team/Export buttons
- Contains:
  - Delete Project (soft delete)
  - Permanently Delete (hard delete)
- Only visible to controllers

### Projects List Page (`/app/(dashboard)/projects/page.tsx`)
- Added dropdown menu in actions column (table view)
- Added dropdown menu in card actions (card view)
- Same delete options as detail page
- Only visible to controllers

## API Endpoints Used

### Soft Delete: `DELETE /api/projects/[id]`
- Sets `deleted_at` timestamp
- Changes status to 'cancelled'
- Returns success message

### Hard Delete Preview: `GET /api/projects/[id]/hard-delete`
- Returns count of affected records
- Generates confirmation code
- Shows what will be deleted

### Hard Delete Execute: `POST /api/projects/[id]/hard-delete`
- Requires confirmation code
- Permanently deletes all related data
- Optional attachment deletion
- Comprehensive transaction handling

## Usage Instructions

1. **For Controllers**:
   - Navigate to any project detail page or projects list
   - Click the "⋯" (More Actions) button
   - Select "Delete Project" for soft delete
   - Select "Permanently Delete" for hard delete
   - Follow dialog prompts to confirm

2. **For Other Roles**:
   - Delete functionality is not visible
   - API endpoints return 403 Forbidden if accessed

## Security Considerations

- Role-based access control enforced at API level
- Soft delete preserves audit trail
- Hard delete requires explicit confirmation
- All deletions are logged in audit tables
- Comprehensive error handling prevents partial deletions

## Future Enhancements

1. Add ability to restore soft-deleted projects
2. Add bulk delete functionality
3. Add delete reason/notes field
4. Email notifications for deletions
5. Scheduled cleanup of old soft-deleted projects