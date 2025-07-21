import { test, expect } from '@playwright/test'
import { setupAuthState } from '../utils/auth.helper'

test.describe('Projects CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await setupAuthState(page)
    
    // Navigate to projects page
    await page.goto('/projects')
    await page.waitForLoadState('networkidle')
  })

  test('should display projects list', async ({ page }) => {
    // Check for projects page elements
    await expect(page.locator('h1')).toContainText('Projects')
    
    // Should have search input
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible()
    
    // Should have create button
    await expect(page.locator('button:has-text("Create Project")')).toBeVisible()
    
    // Should show project table or list
    await expect(page.locator('[data-testid="projects-table"], [data-testid="projects-list"]')).toBeVisible()
  })

  test('should filter projects by search', async ({ page }) => {
    // Search for a specific project
    await page.fill('input[placeholder*="Search"]', 'Test Project')
    
    // Wait for filter to apply
    await page.waitForTimeout(500)
    
    // Check that results are filtered
    const projectRows = page.locator('[data-testid="project-row"]')
    const count = await projectRows.count()
    
    if (count > 0) {
      // Verify all visible projects contain search term
      for (let i = 0; i < count; i++) {
        const text = await projectRows.nth(i).textContent()
        expect(text?.toLowerCase()).toContain('test project')
      }
    }
  })

  test('should create a new project', async ({ page }) => {
    // Click create button
    await page.click('button:has-text("Create Project")')
    
    // Wait for form to appear
    await page.waitForSelector('form')
    
    // Fill in project details
    const timestamp = Date.now()
    const projectData = {
      job_number: `TEST-${timestamp}`,
      name: `E2E Test Project ${timestamp}`,
      client_name: 'Test Client',
      division: 'Division 1',
      project_manager: 'pm@ics.ac',
      original_contract_amount: '1000000',
      retainage_percentage: '10',
      start_date: '2024-01-01',
      target_end_date: '2024-12-31',
    }
    
    // Fill form fields
    await page.fill('input[name="job_number"]', projectData.job_number)
    await page.fill('input[name="name"]', projectData.name)
    
    // Select client (might be a select or combobox)
    const clientInput = page.locator('input[name="client_name"], [data-testid="client-select"]')
    if (await clientInput.isVisible()) {
      await clientInput.fill(projectData.client_name)
    }
    
    // Select division
    await page.selectOption('select[name="division"]', projectData.division)
    
    // Select project manager
    const pmSelect = page.locator('select[name="project_manager_id"], [data-testid="pm-select"]')
    if (await pmSelect.isVisible()) {
      await pmSelect.selectOption({ label: projectData.project_manager })
    }
    
    // Fill financial details
    await page.fill('input[name="original_contract_amount"]', projectData.original_contract_amount)
    await page.fill('input[name="retainage_percentage"]', projectData.retainage_percentage)
    
    // Fill dates
    await page.fill('input[name="start_date"]', projectData.start_date)
    await page.fill('input[name="target_end_date"]', projectData.target_end_date)
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for success message or redirect
    await page.waitForURL(/\/projects\/([\w-]+)|\/projects/, { timeout: 10000 })
    
    // Verify project was created
    if (page.url().includes('/projects/')) {
      // If redirected to project detail page
      await expect(page.locator('h1')).toContainText(projectData.name)
    } else {
      // If stayed on projects list
      await page.fill('input[placeholder*="Search"]', projectData.job_number)
      await page.waitForTimeout(500)
      await expect(page.locator(`text="${projectData.job_number}"`)).toBeVisible()
    }
  })

  test('should edit an existing project', async ({ page }) => {
    // Find and click on first project in list
    const firstProject = page.locator('[data-testid="project-row"]').first()
    const projectName = await firstProject.locator('[data-testid="project-name"]').textContent()
    
    // Click to view project details
    await firstProject.click()
    
    // Wait for project detail page
    await page.waitForURL(/\/projects\/[\w-]+/)
    
    // Click edit button
    await page.click('button:has-text("Edit")')
    
    // Wait for edit form
    await page.waitForSelector('form')
    
    // Update project name
    const updatedName = `${projectName} - Updated`
    await page.fill('input[name="name"]', updatedName)
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for save
    await page.waitForLoadState('networkidle')
    
    // Verify update
    await expect(page.locator('h1')).toContainText(updatedName)
  })

  test('should view project details', async ({ page }) => {
    // Click on first project
    const firstProject = page.locator('[data-testid="project-row"]').first()
    await firstProject.click()
    
    // Wait for project detail page
    await page.waitForURL(/\/projects\/[\w-]+/)
    
    // Check for key project information sections
    await expect(page.locator('text="Project Information"')).toBeVisible()
    await expect(page.locator('text="Financial Summary"')).toBeVisible()
    
    // Check for action buttons based on user role
    const editButton = page.locator('button:has-text("Edit")')
    const deleteButton = page.locator('button:has-text("Delete")')
    
    // At least edit should be visible for most roles
    await expect(editButton.or(deleteButton)).toBeVisible()
  })

  test('should handle project deletion (if authorized)', async ({ page }) => {
    // This test only runs if user has delete permissions
    
    // Navigate to a test project
    const testProject = page.locator('[data-testid="project-row"]:has-text("TEST-")')
    
    if (await testProject.count() > 0) {
      await testProject.first().click()
      
      // Wait for detail page
      await page.waitForURL(/\/projects\/[\w-]+/)
      
      // Check if delete button exists (only for controllers)
      const deleteButton = page.locator('button:has-text("Delete")')
      
      if (await deleteButton.isVisible()) {
        // Click delete
        await deleteButton.click()
        
        // Confirm deletion in dialog
        await page.click('button:has-text("Confirm")')
        
        // Should redirect to projects list
        await page.waitForURL('/projects')
        
        // Verify project is marked as deleted (soft delete)
        await expect(page.locator('text="Project deleted successfully"')).toBeVisible()
      }
    }
  })
})