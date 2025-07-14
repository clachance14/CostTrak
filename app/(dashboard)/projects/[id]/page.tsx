'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const router = useRouter()
  const { id } = use(params)

  // Redirect to overview page
  useEffect(() => {
    router.replace(`/projects/${id}/overview`)
  }, [id, router])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to project overview...</p>
      </div>
    </div>
  )
}