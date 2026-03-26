'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  MousePointerClickIcon,
  Globe,
  Clock,
  Link2,
  PlayCircle,
} from 'lucide-react'
import { useEditor } from '@/app/providers/editor-provider'
import { useNodeId } from 'reactflow'
import {
  DEFAULT_SCHEDULE_INTERVAL,
  DEFAULT_TRIGGER_TYPE,
} from '@/lib/workflow-definition'
import { EditorCanvasTypes, TriggerMetadata, WorkflowTriggerType } from '@/lib/types'

type TriggerNodeProps = {
  data: {
    title: string
    description: string
    type: string
    completed: boolean
    current: boolean
    metadata: Record<string, any>
  }
}

const triggerTypes: {
  id: WorkflowTriggerType
  name: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Run the workflow when your connected Google Drive changes.',
    icon: <Globe className="h-4 w-4" />,
  },
  {
    id: 'scheduled',
    name: 'Schedule',
    description: 'Run automatically on a recurring interval.',
    icon: <Clock className="h-4 w-4" />,
  },
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'Run when this workflow endpoint receives a request.',
    icon: <Link2 className="h-4 w-4" />,
  },
  {
    id: 'manual',
    name: 'Manual',
    description: 'Run on demand from the UI or API.',
    icon: <PlayCircle className="h-4 w-4" />,
  },
]

const scheduleOptions: NonNullable<TriggerMetadata['scheduleInterval']>[] = [
  '5m',
  '15m',
  '30m',
  '1h',
  '24h',
]

