import { useEditor } from '@/app/providers/editor-provider'
import { EditorCanvasCardType } from '@/lib/types'
import React, { useMemo } from 'react'
import { Position, useNodeId, useReactFlow } from 'reactflow'
import EditorCanvasIconHelper from './editor-canvas-card-icon-helper'
import CustomHandle from './custom-handle'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

const EditorCanvasCardSingle = ({ data }: { data: EditorCanvasCardType}) => {
    const { dispatch, state } = useEditor();
    const nodeId = useNodeId()
    const { deleteElements } = useReactFlow()
    const logo = useMemo(() => {
        return <EditorCanvasIconHelper type={data.type} />
    }, [data])
  return (
    <>
     {data.type !== 'Trigger' && data.type !== 'Google Drive' && (
      <CustomHandle 
       type="target"
       position={Position.Top}
       style = {{ zIndex: 100 }}
      />
     )}
     <Card
      onClick = {(e) => {
        e.stopPropagation();
        const val = state.editor.elements.find((n) => n.id === nodeId)
        if(val)
          dispatch({ 
            type: 'SELECTED_ELEMENT', 
            payload: {
              element: val,
            },
           })
      }}
      className='relative max-w-[420px] dark:border-muted-foreground/70'
     >
      <CardHeader className="flex flex-row items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {logo}
        </div>
        <div className='flex-1'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <CardTitle className='text-md'>{data.title}</CardTitle>
              <p className='text-xs text-muted-foreground/60'>
                Node ID: {nodeId}
              </p>
            </div>
            <Button
             type="button"
             variant="ghost"
             size="icon"
             className='h-8 w-8 text-muted-foreground'
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
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
          <CardDescription>
            <p>{data.description}</p>
          </CardDescription>
        </div>
      </CardHeader>
      <Badge
       variant="secondary"
       className="absolute right-2 top-2"
      >
        {data.type}
      </Badge>
     </Card>
     {data.type === 'Condition' ? (
      <>
       <CustomHandle 
        type = "source"
        position={Position.Bottom}
        id="condition-true"
        style={{ left: '30%' }}
       />
       <CustomHandle 
        type = "source"
        position={Position.Bottom}
        id="condition-false"
        style={{ left: '70%' }}
       />
      </>
     ) : (
      <CustomHandle 
       type = "source"
       position={Position.Bottom}
       id="default"
      />
     )}
    </>
  )
}

export default EditorCanvasCardSingle
