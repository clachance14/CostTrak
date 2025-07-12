# Testing Guide for CostTrak

## Overview

This guide provides comprehensive test scenarios for validating the CostTrak application functionality, security, and user experience. Tests are organized by feature area and include both happy path and edge cases.

## Test Environment Setup

### Prerequisites
1. Supabase local instance running with test data
2. All test user accounts created (see setup-test-users.sql)
3. Environment variables configured
4. Development server running on http://localhost:3000

### Test Users

| Role | Email | Password | Test Focus |
|------|-------|----------|------------|
| Controller | controller@ics.ac | Test123!@# | Full access, user management |
| Executive | executive@ics.ac | Test123!@# | Read-only, dashboards |
| Ops Manager | opsmanager@ics.ac | Test123!@# | All divisions access |
| Project Manager 1 | pm1@ics.ac | Test123!@# | Own projects only |
| Project Manager 2 | pm2@ics.ac | Test123!@# | Own projects only |
| Accounting | accounting@ics.ac | Test123!@# | Financial data access |
| Viewer | viewer@ics.ac | Test123!@# | Specific project access |

## Authentication Testing

### Login Flow

#### Test Case: Valid Login
1. Navigate to `/login`
2. Enter valid credentials (e.g., controller@ics.ac / Test123!@#)
3. Click "Sign In"
4. **Expected**: Redirect to `/dashboard`

#### Test Case: Invalid Email Domain
1. Navigate to `/login`
2. Enter email: user@gmail.com
3. **Expected**: Error message "Email must be from @ics.ac domain"

#### Test Case: Invalid Credentials
1. Navigate to `/login`
2. Enter valid email, wrong password
3. **Expected**: Error message "Invalid credentials"

#### Test Case: Empty Fields
1. Navigate to `/login`
2. Click "Sign In" without entering data
3. **Expected**: Field validation errors

### Route Protection

#### Test Case: Unauthorized Access
1. Without logging in, navigate to `/projects`
2. **Expected**: Redirect to `/login`

#### Test Case: Role-based Access
1. Login as viewer@ics.ac
2. Navigate to `/controller`
3. **Expected**: Redirect to `/unauthorized`

## Projects CRUD Testing

### Create Project

#### Test Case: Valid Project Creation (Controller)
1. Login as controller@ics.ac
2. Navigate to `/projects`
3. Click "New Project"
4. Fill in all required fields:
   - Job Number: 2024-100
   - Name: Test Project
   - Client: Select from dropdown
   - Division: Select from dropdown
   - Project Manager: Select from dropdown
   - Contract Amount: 1000000
   - Start Date: Today
   - End Date: 6 months from today
   - Status: Planning
5. Click "Create Project"
6. **Expected**: 
   - Success message
   - Redirect to project detail page
   - Project appears in list

#### Test Case: Duplicate Job Number
1. Create project with job number "2024-001" (already exists)
2. **Expected**: Error "Job number already exists"

#### Test Case: Permission Denied (Viewer)
1. Login as viewer@ics.ac
2. Navigate to `/projects`
3. **Expected**: No "New Project" button visible

#### Test Case: Validation Errors
1. As controller, go to create project
2. Test each validation:
   - Empty job number → "Job number is required"
   - Empty name → "Project name is required"
   - No client selected → "Please select a client"
   - Negative contract → Should not allow negative input
   - End date before start date → Should not allow selection
   - State > 2 chars → Should limit input

### Edit Project

#### Test Case: Valid Edit (Project Manager - Own Project)
1. Login as pm1@ics.ac
2. Navigate to project managed by PM1
3. Click "Edit"
4. Change project name and status
5. Save changes
6. **Expected**: 
   - Success message
   - Changes reflected on detail page

#### Test Case: Edit Permission Denied (Wrong PM)
1. Login as pm2@ics.ac
2. Navigate to project managed by PM1
3. **Expected**: No "Edit" button visible

#### Test Case: Partial Update
1. As controller, edit project
2. Change only the status field
3. Save
4. **Expected**: Only status updated, other fields unchanged

### Delete Project

#### Test Case: Soft Delete (Controller Only)
1. Login as controller@ics.ac
2. Navigate to project detail
3. Click "Delete"
4. Confirm deletion
5. **Expected**:
   - Success message
   - Project removed from active list
   - Project status changed to "cancelled" in database

#### Test Case: Delete Permission Denied
1. Login as any non-controller role
2. Navigate to project detail
3. **Expected**: No "Delete" button visible

### List Projects

#### Test Case: Pagination
1. Ensure > 20 projects in database
2. Navigate to `/projects`
3. **Expected**: 
   - Shows 20 projects
   - Pagination controls visible
   - Can navigate between pages

#### Test Case: Search
1. Navigate to `/projects`
2. Search for "Acme" (in project name)
3. **Expected**: Only projects with "Acme" in name shown
4. Search for "2024-001" (job number)
5. **Expected**: Specific project shown

#### Test Case: Status Filter
1. Navigate to `/projects`
2. Select "Active" from status filter
3. **Expected**: Only active projects shown
4. Select "Planning"
5. **Expected**: Only planning projects shown

#### Test Case: Division Filter
1. Navigate to `/projects`
2. Select "Northern" division
3. **Expected**: Only Northern division projects shown

#### Test Case: Combined Filters
1. Apply status "Active" AND division "Northern"
2. **Expected**: Only active Northern projects shown

#### Test Case: Empty State
1. Apply filters that match no projects
2. **Expected**: "No projects found" message

### Project Detail View

#### Test Case: Authorized Access
1. Login as pm1@ics.ac
2. Navigate to own project detail
3. **Expected**: 
   - All project info displayed
   - Financial summary visible
   - Recent activity shown

#### Test Case: 404 Error
1. Navigate to `/projects/invalid-uuid`
2. **Expected**: "Project not found" error

## Permission Matrix Testing

### Controller Role
- ✓ Create projects
- ✓ Edit any project
- ✓ Delete projects
- ✓ View all projects
- ✓ Create users

### Executive Role
- ✗ Create projects
- ✗ Edit projects
- ✗ Delete projects
- ✓ View all projects
- ✗ Create users

### Ops Manager Role
- ✓ Create projects
- ✓ Edit any project
- ✗ Delete projects
- ✓ View all projects (all divisions)
- ✗ Create users

### Project Manager Role
- ✗ Create projects
- ✓ Edit own projects only
- ✗ Delete projects
- ✓ View own projects only
- ✗ Create users

### Accounting Role
- ✗ Create projects
- ✗ Edit projects
- ✗ Delete projects
- ✓ View all projects (financial data)
- ✗ Create users

### Viewer Role
- ✗ Create projects
- ✗ Edit projects
- ✗ Delete projects
- ✓ View specific projects only
- ✗ Create users

## Error State Testing

### Network Errors
1. Disable network
2. Try to load projects
3. **Expected**: Error message with retry option

### Loading States
1. Slow network simulation
2. Navigate between pages
3. **Expected**: Loading indicators shown

### Form Errors
1. Submit form with validation errors
2. **Expected**: 
   - Field-level error messages
   - Form remains populated
   - Focus on first error field

## API Testing

### Projects Endpoints

#### GET /api/projects
```bash
# Test pagination
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/projects?page=2&limit=10"

# Test filters
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/projects?status=active&division_id=$DIV_ID"

# Test search
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/projects?search=acme"
```

#### POST /api/projects
```bash
# Valid creation
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"job_number":"2024-200","name":"API Test Project","client_id":"...","division_id":"...","project_manager_id":"...","original_contract":1000000,"start_date":"2024-01-01T00:00:00Z","end_date":"2024-12-31T00:00:00Z","status":"planning"}' \
  http://localhost:3000/api/projects

# Test validation errors
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Missing Required Fields"}' \
  http://localhost:3000/api/projects
```

#### PATCH /api/projects/:id
```bash
# Partial update
curl -X PATCH -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"active","name":"Updated Project Name"}' \
  http://localhost:3000/api/projects/$PROJECT_ID
```

#### DELETE /api/projects/:id
```bash
# Soft delete (controller only)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/projects/$PROJECT_ID
```

## Performance Testing

### List View Performance
1. Create 100+ projects
2. Load projects list
3. **Expected**: 
   - Page loads < 2 seconds
   - Smooth scrolling
   - Pagination works quickly

### Search Performance
1. With 100+ projects
2. Type in search box
3. **Expected**: 
   - Debounced search (300ms delay)
   - Results update smoothly

## Accessibility Testing

### Keyboard Navigation
1. Tab through all form fields
2. **Expected**: 
   - Logical tab order
   - Focus indicators visible
   - Can submit with Enter key

### Screen Reader
1. Use screen reader on forms
2. **Expected**: 
   - Labels read correctly
   - Error messages announced
   - Success messages announced

## Security Testing

### SQL Injection
1. In search box, enter: `'; DROP TABLE projects; --`
2. **Expected**: Treated as literal search string

### XSS Prevention
1. Create project with name: `<script>alert('XSS')</script>`
2. **Expected**: Displayed as plain text

### Authorization Bypass
1. As viewer, try direct API calls to create project
2. **Expected**: 403 Forbidden response

## Regression Testing Checklist

Before each release, verify:

- [ ] All user roles can login
- [ ] Projects list loads and paginates
- [ ] Search and filters work
- [ ] Create project (authorized roles)
- [ ] Edit project (authorized roles)
- [ ] Delete project (controller only)
- [ ] Project detail view loads
- [ ] Form validation works
- [ ] Error states display correctly
- [ ] Loading states display correctly
- [ ] TypeScript compilation passes
- [ ] ESLint passes
- [ ] No console errors in browser

## Automated Testing (Future)

### Unit Tests
- Validation schemas
- Utility functions
- API route handlers

### Integration Tests
- Database operations
- Authentication flow
- API endpoints

### E2E Tests
- User journeys
- Critical paths
- Cross-browser testing

## Bug Reporting

When reporting bugs, include:
1. User role and email
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Browser and OS
6. Console errors
7. Network requests
8. Screenshots