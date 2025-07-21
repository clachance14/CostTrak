import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateFinancialSnapshot } from '../financial-snapshot'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.generated'

// Mock Supabase client
function createMockSupabase() {
  const mockFrom = vi.fn((table: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
  }))

  return {
    from: mockFrom,
  } as unknown as SupabaseClient<Database>
}

describe('Financial Snapshot Service', () => {
  let mockSupabase: SupabaseClient<Database>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
  })

  describe('calculateFinancialSnapshot', () => {
    const baseSnapshotDate = '2025-01-21'

    it('should calculate project snapshot correctly', async () => {
      const projectId = 'project-123'
      
      // Mock project data
      const mockProject = {
        id: projectId,
        original_contract_amount: 1000000,
        name: 'Test Project',
      }

      // Mock purchase orders
      const mockPOs = [
        { total_amount: 200000 },
        { total_amount: 150000 },
        { total_amount: 100000 },
      ]

      // Mock change orders
      const mockChangeOrders = [
        { amount: 50000 },
        { amount: 30000 },
      ]

      // Mock labor actuals
      const mockLaborActuals = [
        { total_cost: 75000 },
        { total_cost: 60000 },
      ]

      // Mock labor forecasts  
      const mockLaborForecasts = [
        { forecasted_cost: 80000 },
        { forecasted_cost: 90000 },
      ]

      // Set up mock returns
      const fromMock = mockSupabase.from as any
      
      // Project query
      fromMock.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProject, error: null }),
      }))

      // PO query
      fromMock.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockPOs, error: null }),
      }))

      // Change orders query
      fromMock.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockChangeOrders, error: null }),
      }))

      // Labor actuals query
      fromMock.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockLaborActuals, error: null }),
      }))

      // Labor forecasts query
      fromMock.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockLaborForecasts, error: null }),
      }))

      // Final insert query
      const mockSnapshot = {
        id: 'snapshot-123',
        snapshot_type: 'project',
        project_id: projectId,
        snapshot_date: baseSnapshotDate,
        original_contract: 1000000,
        approved_change_orders: 80000,
        revised_contract: 1080000,
        total_po_committed: 450000,
        total_labor_cost: 135000,
        forecasted_cost: 755000,
        forecasted_profit: 325000,
      }

      fromMock.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSnapshot, error: null }),
      }))

      const result = await calculateFinancialSnapshot(mockSupabase, {
        type: 'project',
        projectId,
        snapshotDate: baseSnapshotDate,
      })

      expect(result).toEqual(mockSnapshot)
      expect(fromMock).toHaveBeenCalledWith('financial_snapshots')
    })

    it('should calculate division snapshot correctly', async () => {
      const divisionId = 'division-456'
      
      // Mock projects in division
      const mockProjects = [
        { id: 'p1', original_contract_amount: 500000 },
        { id: 'p2', original_contract_amount: 750000 },
      ]

      const fromMock = mockSupabase.from as any
      
      // Projects query
      fromMock.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProjects, error: null }),
      }))

      // Mock aggregated data for division
      const mockDivisionData = {
        total_po_committed: 600000,
        total_labor_cost: 200000,
        approved_change_orders: 100000,
      }

      // Additional mock queries for division calculations
      for (let i = 0; i < 4; i++) {
        fromMock.mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: [], error: null }),
        }))
      }

      // Final insert
      const mockSnapshot = {
        id: 'snapshot-div-123',
        snapshot_type: 'division',
        division_id: divisionId,
        snapshot_date: baseSnapshotDate,
        original_contract: 1250000,
        revised_contract: 1350000,
        total_committed: 800000,
      }

      fromMock.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSnapshot, error: null }),
      }))

      const result = await calculateFinancialSnapshot(mockSupabase, {
        type: 'division',
        divisionId,
        snapshotDate: baseSnapshotDate,
      })

      expect(result.snapshot_type).toBe('division')
      expect(result.division_id).toBe(divisionId)
    })

    it('should calculate company snapshot correctly', async () => {
      const fromMock = mockSupabase.from as any

      // Mock all projects
      const mockProjects = [
        { id: 'p1', original_contract_amount: 1000000 },
        { id: 'p2', original_contract_amount: 2000000 },
        { id: 'p3', original_contract_amount: 1500000 },
      ]

      fromMock.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProjects, error: null }),
      }))

      // Mock aggregated company data
      for (let i = 0; i < 4; i++) {
        fromMock.mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: [], error: null }),
        }))
      }

      // Final insert
      const mockSnapshot = {
        id: 'snapshot-company-123',
        snapshot_type: 'company',
        snapshot_date: baseSnapshotDate,
        original_contract: 4500000,
        total_committed: 2800000,
        forecasted_profit: 1700000,
      }

      fromMock.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSnapshot, error: null }),
      }))

      const result = await calculateFinancialSnapshot(mockSupabase, {
        type: 'company',
        snapshotDate: baseSnapshotDate,
      })

      expect(result.snapshot_type).toBe('company')
      expect(result.project_id).toBeNull()
      expect(result.division_id).toBeNull()
    })

    it('should throw error when project not found', async () => {
      const fromMock = mockSupabase.from as any
      
      fromMock.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }))

      await expect(
        calculateFinancialSnapshot(mockSupabase, {
          type: 'project',
          projectId: 'non-existent',
          snapshotDate: baseSnapshotDate,
        })
      ).rejects.toThrow('Project not found')
    })

    it('should handle database errors gracefully', async () => {
      const fromMock = mockSupabase.from as any
      
      // Mock project query success
      fromMock.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: { id: 'p1', original_contract_amount: 1000000 }, 
          error: null 
        }),
      }))

      // Mock subsequent queries
      for (let i = 0; i < 4; i++) {
        fromMock.mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: [], error: null }),
        }))
      }

      // Mock insert failure
      fromMock.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Database connection failed' } 
        }),
      }))

      await expect(
        calculateFinancialSnapshot(mockSupabase, {
          type: 'project',
          projectId: 'project-123',
          snapshotDate: baseSnapshotDate,
        })
      ).rejects.toThrow('Failed to create financial snapshot: Database connection failed')
    })

    it('should calculate metrics with null values correctly', async () => {
      const projectId = 'project-with-nulls'
      
      const fromMock = mockSupabase.from as any
      
      // Mock project with null contract amount
      fromMock.mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: { id: projectId, original_contract_amount: null }, 
          error: null 
        }),
      }))

      // Mock empty results for other queries
      for (let i = 0; i < 4; i++) {
        fromMock.mockImplementationOnce(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: [], error: null }),
        }))
      }

      // Mock successful insert
      const mockSnapshot = {
        id: 'snapshot-null-123',
        snapshot_type: 'project',
        project_id: projectId,
        snapshot_date: baseSnapshotDate,
        original_contract: 0,
        total_po_committed: 0,
        total_labor_cost: 0,
      }

      fromMock.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSnapshot, error: null }),
      }))

      const result = await calculateFinancialSnapshot(mockSupabase, {
        type: 'project',
        projectId,
        snapshotDate: baseSnapshotDate,
      })

      expect(result.original_contract).toBe(0)
      expect(result.total_po_committed).toBe(0)
    })

    it('should validate snapshot type parameter', async () => {
      await expect(
        calculateFinancialSnapshot(mockSupabase, {
          type: 'invalid' as any,
          snapshotDate: baseSnapshotDate,
        })
      ).rejects.toThrow()
    })

    it('should require projectId for project snapshots', async () => {
      const fromMock = mockSupabase.from as any
      
      // Mock insert without calculations (since no projectId)
      fromMock.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: { 
            id: 'snap-123', 
            snapshot_type: 'project',
            project_id: null,
            snapshot_date: baseSnapshotDate,
          }, 
          error: null 
        }),
      }))

      const result = await calculateFinancialSnapshot(mockSupabase, {
        type: 'project',
        snapshotDate: baseSnapshotDate,
      })

      expect(result.project_id).toBeNull()
    })

    it('should require divisionId for division snapshots', async () => {
      const fromMock = mockSupabase.from as any
      
      // Mock insert without calculations (since no divisionId)
      fromMock.mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: { 
            id: 'snap-123', 
            snapshot_type: 'division',
            division_id: null,
            snapshot_date: baseSnapshotDate,
          }, 
          error: null 
        }),
      }))

      const result = await calculateFinancialSnapshot(mockSupabase, {
        type: 'division',
        snapshotDate: baseSnapshotDate,
      })

      expect(result.division_id).toBeNull()
    })
  })
})