import axios from 'axios'
import nodemailer from 'nodemailer'
import { Workflows } from '@prisma/client'
import { clerkClient } from '@clerk/nextjs/server'
import { google } from 'googleapis'
import { db } from '@/lib/db'
import { postContentToWebHook } from '@/app/(main)/(pages)/connections/_actions/discord-connection'
import { onCreateNewPageInDatabase } from '@/app/(main)/(pages)/connections/_actions/notion-connection'
import { postMessageToSlack } from '@/app/(main)/(pages)/connections/_actions/slack-connection'
import {
  getNodeById,
  getOutgoingEdges,
  getTriggerNode,
  getTriggerMetadata,
  matchesTrigger,
  parseWorkflowEdges,
  parseWorkflowNodes,
  validateWorkflowDefinition,
} from './workflow-definition'
import { WorkflowExecutionService } from './workflow-execution-service'
import {
  EditorNode,
  WorkflowComparisonOperator,
  WorkflowNodeMetadata,
  WorkflowTriggerType,
} from './types'

type RunnerResult = {
  workflowId: string
  status: 'completed' | 'failed' | 'partial' | 'skipped'
  results?: NodeExecutionResult[]
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

type WorkflowContext = {
  workflowId: string
  userId: string
  triggerType: WorkflowTriggerType
  values: Record<string, string>
  lastValue: string
  lastNodeId?: string
}

type NodeExecutionResult = {
  nodeId: string
  node: string
  status: 'success' | 'failed' | 'scheduled' | 'skipped'
  reason?: string
  error?: string
  output?: string
}

const resolveTemplate = (input: string | undefined, context: WorkflowContext) => {
  const raw = input || ''

  return raw.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, key: string) => {
    const cleaned = key.trim()

    if (cleaned === 'lastValue') return context.lastValue || ''
    if (cleaned === 'workflowId') return context.workflowId
    if (cleaned === 'triggerType') return context.triggerType
    if (cleaned === 'userId') return context.userId
    if (cleaned.startsWith('values.')) {
      return context.values[cleaned.slice('values.'.length)] || ''
    }

    return context.values[cleaned] || ''
  })
}

const parseJsonObject = (value?: string) => {
  if (!value) return undefined

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

const getGoogleOAuthClient = async (userId: string) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.OAUTH2_REDIRECT_URI
  )

  const clerk = await clerkClient()
  const tokenResponse = await clerk.users.getUserOauthAccessToken(userId, 'google')
  const accessToken = tokenResponse.data[0]?.token

  if (!accessToken) {
    throw new Error('Google OAuth token not found for user')
  }

  oauth2Client.setCredentials({
    access_token: accessToken,
  })

  return oauth2Client
}

const sendEmail = async (metadata: WorkflowNodeMetadata, context: WorkflowContext) => {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const to = resolveTemplate(metadata.emailTo, context)
  const subject = resolveTemplate(metadata.emailSubject, context)
  const body = resolveTemplate(metadata.emailBody, context)
  const from = resolveTemplate(
    metadata.emailFrom || process.env.SMTP_FROM || process.env.SMTP_USER,
    context
  )

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is missing')
  }

  if (!to || !subject || !body) {
    throw new Error('Email node is missing recipient, subject, or body')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  })

  await transporter.sendMail({
    from,
    to,
    subject,
    text: body,
  })

  return `Email sent to ${to}`
}

const runAiPrompt = async (metadata: WorkflowNodeMetadata, context: WorkflowContext) => {
  const apiKey = process.env.OPENAI_API_KEY
  const model = metadata.aiModel || process.env.OPENAI_MODEL || 'gpt-4.1-mini'
  const prompt = resolveTemplate(metadata.aiPrompt, context)

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured')
  }

  if (!prompt) {
    throw new Error('AI node prompt is empty')
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'AI request failed')
  }

  const outputText = payload?.output_text || ''
  if (!outputText) {
    throw new Error('AI node returned no text output')
  }

  return outputText
}

