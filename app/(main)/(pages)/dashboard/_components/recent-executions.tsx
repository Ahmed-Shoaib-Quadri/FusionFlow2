'use client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle, 
  XCircle, 
  Clock,
  ExternalLink,
  Calendar,
  Zap
} from 'lucide-react'
import Link from 'next/link'

type Execution = {
  id: string
  workflowId: string
  status: string
  triggerType: string
  results: any[] | null
  error: string | null
  startedAt: Date
  completedAt: Date | null
  duration: number | null
  workflow: {
    name: string
    id: string
  }
}

type RecentExecutionsProps = {
  executions: Execution[]
}

const RecentExecutions = ({ executions }: RecentExecutionsProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'partial':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="default" className="bg-green-100 text-green-800">Success</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'partial':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Partial</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const formatDuration = (duration: number | null) => {
    if (!duration) return 'N/A'
    if (duration < 1000) return `${duration}ms`
    return `${(duration / 1000).toFixed(2)}s`
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  if (executions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Zap className="h-5 w-5" />
            Recent Executions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-center py-8 text-muted-foreground'>
            <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No executions yet</p>
            <p className='text-sm'>Your workflow executions will appear here</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Zap className="h-5 w-5" />
          Recent Executions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {executions.slice(0, 5).map((execution) => (
            <div key={execution.id} className='flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors'>
              <div className='flex items-center gap-3 flex-1'>
                {getStatusIcon(execution.status)}
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-2 mb-1'>
                    <Link 
                      href={`/workflows/editor/${execution.workflowId}`}
                      className='font-medium hover:underline truncate'
                    >
                      {execution.workflow.name}
                    </Link>
                    {getStatusBadge(execution.status)}
                  </div>
                  <div className='flex items-center gap-4 text-sm text-muted-foreground'>
                    <span className='flex items-center gap-1'>
                      <Calendar className="h-3 w-3" />
                      {formatDate(execution.startedAt)}
                    </span>
                    <span>Duration: {formatDuration(execution.duration)}</span>
                    <span className='capitalize'>{execution.triggerType.replace('_', ' ')}</span>
                  </div>
                  {execution.error && (
                    <p className='text-sm text-red-600 mt-1 truncate'>
                      Error: {execution.error}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/workflows/editor/${execution.workflowId}`}>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
        
        {executions.length > 5 && (
          <div className='mt-4 pt-4 border-t'>
            <Button variant="outline" size="sm" className='w-full' asChild>
              <Link href="/executions">
                View All Executions
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default RecentExecutions 