import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function findClientPOReferences() {
  console.log('Connected to Supabase at:', supabaseUrl)
  console.log('\n=== Searching for Client PO References ===\n')

  // Search for POs that might have client order references in descriptions
  const { data: posWithOrderInfo } = await supabase
    .from('purchase_orders')
    .select(`
      po_number,
      description,
      vendor_name,
      project:projects(job_number, name)
    `)
    .or('description.ilike.%order%,description.ilike.%Order%,description.ilike.%ORDER%,description.ilike.%bid%,description.ilike.%Bid%,description.ilike.%BID%,description.ilike.%ref%,description.ilike.%Ref%,description.ilike.%REF%,description.ilike.%quote%,description.ilike.%Quote%,description.ilike.%QUOTE%')
    .limit(50)

  if (posWithOrderInfo && posWithOrderInfo.length > 0) {
    console.log(`Found ${posWithOrderInfo.length} POs with potential client references:\n`)
    
    // Extract order numbers using regex patterns
    const orderPatterns = [
      /Order\s*No\.?\s*:?\s*([A-Z0-9\-]+)/i,
      /ORDER\s*NO\.?\s*:?\s*([A-Z0-9\-]+)/i,
      /Bid\s*No\.?\s*:?\s*([A-Z0-9\-]+)/i,
      /BID\s*NO\.?\s*:?\s*([A-Z0-9\-]+)/i,
      /Quote\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
      /Ref\.?\s*:?\s*([A-Z0-9\-]+)/i,
      /PO\s*#?\s*:?\s*([A-Z0-9\-]+)/i,
      /Client\s*PO\s*:?\s*([A-Z0-9\-]+)/i
    ]

    const clientReferences: Array<{
      icsPoNumber: string
      vendor: string
      project: string
      description: string
      extractedReference?: string
    }> = []

    posWithOrderInfo.forEach(po => {
      let extractedRef: string | undefined
      
      // Try to extract reference number from description
      if (po.description) {
        for (const pattern of orderPatterns) {
          const match = po.description.match(pattern)
          if (match && match[1]) {
            extractedRef = match[1]
            break
          }
        }
      }

      clientReferences.push({
        icsPoNumber: po.po_number,
        vendor: po.vendor_name,
        project: Array.isArray(po.project) 
          ? `${po.project[0]?.job_number} - ${po.project[0]?.name}`
          : `${po.project?.job_number} - ${po.project?.name}`,
        description: po.description || '',
        extractedReference: extractedRef
      })
    })

    // Display results organized by extraction success
    console.log('=== POs with Extracted Client References ===\n')
    const withRefs = clientReferences.filter(ref => ref.extractedReference)
    if (withRefs.length > 0) {
      withRefs.forEach((ref, index) => {
        console.log(`${index + 1}. ICS PO: ${ref.icsPoNumber}`)
        console.log(`   Client Reference: ${ref.extractedReference}`)
        console.log(`   Vendor: ${ref.vendor}`)
        console.log(`   Project: ${ref.project}`)
        console.log(`   Full Description: ${ref.description}`)
        console.log()
      })
    } else {
      console.log('No client references could be extracted automatically.\n')
    }

    console.log('=== POs with Potential References (Manual Review Needed) ===\n')
    const needsReview = clientReferences.filter(ref => !ref.extractedReference).slice(0, 20)
    needsReview.forEach((ref, index) => {
      console.log(`${index + 1}. ICS PO: ${ref.icsPoNumber}`)
      console.log(`   Vendor: ${ref.vendor}`)
      console.log(`   Description: ${ref.description}`)
      console.log()
    })
  } else {
    console.log('No purchase orders found with potential client references.')
  }

  // Also check for any references in the WO/PMO field
  console.log('\n=== Checking WO/PMO Fields ===\n')
  const { data: posWithWO } = await supabase
    .from('purchase_orders')
    .select('po_number, wo_pmo, vendor_name')
    .not('wo_pmo', 'is', null)
    .not('wo_pmo', 'eq', '')
    .limit(20)

  if (posWithWO && posWithWO.length > 0) {
    console.log(`Found ${posWithWO.length} POs with WO/PMO values:\n`)
    posWithWO.forEach((po, index) => {
      console.log(`${index + 1}. ICS PO: ${po.po_number}`)
      console.log(`   WO/PMO: ${po.wo_pmo}`)
      console.log(`   Vendor: ${po.vendor_name}`)
      console.log()
    })
  } else {
    console.log('No POs found with WO/PMO values.')
  }

}

findClientPOReferences().catch(console.error)