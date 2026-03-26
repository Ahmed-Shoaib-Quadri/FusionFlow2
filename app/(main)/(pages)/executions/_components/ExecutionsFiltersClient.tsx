'use client';
import React from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  initialStatus?: string;
  initialWorkflow?: string;
  workflows: { id: string; name: string }[];
};

export default function ExecutionsFiltersClient({ initialStatus, initialWorkflow, workflows }: Props) {
  const applyParam = (key: string, value?: string) => {
    const url = new URL(window.location.href);
    if (value && value !== '') url.searchParams.set(key, value);
    else url.searchParams.delete(key);
    // reset page param when filter changes
    url.searchParams.delete('page');
    window.location.href = url.toString();
  };

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <label className="text-sm font-medium mb-2 block">Status</label>
        <select
          className="w-full p-2 border rounded-md"
          defaultValue={initialStatus || ''}
          onChange={(e) => applyParam('status', e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      <div className="flex-1">
        <label className="text-sm font-medium mb-2 block">Workflow</label>
        <select
          className="w-full p-2 border rounded-md"
          defaultValue={initialWorkflow || ''}
          onChange={(e) => applyParam('workflow', e.target.value)}
        >
          <option value="">All Workflows</option>
          {workflows.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {/* Keep a manual reset button in case user prefers to clear filters */}
      <div className="flex items-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.delete('status');
            url.searchParams.delete('workflow');
            url.searchParams.delete('page');
            window.location.href = url.toString();
          }}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
