'use client'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
import { onFlowPublish, onSaveWorkflow } from '../../../_actions/workflow-connections'
import { toast } from 'sonner'

type Props = {
    children: React.ReactNode
    edges: any[]
    nodes: any[]
}

const FlowInstance = ({ children, edges, nodes }: Props) => {
    const pathname = usePathname();
    const [isFlow, setIsFlow] = useState([]);

    const onFlowAutomation = useCallback(async () => {
        const flow = await onSaveWorkflow(
            pathname.split('/').pop()!,
            nodes,
            edges
        )

        if(flow?.message === 'Workflow saved successfully') {
            toast.success('Workflow saved successfully');
        } else {
            toast.error(flow?.message || 'Failed to save workflow');
        }
    },[nodes, edges, pathname]);

    const onPublishWorkflow = useCallback(async () => {
        const response = await onFlowPublish(pathname.split('/').pop()!,true)
        if(response === 'Workflow published') {
          toast.success(response);
          return
        }

        if(response) toast.error(response);
    },[pathname])

    const onAutomateFlow = async () => {
      const flows: any = [];
      const connectedEdges = edges.map((edge) => edge.target)
      connectedEdges.forEach((target) => {
        nodes.forEach((node) => {
          if(node.id === target) {
            flows.push(node.type)
          }
        })
      })
      setIsFlow(flows);
    }

    useEffect(() => {
      onAutomateFlow();
    }, [edges])

  return (
    <div className='flex h-full min-h-0 flex-col gap-2'>
      <div className='flex gap-3 p-4'>
        <Button 
         onClick={onFlowAutomation} 
         disabled={isFlow.length < 1}
         className='bg-white text-black hover:bg-[#2F006B] hover:text-white cursor-pointer'
        >
            Save
         </Button>
         <Button
          disabled={isFlow.length < 1}
          onClick={onPublishWorkflow}
          className='bg-white text-black hover:bg-[#2F006B] hover:text-white cursor-pointer'
         >
            Publish
         </Button>
      </div>
      <div className='min-h-0 flex-1 overflow-hidden'>
        {children}
      </div>
    </div>
  )
}

export default FlowInstance
