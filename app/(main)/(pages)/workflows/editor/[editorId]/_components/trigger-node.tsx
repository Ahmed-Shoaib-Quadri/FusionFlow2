'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  MousePointerClickIcon,
  Zap,
  Calendar,
  Clock,
  Settings,
  Play,
  Pause
} from 'lucide-react'
import { useEditor } from '@/app/providers/editor-provider'
import { useNodeId } from 'reactflow'

type TriggerNodeProps = {
  data: {
    title: string
    description: string
    type: string
    metadata: any
  }
}

const TriggerNode = ({ data }: TriggerNodeProps) => {
  const nodeId = useNodeId()
  const { dispatch, state } = useEditor()
  const [isConfigured, setIsConfigured] = useState(false)
  const [triggerType, setTriggerType] = useState('google_drive')
  const [isEnabled, setIsEnabled] = useState(true)

  const triggerTypes = [
    {
      id: 'google_drive',
      name: 'Google Drive',
      description: 'Trigger when files are created, modified, or deleted',
      icon: '📁'
    },
    {
      id: 'schedule',
      name: 'Schedule',
      description: 'Trigger at specific times or intervals',
      icon: '⏰'
    },
    {
      id: 'webhook',
      name: 'Webhook',
      description: 'Trigger via HTTP webhook',
      icon: '🔗'
    },
    {
      id: 'manual',
      name: 'Manual',
      description: 'Trigger manually from dashboard',
      icon: '👆'
    }
  ]

  const handleNodeClick = () => {
    const node = state.editor.elements.find((n) => n.id === nodeId)
    if (node) {
      dispatch({
        type: 'SELECTED_ELEMENT',
        payload: {
          element: node,
        },
      })
    }
  }

  const handleTriggerTypeChange = (type: string) => {
    setTriggerType(type)
    setIsConfigured(true)
    
    // Update node metadata
    const updatedNode = {
      ...data,
      metadata: {
        ...data.metadata,
        triggerType: type,
        isConfigured: true
      }
    }
    
    // Update the node in the editor state
    dispatch({
      type: 'UPDATE_NODE',
      payload: {
        nodeId: nodeId!,
        data: updatedNode
      }
    })
  }

  const handleToggleEnabled = () => {
    setIsEnabled(!isEnabled)
    
    // Update node metadata
    const updatedNode = {
      ...data,
      metadata: {
        ...data.metadata,
        isEnabled: !isEnabled
      }
    }
    
    dispatch({
      type: 'UPDATE_NODE',
      payload: {
        nodeId: nodeId!,
        data: updatedNode
      }
    })
  }

  useEffect(() => {
    // Load saved configuration
    if (data.metadata?.triggerType) {
      setTriggerType(data.metadata.triggerType)
      setIsConfigured(data.metadata.isConfigured || false)
      setIsEnabled(data.metadata.isEnabled !== false)
    }
  }, [data.metadata])

  return (
    <Card
      onClick={handleNodeClick}
      className={`relative max-w-[400px] cursor-pointer transition-all duration-200 hover:shadow-lg ${
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
            <Badge variant="secondary" className="text-xs">
              {triggerType.replace('_', ' ')}
            </Badge>
          </CardTitle>
          <CardDescription className="text-sm">
            {data.description}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={isEnabled}
            onCheckedChange={handleToggleEnabled}
            size="sm"
          />
          <Badge variant={isEnabled ? "default" : "secondary"}>
            {isEnabled ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {!isConfigured ? (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select Trigger Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {triggerTypes.map((type) => (
                <Button
                  key={type.id}
                  variant="outline"
                  size="sm"
                  className="h-auto p-3 flex flex-col items-start gap-2"
                  onClick={() => handleTriggerTypeChange(type.id)}
                >
                  <div className="text-lg">{type.icon}</div>
                  <div className="text-left">
                    <div className="font-medium text-xs">{type.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {type.description}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Trigger Configuration</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsConfigured(false)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            
            {triggerType === 'google_drive' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-600">✓</span>
                  <span>Google Drive connected</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Triggers on file changes in connected Google Drive
                </div>
              </div>
            )}
            
            {triggerType === 'schedule' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Every 1 hour"
                    className="text-sm"
                    defaultValue={data.metadata?.schedule || "Every 1 hour"}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  Cron expression or human-readable interval
                </div>
              </div>
            )}
            
            {triggerType === 'webhook' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="https://api.example.com/webhook"
                    className="text-sm"
                    defaultValue={data.metadata?.webhookUrl || ""}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  HTTP endpoint to receive trigger events
                </div>
              </div>
            )}
            
            {triggerType === 'manual' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-blue-600">👆</span>
                  <span>Manual trigger from dashboard</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Execute workflow manually from the dashboard
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default TriggerNode 