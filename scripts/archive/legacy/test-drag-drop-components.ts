#!/usr/bin/env node

/**
 * Test script to verify drag and drop components are properly implemented
 */

import fs from 'fs'
import path from 'path'

const files = [
  '/hooks/use-drag-and-drop.ts',
  '/components/ui/file-drop-zone.tsx',
  '/app/(dashboard)/purchase-orders/import/page.tsx',
  '/app/(dashboard)/employees/import/page.tsx',
  '/app/(dashboard)/labor/import/page.tsx',
  '/components/documents/document-upload-modal.tsx',
  '/components/dashboard/quick-import-section.tsx'
]

console.log('🔍 Checking drag and drop implementations...\n')

let totalChecks = 0
let passedChecks = 0

for (const file of files) {
  const fullPath = path.join(process.cwd(), file)
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${file}`)
    totalChecks++
    continue
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8')
  
  console.log(`📄 Checking ${file}...`)
  totalChecks++
  
  // Check for drag and drop functionality
  const hasDragHandlers = 
    content.includes('onDragEnter') ||
    content.includes('handleDragEnter') ||
    content.includes('useDragAndDrop') ||
    content.includes('useDropzone') ||
    content.includes('FileDropZone')
  
  const hasDropHandlers = 
    content.includes('onDrop') ||
    content.includes('handleDrop') ||
    content.includes('useDragAndDrop') ||
    content.includes('useDropzone') ||
    content.includes('FileDropZone')
  
  const hasDragState = 
    content.includes('isDragging') ||
    content.includes('dragActive') ||
    content.includes('FileDropZone')
  
  if (hasDragHandlers && hasDropHandlers && hasDragState) {
    console.log(`  ✅ Has complete drag and drop implementation`)
    passedChecks++
  } else {
    console.log(`  ⚠️  Missing drag and drop features:`)
    if (!hasDragHandlers) console.log(`     - No drag handlers`)
    if (!hasDropHandlers) console.log(`     - No drop handlers`)
    if (!hasDragState) console.log(`     - No drag state management`)
  }
  
  // Check for visual feedback
  const hasVisualFeedback = 
    content.includes('isDragging') ||
    content.includes('dragActive') ||
    content.includes('border-primary') ||
    content.includes('scale-')
  
  if (hasVisualFeedback) {
    console.log(`  ✅ Has visual feedback for drag states`)
  } else {
    console.log(`  ⚠️  No visual feedback for drag states`)
  }
  
  console.log()
}

console.log('📊 Summary:')
console.log(`  Total files checked: ${totalChecks}`)
console.log(`  Files with drag & drop: ${passedChecks}`)
console.log(`  Success rate: ${Math.round(passedChecks / totalChecks * 100)}%`)

if (passedChecks === totalChecks) {
  console.log('\n✅ All drag and drop fields are properly implemented!')
  process.exit(0)
} else {
  console.log('\n⚠️  Some files are missing drag and drop functionality')
  process.exit(1)
}