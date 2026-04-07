'use client'
import { UserButton } from '@clerk/nextjs';
import React, { useEffect, useRef, useState } from 'react';
import { ModeToggle } from '../global/mode-toggle';
import {
  Book,
  Headphones,
  Search,
  X,
  ExternalLink,
  MessageCircle,
  HelpCircle,
} from 'lucide-react';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBilling } from '@/app/providers/billing-provider';
import { onPaymentDetails } from '@/app/(main)/(pages)/billing/_actions/payment-connections';
import { useRouter } from 'next/navigation';

type QuickAction = {
  id: string;
  label: string;
  path: string;
  icon?: string;
  aliases?: string[]; // additional short aliases
};

type Props = {};

// Lightweight fuzzy scoring:
// - startsWith: score +100
// - acronym match (initial letters): +80
// - includes: +50
// - shorter distance bonus
function getAcronym(s: string) {
  return s
    .split(/[\s-_]+/)
    .map((p) => p[0])
    .join('')
    .toLowerCase();
}

function scoreMatch(query: string, label: string, aliases: string[] = []) {
  if (!query) return 0;
  const q = query.toLowerCase();
  const l = label.toLowerCase();

  // exact or startsWith
  if (l === q) return 1000;
  if (l.startsWith(q)) return 500;

  // aliases exact / startsWith
  for (const a of aliases) {
    const la = a.toLowerCase();
    if (la === q) return 900;
    if (la.startsWith(q)) return 450;
  }

  // acronym match
  const acronym = getAcronym(label);
  if (acronym.startsWith(q) && q.length <= acronym.length) return 450;

  // includes
  if (l.includes(q)) return 200;

  // fuzzy letter order (cheap): check chars appear in order
  let i = 0;
  for (const ch of q) {
    i = l.indexOf(ch, i);
    if (i === -1) {
      i = -1;
      break;
    }
    i++;
  }
  if (i !== -1) {
    // smaller query -> higher score
    return 100 + Math.max(0, 40 - q.length);
  }

  return 0;
}

