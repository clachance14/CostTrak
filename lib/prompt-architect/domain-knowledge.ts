import { DomainKnowledge, TableInfo, BusinessRule, TechStackItem, CodePattern, TaskTemplate } from './types'

export const COSTTRAK_KNOWLEDGE: DomainKnowledge = {
  tables: [
    {
      name: 'projects',
      description: 'Core project information and metadata',
      keyColumns: ['id', 'name', 'project_number', 'original_contract_amount'],
      relationships: ['budget_line_items', 'purchase_orders', 'change_orders', 'labor_employee_actuals'],
      businessPurpose: 'Central entity tracking construction projects with financial baselines'
    },
    {
      name: 'budget_line_items',
      description: 'Detailed budget breakdown by cost code and WBS',
      keyColumns: ['id', 'project_id', 'cost_code', 'wbs_code', 'description', 'amount'],
      relationships: ['projects'],
      businessPurpose: 'Tracks approved budget allocations for cost tracking and variance analysis'
    },
    {
      name: 'purchase_orders',
      description: 'Purchase order headers with vendor and approval information',
      keyColumns: ['id', 'project_id', 'po_number', 'vendor_name', 'total_amount', 'week_ending'],
      relationships: ['projects', 'po_line_items'],
      businessPurpose: 'Tracks committed costs and vendor relationships'
    },
    {
      name: 'po_line_items',
      description: 'Detailed line items for each purchase order',
      keyColumns: ['id', 'purchase_order_id', 'cost_code', 'description', 'amount'],
      relationships: ['purchase_orders'],
      businessPurpose: 'Provides cost code level detail for commitment tracking'
    },
    {
      name: 'labor_employee_actuals',
      description: 'Weekly labor hours and costs by employee',
      keyColumns: ['id', 'project_id', 'employee_id', 'week_ending', 'hours', 'labor_cost'],
      relationships: ['projects', 'employees', 'craft_types'],
      businessPurpose: 'Tracks actual labor costs for budget comparison and forecasting'
    },
    {
      name: 'employees',
      description: 'Employee master data with labor classification',
      keyColumns: ['id', 'name', 'is_direct', 'default_craft_type_id'],
      relationships: ['labor_employee_actuals', 'craft_types'],
      businessPurpose: 'Maintains employee roster with Direct/Indirect classification for cost allocation'
    },
    {
      name: 'craft_types',
      description: 'Labor categories with billing rates',
      keyColumns: ['id', 'name', 'abbreviation', 'rate_tier'],
      relationships: ['employees', 'labor_employee_actuals'],
      businessPurpose: 'Defines labor classifications for rate calculations and reporting'
    },
    {
      name: 'change_orders',
      description: 'Contract modifications affecting project scope and budget',
      keyColumns: ['id', 'project_id', 'co_number', 'amount', 'status', 'approved_date'],
      relationships: ['projects'],
      businessPurpose: 'Tracks approved changes to original contract for revised budget calculations'
    },
    {
      name: 'labor_headcount_forecasts',
      description: 'Simple weekly headcount projections by craft',
      keyColumns: ['id', 'project_id', 'craft_type_id', 'week_ending', 'headcount'],
      relationships: ['projects', 'craft_types'],
      businessPurpose: 'Enables basic labor forecasting for resource planning'
    },
    {
      name: 'data_imports',
      description: 'Import history and audit trail',
      keyColumns: ['id', 'import_type', 'status', 'imported_by', 'created_at'],
      relationships: ['profiles'],
      businessPurpose: 'Provides traceability and rollback capability for all data imports'
    }
  ],
  
  businessRules: [
    {
      name: 'Email Domain Restriction',
      description: 'Only users with @ics.ac email addresses can register',
      implementation: 'Enforced in /api/auth/create-user and login routes',
      exceptions: ['Local development may bypass for testing']
    },
    {
      name: 'Single Role System',
      description: 'All users have project_manager role with full access',
      implementation: 'Role hardcoded in user creation, no complex permissions',
    },
    {
      name: 'Budget Import Once',
      description: 'Budget can only be imported once per project',
      implementation: 'Check for existing budget_line_items before import',
      exceptions: ['Admin override for corrections']
    },
    {
      name: 'Weekly Import Cadence',
      description: 'Labor and PO data imported weekly',
      implementation: 'Week ending date validation in import APIs',
    },
    {
      name: 'Direct/Indirect Classification',
      description: 'Labor costs automatically classified based on employee.is_direct flag',
      implementation: 'Applied during labor import processing',
    },
    {
      name: 'Revised Contract Calculation',
      description: 'Revised = Original + Sum(Approved Change Orders)',
      implementation: 'Calculated dynamically in project queries',
    },
    {
      name: 'Cost Code Validation',
      description: 'All transactions must reference valid cost codes from budget',
      implementation: 'Foreign key constraints and import validation',
    }
  ],
  
  techStack: [
    {
      category: 'Frontend Framework',
      technology: 'Next.js',
      version: '15.0',
      usage: 'App Router for all pages and API routes',
      constraints: ['Use Server Components by default', 'Client Components only when needed']
    },
    {
      category: 'UI Library',
      technology: 'React',
      version: '19.0',
      usage: 'Component development with hooks',
      constraints: ['Avoid class components', 'Use functional components']
    },
    {
      category: 'Language',
      technology: 'TypeScript',
      version: '5.x',
      usage: 'Type safety across entire codebase',
      constraints: ['Strict mode enabled', 'No any types without justification']
    },
    {
      category: 'Database',
      technology: 'Supabase',
      version: 'Latest',
      usage: 'PostgreSQL database with built-in auth and RLS',
      constraints: ['Use RLS policies for security', 'Leverage built-in auth']
    },
    {
      category: 'Styling',
      technology: 'Tailwind CSS',
      version: '3.x',
      usage: 'Utility-first CSS framework',
      constraints: ['Use design system tokens', 'Avoid custom CSS when possible']
    },
    {
      category: 'Components',
      technology: 'shadcn/ui',
      version: 'Latest',
      usage: 'Pre-built accessible components',
      constraints: ['Customize via cn() utility', 'Maintain accessibility']
    },
    {
      category: 'State Management',
      technology: 'React Query + Context',
      version: '5.x',
      usage: 'Server state with React Query, UI state with Context',
      constraints: ['No Redux unless absolutely necessary', 'Keep state close to usage']
    },
    {
      category: 'Forms',
      technology: 'react-hook-form + Zod',
      version: 'Latest',
      usage: 'Form handling with schema validation',
      constraints: ['Always validate with Zod schemas', 'Handle errors gracefully']
    },
    {
      category: 'File Processing',
      technology: 'xlsx',
      version: 'Latest',
      usage: 'Excel file import/export',
      constraints: ['Process client-side when possible', 'Validate all imported data']
    }
  ],
  
  codePatterns: [
    {
      name: 'API Route Pattern',
      description: 'Standard structure for Next.js API routes',
      useCase: 'Creating new API endpoints',
      example: `export async function GET(request: Request) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('table').select()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}`,
      antipatterns: ['Direct database queries without Supabase client', 'Missing error handling']
    },
    {
      name: 'Component Structure',
      description: 'Consistent React component organization',
      useCase: 'Building new UI components',
      example: `'use client' // Only if needed
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ComponentProps {
  className?: string
}

export function Component({ className }: ComponentProps) {
  return <div className={cn('base-styles', className)}>Content</div>
}`,
      antipatterns: ['Inline styles', 'Direct DOM manipulation']
    },
    {
      name: 'Data Fetching',
      description: 'Server-side data fetching in pages',
      useCase: 'Loading data for pages',
      example: `export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('table').select()
  return <ClientComponent data={data} />
}`,
      antipatterns: ['Client-side fetching for initial data', 'Blocking waterfalls']
    },
    {
      name: 'Error Handling',
      description: 'Consistent error handling pattern',
      useCase: 'API responses and data operations',
      example: `try {
  const result = await operation()
  return { data: result, error: null }
} catch (error) {
  console.error('Operation failed:', error)
  return { data: null, error: error.message }
}`,
      antipatterns: ['Swallowing errors', 'Generic error messages']
    }
  ],
  
  commonTasks: [
    {
      name: 'Create New API Endpoint',
      category: 'code-generation',
      description: 'Add a new API route for data operations',
      typicalQuestions: ['What data to return?', 'Authentication required?', 'Validation rules?'],
      outputExample: 'API route file with GET/POST/PUT/DELETE methods'
    },
    {
      name: 'Budget vs Actual Report',
      category: 'data-analysis',
      description: 'Compare budgeted amounts to actual costs',
      typicalQuestions: ['Time period?', 'Group by cost code?', 'Include commitments?'],
      outputExample: 'Table or chart showing variance analysis'
    },
    {
      name: 'Import Excel Data',
      category: 'process-automation',
      description: 'Process Excel file and load into database',
      typicalQuestions: ['File format?', 'Validation rules?', 'Error handling?'],
      outputExample: 'Import function with preview and validation'
    },
    {
      name: 'Add Form Validation',
      category: 'code-generation',
      description: 'Implement Zod schema and form validation',
      typicalQuestions: ['Fields to validate?', 'Business rules?', 'Error messages?'],
      outputExample: 'Zod schema and react-hook-form integration'
    },
    {
      name: 'Create Dashboard Widget',
      category: 'code-generation',
      description: 'Build a new dashboard component',
      typicalQuestions: ['Data to display?', 'Update frequency?', 'Interactions?'],
      outputExample: 'React component with data fetching and visualization'
    },
    {
      name: 'Debug Import Failure',
      category: 'debugging',
      description: 'Investigate why data import is failing',
      typicalQuestions: ['Error message?', 'File format?', 'Recent changes?'],
      outputExample: 'Root cause analysis and fix'
    },
    {
      name: 'Optimize Query Performance',
      category: 'architecture',
      description: 'Improve slow database queries',
      typicalQuestions: ['Current query?', 'Data volume?', 'Usage patterns?'],
      outputExample: 'Optimized query with indexes or restructuring'
    },
    {
      name: 'Document API Usage',
      category: 'documentation',
      description: 'Create API documentation for developers',
      typicalQuestions: ['Endpoints to document?', 'Include examples?', 'Authentication details?'],
      outputExample: 'Markdown documentation with request/response examples'
    }
  ]
}