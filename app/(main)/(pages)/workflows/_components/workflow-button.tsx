'use client'
import { Button } from '@/components/ui/button';
import { useModal } from '@/app/providers/modal-provider';
import { Plus } from 'lucide-react';
import React from 'react';
import CustomModal from '@/app/components/global/custom-modal';
import Workflowform from '@/app/components/forms/workflow-form';
import { useBilling } from '@/app/providers/billing-provider';

type Props = {}

const WorkflowButton = (props:Props) => {
    const { setOpen, setClose } = useModal();
    const { credits } = useBilling();
    const handleClick = () => {
            setOpen(
                <CustomModal
                 title="Create a Workflow Automation"
                 subheading="Workflows are powerful that help you automate tasks."
                >
                    <Workflowform />
                </CustomModal>
            )
    }

    return (
        <Button 
         size={'icon'}
         {...(credits !== '0'
            ? {
                onClick: handleClick,
            }
            : {
                disabled: true,
            }
         )}
         className='bg-white text-black hover:bg-[#2F006B] hover:text-white cursor-pointer'
        >
            <Plus />
        </Button>
    )
}

export default WorkflowButton