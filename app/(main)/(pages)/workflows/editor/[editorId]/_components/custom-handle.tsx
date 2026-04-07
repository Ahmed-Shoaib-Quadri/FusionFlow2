import { useEditor } from '@/app/providers/editor-provider'
import React, { CSSProperties } from 'react'
import { Handle, HandleProps } from 'reactflow'

type Props = HandleProps & { style?:CSSProperties }

const CustomHandle = (props: Props) => {
    const { state } = useEditor();

  return (
    <Handle 
     {...props}
     isValidConnection={(e) => {
        const targetFromHandleInState = state.editor.edges.filter(
            (edge) => edge.target === e.target
        ).length

        if(targetFromHandleInState === 1) return false
        return true
     }}
     className='!-bottom-2 !h-4 !w-4 dark:bg-neutral-800' 
    />
  )
}

export default CustomHandle
