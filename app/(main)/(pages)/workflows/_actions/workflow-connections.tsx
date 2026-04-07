'use server'

import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { Option } from '@/store'
import {
  getTriggerMetadata,
  parseWorkflowEdges,
  parseWorkflowNodes,
  scheduleIntervalToCronJobSchedule,
  validateWorkflowDefinition,
} from '@/lib/workflow-definition'

const getBaseUrl = () =>
  (process.env.NEXT_PUBLIC_URL || process.env.NGROK_URI || 'http://localhost:3000').trim()

const getWorkflowForCurrentUser = async (workflowId: string) => {
  const user = await currentUser()
  if (!user) return null

  const workflow = await db.workflows.findFirst({
    where: {
      id: workflowId,
      userId: user.id,
    },
  })

  if (!workflow) return null

  return { workflow, user }
}

const syncScheduledTrigger = async (
  workflowId: string,
  publish: boolean,
  nodesRaw?: string | null
) => {
  const nodes = parseWorkflowNodes(nodesRaw)
  const triggerNode = nodes.find((node) => node.type === 'Trigger')
  if (!triggerNode) return { updatedNodes: nodesRaw || null }

  const metadata = getTriggerMetadata(nodes)
  if (metadata.triggerType !== 'scheduled') {
    return { updatedNodes: JSON.stringify(nodes) }
  }

  const existingJobId = (triggerNode.data.metadata as Record<string, any>).scheduledJobId

  if (!publish && existingJobId) {
    await fetch(`https://api.cron-job.org/jobs/${existingJobId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${process.env.CRON_JOB_KEY!}`,
        'Content-Type': 'application/json',
      },
    }).catch((error) => {
      console.error('Failed to delete scheduled trigger job:', error)
    })

    triggerNode.data.metadata = {
      ...triggerNode.data.metadata,
      scheduledJobId: '',
    }

    return { updatedNodes: JSON.stringify(nodes) }
  }

  if (publish) {
    const webhookSecret =
      metadata.webhookSecret || crypto.randomUUID().replace(/-/g, '')

    if (existingJobId) {
      await fetch(`https://api.cron-job.org/jobs/${existingJobId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.CRON_JOB_KEY!}`,
          'Content-Type': 'application/json',
        },
      }).catch((error) => {
        console.error('Failed to replace scheduled trigger job:', error)
      })
    }

    const response = await fetch('https://api.cron-job.org/jobs', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.CRON_JOB_KEY!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job: {
          url: `${getBaseUrl()}/api/workflows/scheduled/${workflowId}?token=${webhookSecret}`,
          enabled: true,
          schedule: scheduleIntervalToCronJobSchedule(metadata.scheduleInterval || '1h'),
        },
      }),
    })

    const payload = await response.json().catch(() => null)
    const scheduledJobId = payload?.jobId || payload?.job?.jobId || ''

    triggerNode.data.metadata = {
      ...triggerNode.data.metadata,
      webhookSecret,
      scheduledJobId,
      isConfigured: true,
    }

    return { updatedNodes: JSON.stringify(nodes) }
  }

  return { updatedNodes: JSON.stringify(nodes) }
}

export const getGoogleListener = async () => {
  const authUser = await currentUser()
  if (!authUser) return null

  const listener = await db.user.findUnique({
    where: {
      clerkId: authUser.id,
    },
    select: {
      googleResourceId: true,
    },
  })

  return listener
}

export const onFlowPublish = async (workflowId: string, state: boolean) => {
  const current = await getWorkflowForCurrentUser(workflowId)
  if (!current) return 'Workflow not found'

  const { workflow } = current
  const nodes = parseWorkflowNodes(workflow.nodes)
  const edges = parseWorkflowEdges(workflow.edges)
  const validation = validateWorkflowDefinition(nodes, edges)

  if (state && validation.errors.length) {
    return validation.errors[0]
  }

  const triggerMetadata = validation.triggerMetadata
  if (state && triggerMetadata.triggerType === 'google_drive') {
    const listener = await getGoogleListener()
    if (!listener?.googleResourceId) {
      return 'Create a Google Drive listener before publishing this workflow'
    }
  }

  const scheduleSync = await syncScheduledTrigger(workflowId, state, workflow.nodes)

  const published = await db.workflows.update({
    where: {
      id: workflowId,
    },
    data: {
      publish: state,
      flowPath: JSON.stringify(validation.flowPath),
      nodes: scheduleSync.updatedNodes || workflow.nodes,
    },
  })

  return published.publish ? 'Workflow published' : 'Workflow not published'
}

