'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { useNodeId, useReactFlow, Position } from 'reactflow'
import { useEditor } from '@/app/providers/editor-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULT_DRIVE_EVENT_TYPES,
  DEFAULT_SCHEDULE_INTERVAL,
  DEFAULT_TRIGGER_TYPE,
} from '@/lib/workflow-definition'
import {
  DriveChangeEventType,
  EditorCanvasTypes,
  TriggerMetadata,
  WorkflowTriggerType,
} from '@/lib/types'
import { CalendarClock, Link2, MousePointerClickIcon, PlayCircle, Trash2 } from 'lucide-react'
import CustomHandle from './custom-handle'

type TriggerNodeProps = {
  data: {
    title: string
    description: string
    type: string
    completed: boolean
    current: boolean
    metadata: Record<string, unknown>
  }
}

const triggerTypes: Array<{
  id: WorkflowTriggerType
  title: string
  subtitle: string
  icon: React.ReactNode
}> = [
  {
    id: 'google_drive',
    title: 'Google Drive',
    subtitle: 'Run when Drive changes arrive through the listener',
    icon: <MousePointerClickIcon className="h-4 w-4" />,
  },
  {
    id: 'manual',
    title: 'Manual',
    subtitle: 'Run directly from the workflow card or execute route',
    icon: <PlayCircle className="h-4 w-4" />,
  },
  {
    id: 'scheduled',
    title: 'Scheduled',
    subtitle: 'Run repeatedly on a chosen interval',
    icon: <CalendarClock className="h-4 w-4" />,
  },
  {
    id: 'webhook',
    title: 'Webhook',
    subtitle: 'Run when the workflow endpoint is called',
    icon: <Link2 className="h-4 w-4" />,
  },
]

const driveEventOptions: Array<{
  value: DriveChangeEventType
  label: string
}> = [
  { value: 'created', label: 'Uploads' },
  { value: 'updated', label: 'Updates' },
  { value: 'deleted', label: 'Deletes' },
]

