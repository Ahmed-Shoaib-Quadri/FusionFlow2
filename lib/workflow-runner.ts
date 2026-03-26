import axios from 'axios'
import { Workflows } from '@prisma/client'
import { db } from '@/lib/db'
import { postContentToWebHook } from '@/app/(main)/(pages)/connections/_actions/discord-connection'
import { onCreateNewPageInDatabase } from '@/app/(main)/(pages)/connections/_actions/notion-connection'
import { postMessageToSlack } from '@/app/(main)/(pages)/connections/_actions/slack-connection'
import {
  getTriggerMetadata,
  matchesTrigger,
  parseWorkflowEdges,
  parseWorkflowNodes,
  validateWorkflowDefinition,
} from './workflow-definition'
import { WorkflowExecutionService } from './workflow-execution-service'
import { WorkflowTriggerType } from './types'

type RunnerResult = {
  workflowId: string
  status: 'completed' | 'failed' | 'skipped'
  results?: any[]
  error?: string
  reason?: string
}

type ExecuteWorkflowOptions = {
  workflow: Workflows
  triggerType: WorkflowTriggerType
  startedAt?: Date
}

type ResumeWorkflowOptions = {
  workflow: Workflows
  triggerType: Extract<WorkflowTriggerType, 'scheduled'>
}

