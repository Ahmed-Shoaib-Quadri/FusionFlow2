import React from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { WorkflowExecutionService } from '@/lib/workflow-execution-service'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  CheckCircle, 
  XCircle, 
  Clock,
  ExternalLink,
  Calendar,
  Zap,
  Search,
  Filter,
  Download
} from 'lucide-react'
import Link from 'next/link'

const ExecutionsPage = async ({
  searchParams,
}: {
  searchParams: { status?: string; workflow?: string; page?: string }
}) => {
  const user = await currentUser()
  
  if (!user) {
    return <div>Not authenticated</div>
  }

  const page = parseInt(searchParams.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  // Fetch executions with pagination and filtering
  const [executions, totalCount, workflows] = await Promise.all([
    WorkflowExecutionService.getUserExecutionHistory(user.id, limit, offset, searchParams.status, searchParams.workflow),
    WorkflowExecutionService.getExecutionCount(user.id, searchParams.status, searchParams.workflow),
    db.workflows.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })
  ])

  const totalPages = Math.ceil(totalCount / limit)

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
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  return (
    <div className='flex flex-col gap-6 p-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-4xl font-bold'>Execution History</h1>
        <div className='text-sm text-muted-foreground'>
          {totalCount} total executions
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex gap-4'>
            <div className='flex-1'>
              <label className='text-sm font-medium mb-2 block'>Status</label>
              <select 
                className='w-full p-2 border rounded-md'
                defaultValue={searchParams.status || ''}
                onChange={(e) => {
                  const url = new URL(window.location.href)
                  if (e.target.value) {
                    url.searchParams.set('status', e.target.value)
                  } else {
                    url.searchParams.delete('status')
                  }
                  url.searchParams.delete('page')
                  window.location.href = url.toString()
                }}
              >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            <div className='flex-1'>
              <label className='text-sm font-medium mb-2 block'>Workflow</label>
              <select 
                className='w-full p-2 border rounded-md'
                defaultValue={searchParams.workflow || ''}
                onChange={(e) => {
                  const url = new URL(window.location.href)
                  if (e.target.value) {
                    url.searchParams.set('workflow', e.target.value)
                  } else {
                    url.searchParams.delete('workflow')
                  }
                  url.searchParams.delete('page')
                  window.location.href = url.toString()
                }}
              >
                <option value="">All Workflows</option>
                {workflows.map((workflow) => (
                  <option key={workflow.id} value={workflow.id}>
                    {workflow.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executions List */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Zap className="h-5 w-5" />
            Executions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {executions.length === 0 ? (
            <div className='text-center py-12 text-muted-foreground'>
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No executions found</p>
              <p className='text-sm'>Try adjusting your filters</p>
            </div>
          ) : (
            <div className='space-y-4'>
              {executions.map((execution) => (
                <div key={execution.id} className='flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors'>
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
                        <p className='text-sm text-red-600 mt-1'>
                          Error: {execution.error}
                        </p>
                      )}
                      {execution.results && execution.results.length > 0 && (
                        <div className='mt-2'>
                          <p className='text-sm font-medium mb-1'>Results:</p>
                          <div className='flex flex-wrap gap-1'>
                            {execution.results.map((result: any, index: number) => (
                              <Badge 
                                key={index} 
                                variant={result.status === 'success' ? 'default' : 'destructive'}
                                className='text-xs'
                              >
                                {result.node}: {result.status}
                              </Badge>
                            ))}
                          </div>
                        </div>
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
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className='mt-6 flex items-center justify-between'>
              <div className='text-sm text-muted-foreground'>
                Page {page} of {totalPages}
              </div>
              <div className='flex gap-2'>
                {page > 1 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const url = new URL(window.location.href)
                      url.searchParams.set('page', (page - 1).toString())
                      window.location.href = url.toString()
                    }}
                  >
                    Previous
                  </Button>
                )}
                {page < totalPages && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const url = new URL(window.location.href)
                      url.searchParams.set('page', (page + 1).toString())
                      window.location.href = url.toString()
                    }}
                  >
                    Next
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ExecutionsPage 