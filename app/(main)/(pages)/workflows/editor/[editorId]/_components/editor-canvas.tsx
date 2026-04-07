'use client'
import { useEditor } from '@/app/providers/editor-provider';
import { EditorCanvasCardType, EditorNodeType, WorkflowNodeMetadata } from '@/lib/types';
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, { addEdge, applyEdgeChanges, applyNodeChanges, Background, Connection, Controls, Edge, EdgeChange, MiniMap, NodeChange, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import EditorCanvasCardSingle from './editor-canvas-card-single';
import TriggerNode from './trigger-node';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { toast } from 'sonner';
import { usePathname } from 'next/navigation';
import { v4 } from 'uuid';
import { EditorCanvasDefaultCardTypes } from '@/lib/constant';
import FlowInstance from './flow-instance';
import EditorCanvasSidebar from './editor-canvas-sidebar';
import { onGetNodesEdges, onSaveWorkflow } from '../../../_actions/workflow-connections';
import { EMPTY_EDITOR_NODE, WorkflowEdge, getOutgoingEdges, getTriggerNode } from '@/lib/workflow-definition';
import { LayoutPanelTop } from 'lucide-react';

type Props = {}

const initialNodes: EditorNodeType[] = []

const initialEdges: WorkflowEdge[] = []

const EditorCanvas = () => {
    const { dispatch, state } = useEditor();
    const [nodes, setNodes] = useState(initialNodes);
    const [edges, setEdges] = useState(initialEdges);
    const [isWorkFlowLoading, setIsWorkFlowLoading] = useState<boolean>(false)
    const [isSaving, setIsSaving] = useState<boolean>(false)
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance>()
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true)
    const pathname = usePathname()
    const workflowId = pathname.split('/').pop()!
    const hasStarterNode = nodes.some(
      (node) => node.type === 'Trigger' || node.type === 'Google Drive'
    )

    const getDefaultNodePosition = useCallback(() => {
      const selectedNode = nodes.find((node) => node.id === state.editor.selectedNode.id)

      if (selectedNode) {
        return {
          x: selectedNode.position.x,
          y: selectedNode.position.y + 220,
        }
      }

      if (!nodes.length) {
        return { x: 280, y: 80 }
      }

      const lastNode = nodes[nodes.length - 1]
      return {
        x: lastNode.position.x + (nodes.length % 2 === 0 ? 260 : -260),
        y: lastNode.position.y + 180,
      }
    }, [nodes, state.editor.selectedNode.id])

    const buildNode = useCallback(
      (type: EditorCanvasCardType['type'], position: { x: number; y: number }) => ({
        id: v4(),
        type,
        position,
        data: {
          title: type,
          description: EditorCanvasDefaultCardTypes[type].description,
          completed: false,
          current: false,
          metadata:
            type === 'Google Drive'
              ? {
                  triggerType: 'google_drive',
                  isConfigured: true,
                  isEnabled: true,
                } satisfies WorkflowNodeMetadata
              : ({} as WorkflowNodeMetadata),
          type,
        },
      }),
      []
    )

    const addNodeOfType = useCallback(
      (type: EditorCanvasCardType['type'], overridePosition?: { x: number; y: number }) => {
        const triggerAlreadyExists = nodes.find(
          (node) => node.type === 'Trigger' || node.type === 'Google Drive'
        )

        if ((type === 'Trigger' || type === 'Google Drive') && triggerAlreadyExists) {
          toast('Choose either Trigger or Google Drive as the starter node')
          return
        }

        if (
          nodes.length > 0 &&
          (type === 'Trigger' || type === 'Google Drive') &&
          triggerAlreadyExists
        ) {
          return
        }

        const position = overridePosition || getDefaultNodePosition()
        const newNode = buildNode(type, position)
        setNodes((currentNodes) => currentNodes.concat(newNode))
      },
      [buildNode, getDefaultNodePosition, nodes]
    )

    const autoLayoutHierarchy = useCallback(() => {
      const rootNode = getTriggerNode(nodes)
      if (!rootNode) {
        toast.message('Add a starter node before arranging the canvas')
        return
      }

      const levels = new Map<string, number>()
      const queue: Array<{ nodeId: string; level: number }> = [
        { nodeId: rootNode.id, level: 0 },
      ]

      while (queue.length > 0) {
        const current = queue.shift()!
        if (levels.has(current.nodeId)) continue
        levels.set(current.nodeId, current.level)

        getOutgoingEdges(edges, current.nodeId).forEach((edge) => {
          queue.push({ nodeId: edge.target, level: current.level + 1 })
        })
      }

      const groupedByLevel = new Map<number, string[]>()
      levels.forEach((level, nodeId) => {
        const group = groupedByLevel.get(level) || []
        group.push(nodeId)
        groupedByLevel.set(level, group)
      })

      const positionedNodeIds = new Set<string>()
      const nextNodes = nodes.map((node) => {
        const level = levels.get(node.id)
        if (level === undefined) {
          return node
        }

        const group = groupedByLevel.get(level) || []
        const index = group.indexOf(node.id)
        positionedNodeIds.add(node.id)

        return {
          ...node,
          position: {
            x: 120 + index * 320,
            y: 80 + level * 200,
          },
        }
      })

      let orphanIndex = 0
      setNodes(
        nextNodes.map((node) => {
          if (positionedNodeIds.has(node.id)) return node

          const nextNode = {
            ...node,
            position: {
              x: 120 + (orphanIndex % 3) * 320,
              y: 120 + (Math.floor(orphanIndex / 3) + 4) * 180,
            },
          }
          orphanIndex += 1
          return nextNode
        })
      )

      toast.success('Hierarchy arranged')
    }, [edges, nodes])

    const onDragOver = useCallback((event:any) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },[]);

    const onNodesChange = useCallback(
      (changes:NodeChange[]) => {
        //@ts-ignore
       setNodes((nds)=>applyNodeChanges(changes,nds))
      },
      [setNodes]
    );

    const onEdgesChange = useCallback(
      (changes: EdgeChange[]) => {
        //@ts-ignore
        setEdges((eds) => applyEdgeChanges(changes, eds))
      },
      [setEdges]
    );

    const onConnect = useCallback(
      (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
      []
    );

    const onDrop = useCallback(
      (event: any) => {
        event.preventDefault()

        const type: EditorCanvasCardType['type'] = event.dataTransfer.getData(
          'application/reactflow'
        )

        if(typeof type === 'undefined' || !type){
          return
        }

        if(!reactFlowInstance) return 
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })
        addNodeOfType(type, position)
      },[addNodeOfType, reactFlowInstance]
    )

    const handleClickCanvas = () => {
      dispatch({
        type: 'SELECTED_ELEMENT',
        payload: {
          element: EMPTY_EDITOR_NODE,
        },
      })
    }

    const deleteNodeById = useCallback((nodeId: string) => {
      if (!nodeId) return

      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== nodeId))
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => edge.source !== nodeId && edge.target !== nodeId
        )
      )

      dispatch({
        type: 'DELETE_NODE',
        payload: { nodeId },
      })
    }, [dispatch])

    const handleDeleteSelectedNode = useCallback(() => {
      const selectedNodeId = state.editor.selectedNode.id
      if (!selectedNodeId) {
        toast.message('Select a node to delete')
        return
      }

      deleteNodeById(selectedNodeId)
      toast.success('Node deleted')
    }, [deleteNodeById, state.editor.selectedNode.id])

    // Auto-save functionality
    const saveWorkflow = useCallback(async (isAutoSave = false) => {
      if (isSaving) return
      
      setIsSaving(true)
      try {
        const response = await onSaveWorkflow(workflowId, nodes, edges)
        if (response.message === 'Workflow saved successfully') {
          setLastSaved(new Date())
          // Only show toast for manual saves, not auto-saves
          if (!isAutoSave) {
            toast.success('Workflow saved')
          }
        } else {
          if (!isAutoSave) {
            toast.error('Failed to save workflow')
          }
        }
      } catch (error) {
        console.error('Error saving workflow:', error)
        if (!isAutoSave) {
          toast.error('Error saving workflow')
        }
      } finally {
        setIsSaving(false)
      }
    }, [workflowId, nodes, edges, isSaving])

    // Auto-save on changes (debounced) - increased delay to 10 seconds
    useEffect(() => {
      if (!autoSaveEnabled) return // Skip auto-save if disabled
      
      const timeoutId = setTimeout(() => {
        if (nodes.length > 0 || edges.length > 0) {
          saveWorkflow(true) // Pass true to indicate this is an auto-save
        }
      }, 10000) // Save after 10 seconds of inactivity (increased from 2 seconds)

      return () => clearTimeout(timeoutId)
    }, [nodes, edges, saveWorkflow, autoSaveEnabled])

    useEffect(() => {
      dispatch({type: 'LOAD_DATA', payload: {edges, elements: nodes }})
    },[dispatch, nodes, edges])
  
    const nodeTypes = useMemo(
        () => ({
            Action: EditorCanvasCardSingle,
            Trigger: TriggerNode,
            Email: EditorCanvasCardSingle,
            Condition: EditorCanvasCardSingle,
            AI: EditorCanvasCardSingle,
            Slack: EditorCanvasCardSingle,
            'Google Drive': EditorCanvasCardSingle,
            Notion: EditorCanvasCardSingle,
            Discord: EditorCanvasCardSingle,
            'Custom Webhook': EditorCanvasCardSingle,
            'Google Calender': EditorCanvasCardSingle,
            Wait: EditorCanvasCardSingle,
        }),
        []
    )

    const onGetWorkFlow = async () => {
      setIsWorkFlowLoading(true);
      try {
        const response = await onGetNodesEdges(workflowId);
        if (response) {
          const parsedNodes = response.nodes ? JSON.parse(response.nodes) : [];
          const parsedEdges = response.edges ? JSON.parse(response.edges) : [];
          setEdges(parsedEdges);
          setNodes(parsedNodes);
          setLastSaved(new Date())
        }
      } catch (error) {
        console.error('Error loading workflow:', error)
        toast.error('Error loading workflow')
      } finally {
        setIsWorkFlowLoading(false);
      }
    }

    useEffect(() => {
      onGetWorkFlow()
    }, [workflowId])

    // Keyboard shortcut for manual save (Ctrl+S)
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault()
          saveWorkflow(false) // Manual save
        }
      }

      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }, [saveWorkflow])

    useEffect(() => {
      const handleDeleteKey = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null
        const tagName = target?.tagName?.toLowerCase()
        const isTypingTarget =
          tagName === 'input' ||
          tagName === 'textarea' ||
          target?.isContentEditable

        if (isTypingTarget) return

        if (event.key === 'Delete' || event.key === 'Backspace') {
          if (state.editor.selectedNode.id) {
            event.preventDefault()
            handleDeleteSelectedNode()
          }
        }
      }

      document.addEventListener('keydown', handleDeleteKey)
      return () => document.removeEventListener('keydown', handleDeleteKey)
    }, [handleDeleteSelectedNode, state.editor.selectedNode.id])
    
  return (
    <ResizablePanelGroup 
     direction='horizontal' 
     className='h-full min-h-0'>
      <ResizablePanel defaultSize={72} className='min-h-0'>
        <div className='flex h-full min-h-0 items-center justify-center'>
          <div
           style={{ width: '100%', height: '100%' , paddingBottom:'70px'}}
           className='relative min-h-0'
          >
             {isWorkFlowLoading ? (
              <div className="absolute flex h-full w-full items-center justify-center">
                <svg
                  aria-hidden="true"
                  className="inline h-8 w-8 animate-spin fill-blue-600 text-gray-200 dark:text-gray-600"
                  viewBox="0 0 100 101"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                    fill="currentColor"
                  />
                  <path
                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                    fill="currentFill"
                  />
                </svg>
              </div>
            ) : (
            <ReactFlow
             className='w-[300px]'
             onDrop={onDrop}
             onDragOver={onDragOver}
             nodes={nodes}
             onNodesChange={onNodesChange}
             edges={edges}
             onEdgesChange={onEdgesChange}
             onConnect={onConnect}
             onInit={setReactFlowInstance}
             fitView
             onClick={handleClickCanvas}
             snapToGrid
             snapGrid={[20, 20]}
             defaultEdgeOptions={{
              type: 'smoothstep',
             }}
             nodeTypes={nodeTypes}
            >
              <Controls position='top-left' />
              <MiniMap
               position="bottom-left"
               className="!bg-background"
               zoomable
               pannable
              />
              <Background
               //@ts-ignore
               variant="dots"
               gap={12}
               size={1}
              />
            </ReactFlow>
            )}
            
            {/* Save status indicator */}
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg border bg-background/85 px-3 py-2 text-sm backdrop-blur-sm">
              <button
                onClick={autoLayoutHierarchy}
                className="inline-flex items-center gap-2 rounded-md bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <LayoutPanelTop className="h-4 w-4" />
                Arrange hierarchy
              </button>
              <div className="text-xs text-muted-foreground">
                {hasStarterNode
                  ? 'Drag from the starter node to build the flow'
                  : 'Start with either Google Drive or Trigger'}
              </div>
            </div>
            <div className="absolute top-4 right-4 flex items-center gap-2 text-sm text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg border">
              {isSaving && (
                <div className="flex items-center gap-1">
                  <svg
                    className="inline h-4 w-4 animate-spin"
                    viewBox="0 0 100 101"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                      fill="currentColor"
                    />
                    <path
                      d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                      fill="currentFill"
                    />
                  </svg>
                  Saving...
                </div>
              )}
              {lastSaved && !isSaving && (
                <div className="flex items-center gap-1">
                  <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
                </div>
              )}
              {!autoSaveEnabled && !isSaving && (
                <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs">Manual save only</span>
                </div>
              )}
              <div className="flex items-center gap-2 ml-2">
                <button
                  onClick={handleDeleteSelectedNode}
                  disabled={!state.editor.selectedNode.id}
                  className="text-xs px-2 py-1 rounded transition-colors bg-red-100 text-red-700 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-red-900/20 dark:text-red-400"
                  title="Delete selected node"
                >
                 Delete node
                </button>
                <button
                  onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    autoSaveEnabled 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' 
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                  title={autoSaveEnabled ? 'Auto-save enabled (Ctrl+S to save manually)' : 'Auto-save disabled (Ctrl+S to save manually)'}
                >
                  {autoSaveEnabled ? 'Auto-save ON' : 'Auto-save OFF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel
       defaultSize={28}
       className='relative min-h-0 sm:block'
       >
        {isWorkFlowLoading ? (
          <div className="absolute flex h-full w-full items-center justify-center">
            <svg
              aria-hidden="true"
              className="inline h-8 w-8 animate-spin fill-blue-600 text-gray-200 dark:text-gray-600"
              viewBox="0 0 100 101"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                fill="currentColor"
              />
              <path
                d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                fill="currentFill"
              />
            </svg>
          </div>
        ) : (
          <FlowInstance
            edges={edges}
            nodes={nodes}
          >
            <EditorCanvasSidebar
             nodes={nodes}
             onAddNode={addNodeOfType}
             onArrangeHierarchy={autoLayoutHierarchy}
            />
          </FlowInstance>
        )}
       </ResizablePanel>
     </ResizablePanelGroup>
  )
}

export default EditorCanvas;
