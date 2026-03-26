import { EditorNode, TriggerMetadata, WorkflowTriggerType } from './types'

export type WorkflowEdge = {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

export const DEFAULT_TRIGGER_TYPE: WorkflowTriggerType = 'google_drive'
export const DEFAULT_SCHEDULE_INTERVAL: NonNullable<TriggerMetadata['scheduleInterval']> = '1h'

export const EMPTY_EDITOR_NODE: EditorNode = {
  data: {
    completed: false,
    current: false,
    description: '',
    metadata: {},
    title: '',
    type: 'Trigger',
  },
  id: '',
  position: { x: 0, y: 0 },
  type: 'Trigger',
}

export function parseWorkflowNodes(nodes?: string | null): EditorNode[] {
  if (!nodes) return []

  try {
    const parsed = JSON.parse(nodes)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to parse workflow nodes:', error)
    return []
  }
}

export function parseWorkflowEdges(edges?: string | null): WorkflowEdge[] {
  if (!edges) return []

  try {
    const parsed = JSON.parse(edges)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Failed to parse workflow edges:', error)
    return []
  }
}

export function getTriggerNode(nodes: EditorNode[]) {
  return nodes.find((node) => node.type === 'Trigger') || null
}

export function getTriggerMetadata(nodes: EditorNode[]): TriggerMetadata {
  const triggerNode = getTriggerNode(nodes)
  const metadata = (triggerNode?.data.metadata || {}) as TriggerMetadata

  return {
    triggerType: metadata.triggerType || DEFAULT_TRIGGER_TYPE,
    isConfigured: metadata.isConfigured ?? false,
    isEnabled: metadata.isEnabled ?? true,
    scheduleInterval: metadata.scheduleInterval || DEFAULT_SCHEDULE_INTERVAL,
    webhookSecret: metadata.webhookSecret || '',
  }
}

export function buildWorkflowPath(nodes: EditorNode[], edges: WorkflowEdge[]) {
  const triggerNode = getTriggerNode(nodes)
  if (!triggerNode) return []

  const adjacency = new Map<string, string[]>()
  edges.forEach((edge) => {
    const targets = adjacency.get(edge.source) || []
    targets.push(edge.target)
    adjacency.set(edge.source, targets)
  })

  const visited = new Set<string>()
  const orderedNodeIds: string[] = []

  const visit = (nodeId: string) => {
    const targets = adjacency.get(nodeId) || []
    targets.forEach((targetId) => {
      if (visited.has(targetId)) return
      visited.add(targetId)

      const targetNode = nodes.find((node) => node.id === targetId)
      if (!targetNode) return

      orderedNodeIds.push(targetNode.id)
      visit(targetId)
    })
  }

  visit(triggerNode.id)
  return orderedNodeIds
}

export function getNodeById(nodes: EditorNode[], nodeId: string) {
  return nodes.find((node) => node.id === nodeId) || null
}

export function getOutgoingEdges(edges: WorkflowEdge[], nodeId: string) {
  return edges.filter((edge) => edge.source === nodeId)
}

export function validateWorkflowDefinition(
  nodes: EditorNode[],
  edges: WorkflowEdge[]
) {
  const errors: string[] = []
  const triggerNode = getTriggerNode(nodes)

  if (!triggerNode) {
    errors.push('Add a trigger node before publishing.')
    return {
      errors,
      flowPath: [] as string[],
      triggerMetadata: getTriggerMetadata(nodes),
    }
  }

  const triggerMetadata = getTriggerMetadata(nodes)

  if (triggerMetadata.isEnabled === false) {
    errors.push('Enable the trigger before publishing.')
  }

  if (!triggerMetadata.isConfigured) {
    errors.push('Configure the trigger before publishing.')
  }

  if (
    triggerMetadata.triggerType === 'scheduled' &&
    !triggerMetadata.scheduleInterval
  ) {
    errors.push('Select a schedule interval for the scheduled trigger.')
  }

  if (
    triggerMetadata.triggerType === 'webhook' &&
    !triggerMetadata.webhookSecret
  ) {
    errors.push('Generate a webhook secret before publishing.')
  }

  const flowPath = buildWorkflowPath(nodes, edges)

  if (!flowPath.length) {
    errors.push('Connect at least one action node to the trigger.')
  }

  return {
    errors,
    flowPath,
    triggerMetadata,
  }
}

export function matchesTrigger(
  triggerMetadata: TriggerMetadata,
  triggerType: WorkflowTriggerType
) {
  const configuredTrigger = triggerMetadata.triggerType || DEFAULT_TRIGGER_TYPE
  return configuredTrigger === triggerType && triggerMetadata.isEnabled !== false
}

export function scheduleIntervalToCronJobSchedule(
  interval: NonNullable<TriggerMetadata['scheduleInterval']>
) {
  switch (interval) {
    case '5m':
      return {
        timezone: 'UTC',
        expiresAt: 0,
        hours: [-1],
        mdays: [-1],
        minutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
        months: [-1],
        wdays: [-1],
      }
    case '15m':
      return {
        timezone: 'UTC',
        expiresAt: 0,
        hours: [-1],
        mdays: [-1],
        minutes: [0, 15, 30, 45],
        months: [-1],
        wdays: [-1],
      }
    case '30m':
      return {
        timezone: 'UTC',
        expiresAt: 0,
        hours: [-1],
        mdays: [-1],
        minutes: [0, 30],
        months: [-1],
        wdays: [-1],
      }
    case '24h':
      return {
        timezone: 'UTC',
        expiresAt: 0,
        hours: [0],
        mdays: [-1],
        minutes: [0],
        months: [-1],
        wdays: [-1],
      }
    case '1h':
    default:
      return {
        timezone: 'UTC',
        expiresAt: 0,
        hours: [-1],
        mdays: [-1],
        minutes: [0],
        months: [-1],
        wdays: [-1],
      }
  }
}
