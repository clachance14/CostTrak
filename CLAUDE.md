Architecture Overview
CostTrak is an internal financial tracking system for industrial construction projects built with:

Frontend: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
Backend: Supabase (PostgreSQL + Auth + Realtime)
UI Components: Radix UI (@radix-ui/react-*), shadcn/ui components
Form Handling: react-hook-form, zod (validation)
State Management: @tanstack/react-query (TanStack Query)
Icons & Visualization: lucide-react, recharts
File Handling: xlsx (Excel import/export), react-dropzone
Date/Time: date-fns
Security: argon2 (password hashing), speakeasy (2FA)
Notifications: sonner (toast notifications)
Database Schema
Core tables with Row Level Security (RLS):

profiles: User profiles with role-based access (controller, executive, ops_manager, project_manager, accounting, viewer)
projects: Central entity with job_number as unique identifier
purchase_orders & po_line_items: Track committed costs
change_orders: Contract modifications with approval workflow
financial_snapshots: Pre-calculated metrics for performance dashboards
labor_actuals: Weekly actual labor costs and hours by craft type
labor_headcount_forecasts: Future headcount projections
craft_types: Labor categories (direct, indirect, staff)
documents: File management with categories (general, safety, financial, legal, technical, other)
notifications: User notification system with read/archived status
Key Business Rules
Email Domain: Only @ics.ac emails allowed (enforced at database level)
Job Numbers: Unique project identifiers, must be preserved during imports
Access Control: Division-based for ops managers, project-based for PMs
Financial Calculations: Revised contract = original + approved change orders
Soft Deletes: Use status fields, never hard delete
Environment Variables
Required in .env.local:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=ics.ac
Development Patterns
Type Safety: Generate types from database schema when schema changes
RLS Policies: All database access must respect row-level security
Audit Trail: Use audit_log table for tracking sensitive changes
Performance: Use financial_snapshots for dashboard queries
Excel Import: Preserve legacy PO numbers and job numbers during import
API Patterns:
Use Zod schemas for request/response validation
Implement consistent error handling with proper HTTP status codes
Use React Query for client-side data fetching and caching
Apply rate limiting on sensitive endpoints
Component Architecture:
Use shadcn/ui components with Radix UI primitives
Implement variant system for component styling (size, variant props)
Follow compound component pattern for complex UI elements
Form Handling:
Use react-hook-form with Zod validation
Implement progressive enhancement for forms
Show loading states during async operations
Security Best Practices:
Use Argon2 for password hashing (via Supabase auth)
Implement CSRF protection via SameSite cookies
Validate all user inputs on both client and server
Never expose sensitive data in client-side code
State Management:
Use React Query for server state
Use React Context for global UI state
Implement optimistic updates for better UX
Cache API responses appropriately
Current Features
Authentication:
Email/password login with @ics.ac domain restriction
Role-based access control
Protected routes via middleware
Two-factor authentication (2FA) support
Password reset functionality
Projects CRUD:
List view with search, status, and division filters
Create/Edit forms with validation
Detail view with financial summary
Soft delete capability (controllers only)
Bulk actions support
Purchase Orders:
CSV import from ICS PO system
PO tracking with line items
Forecast management
Advanced filtering and sorting
Export to Excel functionality
Change Orders:
Create and approve change orders
Approval workflow by role
Impact on contract values
Audit trail
Attachment support
Labor Forecasts (Headcount-based Model):
Weekly actual cost/hours entry
Running average rate calculations
Headcount-based future projections
Labor analytics dashboard
Categories: Direct, Indirect, Staff
Craft type management
Financial Integration:
Comprehensive project financial summary
Real-time budget tracking
Variance analysis and alerts
Profitability projections
Financial snapshots for performance
Document Management:
File upload and storage
Category-based organization
Project-linked documents
Access control by role
Preview and download capabilities
Notification System:
Real-time notifications
Email notifications
In-app notification center
Mark as read/archived
Notification preferences
Dashboard System:
Company-wide dashboard
Division-level analytics
Project-specific dashboards
Key performance indicators
Interactive charts and graphs
API Endpoints
Authentication:

/api/auth/login - User login with email/password
/api/auth/logout - User logout
/api/auth/session - Get current session
/api/auth/password-reset - Password reset flow
/api/auth/2fa/setup - Setup two-factor authentication
/api/auth/2fa/verify - Verify 2FA token
/api/auth/create-user - Create new users (controllers only)
Projects:

/api/projects - List and create projects
/api/projects/[id] - Get, update, delete single project
/api/projects/[id]/financial-summary - Get comprehensive financial data
/api/projects/[id]/documents - List project documents
/api/projects/[id]/labor-summary - Get labor analytics for project
Purchase Orders:

/api/purchase-orders - List and create POs
/api/purchase-orders/[id] - Get, update single PO
/api/purchase-orders/[id]/line-items - Manage PO line items
/api/purchase-orders/import - Import from CSV
/api/purchase-orders/export - Export to Excel
Change Orders:

/api/change-orders - List and create COs
/api/change-orders/[id] - Get, update, approve COs
/api/change-orders/[id]/approve - Approve change order
/api/change-orders/[id]/reject - Reject change order
/api/change-orders/[id]/attachments - Manage CO attachments
Labor Management:

/api/labor-actuals - Manage actual labor costs/hours
/api/labor-actuals/bulk - Bulk create/update labor actuals
/api/labor-forecasts/weekly-actuals - Enter/view weekly actual costs
/api/labor-forecasts/running-averages - Get running average rates
/api/labor-forecasts/headcount - Manage headcount projections
/api/labor-forecasts/calculate - Calculate forecast from headcount
/api/labor-forecasts/[projectId] - Get project-specific labor forecasts
Financial Snapshots:

