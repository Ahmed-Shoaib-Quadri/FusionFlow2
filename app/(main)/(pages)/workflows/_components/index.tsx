import React from 'react';
import Workflow from './workflow';
import { onGetWorkflows } from '../_actions/workflow-connections';
import MoreCredits from './more-credits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  Play, 
  Pause,
  Calendar,
  Clock,
  Zap
} from 'lucide-react';

type Props = {}

const Workflows = async (props: Props) => {
    const workflows = await onGetWorkflows();

    // Calculate some stats
    const totalWorkflows = workflows?.length || 0;
    const publishedWorkflows = workflows?.filter(w => w.publish).length || 0;
    const activeWorkflows = workflows?.filter(w => w.publish).length || 0;

    return (
        <div className='relative flex flex-col gap-6 p-6'>
            {/* Header Stats */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                <Card>
                    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                        <CardTitle className='text-sm font-medium'>Total Workflows</CardTitle>
                        <Grid3X3 className='h-4 w-4 text-muted-foreground' />
                    </CardHeader>
                    <CardContent>
                        <div className='text-2xl font-bold'>{totalWorkflows}</div>
                        <p className='text-xs text-muted-foreground'>
                            Created workflows
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                        <CardTitle className='text-sm font-medium'>Published</CardTitle>
                        <Play className='h-4 w-4 text-green-600' />
                    </CardHeader>
                    <CardContent>
                        <div className='text-2xl font-bold text-green-600'>{publishedWorkflows}</div>
                        <p className='text-xs text-muted-foreground'>
                            Active workflows
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                        <CardTitle className='text-sm font-medium'>Draft</CardTitle>
                        <Pause className='h-4 w-4 text-yellow-600' />
                    </CardHeader>
                    <CardContent>
                        <div className='text-2xl font-bold text-yellow-600'>{totalWorkflows - publishedWorkflows}</div>
                        <p className='text-xs text-muted-foreground'>
                            Unpublished workflows
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Search and Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'>
                        <Search className="h-5 w-5" />
                        Search & Filter Workflows
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className='flex gap-4'>
                        <div className='flex-1'>
                            <Input 
                                placeholder="Search workflows by name or description..."
                                className='w-full'
                            />
                        </div>
                        <Button variant="outline" size="sm">
                            <Filter className="h-4 w-4 mr-2" />
                            Filter
                        </Button>
                        <Button variant="outline" size="sm">
                            <Grid3X3 className="h-4 w-4 mr-2" />
                            Grid
                        </Button>
                        <Button variant="outline" size="sm">
                            <List className="h-4 w-4 mr-2" />
                            List
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Workflows List */}
            <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                    <h2 className='text-xl font-semibold'>Your Workflows</h2>
                    <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                        <Zap className="h-4 w-4" />
                        {activeWorkflows} active
                    </div>
                </div>

                <MoreCredits/>

                {workflows?.length ? (
                    <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4'>
                        {workflows.map((flow) => (
                            <Workflow
                                key={flow.id}
                                {...flow}
                            />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className='flex flex-col items-center justify-center py-12'>
                            <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className='text-lg font-semibold mb-2'>No Workflows Yet</h3>
                            <p className='text-muted-foreground text-center mb-4'>
                                Create your first workflow to start automating your tasks
                            </p>
                            <Button>
                                <Zap className="h-4 w-4 mr-2" />
                                Create Workflow
                            </Button>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}

export default Workflows;