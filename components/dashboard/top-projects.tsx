'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'

interface TopProject {
  id: string
  jobNumber: string
  name: string
  value: number
  status: string
  projectManager: string
}

interface TopProjectsProps {
  projects: TopProject[]
}

export function TopProjects({ projects }: TopProjectsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Projects by Value</CardTitle>
        <CardDescription>Highest value active projects</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job #</TableHead>
              <TableHead>Project Name</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>PM</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <Link 
                    href={`/projects/${project.id}`}
                    className="font-medium hover:underline"
                  >
                    {project.jobNumber}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {project.name}
                </TableCell>
                <TableCell>{formatCurrency(project.value)}</TableCell>
                <TableCell className="max-w-[150px] truncate">
                  {project.projectManager}
                </TableCell>
                <TableCell>
                  <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                    {project.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}