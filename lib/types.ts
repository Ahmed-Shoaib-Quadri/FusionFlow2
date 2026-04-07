import { ConnectionProviderProps } from '@/app/providers/connections-provider';
import { z } from 'zod';

export const EditUserProfileSchema = z.object({
    email: z.string().email('Required'),
    name: z.string().min(1,'Required'),
})

export const WorkflowFormSchema = z.object({
    name: z.string().min(1, 'Required'),
    description: z.string().min(1, 'Required'),
})

export type ConnectionTypes = 'Google Drive' | 'Notion' | 'Slack' | 'Discord'

export type Connection = {
    title: ConnectionTypes
    description: string
    image: string
    connectionKey: keyof ConnectionProviderProps
    accessTokenKey?: string
    alwaysTrue?: boolean
    slackSpecial?: boolean
}

export type EditorCanvasTypes = 
 | 'Email'
 | 'Condition'
 | 'AI'
 | 'Discord'
 | 'Slack'
 | 'Google Drive'
 | 'Notion'
 | 'Custom Webhook'
 | 'Google Calender'
 | 'Trigger'
 | 'Action'
 | 'Wait';

export type WorkflowTriggerType =
 | 'google_drive'
 | 'manual'
 | 'scheduled'
 | 'webhook'

export type DriveChangeEventType =
 | 'created'
 | 'updated'
 | 'deleted'

export type TriggerMetadata = {
    triggerType?: WorkflowTriggerType
    isConfigured?: boolean
    isEnabled?: boolean
    scheduleInterval?: '5m' | '15m' | '30m' | '1h' | '24h'
    webhookSecret?: string
    scheduledJobId?: string
    driveEventTypes?: DriveChangeEventType[]
}

export type WorkflowComparisonOperator =
 | 'equals'
 | 'not_equals'
 | 'contains'
 | 'not_contains'
 | 'greater_than'
 | 'less_than'

export type WorkflowNodeMetadata = TriggerMetadata & {
    content?: string
    contentType?: 'text' | 'json'
    channels?: string[]
    notionContent?: string
    waitMinutes?: number
    webhookUrl?: string
    webhookMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH'
    webhookHeaders?: string
    emailTo?: string
    emailSubject?: string
    emailBody?: string
    emailFrom?: string
    aiPrompt?: string
    aiModel?: string
    calendarSummary?: string
    calendarDescription?: string
    calendarStart?: string
    calendarEnd?: string
    actionValue?: string
    conditionLeft?: string
    conditionRight?: string
    conditionOperator?: WorkflowComparisonOperator
    selectedOutput?: string
    lastRunPreview?: string
}

export type EditorCanvasCardType = {
    title: string
    description: string
    completed: boolean
    current: boolean
    metadata: WorkflowNodeMetadata
    type: EditorCanvasTypes
}

export type EditorNodeType = {
    id: string
    type: EditorCanvasCardType['type']
    position: {
        x: number
        y: number
    }
    data: EditorCanvasCardType 
}

export type EditorNode = EditorNodeType;

export type EditorActions = 
 | {
    type: 'LOAD_DATA'
    payload: {
        elements: EditorNode[]
        edges: {
            id: string
            source: string
            target: string
            sourceHandle?: string | null
            targetHandle?: string | null
        }[]
    }
 }
 | {
    type: 'UPDATE_NODE'
    payload: {
        nodeId: string
        data: EditorCanvasCardType
    }
 }
 | {type: 'REDO'}
 | {type: 'UNDO'}
 | {
    type: 'SELECTED_ELEMENT'
    payload: {
        element: EditorNode
    }
 }
 | {
    type: 'DELETE_NODE'
    payload: {
        nodeId: string
    }
 }

 export const nodeMapper: Record<string,string> = {
    Notion: 'notionNode',
    Slack: 'slackNode',
    Discord: 'discordNode',
    'Google Drive': 'googleNode',
 }
