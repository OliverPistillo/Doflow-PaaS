// apps/frontend/src/components/editor/ResponsiveToolbar.tsx
'use client';

import React from 'react';
import { Monitor, Tablet, Smartphone, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

import { BreakpointKey, DEFAULT_BREAKPOINTS } from '@/types/sitebuilder';

interface ResponsiveToolbarProps {
  currentBreakpoint: BreakpointKey;
  onChange: (breakpoint: BreakpointKey) => void;
  onReset?: () => void;
}

export function ResponsiveToolbar({ 
  currentBreakpoint, 
  onChange,
  onReset,
}: ResponsiveToolbarProps) {
  const breakpoints: Array<{
    key: BreakpointKey;
    icon: React.ReactNode;
    label: string;
    range: string;
  }> = [
    { 
      key: 'desktop', 
      icon: <Monitor className="h-4 w-4" />,
      label: DEFAULT_BREAKPOINTS.desktop.label,
      range: `≥${DEFAULT_BREAKPOINTS.desktop.minWidth}px`,
    },
    { 
      key: 'tablet', 
      icon: <Tablet className="h-4 w-4" />,
      label: DEFAULT_BREAKPOINTS.tablet.label,
      range: `${DEFAULT_BREAKPOINTS.tablet.minWidth}-${DEFAULT_BREAKPOINTS.tablet.maxWidth}px`,
    },
    { 
      key: 'mobile', 
      icon: <Smartphone className="h-4 w-4" />,
      label: DEFAULT_BREAKPOINTS.mobile.label,
      range: `≤${DEFAULT_BREAKPOINTS.mobile.maxWidth}px`,
    },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
      {breakpoints.map(({ key, icon, label, range }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <Button
              variant={currentBreakpoint === key ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-8 px-2.5 gap-1.5',
                currentBreakpoint === key 
                  ? 'bg-white shadow-sm text-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              )}
              onClick={() => onChange(key)}
            >
              {icon}
              <span className="text-[10px] font-medium hidden xl:inline">{label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-[10px]">
            <p className="font-semibold">{label}</p>
            <p className="text-gray-400">{range}</p>
            {currentBreakpoint === key && (
              <Badge variant="secondary" className="mt-1 text-[9px]">
                Attivo
              </Badge>
            )}
          </TooltipContent>
        </Tooltip>
      ))}
      
      {onReset && (
        <>
          <div className="w-px h-4 bg-gray-200" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                onClick={onReset}
                title="Reset responsive overrides"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset override breakpoint</TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}