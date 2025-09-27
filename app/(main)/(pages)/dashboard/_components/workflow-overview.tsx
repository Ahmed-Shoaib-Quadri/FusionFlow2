'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Workflow,
  Play,
  Pause,
  ExternalLink,
  Calendar,
  Activity
} from 'lucide-react'
import Link from 'next/link'

type WorkflowData = {
  id: string
  name: string
  description: string
  publish: boolean | null
  createdAt: Date
  updatedAt: Date
  _count: {
    executions: number
  }
}

type WorkflowOverviewProps = {
  workflows: WorkflowData[]
}

const WorkflowOverview = ({ workflows }: WorkflowOverviewProps) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(new Date(date))
  }

  const getStatusBadge = (publish: boolean | null) => {
    if (publish) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
    }
    return <Badge variant="secondary">Inactive</Badge>
  }

  if (workflows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Workflow className="h-5 w-5" />
            Workflow Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-center py-8 text-muted-foreground'>
            <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No workflows yet</p>
            <p className='text-sm'>Create your first workflow to get started</p>
            <Button className='mt-4' asChild>
              <Link href="/workflows">
                Create Workflow
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Workflow className="h-5 w-5" />
          Workflow Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {workflows.map((workflow) => (
            <div key={workflow.id} className='flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors'>
              <div className='flex items-center gap-3 flex-1'>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 mb-1'>
                    <Link 
                      href={`/workflows/editor/${workflow.id}`}
                      className='font-medium hover:underline truncate'
                    >
                      {workflow.name}
                    </Link>
                    {getStatusBadge(workflow.publish)}
                  </div>
                  <p className='text-sm text-muted-foreground truncate mb-2'>
                    {workflow.description}
                  </p>
                  <div className='flex items-center gap-4 text-sm text-muted-foreground'>
                    <span className='flex items-center gap-1'>
                      <Activity className="h-3 w-3" />
                      {workflow._count.executions} executions
                    </span>
                    <span className='flex items-center gap-1'>
                      <Calendar className="h-3 w-3" />
                      Updated {formatDate(workflow.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
              <div className='flex items-center gap-2'>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/workflows/editor/${workflow.id}`}>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        <div className='mt-4 pt-4 border-t'>
          <Button variant="outline" size="sm" className='w-full' asChild>
            <Link href="/workflows">
              View All Workflows
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default WorkflowOverview 