export const onSaveWorkflow = async (
  workflowId: string,
  nodes: any[],
  edges: any[]
) => {
  try {
    const current = await getWorkflowForCurrentUser(workflowId)
    if (!current) {
      return { message: 'Workflow not found' }
    }

    const validation = validateWorkflowDefinition(nodes, edges)

    const response = await db.workflows.update({
      where: {
        id: workflowId,
      },
      data: {
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        flowPath: JSON.stringify(validation.flowPath),
      },
    })

    if (response) {
      return { message: 'Workflow saved successfully' }
    }

    return { message: 'Failed to save workflow' }
  } catch (error) {
    console.error('Error saving workflow:', error)
    return {
      message: 'Error saving workflow',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export const onCreateNodeTemplate = async (
  content: string,
  type: string,
  workflowId: string,
  channels?: Option[],
  accessToken?: string,
  notionDbId?: string
) => {
  const current = await getWorkflowForCurrentUser(workflowId)
  if (!current) return 'Workflow not found'

  if (type === 'Discord') {
    const response = await db.workflows.update({
      where: { id: workflowId },
      data: { discordTemplate: content },
    })

    if (response) return 'Discord template saved'
  }

  if (type === 'Slack') {
    const nextChannels = Array.from(
      new Set((channels || []).map((channel) => channel.value))
    )

    const response = await db.workflows.update({
      where: { id: workflowId },
      data: {
        slackTemplate: content,
        slackAccessToken: accessToken,
        slackChannels: nextChannels,
      },
    })

    if (response) return 'Slack template saved'
  }

  if (type === 'Notion') {
    const response = await db.workflows.update({
      where: { id: workflowId },
      data: {
        notionTemplate: content,
        notionAccessToken: accessToken,
        notionDbId,
      },
    })

    if (response) return 'Notion template saved'
  }

  return 'Template could not be saved'
}

export const onGetWorkflows = async () => {
  const user = await currentUser()
  if (!user) return []

  const workflows = await db.workflows.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      updatedAt: 'desc',
    },
  })

  return workflows
}

export const onCreateWorkflow = async (name: string, description: string) => {
  const user = await currentUser()
  if (!user) return { message: 'User not authenticated' }

  const workflow = await db.workflows.create({
    data: {
      userId: user.id,
      name,
      description,
    },
  })

  if (workflow) {
    return { message: 'workflow created', workflowId: workflow.id }
  }

  return { message: 'Oops! try again' }
}

export const onGetNodesEdges = async (flowId: string) => {
  const current = await getWorkflowForCurrentUser(flowId)
  if (!current) return null

  const { workflow } = current
  return {
    nodes: workflow.nodes,
    edges: workflow.edges,
  }
}

export const onDeleteWorkflow = async (workflowId: string) => {
  try {
    const current = await getWorkflowForCurrentUser(workflowId)
    if (!current) return { message: 'Workflow not found' }

    const { workflow } = current
    const triggerMetadata = getTriggerMetadata(parseWorkflowNodes(workflow.nodes))
    const scheduledJobId = (triggerMetadata as Record<string, any>).scheduledJobId

    if (scheduledJobId) {
      await fetch(`https://api.cron-job.org/jobs/${scheduledJobId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${process.env.CRON_JOB_KEY!}`,
          'Content-Type': 'application/json',
        },
      }).catch((error) => {
        console.error('Failed to delete scheduled trigger job:', error)
      })
    }

    await db.workflows.delete({
      where: {
        id: workflowId,
      },
    })

    return { message: 'Workflow deleted successfully' }
  } catch (error) {
    console.error('Error deleting workflow:', error)
    return {
      message: 'Error deleting workflow',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export const onDuplicateWorkflow = async (workflowId: string) => {
  try {
    const current = await getWorkflowForCurrentUser(workflowId)
    if (!current) return { message: 'Workflow not found' }

    const { workflow, user } = current
    const nodes = parseWorkflowNodes(workflow.nodes)
    const triggerNode = nodes.find((node) => node.type === 'Trigger')

    if (triggerNode) {
      triggerNode.data.metadata = {
        ...triggerNode.data.metadata,
        scheduledJobId: '',
      }
    }

    const duplicated = await db.workflows.create({
      data: {
        userId: user.id,
        name: `${workflow.name} (Copy)`,
        description: workflow.description,
        nodes: JSON.stringify(nodes),
        edges: workflow.edges,
        discordTemplate: workflow.discordTemplate,
        notionTemplate: workflow.notionTemplate,
        slackTemplate: workflow.slackTemplate,
        slackChannels: workflow.slackChannels,
        slackAccessToken: workflow.slackAccessToken,
        notionAccessToken: workflow.notionAccessToken,
        notionDbId: workflow.notionDbId,
        flowPath: workflow.flowPath,
        cronPath: null,
        publish: false,
      },
    })

    if (duplicated) {
      return {
        message: 'Workflow duplicated successfully',
        workflowId: duplicated.id,
      }
    }

    return { message: 'Failed to duplicate workflow' }
  } catch (error) {
    console.error('Error duplicating workflow:', error)
    return {
      message: 'Error duplicating workflow',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