const TriggerNode = ({ data }: TriggerNodeProps) => {
  const nodeId = useNodeId()
  const { dispatch, state } = useEditor()
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>(DEFAULT_TRIGGER_TYPE)
  const [isConfigured, setIsConfigured] = useState(false)
  const [isEnabled, setIsEnabled] = useState(true)
  const [scheduleInterval, setScheduleInterval] = useState<
    NonNullable<TriggerMetadata['scheduleInterval']>
  >(DEFAULT_SCHEDULE_INTERVAL)
  const [webhookSecret, setWebhookSecret] = useState('')

  const currentNode = useMemo(
    () => state.editor.elements.find((node) => node.id === nodeId),
    [nodeId, state.editor.elements]
  )

  const webhookUrl = useMemo(() => {
    if (!webhookSecret) return ''
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/api/workflows/webhook/${nodeId}?token=${webhookSecret}`
  }, [nodeId, webhookSecret])

  const persistMetadata = (partial: Partial<TriggerMetadata>) => {
    if (!nodeId) return

    const nextMetadata: TriggerMetadata = {
      triggerType,
      isConfigured,
      isEnabled,
      scheduleInterval,
      webhookSecret,
      ...(data.metadata || {}),
      ...partial,
    }

    dispatch({
      type: 'UPDATE_NODE',
      payload: {
        nodeId,
        data: {
          ...data,
          completed: data.completed,
          current: data.current,
          type: data.type as EditorCanvasTypes,
          metadata: nextMetadata,
        },
      },
    })
  }

  const handleNodeClick = () => {
    if (currentNode) {
      dispatch({
        type: 'SELECTED_ELEMENT',
        payload: {
          element: currentNode,
        },
      })
    }
  }

  const handleTriggerTypeChange = (type: WorkflowTriggerType) => {
    const nextConfigured = type === 'google_drive' || type === 'manual'
    setTriggerType(type)
    setIsConfigured(nextConfigured)

    const nextSecret =
      type === 'webhook' && !webhookSecret
        ? crypto.randomUUID().replace(/-/g, '')
        : webhookSecret

    if (type === 'webhook') {
      setWebhookSecret(nextSecret)
    }

    persistMetadata({
      triggerType: type,
      isConfigured: nextConfigured || type === 'webhook',
      scheduleInterval:
        type === 'scheduled' ? scheduleInterval || DEFAULT_SCHEDULE_INTERVAL : scheduleInterval,
      webhookSecret: type === 'webhook' ? nextSecret : webhookSecret,
      isEnabled,
    })
  }

  const handleToggleEnabled = () => {
    const nextEnabled = !isEnabled
    setIsEnabled(nextEnabled)
    persistMetadata({ isEnabled: nextEnabled })
  }

  const handleScheduleChange = (
    nextInterval: NonNullable<TriggerMetadata['scheduleInterval']>
  ) => {
    setScheduleInterval(nextInterval)
    setIsConfigured(true)
    persistMetadata({
      triggerType: 'scheduled',
      scheduleInterval: nextInterval,
      isConfigured: true,
    })
  }

  const generateWebhookSecret = () => {
    const nextSecret = crypto.randomUUID().replace(/-/g, '')
    setWebhookSecret(nextSecret)
    setIsConfigured(true)
    persistMetadata({
      triggerType: 'webhook',
      webhookSecret: nextSecret,
      isConfigured: true,
    })
  }

  useEffect(() => {
    const metadata = (data.metadata || {}) as TriggerMetadata
    setTriggerType(metadata.triggerType || DEFAULT_TRIGGER_TYPE)
    setIsConfigured(metadata.isConfigured ?? false)
    setIsEnabled(metadata.isEnabled !== false)
    setScheduleInterval(metadata.scheduleInterval || DEFAULT_SCHEDULE_INTERVAL)
    setWebhookSecret(metadata.webhookSecret || '')
  }, [data.metadata])

  return (
    <Card
      onClick={handleNodeClick}
      className={`relative max-w-[420px] cursor-pointer transition-all duration-200 hover:shadow-lg ${
        state.editor.selectedNode.id === nodeId ? 'ring-2 ring-primary' : ''
      }`}
    >
      <CardHeader className="flex flex-row items-center gap-4 pb-3">
        <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
          <MousePointerClickIcon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg flex items-center gap-2">
            {data.title}
            <Badge variant="secondary" className="text-xs capitalize">
              {triggerType.replace('_', ' ')}
            </Badge>
          </CardTitle>
          <CardDescription className="text-sm">{data.description}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isEnabled} onCheckedChange={handleToggleEnabled} />
          <Badge variant={isEnabled ? 'default' : 'secondary'}>
            {isEnabled ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Trigger Type</Label>
          <div className="grid grid-cols-2 gap-2">
            {triggerTypes.map((type) => (
              <Button
                key={type.id}
                type="button"
                variant={triggerType === type.id ? 'default' : 'outline'}
                className="h-auto justify-start gap-2 px-3 py-3"
                onClick={() => handleTriggerTypeChange(type.id)}
              >
                {type.icon}
                <span className="text-left">
                  <span className="block text-xs font-semibold">{type.name}</span>
                  <span className="block text-[11px] opacity-80">{type.description}</span>
                </span>
              </Button>
            ))}
          </div>
        </div>

        {triggerType === 'google_drive' && (
          <div className="rounded-lg border p-3 text-sm text-muted-foreground">
            This workflow will run when the connected Google Drive listener receives a file
            change event.
          </div>
        )}

        {triggerType === 'manual' && (
          <div className="rounded-lg border p-3 text-sm text-muted-foreground">
            This workflow can be executed from the workflow UI or the manual execution API.
          </div>
        )}

        {triggerType === 'scheduled' && (
          <div className="space-y-3 rounded-lg border p-3">
            <Label className="text-sm font-medium">Run interval</Label>
            <div className="flex flex-wrap gap-2">
              {scheduleOptions.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={scheduleInterval === option ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleScheduleChange(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Publishing a scheduled workflow creates or refreshes the external cron job.
            </p>
          </div>
        )}

        {triggerType === 'webhook' && (
          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Webhook secret</Label>
              <Button type="button" variant="outline" size="sm" onClick={generateWebhookSecret}>
                {webhookSecret ? 'Regenerate' : 'Generate'}
              </Button>
            </div>
            <div className="rounded-md bg-muted px-3 py-2 text-xs break-all">
              {webhookSecret || 'Generate a secret to enable this webhook trigger.'}
            </div>
            <div className="rounded-md bg-muted px-3 py-2 text-xs break-all">
              {webhookUrl || 'Publish the workflow after generating a secret to use this URL.'}
            </div>
            <p className="text-xs text-muted-foreground">
              Send a `POST` or `GET` request to this URL with the token to execute the workflow.
            </p>
          </div>
        )}

        {!isConfigured && triggerType !== 'google_drive' && triggerType !== 'manual' && (
          <p className="text-xs text-amber-600">
            Finish configuring this trigger before publishing the workflow.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default TriggerNode
