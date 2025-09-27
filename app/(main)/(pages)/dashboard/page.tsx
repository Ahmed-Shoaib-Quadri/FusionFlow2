import React from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { WorkflowExecutionService } from '@/lib/workflow-execution-service'
import { db } from '@/lib/db'
import DashboardStats from './_components/dashboard-stats'
import RecentExecutions from './_components/recent-executions'
import WorkflowOverview from './_components/workflow-overview'

const DashboardPage = async () => {
  const user = await currentUser()
  
  if (!user) {
    return <div>Not authenticated</div>
  }

  // Fetch dashboard data
  const [stats, recentExecutions, workflows] = await Promise.all([
    WorkflowExecutionService.getExecutionStats(user.id),
    WorkflowExecutionService.getRecentExecutions(user.id, 7),
    db.workflows.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        description: true,
        publish: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { executions: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    })
  ])

  return (
    <div className='flex flex-col gap-6 p-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-4xl font-bold'>Dashboard</h1>
        <div className='text-sm text-muted-foreground'>
          Welcome back, {user.firstName || user.emailAddresses[0]?.emailAddress}
        </div>
      </div>

      {/* Stats Cards */}
      <DashboardStats stats={stats} />

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* Recent Executions */}
        <RecentExecutions executions={recentExecutions} />
        
        {/* Workflow Overview */}
        <WorkflowOverview workflows={workflows} />
      </div>
    </div>
  )
}

export default DashboardPage
