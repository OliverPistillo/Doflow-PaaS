// apps/frontend/src/components/editor/Canvas.tsx
'use client';
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  ZoomIn, ZoomOut, Maximize2, Lock, Layout
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Brick, SitePage, DesignTokens, BreakpointKey } from '@/types/sitebuilder';

// Sostituisci questo con il tuo vero BlockRenderer se necessario
// Per ora usiamo un wrapper generico per evitare errori di import
const BlockRenderer = ({ brick, designTokens, selected, device, onUpdate }: {
  brick: Brick; designTokens: DesignTokens; selected: boolean; device: BreakpointKey; onUpdate: (patch: Partial<Brick>) => void;
}) => (
  <div className={cn('p-4 border transition-all', selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300')}>
    <div className="text-xs font-bold uppercase text-gray-400 mb-1">{brick.type}</div>
    {brick.headline && <h2 className="text-xl font-bold">{brick.headline}</h2>}
    {brick.body && <p className="text-gray-600 mt-2">{brick.body}</p>}
    {brick.items?.map((item, i) => <div key={i} className="mt-2 p-2 bg-gray-50 rounded">{item.title}</div>)}
  </div>
);

interface CanvasProps {
  pages: SitePage[];
  pageIndex: number;
  selectedId: string | null;
  device: BreakpointKey;
  designTokens: DesignTokens;
  zoom: number;
  showGuides: boolean;
  snapToGrid: boolean;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<Brick>) => void;
  onAddBrick: (type: string, parentId?: string, index?: number) => void;
}

export function Canvas({
  pages, pageIndex, selectedId, device, designTokens,
  zoom, showGuides, snapToGrid,
  onSelect, onUpdate, onAddBrick,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const currentPage = pages[pageIndex];
  const bricks = currentPage?.bricks || [];

  // Device width mapping
  const deviceWidths: Record<BreakpointKey, number> = {
    desktop: 1440, tablet: 768, mobile: 375,
  };
  const canvasWidth = deviceWidths[device];

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // Logica zoom gestita dal parent via prop o qui se vuoi
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return (
    <div className="relative w-full h-full">
      {/* Toolbar zoom/guide */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-white rounded-full shadow-lg border px-3 py-1.5">
        <button className={cn('p-1.5 rounded', showGuides ? 'text-blue-600' : 'text-gray-400')}>
          <ZoomIn className="h-4 w-4" />
        </button>
        <div className="w-px h-4 bg-gray-200" />
        <button className="p-1.5 rounded text-gray-500 hover:bg-gray-100" onClick={() => setPan({ x: 0, y: 0 })}>
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className={cn(
          'absolute inset-0 overflow-auto bg-gray-100 flex justify-center p-8',
          isPanning ? 'cursor-grabbing' : 'cursor-default'
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => onSelect(null)}
      >
        <div
          className="relative bg-white shadow-xl min-h-[800px] transition-transform duration-100 origin-top"
          style={{
            width: canvasWidth,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* Guidelines Overlay */}
          {showGuides && (
            <div className="absolute inset-0 pointer-events-none z-10">
              <div className="absolute top-0 bottom-0 w-px bg-blue-400/30 left-1/2" />
              <div className="absolute inset-x-4 top-4 bottom-4 border border-dashed border-gray-300/50 rounded" />
            </div>
          )}

          {/* Bricks */}
          <div className="relative z-0">
            {bricks.map((brick) => (
              <div
                key={brick.id}
                className={cn(
                  'relative group transition-all duration-100',
                  selectedId === brick.id && 'ring-2 ring-blue-500 ring-offset-2',
                  brick.hidden && 'opacity-40'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!brick.locked) onSelect(brick.id);
                }}
              >
                {/* Brick label badge */}
                {selectedId === brick.id && (
                  <div className="absolute -top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-[9px] rounded-full shadow">
                    {brick.type}
                  </div>
                )}

                {/* Locked overlay */}
                {brick.locked && (
                  <div className="absolute inset-0 bg-black/5 flex items-center justify-center z-10">
                    <Lock className="h-6 w-6 text-gray-400" />
                  </div>
                )}

                {/* Render brick */}
                <BlockRenderer
                  brick={brick}
                  designTokens={designTokens}
                  selected={selectedId === brick.id}
                  device={device}
                  onUpdate={(patch: Partial<Brick>) => onUpdate(brick.id, patch)}
                />
              </div>
            ))}
          </div>

          {/* Empty state */}
          {bricks.length === 0 && (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
              <Layout className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-sm font-medium">Nessun blocco in questa pagina</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}