const TriggerNode = ({ data }: TriggerNodeProps) => {
  const nodeId = useNodeId()
  const { deleteElements } = useReactFlow()
  const { dispatch, state } = useEditor()
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>(DEFAULT_TRIGGER_TYPE)
  const [isEnabled, setIsEnabled] = useState(true)
  const [isConfigured, setIsConfigured] = useState(false)
  const [scheduleInterval, setScheduleInterval] = useState<
    NonNullable<TriggerMetadata['scheduleInterval']>
  >(DEFAULT_SCHEDULE_INTERVAL)
  const [webhookSecret, setWebhookSecret] = useState('')
  const [driveEventTypes, setDriveEventTypes] = useState<DriveChangeEventType[]>(
    DEFAULT_DRIVE_EVENT_TYPES
  )

  const currentNode = useMemo(
    () => state.editor.elements.find((node) => node.id === nodeId),
    [nodeId, state.editor.elements]
  )

  const webhookUrl = useMemo(() => {
    if (!webhookSecret || !nodeId || typeof window === 'undefined') return ''
    return `${window.location.origin}/api/workflows/webhook/${nodeId}?token=${webhookSecret}`
  }, [nodeId, webhookSecret])

  const persistMetadata = (partial: Partial<TriggerMetadata>) => {
    if (!nodeId) return

    const nextMetadata: TriggerMetadata = {
      ...(data.metadata as TriggerMetadata),
      triggerType,
      isEnabled,
      isConfigured,
      scheduleInterval,
      webhookSecret,
      driveEventTypes,
      ...partial,
    }

    dispatch({
      type: 'UPDATE_NODE',
      payload: {
        nodeId,
        data: {
          ...data,
          type: data.type as EditorCanvasTypes,
          completed: data.completed,
          current: data.current,
          metadata: nextMetadata,
        },
      },
    })
  }

  const selectNode = () => {
    if (!currentNode) return
    dispatch({
      type: 'SELECTED_ELEMENT',
      payload: {
        element: currentNode,
      },
    })
  }

  const handleTriggerTypeChange = (nextType: WorkflowTriggerType) => {
    const generatedWebhookSecret =
      nextType === 'webhook'
        ? webhookSecret || crypto.randomUUID().replace(/-/g, '')
        : webhookSecret

    const nextConfigured =
      nextType === 'google_drive' ||
      nextType === 'manual' ||
      nextType === 'scheduled' ||
      !!generatedWebhookSecret

    setTriggerType(nextType)
    setWebhookSecret(generatedWebhookSecret)
    setIsConfigured(nextConfigured)

    persistMetadata({
      triggerType: nextType,
      webhookSecret: generatedWebhookSecret,
      isConfigured: nextConfigured,
    })
  }

  const toggleEnabled = () => {
    const nextEnabled = !isEnabled
    setIsEnabled(nextEnabled)
    persistMetadata({ isEnabled: nextEnabled })
  }

  const regenerateWebhookSecret = () => {
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
    setIsEnabled(metadata.isEnabled !== false)
    setIsConfigured(metadata.isConfigured ?? false)
    setScheduleInterval(metadata.scheduleInterval || DEFAULT_SCHEDULE_INTERVAL)
    setWebhookSecret(metadata.webhookSecret || '')
    setDriveEventTypes(
      metadata.driveEventTypes && metadata.driveEventTypes.length > 0
        ? metadata.driveEventTypes
        : DEFAULT_DRIVE_EVENT_TYPES
    )
  }, [data.metadata])

  const toggleDriveEventType = (eventType: DriveChangeEventType) => {
    const isSelected = driveEventTypes.includes(eventType)
    const nextEventTypes = isSelected
      ? driveEventTypes.filter((item) => item !== eventType)
      : [...driveEventTypes, eventType]

    const resolvedEventTypes =
      nextEventTypes.length > 0 ? nextEventTypes : DEFAULT_DRIVE_EVENT_TYPES

    setDriveEventTypes(resolvedEventTypes)
    setIsConfigured(true)
    persistMetadata({
      triggerType: 'google_drive',
      driveEventTypes: resolvedEventTypes,
      isConfigured: true,
    })
  }

  return (
    <>
      <div
        onClick={selectNode}
        className={`relative min-w-[360px] max-w-[430px] rounded-2xl border bg-card p-4 shadow-sm transition-all ${
          state.editor.selectedNode.id === nodeId ? 'ring-2 ring-primary' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MousePointerClickIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">{data.title}</h3>
                <Badge variant="secondary" className="capitalize">
                  {triggerType.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{data.description}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">Node ID: {nodeId}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isEnabled} onCheckedChange={toggleEnabled} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={async (event) => {
                event.stopPropagation()
                if (!nodeId) return
                await deleteElements({ nodes: [{ id: nodeId }] })
                dispatch({
                  type: 'DELETE_NODE',
                  payload: { nodeId },
                })
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {triggerTypes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                handleTriggerTypeChange(item.id)
              }}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                triggerType === item.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-background hover:bg-muted/50'
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                {item.icon}
                {item.title}
              </div>
              <p className="text-xs text-muted-foreground">{item.subtitle}</p>
            </button>
          ))}
        </div>

        {triggerType === 'scheduled' && (
          <div className="mt-4 rounded-xl border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Schedule interval
            </p>
            <div className="flex flex-wrap gap-2">
              {(['5m', '15m', '30m', '1h', '24h'] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={scheduleInterval === option ? 'default' : 'outline'}
                  onClick={(event) => {
                    event.stopPropagation()
                    setScheduleInterval(option)
                    setIsConfigured(true)
                    persistMetadata({
                      triggerType: 'scheduled',
                      scheduleInterval: option,
                      isConfigured: true,
                    })
                  }}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        )}

        {triggerType === 'google_drive' && (
          <div className="mt-4 rounded-xl border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Drive events
            </p>
            <div className="flex flex-wrap gap-2">
              {driveEventOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={driveEventTypes.includes(option.value) ? 'default' : 'outline'}
                  onClick={(event) => {
                    event.stopPropagation()
                    toggleDriveEventType(option.value)
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The workflow will only run when the selected Drive change types are detected.
            </p>
          </div>
        )}

        {triggerType === 'webhook' && (
          <div className="mt-4 rounded-xl border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Webhook endpoint
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation()
                  regenerateWebhookSecret()
                }}
              >
                {webhookSecret ? 'Regenerate' : 'Generate'}
              </Button>
            </div>
            <p className="mb-2 break-all rounded-lg bg-background px-3 py-2 text-xs">
              {webhookUrl || 'Generate a webhook secret to activate this endpoint.'}
            </p>
            <p className="text-xs text-muted-foreground">
              Publish the workflow after connecting this trigger to at least one action node.
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Badge variant={isEnabled ? 'default' : 'secondary'}>
            {isEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
          {isConfigured ? (
            <Badge variant="outline">Configured</Badge>
          ) : (
            <Badge variant="outline">Needs setup</Badge>
          )}
        </div>
      </div>

      <CustomHandle
        type="source"
        position={Position.Bottom}
        id="trigger-source"
      />
    </>
  )
}

export default TriggerNode
