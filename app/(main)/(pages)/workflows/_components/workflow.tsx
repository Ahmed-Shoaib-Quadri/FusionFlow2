'use client'
import React, { useState, useEffect } from 'react';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { onFlowPublish, onDeleteWorkflow, onDuplicateWorkflow } from '../_actions/workflow-connections';
import { Button } from '@/components/ui/button';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Trash2, Copy, Edit, Play, Pause } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Props = {
    name: string
    description: string
    id: string
    publish: boolean | null
    createdAt?: Date
    updatedAt?: Date
}

const Workflow = ({ name, description, id, publish, createdAt, updatedAt }: Props) => {
    const [enabled, setEnabled] = useState(!!publish);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setEnabled(!!publish);
    }, [publish]);

    const onPublishFlow = async (event: any) => {
        setIsLoading(true);
        try {
            const response = await onFlowPublish(
                id,
                event.target.ariaChecked === 'false'
            )
            if (response) {
                if (response === 'Workflow published') {
                    setEnabled(true);
                    toast.success(response);
                } else if (response === 'Workflow not published') {
                    setEnabled(false);
                    toast.success(response);
                }
            }
        } catch (error) {
            toast.error('Failed to update workflow status');
        } finally {
            setIsLoading(false);
        }
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this workflow? This action cannot be undone.')) {
            return;
        }

        setIsLoading(true);
        try {
            const response = await onDeleteWorkflow(id);
            if (response.message === 'Workflow deleted successfully') {
                toast.success('Workflow deleted successfully');
                // Trigger a page refresh or update the parent component
                window.location.reload();
            } else {
                toast.error(response.message || 'Failed to delete workflow');
            }
        } catch (error) {
            toast.error('Error deleting workflow');
        } finally {
            setIsLoading(false);
        }
    }

    const handleDuplicate = async () => {
        setIsLoading(true);
        try {
            const response = await onDuplicateWorkflow(id);
            if (response.message === 'Workflow duplicated successfully') {
                toast.success('Workflow duplicated successfully');
                // Redirect to the new workflow
                window.location.href = `/workflows/editor/${response.workflowId}`;
            } else {
                toast.error(response.message || 'Failed to duplicate workflow');
            }
        } catch (error) {
            toast.error('Error duplicating workflow');
        } finally {
            setIsLoading(false);
        }
    }

    const getStatusColor = () => {
        if (enabled) return 'bg-green-500';
        return 'bg-gray-400';
    }

    const getStatusText = () => {
        if (enabled) return 'Active';
        return 'Inactive';
    }

    return (
        <Card className='flex w-full items-center justify-between hover:shadow-md transition-shadow'>
            <CardHeader className='flex flex-col gap-4 flex-1'>
                <Link href={`/workflows/editor/${id}`} className='hover:opacity-80 transition-opacity'>
                    <div className='flex flex-row gap-2 mb-2'>
                        <Image
                            src="/googleDrive.png"
                            alt="Google Drive"
                            height={30}
                            width={30}
                            className='object-contain'
                        />
                        <Image
                            src="/notion.png"
                            alt="Notion"
                            height={30}
                            width={30}
                            className='object-contain'
                        />
                        <Image
                            src="/discord.png"
                            alt="Discord"
                            height={30}
                            width={30}
                            className='object-contain'
                        />
                    </div>
                    <div>
                        <CardTitle className='text-lg'>{name}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                        <div className='flex items-center gap-2 mt-2'>
                            <Badge variant={enabled ? "default" : "secondary"}>
                                {getStatusText()}
                            </Badge>
                            {updatedAt && (
                                <span className='text-xs text-muted-foreground'>
                                    Updated: {new Date(updatedAt).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                </Link>
            </CardHeader>
            
            <div className='flex flex-col items-center gap-4 p-4'>
                {/* Status Toggle */}
                <div className='flex flex-col items-center gap-2'>
                    <Label
                        htmlFor={`toggle-${id}`}
                        className='text-muted-foreground cursor-pointer text-sm'
                    >
                        {enabled ? 'Active' : 'Inactive'}
                    </Label>
                    <button
                        id={`toggle-${id}`}
                        onClick={onPublishFlow}
                        disabled={isLoading}
                        className={`${
                            enabled ? 'bg-green-500' : 'bg-gray-400'
                        } w-10 h-5 flex items-center p-1 rounded-full transition-colors cursor-pointer disabled:opacity-50`}
                    >
                        <div
                            className={`w-4 h-4 rounded-full shadow-md transform transition ${
                                enabled ? 'bg-white translate-x-4' : 'bg-white translate-x-0'
                            }`}
                        />
                    </button>
                </div>

                {/* Actions Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={isLoading}>
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                            <Link href={`/workflows/editor/${id}`} className='flex items-center gap-2'>
                                <Edit className="h-4 w-4" />
                                Edit Workflow
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleDuplicate} className='flex items-center gap-2'>
                            <Copy className="h-4 w-4" />
                            Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            onClick={handleDelete} 
                            className='flex items-center gap-2 text-red-600'
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </Card>
    )
}

export default Workflow;
