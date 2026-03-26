'use client'
import React, { useEffect, useMemo } from 'react'
import axios from 'axios'
import { AccordionContent } from '@/components/ui/accordion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useEditor } from '@/app/providers/editor-provider'
import { ConnectionProviderProps } from '@/app/providers/connections-provider'
import { EditorState } from '@/app/providers/editor-provider'
import GoogleFileDetails from './google-file-details'
import GoogleDriveFiles from './google-drive-files'
import { postContentToWebHook } from '@/app/(main)/(pages)/connections/_actions/discord-connection'
import { onCreateNewPageInDatabase } from '@/app/(main)/(pages)/connections/_actions/notion-connection'
import { postMessageToSlack } from '@/app/(main)/(pages)/connections/_actions/slack-connection'
import { useAutoFlowStore } from '@/store'
import { EditorCanvasTypes, WorkflowComparisonOperator, WorkflowNodeMetadata } from '@/lib/types'
import { onContentChange } from '@/lib/editor-utils'

export interface Option {
  value: string
  label: string
  disable?: boolean
  fixed?: boolean
  [key: string]: string | boolean | undefined
}

type Props = {
  nodeConnection: ConnectionProviderProps
  newState: EditorState
  file: Record<string, string>
  setFile: (file: Record<string, string>) => void
  selectedSlackChannels: Option[]
  setSelectedSlackChannels: (value: Option[]) => void
}

const conditionOperators: WorkflowComparisonOperator[] = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
]