export default function InfoBar(_: Props) {
  const { credits, tier, setCredits, setTier } = useBilling();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<QuickAction[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestionBoxRef = useRef<HTMLDivElement | null>(null);

  const quickActions: QuickAction[] = [
    { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: '🏠', aliases: ['dash', 'dsb'] },
    { id: 'workflows', label: 'Workflows', path: '/workflows', icon: '⚡', aliases: ['flow', 'wf'] },
    { id: 'connections', label: 'Connections', path: '/connections', icon: '🔗', aliases: ['conn', 'integration'] },
    { id: 'executions', label: 'Executions', path: '/executions', icon: '📜', aliases: ['exec', 'history', 'logs'] },
    { id: 'settings', label: 'Settings', path: '/settings', icon: '⚙️', aliases: ['pref', 'config'] },
    { id: 'billing', label: 'Billing', path: '/billing', icon: '💳', aliases: ['pay', 'subscription', 'sub'] },
  ];

  // load payment info on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const response = await onPaymentDetails();
        if (!mounted) return;
        if (response) {
          setTier(response.tier!);
          setCredits(response.credits!);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [setCredits, setTier]);

  // update suggestion list live as user types
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSuggestions([]);
      setSelectedIndex(-1);
      return;
    }

    const scored = quickActions
      .map((a) => ({ action: a, score: scoreMatch(q, a.label, a.aliases || []) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.action);

    setSuggestions(scored);
    setSelectedIndex(scored.length > 0 ? 0 : -1);
  }, [searchQuery]);

  // keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isSearchFocused) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min((suggestions.length - 1), Math.max(0, i + 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          const target = suggestions[selectedIndex];
          router.push(target.path);
          setSearchQuery('');
          setIsSearchFocused(false);
        } else {
          // fallback: direct fuzzy match then navigate to top match
          if (suggestions.length > 0) {
            router.push(suggestions[0].path);
            setSearchQuery('');
            setIsSearchFocused(false);
          }
        }
      } else if (e.key === 'Escape') {
        setIsSearchFocused(false);
        setSuggestions([]);
        setSelectedIndex(-1);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSearchFocused, suggestions, selectedIndex, router]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    // exact or top suggestion redirect
    if (suggestions.length > 0) {
      router.push(suggestions[0].path);
      setSearchQuery('');
      setIsSearchFocused(false);
      return;
    }

    // fallback heuristics
    // try first matching quickAction by alias or substring
    const found = quickActions.find((a) => {
      const label = a.label.toLowerCase();
      const aliases = (a.aliases || []).map((x) => x.toLowerCase());
      return label.includes(q) || aliases.some((al) => al.includes(q));
    });
    if (found) {
      router.push(found.path);
      setSearchQuery('');
      setIsSearchFocused(false);
      return;
    }

    // default: just clear and log (or go to a search page if you add one)
    console.log('Search:', searchQuery);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const handleQuickActionClick = (action: QuickAction) => {
    router.push(action.path);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  return (
    <div className='flex flex-row justify-between items-center px-4 py-4 w-full dark:bg-black relative'>
      {/* Left side - Credits */}
      <span className='flex items-center gap-2 font-bold'>
        <p className='text-sm font-light text-gray-300'>Credits</p>
        {tier === 'Unlimited' ? (
          <span>Unlimited</span>
        ) : (
          <span>
            {credits}/{tier === 'Free' ? '10' : tier === 'Pro' ? '100' : credits}
          </span>
        )}
      </span>

      {/* Center - Search / Command Palette */}
      <div className='flex-1 max-w-lg mx-4 relative'>
        <form
          onSubmit={(e) => { e.preventDefault(); handleSearchSubmit(e); }}
          className='relative'
          role='search'
          aria-label='Quick search'
        >
          <div className='relative'>
            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
            <Input
              ref={inputRef}
              placeholder="Quick Search... (try 'dash', 'exec', 'flow', 'conn')"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
              className='pl-10 pr-10 border-none bg-muted/50 focus:bg-muted transition-colors'
              aria-autocomplete='list'
              aria-controls='ff-suggestions'
              aria-expanded={isSearchFocused && suggestions.length > 0}
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className='absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0'
                onClick={() => { setSearchQuery(''); setSuggestions([]); setSelectedIndex(-1); }}
                aria-label='Clear search'
              >
                <X className='h-3 w-3' />
              </Button>
            )}
          </div>

          {/* Suggestions / Command Palette Dropdown */}
          {isSearchFocused && (suggestions.length > 0 || searchQuery.trim()) && (
            <div
              id='ff-suggestions'
              ref={suggestionBoxRef}
              className='absolute top-full left-0 right-0 mt-2 bg-background border rounded-lg shadow-lg z-50 max-h-72 overflow-auto'
              role='listbox'
            >
              <div className='p-2'>
                {suggestions.length === 0 && (
                  <div className='text-sm text-muted-foreground px-2 py-3'>
                    No direct match — press Enter to search or try different keywords.
                  </div>
                )}

                {suggestions.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => handleQuickActionClick(s)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                      idx === selectedIndex ? 'bg-muted/60' : 'hover:bg-muted/30'
                    }`}
                    role='option'
                    aria-selected={idx === selectedIndex}
                  >
                    <span className='flex-none text-lg'>{s.icon || '•'}</span>
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center justify-between'>
                        <span className='font-medium truncate'>{s.label}</span>
                        <span className='text-xs text-muted-foreground'>{s.path}</span>
                      </div>
                      {s.aliases && s.aliases.length > 0 && (
                        <div className='text-xs text-muted-foreground mt-1 truncate'>
                          Aliases: {s.aliases.join(', ')}
                        </div>
                      )}
                    </div>
                  </button>
                ))}

                {/* Fallback suggestions: show other quickActions partially matched if no scored suggestions */}
                {suggestions.length === 0 && searchQuery.trim().length > 0 && (
                  <div className='mt-2'>
                    <div className='text-xs text-muted-foreground px-2 mb-1'>Try these quick links</div>
                    <div className='grid gap-1'>
                      {quickActions.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => handleQuickActionClick(a)}
                          className='w-full text-left flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/30'
                        >
                          <span className='text-lg'>{a.icon}</span>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-center justify-between'>
                              <span className='font-medium truncate'>{a.label}</span>
                              <span className='text-xs text-muted-foreground'>{a.path}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
              <Tooltip>
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
              <Tooltip>
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
