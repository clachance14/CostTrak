'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function OpsManagerRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.replace('/dashboard/ops-manager')
  }, [router])
  
  return null
}