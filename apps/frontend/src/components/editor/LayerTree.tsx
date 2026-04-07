// apps/frontend/src/components/editor/LayerTree.tsx
'use client';
import React from 'react';
import { ChevronRight, ChevronDown, GripVertical, Eye, EyeOff, Lock, Unlock, Trash2, Copy, MoreVertical, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Brick } from '@/types/sitebuilder';

interface LayerTreeItemProps {
  brick: Brick;
  depth: number;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Brick>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function LayerTreeItem({ brick, depth, isSelected, isExpanded, onToggleExpand, onSelect, onUpdate, onDuplicate, onDelete }: LayerTreeItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: brick.id });
  const style = { transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  
  // FIX: Safe access to children length
  const hasChildren = brick.children?.length && brick.children.length > 0;

  return (
    <div ref={setNodeRef} style={style} className={cn('group flex items-center gap-1 py-1 px-2 rounded hover:bg-gray-100 cursor-pointer select-none', isSelected && 'bg-blue-50 ring-1 ring-blue-200')} onClick={() => onSelect(brick.id)} {...attributes}>
      <div style={{ width: depth * 16 }} className="flex-shrink-0" />
      
      {hasChildren ? (
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 -ml-1 hover:bg-gray-200" onClick={(e) => { e.stopPropagation(); onToggleExpand(brick.id); }}>
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
      ) : <div className="w-5" />}
      
      <div {...listeners} className="p-0.5 cursor-grab rounded text-gray-400 hover:text-gray-600 hover:bg-gray-200" onClick={(e) => e.stopPropagation()}>
        <GripVertical className="h-3 w-3" />
      </div>
      
      <span className="text-xs truncate flex-1">{brick.label || brick.headline || brick.type}</span>
      
      <Button variant="ghost" size="sm" className={cn('h-5 w-5 p-0 opacity-0 group-hover:opacity-100', brick.hidden && 'text-gray-400')} onClick={(e) => { e.stopPropagation(); onUpdate(brick.id, { hidden: !brick.hidden }); }}>
        {brick.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </Button>
      <Button variant="ghost" size="sm" className={cn('h-5 w-5 p-0 opacity-0 group-hover:opacity-100', brick.locked && 'text-gray-400')} onClick={(e) => { e.stopPropagation(); onUpdate(brick.id, { locked: !brick.locked }); }}>
        {brick.locked ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(brick.id); }}><Copy className="h-3.5 w-3.5 mr-2" /> Duplica</DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }}><Settings className="h-3.5 w-3.5 mr-2" /> Impostazioni</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={(e) => { e.stopPropagation(); if (confirm('Eliminare?')) onDelete(brick.id); }}><Trash2 className="h-3.5 w-3.5 mr-2" /> Elimina</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface LayerTreeProps {
  bricks: Brick[];
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Brick>) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder: (from: string, to: string, parentId?: string) => void;
}

export function LayerTree({ bricks, selectedId, expandedIds, onToggleExpand, onSelect, onUpdate, onDuplicate, onDelete }: LayerTreeProps) {
  const renderBricks = (brickList: Brick[], depth = 0) => {
    return (
      <div>
        {brickList.map(brick => (
          <React.Fragment key={brick.id}>
            <LayerTreeItem brick={brick} depth={depth} isSelected={selectedId === brick.id} isExpanded={expandedIds.has(brick.id)} onToggleExpand={onToggleExpand} onSelect={onSelect} onUpdate={onUpdate} onDuplicate={onDuplicate} onDelete={onDelete} />
            {/* FIX: Safe render children */}
            {brick.children?.length && expandedIds.has(brick.id) && (
              <div className="border-l border-gray-200 ml-4">
                {renderBricks(brick.children!, depth + 1)}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600">Layer</span>
      </div>
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {bricks.length === 0 ? <p className="text-xs text-gray-400 text-center py-8 px-4">Nessun blocco.</p> : renderBricks(bricks)}
      </div>
    </div>
  );
}