const createCalendarEvent = async (
  workflow: Workflows,
  metadata: WorkflowNodeMetadata,
  context: WorkflowContext
) => {
  const auth = await getGoogleOAuthClient(workflow.userId)
  const calendar = google.calendar({ version: 'v3', auth })

  const summary = resolveTemplate(metadata.calendarSummary, context)
  const description = resolveTemplate(metadata.calendarDescription, context)
  const start = metadata.calendarStart
  const end = metadata.calendarEnd

  if (!summary || !start || !end) {
    throw new Error('Calendar node is missing summary, start, or end time')
  }

  const event = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary,
      description,
      start: { dateTime: start },
      end: { dateTime: end },
    },
  })

  return event.data.htmlLink || `Calendar event created: ${summary}`
}

const compareCondition = (
  operator: WorkflowComparisonOperator = 'contains',
  left: string,
  right: string
) => {
  switch (operator) {
    case 'equals':
      return left === right
    case 'not_equals':
      return left !== right
    case 'contains':
      return left.includes(right)
    case 'not_contains':
      return !left.includes(right)
    case 'greater_than':
      return Number(left) > Number(right)
    case 'less_than':
      return Number(left) < Number(right)
    default:
      return false
  }
}

async function scheduleWaitStep(
  workflowId: string,
  currentIndex: number,
  waitMinutes: number
) {
  const fireAt = new Date(Date.now() + waitMinutes * 60 * 1000)

  return axios.put(
    'https://api.cron-job.org/jobs',
    {
      job: {
        url: `${(process.env.NGROK_URI || process.env.NEXT_PUBLIC_URL || '').trim()}/api/cron/wait?flow_id=${workflowId}&current_index=${currentIndex}`,
        enabled: true,
        schedule: {
          timezone: 'UTC',
          expiresAt: 0,
          hours: [fireAt.getUTCHours()],
          mdays: [fireAt.getUTCDate()],
          minutes: [fireAt.getUTCMinutes()],
          months: [fireAt.getUTCMonth() + 1],
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

const executeNode = async (
  workflow: Workflows,
  node: EditorNode,
  context: WorkflowContext
): Promise<NodeExecutionResult> => {
  const metadata = node.data.metadata || {}

  switch (node.type) {
    case 'Action': {
      const output = resolveTemplate(metadata.actionValue || node.data.title, context)
      context.lastValue = output
      context.values[node.id] = output

      return {
        nodeId: node.id,
        node: node.data.title,
        status: 'success',
        output,
      }
    }

    case 'Discord': {
      const content = resolveTemplate(metadata.content || workflow.discordTemplate || '', context)
      const discordWebhook = await db.discordWebhook.findFirst({
        where: { userId: workflow.userId },
        select: { url: true },
      })

      if (!discordWebhook || !content) {
        throw new Error('Discord node is missing webhook or message content')
      }

      await postContentToWebHook(content, discordWebhook.url)
      context.lastValue = content
      context.values[node.id] = content

      return { nodeId: node.id, node: 'Discord', status: 'success', output: content }
    }

    case 'Slack': {
      const content = resolveTemplate(metadata.content || workflow.slackTemplate || '', context)
      const channels = (metadata.channels || workflow.slackChannels || []).map((channel) => ({
        label: channel,
        value: channel,
      }))
      const slackConnection =
        workflow.slackAccessToken
          ? null
          : await db.slack.findFirst({
              where: { userId: workflow.userId },
              select: { slackAccessToken: true },
            })
      const slackAccessToken =
        workflow.slackAccessToken || slackConnection?.slackAccessToken || ''

      if (!slackAccessToken || !content || !channels.length) {
        throw new Error('Slack node is missing token, channels, or message content')
      }

      await postMessageToSlack(slackAccessToken, channels, content)
      context.lastValue = content
      context.values[node.id] = content

      return { nodeId: node.id, node: 'Slack', status: 'success', output: content }
    }

    case 'Notion': {
      const notionConnection =
        workflow.notionAccessToken && workflow.notionDbId
          ? null
          : await db.notion.findFirst({
              where: { userId: workflow.userId },
              select: { accessToken: true, databaseId: true },
            })
      const notionAccessToken =
        workflow.notionAccessToken || notionConnection?.accessToken || ''
      const notionDatabaseId = workflow.notionDbId || notionConnection?.databaseId || ''
      const content = resolveTemplate(
        metadata.notionContent || metadata.content || workflow.notionTemplate || '',
        context
      )

      if (!notionAccessToken || !notionDatabaseId || !content) {
        throw new Error('Notion node is missing database configuration or content')
      }

      await onCreateNewPageInDatabase(
        notionDatabaseId,
        notionAccessToken,
        content
      )

      context.lastValue = content
      context.values[node.id] = content

      return { nodeId: node.id, node: 'Notion', status: 'success', output: content }
    }

    case 'Custom Webhook': {
      const url = resolveTemplate(metadata.webhookUrl, context)
      const method = metadata.webhookMethod || 'POST'
      const headers = parseJsonObject(resolveTemplate(metadata.webhookHeaders, context)) || {}
      const body = resolveTemplate(metadata.content, context)

      if (!url) {
        throw new Error('Custom Webhook node is missing a target URL')
      }

      const response = await axios.request({
        method,
        url,
        headers,
        data:
          metadata.contentType === 'json'
            ? parseJsonObject(body) || { content: body }
            : { content: body },
      })

      const output =
        typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data)

      context.lastValue = output
      context.values[node.id] = output

      return { nodeId: node.id, node: 'Custom Webhook', status: 'success', output }
    }

    case 'Email': {
      const output = await sendEmail(metadata, context)
      context.lastValue = output
      context.values[node.id] = output
      return { nodeId: node.id, node: 'Email', status: 'success', output }
    }

    case 'AI': {
      const output = await runAiPrompt(metadata, context)
      context.lastValue = output
      context.values[node.id] = output
      return { nodeId: node.id, node: 'AI', status: 'success', output }
    }

    case 'Google Calender': {
      const output = await createCalendarEvent(workflow, metadata, context)
      context.lastValue = output
      context.values[node.id] = output
      return { nodeId: node.id, node: 'Google Calender', status: 'success', output }
    }

    default:
      return {
        nodeId: node.id,
        node: node.type,
        status: 'skipped',
        reason: 'handled_by_graph_logic',
      }
  }
}

const followWorkflowGraph = async (
  workflow: Workflows,
  nodes: EditorNode[],
  edges: ReturnType<typeof parseWorkflowEdges>,
  triggerType: WorkflowTriggerType,
  startedAt: Date,
  resumeFromNodeIds?: string[]
) => {
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
      status: 'failed' as const,
      error: validation.errors.join(' '),
    }
  }

  const context: WorkflowContext = {
    workflowId: workflow.id,
    userId: workflow.userId,
    triggerType,
    values: {},
    lastValue: '',
  }

  const triggerNode = getTriggerNode(nodes)
  const pendingNodeIds = [
    ...(
      resumeFromNodeIds ||
      (triggerNode ? getOutgoingEdges(edges, triggerNode.id).map((edge) => edge.target) : [])
    ),
  ]
  const results: NodeExecutionResult[] = []
  let overallStatus: 'success' | 'partial' = 'success'

  while (pendingNodeIds.length > 0) {
    const nodeId = pendingNodeIds.shift()!
    const node = getNodeById(nodes, nodeId)

    if (!node) {
      results.push({
        nodeId,
        node: 'Unknown',
        status: 'failed',
        reason: 'node_not_found',
      })
      overallStatus = 'partial'
      continue
    }

    try {
      if (node.type === 'Condition') {
        const left = resolveTemplate(node.data.metadata.conditionLeft, context)
        const right = resolveTemplate(node.data.metadata.conditionRight, context)
        const passed = compareCondition(
          node.data.metadata.conditionOperator,
          left,
          right
        )

        context.lastValue = passed ? 'true' : 'false'
        context.values[node.id] = context.lastValue

        results.push({
          nodeId: node.id,
          node: 'Condition',
          status: 'success',
          output: context.lastValue,
        })

        const outgoing = getOutgoingEdges(edges, node.id)
        const preferredHandle = passed ? 'condition-true' : 'condition-false'
        const branchEdge =
          outgoing.find((edge) => edge.sourceHandle === preferredHandle) ||
          outgoing[0]

        if (branchEdge?.target) {
          pendingNodeIds.unshift(branchEdge.target)
        }

        continue
      }

      if (node.type === 'Wait') {
        const waitMinutes = Math.max(1, Number(node.data.metadata.waitMinutes || 5))
        const cronResponse = await scheduleWaitStep(workflow.id, results.length, waitMinutes)

        if (cronResponse.status === 200) {
          await db.workflows.update({
            where: { id: workflow.id },
            data: { cronPath: JSON.stringify(pendingNodeIds) },
          })

          results.push({
            nodeId: node.id,
            node: 'Wait',
            status: 'scheduled',
            output: `${waitMinutes} minute delay scheduled`,
          })

          await WorkflowExecutionService.logExecution({
            workflowId: workflow.id,
            userId: workflow.userId,
            status: overallStatus,
            triggerType,
            results,
            startedAt,
          })

          const resultStatus: RunnerResult['status'] =
            overallStatus === 'partial' ? 'partial' : 'completed'

          return {
            workflowId: workflow.id,
            status: resultStatus,
            results,
          }
        }

        throw new Error('Wait scheduling failed')
      }

      const executionResult = await executeNode(workflow, node, context)
      results.push(executionResult)

      const outgoing = getOutgoingEdges(edges, node.id)
      if (outgoing.length > 0) {
        const nextTargets = outgoing
          .map((edge) => edge.target)
          .filter((target, index, arr) => arr.indexOf(target) === index)

        pendingNodeIds.unshift(...nextTargets.reverse())
      }
    } catch (error) {
      results.push({
        nodeId: node.id,
        node: node.type,
        status: 'failed',
        reason: 'execution_error',
        error: error instanceof Error ? error.message : 'Unknown execution error',
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

  const finalStatus: RunnerResult['status'] =
    overallStatus === 'partial' ? 'partial' : 'completed'

  return {
    workflowId: workflow.id,
    status: finalStatus,
    results,
  }
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

  return followWorkflowGraph(workflow, nodes, edges, triggerType, startedAt)
}

export async function executePublishedWorkflowById(
  workflowId: string,
  triggerType: WorkflowTriggerType
) {
  const workflow = await db.workflows.findUnique({
    where: { id: workflowId },
  })

  if (!workflow) throw new Error('Workflow not found')
  if (!workflow.publish) throw new Error('Workflow is not published')

  return executeWorkflow({ workflow, triggerType })
}

export async function resumeDelayedWorkflow({
  workflow,
  triggerType,
}: ResumeWorkflowOptions) {
  if (!workflow.cronPath) {
    return {
      workflowId: workflow.id,
      status: 'failed' as const,
      error: 'No delayed workflow path found',
    }
  }

  const nodes = parseWorkflowNodes(workflow.nodes)
  const edges = parseWorkflowEdges(workflow.edges)
  const remainingNodeIds = JSON.parse(workflow.cronPath) as string[]

  const result = await followWorkflowGraph(
    workflow,
    nodes,
    edges,
    triggerType,
    new Date(),
    remainingNodeIds
  )

  if (result.status !== 'failed') {
    await db.workflows.update({
      where: { id: workflow.id },
      data: { cronPath: null },
    })
  }

  return result
}