/api/financial-snapshots - List financial snapshots
/api/financial-snapshots/generate - Generate new snapshots
/api/financial-snapshots/[id] - Get specific snapshot details
Documents:

/api/documents - List and upload documents
/api/documents/[id] - Get, update, delete document
/api/documents/[id]/download - Download document file
/api/documents/categories - List document categories
Notifications:

/api/notifications - List user notifications
/api/notifications/[id] - Get, update notification status
/api/notifications/mark-read - Mark notifications as read
/api/notifications/mark-all-read - Mark all as read
/api/notifications/preferences - Manage notification preferences
Dashboards:

/api/dashboard/company - Company-wide metrics
/api/dashboard/division/[divisionId] - Division-specific metrics
/api/dashboard/project/[projectId] - Project-specific metrics
/api/dashboard/financial-summary - Overall financial summary
Reference Data:

/api/divisions - List all divisions
/api/clients - List all clients
/api/users - List users with role filter
/api/craft-types - List labor craft types
/api/roles - List available roles
/api/project-statuses - List project status options
Code Style Guidelines
Use camelCase for variables and functions; PascalCase for components, interfaces, and types.
Follow TypeScript best practices: Always add explicit type annotations; prefer interfaces for props and state; use generics for reusable components.
Import statements: Group Next.js/React imports first, then third-party (e.g., @tanstack/react-query, lucide-react), then local; use absolute imports via aliases (e.g., @/components/Button, @/lib/supabase).
JSX: Apply Tailwind classes directly; use cn() utility from shadcn/ui for conditional classes; avoid inline styles unless absolutely necessary.
Error handling: Use try-catch in async functions; return standardized error objects (e.g., { error: 'message', status: 400 }); integrate with sonner for user-facing toasts.
Dates: Use date-fns for all manipulations; store and transmit in ISO format; format for display with consistent locale (e.g., en-US).
IMPORTANT: Enforce ESLint and Prettier rules—no unused vars, consistent single quotes, required semicolons; use Zod for schema validation in APIs and forms.
Workflow Instructions
After schema changes: Run pnpm db:migrate followed by pnpm generate-types to update types; then pnpm lint and pnpm type-check.
Before commits: Execute pnpm lint, pnpm type-check, and (once configured) pnpm test; seed DB with pnpm db:seed for local testing.
Testing: Prioritize unit tests for utils and components (Jest + React Testing Library); integration tests for APIs with Supabase mocks; cover edge cases like invalid emails, unauthorized access, or large file uploads.
Deployment: Build via pnpm build; deploy to Vercel/Netlify; verify RLS, 2FA, and notifications post-deploy; use Turbopack for dev speed.
For imports/exports: Validate data with Zod against business rules (e.g., unique job numbers, email domains) before DB insertion; handle large Excel files in chunks.
Branching: Feature branches as 'feature/[description]'; bug fixes as 'fix/[description]'; rebase onto main and squash commits before merging PRs.
Environment Setup and Dependencies
Node.js: v20+ required; manage packages exclusively with pnpm (avoid yarn/npm).
Supabase: Local via Docker (pnpm db:start); use supabase CLI for schema management; service role key for admin ops only.
Key dependencies: @supabase/supabase-js for DB/auth; react-hook-form + zod for forms; @tanstack/react-query for data; recharts for visualizations; react-dropzone for uploads.
Dev tools: VS Code with extensions for ESLint, Prettier, Tailwind IntelliSense, React, and Supabase.
Note: Avoid raw SQL—use Supabase client methods for RLS safety; argon2 is handled by Supabase auth, so no direct imports needed.
Quirks: Large xlsx imports may cause memory issues—implement streaming if needed; ensure 2FA secrets are never logged.
Core Files and Utilities
src/lib/supabase.ts: Central client setup for auth/DB—import this for all interactions.
src/types/supabase.ts: Auto-generated DB types—reference for type safety in queries.
src/components/ui/: shadcn/ui and Radix-based components (e.g., Button, Dialog)—extend these for consistency.
src/utils/financial-calculations.ts: Helpers for metrics like revised contracts or variance analysis—reuse across features.
src/hooks/useProjectQuery.ts: Custom React Query hooks for fetching—build on these for data management.
@business-rules.md: Optional linked doc for expanded rules if this section grows.
Unexpected behavior: Recharts may need explicit sizing for responsive dashboards—wrap in containers; dropzone rejects invalid files automatically, but add custom validation.
Custom Rules
YOU MUST enforce RLS: Query as authenticated user; test changes with various roles (e.g., viewer vs. controller).
Security: Validate inputs with Zod on client/server; use optimistic updates in React Query but rollback on errors; enable 2FA checks in auth flows.
Performance tip: Leverage financial_snapshots for queries; use React Server Components for initial loads; debounce search inputs.
Warning: Soft deletes require status updates and audit logging—avoid DELETE ops; preserve job numbers in all imports.
Accessibility: Add ARIA attributes to Radix components; ensure forms are keyboard-navigable; use semantic HTML.
UX: Integrate sonner toasts for all async ops; show skeletons during loading; implement infinite scrolling for long lists if needed.
Financial accuracy: Trigger snapshot regeneration after PO/CO/labor updates; use precise decimal handling (e.g., BigInt for currencies if needed).