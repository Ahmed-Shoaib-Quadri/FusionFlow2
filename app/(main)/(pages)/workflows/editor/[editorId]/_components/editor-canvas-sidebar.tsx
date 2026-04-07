'use client'
import React, { useEffect, useMemo, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { useNodeConnections } from '@/app/providers/connections-provider'
import { useEditor } from '@/app/providers/editor-provider'
import { useAutoFlowStore } from '@/store'
import { CONNECTIONS, EditorCanvasDefaultCardTypes } from '@/lib/constant'
import { EditorCanvasTypes, EditorNodeType } from '@/lib/types'
import { fetchBotSlackChannels, onConnections, onDragStart } from '@/lib/editor-utils'
import EditorCanvasIconHelper from './editor-canvas-card-icon-helper'
import RenderConnectionAccordion from './render-connection-accordion'
import RenderOutputAccordion from './render-output-accordion'

type Props = {
  nodes: EditorNodeType[]
  onAddNode: (type: EditorCanvasTypes) => void
  onArrangeHierarchy: () => void
}

const EditorCanvasSidebar = ({
  nodes,
  onAddNode,
  onArrangeHierarchy,
}: Props) => {
  const { state } = useEditor()
  const { nodeConnection } = useNodeConnections()
  const { googleFile, setSlackChannels } = useAutoFlowStore()
  const selectedNode = state.editor.selectedNode
  const selectedNodeId = selectedNode.id
  const selectedNodeTitle = selectedNode.data.title
  const lastHydratedNodeKey = useRef<string>('')

  useEffect(() => {
    if (!selectedNodeId || !selectedNodeTitle) return

    const hydrationKey = `${selectedNodeId}:${selectedNodeTitle}`
    if (lastHydratedNodeKey.current !== hydrationKey) {
      lastHydratedNodeKey.current = hydrationKey
      onConnections(nodeConnection, state, googleFile)
    }
  }, [googleFile, nodeConnection, selectedNodeId, selectedNodeTitle, state])

  useEffect(() => {
    if (nodeConnection.slackNode.slackAccessToken) {
      fetchBotSlackChannels(nodeConnection.slackNode.slackAccessToken, setSlackChannels)
    }
  }, [nodeConnection.slackNode.slackAccessToken, setSlackChannels])

  const starterCards = useMemo(
    () => ['Google Drive', 'Trigger'] as EditorCanvasTypes[],
    []
  )

  const actionCards = useMemo(
    () =>
      (
        [
          'Action',
          'Condition',
          'Wait',
          'Slack',
          'Discord',
          'Notion',
          'Custom Webhook',
          'Email',
          'AI',
          'Google Calender',
        ] as EditorCanvasTypes[]
      ).filter((type) => EditorCanvasDefaultCardTypes[type]),
    []
  )

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-l bg-background/70 backdrop-blur-sm">
      <Tabs defaultValue="palette" className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="sticky top-0 z-10 bg-background/95 px-4 pb-3 pt-4 backdrop-blur-sm">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="palette" className="cursor-pointer">
              Palette
            </TabsTrigger>
            <TabsTrigger value="settings" className="cursor-pointer">
              Inspector
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="palette"
          className="mt-0 min-h-0 flex-1 overflow-hidden p-0"
        >
          <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-4 pb-24 pt-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Starter node
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Begin the workflow with either a dedicated Google Drive starter or the flexible
              Trigger node.
            </p>
            <div className="mt-4 grid gap-3">
              {starterCards.map((cardKey) => {
                const cardValue = EditorCanvasDefaultCardTypes[cardKey]
                return (
                  <Card
                    key={cardKey}
                    draggable={!nodes.length}
                    onDragStart={(event) => onDragStart(event, cardKey)}
                    className="cursor-pointer border-black bg-neutral-100 transition-colors hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                    onClick={() => {
                      if (!nodes.length) onAddNode(cardKey)
                    }}
                  >
                    <CardHeader className="flex flex-row items-center gap-4 p-4">
                      <EditorCanvasIconHelper type={cardKey} />
                      <CardTitle className="text-md">
                        {cardKey}
                        <CardDescription>{cardValue.description}</CardDescription>
                      </CardTitle>
                    </CardHeader>
                  </Card>
                )
              })}
            </div>
          </div>

          {nodes.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Node palette
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Drag nodes onto the canvas or click to insert them beneath the selected node.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={onArrangeHierarchy}>
                  Arrange
                </Button>
              </div>

              <div className="grid gap-3">
                {actionCards.map((cardKey) => {
                  const cardValue = EditorCanvasDefaultCardTypes[cardKey]
                  return (
                    <Card
                      key={cardKey}
                      draggable
                      className="cursor-grab border-black bg-neutral-100 transition-colors hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
                      onDragStart={(event) => onDragStart(event, cardKey)}
                      onClick={() => onAddNode(cardKey)}
                    >
                      <CardHeader className="flex flex-row items-center gap-4 p-4">
                        <EditorCanvasIconHelper type={cardKey} />
                        <CardTitle className="text-md">
                          {cardKey}
                          <CardDescription>{cardValue.description}</CardDescription>
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  )
                })}
              </div>
            </div>
          ) : null}
          </div>
        </TabsContent>

        <TabsContent
          value="settings"
          className="mt-0 min-h-0 flex-1 overflow-hidden p-0"
        >
          <div className="h-full min-h-0 overflow-y-auto overscroll-contain px-4 pb-24 pt-4">
          <div className="mb-4 rounded-xl border bg-muted/20 p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Selected node
            </div>
            <div className="mt-2 text-lg font-semibold">
              {state.editor.selectedNode.data.title || 'Nothing selected'}
            </div>
          </div>

          <Accordion type="multiple">
            <AccordionItem value="Options" className="border-y-[1px] px-2">
              <AccordionTrigger className="!no-underline">Connections</AccordionTrigger>
              <AccordionContent>
                {CONNECTIONS.map((connection) => (
                  <RenderConnectionAccordion
                    key={connection.title}
                    state={state}
                    connection={connection}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="Expected Output" className="px-2">
              <AccordionTrigger className="!no-underline">Node settings</AccordionTrigger>
              <RenderOutputAccordion state={state} nodeConnection={nodeConnection} />
            </AccordionItem>
          </Accordion>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  )
}

export default EditorCanvasSidebar
