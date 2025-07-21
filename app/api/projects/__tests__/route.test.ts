import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../route'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@ics.ac',
            user_metadata: { role: 'controller' }
          }
        },
        error: null
      })
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }))
  }))
}))

describe('Projects API', () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@ics.ac',
            user_metadata: { role: 'controller' }
          }
        },
        error: null
      })
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    }))
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/projects', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest('http://localhost:3000/api/projects')
      const response = await GET(request)

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Unauthorized')
    })

    it('should return projects for authenticated user', async () => {
      const mockProjects = [
        {
          id: '1',
          job_number: 'TEST-001',
          name: 'Test Project 1',
          status: 'active',
          division: { name: 'Division 1' },
          client: { name: 'Client 1' }
        },
        {
          id: '2',
          job_number: 'TEST-002',
          name: 'Test Project 2',
          status: 'active',
          division: { name: 'Division 2' },
          client: { name: 'Client 2' }
        }
      ]

      const fromMock = mockSupabase.from('projects')
      fromMock.range.mockResolvedValueOnce({
        data: mockProjects,
        error: null,
        count: 2
      })

      const request = new NextRequest('http://localhost:3000/api/projects')
      const response = await GET(request)

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.projects).toHaveLength(2)
      expect(data.total).toBe(2)
    })

    it('should handle search parameter', async () => {
      const fromMock = mockSupabase.from('projects')
      fromMock.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0
      })

      const request = new NextRequest('http://localhost:3000/api/projects?search=TEST')
      await GET(request)

      expect(fromMock.or).toHaveBeenCalledWith(
        expect.stringContaining('name.ilike.%TEST%')
      )
    })

    it('should handle status filter', async () => {
      const fromMock = mockSupabase.from('projects')
      fromMock.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0
      })

      const request = new NextRequest('http://localhost:3000/api/projects?status=active')
      await GET(request)

      expect(fromMock.eq).toHaveBeenCalledWith('status', 'active')
    })

    it('should handle division filter', async () => {
      const fromMock = mockSupabase.from('projects')
      fromMock.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0
      })

      const request = new NextRequest('http://localhost:3000/api/projects?division=div-123')
      await GET(request)

      expect(fromMock.eq).toHaveBeenCalledWith('division_id', 'div-123')
    })

    it('should handle pagination', async () => {
      const fromMock = mockSupabase.from('projects')
      fromMock.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 100
      })

      const request = new NextRequest('http://localhost:3000/api/projects?page=2&limit=20')
      await GET(request)

      expect(fromMock.range).toHaveBeenCalledWith(20, 39)
    })

    it('should handle sorting', async () => {
      const fromMock = mockSupabase.from('projects')
      fromMock.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0
      })

      const request = new NextRequest('http://localhost:3000/api/projects?sortBy=name&sortOrder=desc')
      await GET(request)

      expect(fromMock.order).toHaveBeenCalledWith('name', { ascending: false })
    })

    it('should handle database errors gracefully', async () => {
      const fromMock = mockSupabase.from('projects')
      fromMock.range.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
        count: null
      })

      const request = new NextRequest('http://localhost:3000/api/projects')
      const response = await GET(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Failed to fetch projects')
    })

    it('should filter by user role permissions', async () => {
      // Test as project manager - should only see assigned projects
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'pm-user-id',
            email: 'pm@ics.ac',
            user_metadata: { role: 'project_manager' }
          }
        },
        error: null
      })

      const fromMock = mockSupabase.from('projects')
      fromMock.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0
      })

      const request = new NextRequest('http://localhost:3000/api/projects')
      await GET(request)

      expect(fromMock.in).toHaveBeenCalledWith('id', expect.any(Function))
    })
  })

  describe('POST /api/projects', () => {
    it('should require authentication', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Project' })
      })

      const response = await POST(request)
      expect(response.status).toBe(401)
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Project' }) // Missing required fields
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('validation')
    })

    it('should create project with valid data', async () => {
      const projectData = {
        job_number: 'NEW-001',
        name: 'New Test Project',
        client_id: 'client-123',
        division_id: 'div-123',
        city: 'Test City',
        state: 'CA',
        project_type: 'commercial',
        original_contract_amount: 1000000,
        start_date: '2025-01-01',
        end_date: '2025-12-31'
      }

      const fromMock = mockSupabase.from('projects')
      fromMock.single.mockResolvedValueOnce({
        data: { id: 'new-project-id', ...projectData },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(projectData)
      })

      const response = await POST(request)
      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.id).toBe('new-project-id')
      expect(fromMock.insert).toHaveBeenCalledWith(expect.objectContaining(projectData))
    })

    it('should handle duplicate job numbers', async () => {
      const fromMock = mockSupabase.from('projects')
      fromMock.single.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'Duplicate job number' }
      })

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          job_number: 'EXISTING-001',
          name: 'Test Project',
          client_id: 'client-123',
          division_id: 'div-123',
          city: 'Test City',
          state: 'CA',
          project_type: 'commercial',
          original_contract_amount: 1000000,
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('already exists')
    })

    it('should only allow authorized roles to create projects', async () => {
      // Test as viewer - should not be able to create
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: {
          user: {
            id: 'viewer-id',
            email: 'viewer@ics.ac',
            user_metadata: { role: 'viewer' }
          }
        },
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          job_number: 'NEW-001',
          name: 'Test Project',
          client_id: 'client-123',
          division_id: 'div-123',
          city: 'Test City',
          state: 'CA',
          project_type: 'commercial',
          original_contract_amount: 1000000,
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe('Insufficient permissions')
    })

    it('should validate contract amount is positive', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          job_number: 'NEW-001',
          name: 'Test Project',
          client_id: 'client-123',
          division_id: 'div-123',
          city: 'Test City',
          state: 'CA',
          project_type: 'commercial',
          original_contract_amount: -1000,
          start_date: '2025-01-01',
          end_date: '2025-12-31'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('positive')
    })

    it('should validate end date is after start date', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          job_number: 'NEW-001',
          name: 'Test Project',
          client_id: 'client-123',
          division_id: 'div-123',
          city: 'Test City',
          state: 'CA',
          project_type: 'commercial',
          original_contract_amount: 1000000,
          start_date: '2025-12-31',
          end_date: '2025-01-01'
        })
      })

      const response = await POST(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('end date')
    })
  })
})