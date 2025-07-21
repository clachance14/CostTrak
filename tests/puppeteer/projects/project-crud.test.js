/**
 * SuperClaude Comprehensive E2E Test - Project CRUD Operations
 * Tests: Create, Read, Update, Delete with proper permissions
 */

const assert = require('assert')

module.exports = {
  name: 'Project CRUD Operations',
  
  async run(page, config) {
    const testData = {
      project: {
        job_number: `TEST-${Date.now()}`,
        name: 'SuperClaude Test Project',
        client_id: null, // Will be set dynamically
        division_id: null, // Will be set dynamically
        city: 'Test City',
        state: 'CA',
        project_type: 'commercial',
        original_contract_amount: 5000000,
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    }
    
    // Step 1: Login as controller (has full CRUD permissions)
    await page.goto(config.baseURL)
    await page.waitForSelector('input[name="email"]', { timeout: config.timeout.navigation })
    
    await page.type('input[name="email"]', config.testUsers.controller.email)
    await page.type('input[name="password"]', config.testUsers.controller.password)
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForNavigation()
    await page.waitForSelector('[data-testid="dashboard-header"]', { timeout: config.timeout.navigation })
    
    // Step 2: Navigate to Projects
    await page.click('a[href="/projects"]')
    await page.waitForSelector('[data-testid="projects-list"]', { timeout: config.timeout.navigation })
    
    // Step 3: Create New Project
    await page.click('button:has-text("New Project")')
    await page.waitForSelector('form[data-testid="project-form"]')
    
    // Get first available client and division
    const clients = await page.$$eval('select[name="client_id"] option', options => 
      options.map(opt => ({ value: opt.value, text: opt.textContent }))
    )
    if (clients.length > 1) {
      testData.project.client_id = clients[1].value
      await page.select('select[name="client_id"]', testData.project.client_id)
    }
    
    const divisions = await page.$$eval('select[name="division_id"] option', options => 
      options.map(opt => ({ value: opt.value, text: opt.textContent }))
    )
    if (divisions.length > 1) {
      testData.project.division_id = divisions[1].value
      await page.select('select[name="division_id"]', testData.project.division_id)
    }
    
    // Fill in project details
    await page.type('input[name="job_number"]', testData.project.job_number)
    await page.type('input[name="name"]', testData.project.name)
    await page.type('input[name="city"]', testData.project.city)
    await page.type('input[name="state"]', testData.project.state)
    await page.select('select[name="project_type"]', testData.project.project_type)
    await page.type('input[name="original_contract_amount"]', testData.project.original_contract_amount.toString())
    await page.type('input[name="start_date"]', testData.project.start_date)
    await page.type('input[name="end_date"]', testData.project.end_date)
    
    // Submit form
    await page.click('button[type="submit"]:has-text("Create Project")')
    
    // Wait for success and redirect
    await page.waitForNavigation()
    await page.waitForSelector('[data-testid="project-detail"]')
    
    // Verify project was created
    const projectUrl = page.url()
    const projectId = projectUrl.split('/').pop()
    assert(projectId, 'Project ID should be in URL')
    
    // Step 4: Verify project details
    const projectName = await page.$eval('[data-testid="project-name"]', el => el.textContent)
    assert(projectName.includes(testData.project.name), 'Project name should match')
    
    const jobNumber = await page.$eval('[data-testid="job-number"]', el => el.textContent)
    assert(jobNumber.includes(testData.project.job_number), 'Job number should match')
    
    // Step 5: Update Project
    await page.click('button:has-text("Edit Project")')
    await page.waitForSelector('form[data-testid="project-form"]')
    
    // Update project name
    const updatedName = testData.project.name + ' - Updated'
    await page.fill('input[name="name"]', updatedName)
    
    // Update contract amount
    const updatedAmount = 6000000
    await page.fill('input[name="original_contract_amount"]', updatedAmount.toString())
    
    await page.click('button[type="submit"]:has-text("Update Project")')
    
    // Wait for success
    await page.waitForSelector('.toast-success, [data-testid="success-message"]')
    
    // Verify updates
    await page.goto(`${config.baseURL}/projects/${projectId}`)
    await page.waitForSelector('[data-testid="project-detail"]')
    
    const updatedProjectName = await page.$eval('[data-testid="project-name"]', el => el.textContent)
    assert(updatedProjectName.includes(updatedName), 'Project name should be updated')
    
    // Step 6: Test Search Functionality
    await page.goto(`${config.baseURL}/projects`)
    await page.waitForSelector('[data-testid="projects-list"]')
    
    await page.type('input[placeholder*="Search"]', testData.project.job_number)
    await page.waitForTimeout(500) // Debounce delay
    
    const searchResults = await page.$$('[data-testid="project-row"]')
    assert(searchResults.length >= 1, 'Should find at least one project')
    
    // Step 7: Test Filtering
    if (testData.project.division_id) {
      await page.select('select[data-testid="division-filter"]', testData.project.division_id)
      await page.waitForTimeout(500)
      
      const filteredResults = await page.$$('[data-testid="project-row"]')
      assert(filteredResults.length >= 1, 'Should have filtered results')
    }
    
    // Step 8: Test Delete (Soft Delete)
    await page.goto(`${config.baseURL}/projects/${projectId}`)
    await page.waitForSelector('[data-testid="project-detail"]')
    
    // Click delete button
    await page.click('button:has-text("Delete Project")')
    
    // Confirm deletion in modal
    await page.waitForSelector('[role="dialog"]')
    await page.click('button:has-text("Confirm Delete")')
    
    // Wait for redirect to projects list
    await page.waitForNavigation()
    await page.waitForSelector('[data-testid="projects-list"]')
    
    // Verify project is marked as deleted (should show in inactive status)
    await page.select('select[data-testid="status-filter"]', 'inactive')
    await page.waitForTimeout(500)
    
    const deletedProject = await page.$(`[data-testid="project-${projectId}"]`)
    assert(deletedProject, 'Deleted project should appear in inactive list')
    
    // Step 9: Test Permission Restrictions
    // Logout and login as viewer
    await page.click('[data-testid="user-menu"]')
    await page.click('button:has-text("Logout")')
    
    await page.waitForSelector('input[name="email"]')
    await page.type('input[name="email"]', config.testUsers.viewer.email)
    await page.type('input[name="password"]', config.testUsers.viewer.password)
    await page.click('button[type="submit"]')
    
    await page.waitForNavigation()
    await page.goto(`${config.baseURL}/projects`)
    await page.waitForSelector('[data-testid="projects-list"]')
    
    // Verify viewer cannot see create button
    const createButton = await page.$('button:has-text("New Project")')
    assert(!createButton, 'Viewer should not see create button')
    
    // Navigate to a project and verify no edit/delete buttons
    const firstProject = await page.$('[data-testid="project-row"] a')
    if (firstProject) {
      await firstProject.click()
      await page.waitForSelector('[data-testid="project-detail"]')
      
      const editButton = await page.$('button:has-text("Edit Project")')
      const deleteButton = await page.$('button:has-text("Delete Project")')
      
      assert(!editButton, 'Viewer should not see edit button')
      assert(!deleteButton, 'Viewer should not see delete button')
    }
    
    // Performance metrics
    if (config.performance.enabled) {
      const metrics = await page.metrics()
      console.log('Performance Metrics:', {
        JSHeapUsedSize: Math.round(metrics.JSHeapUsedSize / 1048576) + 'MB',
        Nodes: metrics.Nodes,
        LayoutCount: metrics.LayoutCount
      })
    }
  }
}