const ContentBasedOnTitle = ({
  nodeConnection,
  newState,
  file,
  setFile,
  selectedSlackChannels,
  setSelectedSlackChannels,
}: Props) => {
  const { dispatch } = useEditor()
  const title = newState.editor.selectedNode.data.title as EditorCanvasTypes
  const metadata = (newState.editor.selectedNode.data.metadata || {}) as WorkflowNodeMetadata
  const { slackChannels } = useAutoFlowStore()

  useEffect(() => {
    const reqGoogle = async () => {
      if (title === 'Google Drive' || title === 'Notion' || title === 'Discord' || title === 'Slack') {
        const response: { data: { message: { files: Record<string, string>[] } } } =
          await axios.get('/api/drive')
        const firstFile = response?.data?.message?.files?.[0]
        if (firstFile) {
          setFile(firstFile)
        }
      }
    }

    reqGoogle().catch(() => undefined)
  }, [setFile, title])

  const updateMetadata = (partial: Partial<WorkflowNodeMetadata>) => {
    const selectedNode = newState.editor.selectedNode
    if (!selectedNode.id) return

    dispatch({
      type: 'UPDATE_NODE',
      payload: {
        nodeId: selectedNode.id,
        data: {
          ...selectedNode.data,
          metadata: {
            ...metadata,
            ...partial,
          },
        },
      },
    })
  }

  const selectedNodeConnection = useMemo(() => {
    switch (title) {
      case 'Slack':
        return nodeConnection.slackNode
      case 'Discord':
        return nodeConnection.discordNode
      case 'Notion':
        return nodeConnection.notionNode
      default:
        return null
    }
  }, [nodeConnection.discordNode, nodeConnection.notionNode, nodeConnection.slackNode, title])

  const renderTemplateInsertion = () => {
    if (!file || Object.keys(file).length === 0) return null
    if (title === 'Google Drive') return null

    return (
      <Card className="w-full">
        <CardContent className="px-2 py-3">
          <div className="flex flex-col gap-4">
            <CardDescription>Drive file tokens</CardDescription>
            <GoogleFileDetails nodeConnection={nodeConnection} title={title} gFile={file} />
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderBasicTextArea = (
    label: string,
    value: string | undefined,
    onChange: (value: string) => void,
    placeholder: string,
    rows = 4
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <textarea
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
    </div>
  )

  const renderNodeForm = () => {
    switch (title) {
      case 'Google Drive':
        return <GoogleDriveFiles />

      case 'Discord':
        return (
          <>
            <div className="space-y-2">
              <Label>Discord message</Label>
              <Input
                type="text"
                value={nodeConnection.discordNode.content}
                onChange={(event) => {
                  onContentChange(nodeConnection, title, event)
                  updateMetadata({ content: event.target.value })
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  const result = await postContentToWebHook(
                    nodeConnection.discordNode.content,
                    nodeConnection.discordNode.webhookURL
                  )
                  if (result.message === 'success') {
                    toast.success('Discord test message sent')
                  } else {
                    toast.error(result.message)
                  }
                }}
              >
                Test message
              </Button>
            </div>
          </>
        )

      case 'Slack':
        return (
          <>
            <div className="space-y-2">
              <Label>Slack message</Label>
              <Input
                type="text"
                value={nodeConnection.slackNode.content}
                onChange={(event) => {
                  onContentChange(nodeConnection, title, event)
                  updateMetadata({ content: event.target.value })
                }}
              />
            </div>
            {slackChannels?.length ? (
              <div className="space-y-2">
                <Label>Channel IDs</Label>
                <div className="flex flex-wrap gap-2">
                  {slackChannels.map((channel) => {
                    const checked = selectedSlackChannels.some(
                      (selected) => selected.value === channel.value
                    )

                    return (
                      <Button
                        key={channel.value}
                        type="button"
                        size="sm"
                        variant={checked ? 'default' : 'outline'}
                        onClick={() => {
                          const next = checked
                            ? selectedSlackChannels.filter(
                                (selected) => selected.value !== channel.value
                              )
                            : [...selectedSlackChannels, channel]
                          setSelectedSlackChannels(next)
                          updateMetadata({ channels: next.map((item) => item.value) })
                        }}
                      >
                        {channel.label}
                      </Button>
                    )
                  })}
                </div>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  const response = await postMessageToSlack(
                    nodeConnection.slackNode.slackAccessToken,
                    selectedSlackChannels,
                    nodeConnection.slackNode.content
                  )
                  if (response.message === 'Success') {
                    toast.success('Slack test message sent')
                  } else {
                    toast.error(response.message)
                  }
                }}
              >
                Test message
              </Button>
            </div>
          </>
        )

      case 'Notion':
        return (
          <>
            {renderBasicTextArea(
              'Notion page content',
              metadata.notionContent || '',
              (value) => updateMetadata({ notionContent: value }),
              'Text or template for the created Notion page'
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  if (!nodeConnection.notionNode.databaseId || !nodeConnection.notionNode.accessToken) {
                    toast.error('Notion connection not loaded')
                    return
                  }
                  const response = await onCreateNewPageInDatabase(
                    nodeConnection.notionNode.databaseId,
                    nodeConnection.notionNode.accessToken,
                    metadata.notionContent || ''
                  )
                  if (response) toast.success('Notion test page created')
                }}
              >
                Test page
              </Button>
            </div>
          </>
        )

      case 'Custom Webhook':
        return (
          <>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label>Target URL</Label>
                <Input
                  value={metadata.webhookUrl || ''}
                  onChange={(event) => updateMetadata({ webhookUrl: event.target.value })}
                  placeholder="https://example.com/hook"
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={metadata.webhookMethod || 'POST'}
                  onChange={(event) =>
                    updateMetadata({
                      webhookMethod: event.target.value as WorkflowNodeMetadata['webhookMethod'],
                    })
                  }
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
            </div>
            {renderBasicTextArea(
              'JSON headers',
              metadata.webhookHeaders || '',
              (value) => updateMetadata({ webhookHeaders: value }),
              '{"Authorization":"Bearer ..."}',
              3
            )}
            {renderBasicTextArea(
              'Request body',
              metadata.content || '',
              (value) => updateMetadata({ content: value, contentType: 'json' }),
              '{"message":"{{lastValue}}"}'
            )}
          </>
        )

      case 'Email':
        return (
          <>
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label>To</Label>
                <Input
                  value={metadata.emailTo || ''}
                  onChange={(event) => updateMetadata({ emailTo: event.target.value })}
                  placeholder="person@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>From</Label>
                <Input
                  value={metadata.emailFrom || ''}
                  onChange={(event) => updateMetadata({ emailFrom: event.target.value })}
                  placeholder="Optional sender override"
                />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={metadata.emailSubject || ''}
                  onChange={(event) => updateMetadata({ emailSubject: event.target.value })}
                  placeholder="Workflow update"
                />
              </div>
            </div>
            {renderBasicTextArea(
              'Body',
              metadata.emailBody || '',
              (value) => updateMetadata({ emailBody: value }),
              'Email body. You can use {{lastValue}} and other tokens.'
            )}
          </>
        )

      case 'AI':
        return (
          <>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={metadata.aiModel || ''}
                onChange={(event) => updateMetadata({ aiModel: event.target.value })}
                placeholder="Optional model override"
              />
            </div>
            {renderBasicTextArea(
              'Prompt',
              metadata.aiPrompt || '',
              (value) => updateMetadata({ aiPrompt: value }),
              'Summarize this file: {{lastValue}}'
            )}
          </>
        )

      case 'Google Calender':
        return (
          <>
            <div className="space-y-2">
              <Label>Event summary</Label>
              <Input
                value={metadata.calendarSummary || ''}
                onChange={(event) => updateMetadata({ calendarSummary: event.target.value })}
                placeholder="Automation follow-up"
              />
            </div>
            {renderBasicTextArea(
              'Description',
              metadata.calendarDescription || '',
              (value) => updateMetadata({ calendarDescription: value }),
              'Event details'
            )}
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label>Start (ISO datetime)</Label>
                <Input
                  value={metadata.calendarStart || ''}
                  onChange={(event) => updateMetadata({ calendarStart: event.target.value })}
                  placeholder="2026-04-01T10:00:00+05:30"
                />
              </div>
              <div className="space-y-2">
                <Label>End (ISO datetime)</Label>
                <Input
                  value={metadata.calendarEnd || ''}
                  onChange={(event) => updateMetadata({ calendarEnd: event.target.value })}
                  placeholder="2026-04-01T10:30:00+05:30"
                />
              </div>
            </div>
          </>
        )

      case 'Condition':
        return (
          <>
            <div className="space-y-2">
              <Label>Left value</Label>
              <Input
                value={metadata.conditionLeft || '{{lastValue}}'}
                onChange={(event) => updateMetadata({ conditionLeft: event.target.value })}
                placeholder="{{lastValue}}"
              />
            </div>
            <div className="space-y-2">
              <Label>Operator</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={metadata.conditionOperator || 'contains'}
                onChange={(event) =>
                  updateMetadata({
                    conditionOperator: event.target.value as WorkflowComparisonOperator,
                  })
                }
              >
                {conditionOperators.map((operator) => (
                  <option key={operator} value={operator}>
                    {operator}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Right value</Label>
              <Input
                value={metadata.conditionRight || ''}
                onChange={(event) => updateMetadata({ conditionRight: event.target.value })}
                placeholder="expected content"
              />
            </div>
            <CardDescription>
              Connect the lower-left handle for the true branch and the lower-right handle for
              the false branch.
            </CardDescription>
          </>
        )

      case 'Wait':
        return (
          <div className="space-y-2">
            <Label>Delay in minutes</Label>
            <Input
              type="number"
              min={1}
              value={metadata.waitMinutes || 5}
              onChange={(event) =>
                updateMetadata({ waitMinutes: Math.max(1, Number(event.target.value || 5)) })
              }
            />
          </div>
        )

      case 'Action':
        return renderBasicTextArea(
          'Output value',
          metadata.actionValue || '',
          (value) => updateMetadata({ actionValue: value }),
          'Set a value that later nodes can reuse as {{lastValue}}'
        )

      default:
        return (
          <CardDescription>
            Select a supported node to configure it.
          </CardDescription>
        )
    }
  }

  if (!title) return <AccordionContent />

  return (
    <AccordionContent>
      <Card>
        {selectedNodeConnection && title === 'Discord' && (
          <CardHeader>
            <CardTitle>{nodeConnection.discordNode.webhookName || 'Discord'}</CardTitle>
            <CardDescription>{nodeConnection.discordNode.guildName}</CardDescription>
          </CardHeader>
        )}
        <CardContent className="flex flex-col gap-4 px-6 py-6 pb-20">
          <div className="space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>
              Use {'{{lastValue}}'}, {'{{workflowId}}'}, and file tokens where supported.
            </CardDescription>
          </div>
          {renderNodeForm()}
          {renderTemplateInsertion()}
        </CardContent>
      </Card>
    </AccordionContent>
  )
}

export default ContentBasedOnTitle
