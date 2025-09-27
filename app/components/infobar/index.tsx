'use client'
import { UserButton } from '@clerk/nextjs';
import React, { useEffect, useState } from 'react';
import { ModeToggle } from '../global/mode-toggle';
import { Book, Headphones, Search, X, ExternalLink, MessageCircle, HelpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBilling } from '@/app/providers/billing-provider';
import { onPaymentDetails } from '@/app/(main)/(pages)/billing/_actions/payment-connections';
import { useRouter } from 'next/navigation';

type Props = {}

const InfoBar = (props: Props) => {
    const { credits, tier, setCredits, setTier } = useBilling();
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const router = useRouter();

    const onGetPayment = async () => {
        const response = await onPaymentDetails();
        if (response) {
            setTier(response.tier!)
            setCredits(response.credits!)
        }
    }

    useEffect(() => {
        onGetPayment();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            // You can implement search functionality here
            // For now, let's just log the search query
            console.log('Searching for:', searchQuery);
            // You could redirect to a search results page or filter content
            setSearchQuery('');
        }
    };

    const handleQuickActions = (action: string) => {
        switch (action) {
            case 'workflows':
                router.push('/workflows');
                break;
            case 'connections':
                router.push('/connections');
                break;
            case 'settings':
                router.push('/settings');
                break;
            case 'billing':
                router.push('/billing');
                break;
            default:
                break;
        }
    };

    const quickActions = [
        { label: 'Workflows', action: 'workflows', icon: '⚡' },
        { label: 'Connections', action: 'connections', icon: '🔗' },
        { label: 'Settings', action: 'settings', icon: '⚙️' },
        { label: 'Billing', action: 'billing', icon: '💳' },
    ];

    return (
        <div className='flex flex-row justify-between items-center px-4 py-4 w-full dark:bg-black'>
            {/* Left side - Credits */}
            <span className='flex items-center gap-2 font-bold'>
                <p className='text-sm font-light text-gray-300'>Credits</p>
                {tier == 'Unlimited' ? (
                    <span>Unlimited</span>
                ) : (
                    <span>
                        {credits}/{tier == 'Free' ? '10' : tier == 'Pro' && '100'}
                    </span>
                )}
            </span>

            {/* Center - Search */}
            <div className='flex-1 max-w-md mx-4'>
                <form onSubmit={handleSearch} className='relative'>
                    <div className='relative'>
                        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
                        <Input
                            placeholder="Quick Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                            className='pl-10 pr-10 border-none bg-muted/50 focus:bg-muted transition-colors'
                        />
                        {searchQuery && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className='absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0'
                                onClick={() => setSearchQuery('')}
                            >
                                <X className='h-3 w-3' />
                            </Button>
                        )}
                    </div>

                    {/* Quick Actions Dropdown */}
                    {isSearchFocused && (
                        <div className='absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50'>
                            <div className='p-2'>
                                <p className='text-xs text-muted-foreground mb-2 px-2'>Quick Actions</p>
                                {quickActions.map((action) => (
                                    <button
                                        key={action.action}
                                        onClick={() => handleQuickActions(action.action)}
                                        className='w-full flex items-center gap-3 px-2 py-2 text-sm hover:bg-muted rounded-md transition-colors'
                                    >
                                        <span>{action.icon}</span>
                                        <span>{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </form>
            </div>

            {/* Right side - Actions */}
            <div className='flex items-center gap-4'>
                {/* Contact Support */}
                <Dialog>
                    <DialogTrigger asChild>
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className='h-8 w-8 p-0'>
                                        <Headphones className='h-4 w-4' />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Contact Support</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </DialogTrigger>
                    <DialogContent className='sm:max-w-md'>
                        <DialogHeader>
                            <DialogTitle className='flex items-center gap-2'>
                                <MessageCircle className='h-5 w-5' />
                                Contact Support
                            </DialogTitle>
                            <DialogDescription>
                                Get help with FusionFlow. We're here to assist you.
                            </DialogDescription>
                        </DialogHeader>
                        <div className='space-y-4'>
                            <div className='grid grid-cols-1 gap-3'>
                                <Button 
                                    variant="outline" 
                                    className='justify-start'
                                    onClick={() => window.open('mailto:support@fusionflow.com', '_blank')}
                                >
                                    <MessageCircle className='h-4 w-4 mr-2' />
                                    Email Support
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className='justify-start'
                                    onClick={() => window.open('https://discord.gg/fusionflow', '_blank')}
                                >
                                    <ExternalLink className='h-4 w-4 mr-2' />
                                    Discord Community
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className='justify-start'
                                    onClick={() => window.open('https://docs.fusionflow.com', '_blank')}
                                >
                                    <Book className='h-4 w-4 mr-2' />
                                    Documentation
                                </Button>
                            </div>
                            <div className='text-sm text-muted-foreground'>
                                <p>Response time: Usually within 24 hours</p>
                                <p>Business hours: Mon-Fri 9AM-6PM EST</p>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Guide */}
                <Dialog>
                    <DialogTrigger asChild>
                        <TooltipProvider>
                            <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className='h-8 w-8 p-0'>
                                        <Book className='h-4 w-4' />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Quick Guide</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </DialogTrigger>
                    <DialogContent className='sm:max-w-2xl'>
                        <DialogHeader>
                            <DialogTitle className='flex items-center gap-2'>
                                <HelpCircle className='h-5 w-5' />
                                FusionFlow Quick Guide
                            </DialogTitle>
                            <DialogDescription>
                                Learn how to use FusionFlow effectively
                            </DialogDescription>
                        </DialogHeader>
                        <div className='space-y-6 max-h-96 overflow-y-auto'>
                            <div className='space-y-4'>
                                <h3 className='font-semibold text-lg'>Getting Started</h3>
                                <div className='space-y-3'>
                                    <div className='flex items-start gap-3'>
                                        <div className='bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold'>1</div>
                                        <div>
                                            <p className='font-medium'>Connect Your Apps</p>
                                            <p className='text-sm text-muted-foreground'>Go to Connections and link your Google Drive, Discord, Slack, and Notion accounts.</p>
                                        </div>
                                    </div>
                                    <div className='flex items-start gap-3'>
                                        <div className='bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold'>2</div>
                                        <div>
                                            <p className='font-medium'>Create Your First Workflow</p>
                                            <p className='text-sm text-muted-foreground'>Navigate to Workflows and click "Create Workflow" to start building automations.</p>
                                        </div>
                                    </div>
                                    <div className='flex items-start gap-3'>
                                        <div className='bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold'>3</div>
                                        <div>
                                            <p className='font-medium'>Add Trigger & Actions</p>
                                            <p className='text-sm text-muted-foreground'>Drag and drop nodes to create your automation flow. Start with a Google Drive trigger.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className='space-y-4'>
                                <h3 className='font-semibold text-lg'>Key Features</h3>
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                    <div className='p-3 border rounded-lg'>
                                        <h4 className='font-medium mb-2'>Google Drive Triggers</h4>
                                        <p className='text-sm text-muted-foreground'>Automate workflows when files are added, modified, or deleted in your Google Drive.</p>
                                    </div>
                                    <div className='p-3 border rounded-lg'>
                                        <h4 className='font-medium mb-2'>Multi-Platform Actions</h4>
                                        <p className='text-sm text-muted-foreground'>Send notifications to Discord, Slack, or create entries in Notion automatically.</p>
                                    </div>
                                    <div className='p-3 border rounded-lg'>
                                        <h4 className='font-medium mb-2'>Wait & Conditions</h4>
                                        <p className='text-sm text-muted-foreground'>Add delays and conditional logic to create complex automation flows.</p>
                                    </div>
                                    <div className='p-3 border rounded-lg'>
                                        <h4 className='font-medium mb-2'>Execution History</h4>
                                        <p className='text-sm text-muted-foreground'>Track all your workflow executions with detailed logs and performance metrics.</p>
                                    </div>
                                </div>
                            </div>

                            <div className='space-y-4'>
                                <h3 className='font-semibold text-lg'>Tips & Best Practices</h3>
                                <ul className='space-y-2 text-sm'>
                                    <li className='flex items-start gap-2'>
                                        <span className='text-primary'>•</span>
                                        <span>Always test your workflows before publishing them</span>
                                    </li>
                                    <li className='flex items-start gap-2'>
                                        <span className='text-primary'>•</span>
                                        <span>Use descriptive names for your workflows</span>
                                    </li>
                                    <li className='flex items-start gap-2'>
                                        <span className='text-primary'>•</span>
                                        <span>Monitor your credit usage in the billing section</span>
                                    </li>
                                    <li className='flex items-start gap-2'>
                                        <span className='text-primary'>•</span>
                                        <span>Keep your connections up to date for reliable automation</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>

                <UserButton />
            </div>
        </div>
    );
}

export default InfoBar;