async function scheduleWaitStep(workflowId: string, currentIndex: number) {
  return axios.put(
    'https://api.cron-job.org/jobs',
    {
      job: {
        url: `${(process.env.NGROK_URI || process.env.NEXT_PUBLIC_URL || '').trim()}/api/cron/wait?flow_id=${workflowId}&current_index=${currentIndex}`,
        enabled: true,
        schedule: {
          timezone: 'UTC',
          expiresAt: 0,
          hours: [-1],
          mdays: [-1],
          minutes: [0, 1, 2, 3, 4, 5],
          months: [-1],
          wdays: [-1],
        },
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.CRON_JOB_KEY!}`,
        'Content-Type': 'application/json',
      },
    }
  )
}

export async function executeWorkflow({
  workflow,
  triggerType,
  startedAt = new Date(),
}: ExecuteWorkflowOptions): Promise<RunnerResult> {
  const nodes = parseWorkflowNodes(workflow.nodes)
  const edges = parseWorkflowEdges(workflow.edges)
  const triggerMetadata = getTriggerMetadata(nodes)

  if (!matchesTrigger(triggerMetadata, triggerType)) {
    return {
      workflowId: workflow.id,
      status: 'skipped',
      reason: 'trigger_mismatch',
    }
  }

  const validation = validateWorkflowDefinition(nodes, edges)
  if (validation.errors.length) {
    await WorkflowExecutionService.logExecution({
      workflowId: workflow.id,
      userId: workflow.userId,
      status: 'failed',
      triggerType,
      error: validation.errors.join(' '),
      startedAt,
    })

    return {
      workflowId: workflow.id,
      status: 'failed',
      error: validation.errors.join(' '),
    }
  }

  const flowPath = validation.flowPath
  const results: any[] = []
  let overallStatus: 'success' | 'failed' | 'partial' = 'success'

  for (let currentIndex = 0; currentIndex < flowPath.length; currentIndex++) {
    const currentNode = flowPath[currentIndex]

    try {
      switch (currentNode) {
        case 'Discord': {
          const discordWebhook = await db.discordWebhook.findFirst({
            where: { userId: workflow.userId },
            select: { url: true },
          })

          if (discordWebhook && workflow.discordTemplate) {
            await postContentToWebHook(workflow.discordTemplate, discordWebhook.url)
            results.push({ node: 'Discord', status: 'success' })
          } else {
            results.push({
              node: 'Discord',
              status: 'failed',
              reason: 'no_webhook_or_template',
            })
            overallStatus = 'partial'
          }
          break
        }

        case 'Slack': {
          if (
            workflow.slackAccessToken &&
            workflow.slackTemplate &&
            workflow.slackChannels.length > 0
          ) {
            const channels = workflow.slackChannels.map((channel) => ({
              label: channel,
              value: channel,
            }))

            await postMessageToSlack(
              workflow.slackAccessToken,
              channels,
              workflow.slackTemplate
            )
            results.push({ node: 'Slack', status: 'success' })
          } else {
            results.push({
              node: 'Slack',
              status: 'failed',
              reason: 'missing_config',
            })
            overallStatus = 'partial'
          }
          break
        }

        case 'Notion': {
          if (workflow.notionAccessToken && workflow.notionDbId && workflow.notionTemplate) {
            await onCreateNewPageInDatabase(
              workflow.notionDbId,
              workflow.notionAccessToken,
              JSON.parse(workflow.notionTemplate)
            )
            results.push({ node: 'Notion', status: 'success' })
          } else {
            results.push({
              node: 'Notion',
              status: 'failed',
              reason: 'missing_config',
            })
            overallStatus = 'partial'
          }
          break
        }

        case 'Wait': {
          const cronResponse = await scheduleWaitStep(workflow.id, currentIndex)

          if (cronResponse.status === 200) {
            const remainingPath = flowPath.slice(currentIndex + 1)
            await db.workflows.update({
              where: { id: workflow.id },
              data: { cronPath: JSON.stringify(remainingPath) },
            })
            results.push({ node: 'Wait', status: 'scheduled' })

            await WorkflowExecutionService.logExecution({
              workflowId: workflow.id,
              userId: workflow.userId,
              status: overallStatus,
              triggerType,
              results,
              startedAt,
            })

            return {
              workflowId: workflow.id,
              status: 'completed',
              results,
            }
          }

          results.push({
            node: 'Wait',
            status: 'failed',
            reason: 'cron_schedule_failed',
          })
          overallStatus = 'partial'
          break
        }

        default: {
          results.push({
            node: currentNode,
            status: 'failed',
            reason: 'unsupported_node_type',
          })
          overallStatus = 'partial'
          break
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown execution error'
      results.push({
        node: currentNode,
        status: 'failed',
        reason: 'execution_error',
        error: message,
      })
      overallStatus = 'partial'
    }
  }

  await WorkflowExecutionService.logExecution({
    workflowId: workflow.id,
    userId: workflow.userId,
    status: overallStatus,
    triggerType,
    results,
    startedAt,
  })

  return {
    workflowId: workflow.id,
    status: 'completed',
    results,
  }
}

export async function executePublishedWorkflowById(
  workflowId: string,
  triggerType: WorkflowTriggerType
) {
  const workflow = await db.workflows.findUnique({
    where: { id: workflowId },
  })

  if (!workflow) {
    throw new Error('Workflow not found')
  }

  if (!workflow.publish) {
    throw new Error('Workflow is not published')
  }

  return executeWorkflow({ workflow, triggerType })
}

export async function resumeDelayedWorkflow({
  workflow,
  triggerType,
}: ResumeWorkflowOptions) {
  if (!workflow.cronPath) {
    return {
      workflowId: workflow.id,
      status: 'failed',
      error: 'No delayed workflow path found',
    }
  }

  const remainingPath = JSON.parse(workflow.cronPath) as string[]
  const results: any[] = []

  for (let currentIndex = 0; currentIndex < remainingPath.length; currentIndex++) {
    const currentNode = remainingPath[currentIndex]

    try {
      switch (currentNode) {
        case 'Discord': {
          const discordWebhook = await db.discordWebhook.findFirst({
            where: { userId: workflow.userId },
            select: { url: true },
          })

          if (discordWebhook && workflow.discordTemplate) {
            await postContentToWebHook(workflow.discordTemplate, discordWebhook.url)
            results.push({ node: 'Discord', status: 'success' })
          } else {
            results.push({ node: 'Discord', status: 'failed', reason: 'missing_config' })
          }
          break
        }

        case 'Slack': {
          if (
            workflow.slackAccessToken &&
            workflow.slackTemplate &&
            workflow.slackChannels.length > 0
          ) {
            await postMessageToSlack(
              workflow.slackAccessToken,
              workflow.slackChannels.map((channel) => ({
                label: channel,
                value: channel,
              })),
              workflow.slackTemplate
            )
            results.push({ node: 'Slack', status: 'success' })
          } else {
            results.push({ node: 'Slack', status: 'failed', reason: 'missing_config' })
          }
          break
        }

        case 'Notion': {
          if (workflow.notionAccessToken && workflow.notionDbId && workflow.notionTemplate) {
            await onCreateNewPageInDatabase(
              workflow.notionDbId,
              workflow.notionAccessToken,
              JSON.parse(workflow.notionTemplate)
            )
            results.push({ node: 'Notion', status: 'success' })
          } else {
            results.push({ node: 'Notion', status: 'failed', reason: 'missing_config' })
          }
          break
        }

        case 'Wait': {
          const cronResponse = await scheduleWaitStep(workflow.id, currentIndex)

          if (cronResponse.status === 200) {
            const remainingPathAfterWait = remainingPath.slice(currentIndex + 1)
            await db.workflows.update({
              where: { id: workflow.id },
              data: { cronPath: JSON.stringify(remainingPathAfterWait) },
            })
            results.push({ node: 'Wait', status: 'scheduled' })
            return {
              workflowId: workflow.id,
              status: 'completed',
              results,
            }
          }

          results.push({ node: 'Wait', status: 'failed', reason: 'cron_schedule_failed' })
          break
        }

        default:
          results.push({ node: currentNode, status: 'failed', reason: 'unsupported_node_type' })
      }
    } catch (error) {
      results.push({
        node: currentNode,
        status: 'failed',
        reason: 'execution_error',
        error: error instanceof Error ? error.message : 'Unknown execution error',
      })
    }
  }

  await db.workflows.update({
    where: { id: workflow.id },
    data: { cronPath: null },
  })

  await WorkflowExecutionService.logExecution({
    workflowId: workflow.id,
    userId: workflow.userId,
    status: 'success',
    triggerType,
    results,
  })

  return {
    workflowId: workflow.id,
    status: 'completed',
    results,
  }
}
