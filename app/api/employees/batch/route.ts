import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/employees/batch - Get multiple employees by IDs
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  
  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { employeeIds } = body

    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ error: 'Employee IDs are required' }, { status: 400 })
    }

    // Fetch employees with their base rates
    const { data: employees, error } = await supabase
      .from('employees')
      .select(`
        id,
        employee_number,
        first_name,
        last_name,
        base_rate,
        is_active,
        craft_type_id,
        craft_types (
          id,
          name,
          code
        )
      `)
      .in('employee_number', employeeIds)

    if (error) {
      console.error('Error fetching employees:', error)
      throw error
    }

    // Create a map for easy lookup
    const employeeMap = new Map()
    employees?.forEach(emp => {
      employeeMap.set(emp.employee_number, {
        id: emp.id,
        employeeNumber: emp.employee_number,
        firstName: emp.first_name,
        lastName: emp.last_name,
        baseRate: emp.base_rate || 0,
        isActive: emp.is_active,
        craftTypeId: emp.craft_type_id,
        craftType: emp.craft_types
      })
    })

    // Return both found employees and missing ones
    const result = {
      employees: employeeIds.map(empId => {
        const emp = employeeMap.get(empId)
        return emp || {
          employeeNumber: empId,
          exists: false,
          baseRate: 0
        }
      }),
      found: employeeMap.size,
      missing: employeeIds.length - employeeMap.size
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Employee batch fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    )
  }
}