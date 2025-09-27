'use client'
import { useNodeConnections } from '@/app/providers/connections-provider'
import { Button } from '@/components/ui/button'
import { usePathname } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
import { onCreateNodesEdges, onFlowPublish } from '../_actions/workflow-connections'
import { toast } from 'sonner'

type Props = {
    children: React.ReactNode
    edges: any[]
    nodes: any[]
}

const FlowInstance = ({ children, edges, nodes }: Props) => {
    const pathname = usePathname();
    const [isFlow, setIsFlow] = useState([]);
    const { nodeConnection } = useNodeConnections()

    const onFlowAutomation = useCallback(async () => {
        const flow = await onCreateNodesEdges(
            pathname.split('/').pop()!,
            JSON.stringify(nodes),
            JSON.stringify(edges),
            JSON.stringify(isFlow)
        )

        if(flow) {
            toast.success('Workflow saved successfully');
        } else {
            toast.error('Failed to save workflow');
        }
    },[nodeConnection, nodes, edges, isFlow]);

    const onPublishWorkflow = useCallback(async () => {
        const response = await onFlowPublish(pathname.split('/').pop()!,true)
        if(response) toast.message(response);
    },[])

    const onAutomateFlow = async () => {
      const flows: any = [];
      const connectedEdges = edges.map((edge) => edge.target)
      connectedEdges.map((target) => {
        nodes.map((node) => {
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
    <div className='flex flex-col gap-2'>
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
      {children}
    </div>
  )
}

export default FlowInstance
