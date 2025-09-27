import { db } from '@/lib/db'

export type ExecutionResult = {
  node: string
  status: 'success' | 'failed'
  reason?: string
  error?: string
}

export type WorkflowExecutionData = {
  workflowId: string
  userId: string
  status: 'success' | 'failed' | 'partial'
  triggerType: 'google_drive' | 'manual' | 'scheduled'
  results?: ExecutionResult[]
  error?: string
  startedAt?: Date
}

export class WorkflowExecutionService {
  static async logExecution(data: WorkflowExecutionData) {
    try {
      const startTime = data.startedAt || new Date()
      const endTime = new Date()
      const duration = endTime.getTime() - startTime.getTime()

      const execution = await db.workflowExecution.create({
        data: {
          workflowId: data.workflowId,
          userId: data.userId,
          status: data.status,
          triggerType: data.triggerType,
          results: data.results ? JSON.stringify(data.results) : null,
          error: data.error,
          startedAt: startTime,
          completedAt: endTime,
          duration,
        },
      })

      console.log(`Workflow execution logged: ${execution.id}`)
      return execution
    } catch (error) {
      console.error('Error logging workflow execution:', error)
      throw error
    }
  }

  static async getExecutionHistory(workflowId: string, limit: number = 50) {
    try {
      const executions = await db.workflowExecution.findMany({
        where: { workflowId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        include: {
          workflow: {
            select: {
              name: true,
            },
          },
        },
      })

      return executions.map(execution => ({
        ...execution,
        results: execution.results ? JSON.parse(execution.results) : null,
      }))
    } catch (error) {
      console.error('Error fetching execution history:', error)
      throw error
    }
  }

  static async getUserExecutionHistory(
    userId: string, 
    limit: number = 100, 
    offset: number = 0,
    status?: string,
    workflowId?: string
  ) {
    try {
      const whereClause: any = { userId }
      
      if (status) {
        whereClause.status = status
      }
      
      if (workflowId) {
        whereClause.workflowId = workflowId
      }

      const executions = await db.workflowExecution.findMany({
        where: whereClause,
        orderBy: { startedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          workflow: {
            select: {
              name: true,
              id: true,
            },
          },
        },
      })

      return executions.map(execution => ({
        ...execution,
        results: execution.results ? JSON.parse(execution.results) : null,
      }))
    } catch (error) {
      console.error('Error fetching user execution history:', error)
      throw error
    }
  }

  static async getExecutionCount(userId: string, status?: string, workflowId?: string) {
    try {
      const whereClause: any = { userId }
      
      if (status) {
        whereClause.status = status
      }
      
      if (workflowId) {
        whereClause.workflowId = workflowId
      }

      return await db.workflowExecution.count({
        where: whereClause,
      })
    } catch (error) {
      console.error('Error fetching execution count:', error)
      throw error
    }
  }

  static async getExecutionStats(userId: string) {
    try {
      const stats = await db.workflowExecution.groupBy({
        by: ['status'],
        where: { userId },
        _count: {
          status: true,
        },
      })

      const totalExecutions = await db.workflowExecution.count({
        where: { userId },
      })

      const successfulExecutions = stats.find(s => s.status === 'success')?._count.status || 0
      const failedExecutions = stats.find(s => s.status === 'failed')?._count.status || 0
      const partialExecutions = stats.find(s => s.status === 'partial')?._count.status || 0

      return {
        total: totalExecutions,
        successful: successfulExecutions,
        failed: failedExecutions,
        partial: partialExecutions,
        successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      }
    } catch (error) {
      console.error('Error fetching execution stats:', error)
      throw error
    }
  }

  static async getRecentExecutions(userId: string, days: number = 7) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const executions = await db.workflowExecution.findMany({
        where: {
          userId,
          startedAt: {
            gte: startDate,
          },
        },
        orderBy: { startedAt: 'desc' },
        include: {
          workflow: {
            select: {
              name: true,
              id: true,
            },
          },
        },
      })

      return executions.map(execution => ({
        ...execution,
        results: execution.results ? JSON.parse(execution.results) : null,
      }))
    } catch (error) {
      console.error('Error fetching recent executions:', error)
      throw error
    }
  }
} 