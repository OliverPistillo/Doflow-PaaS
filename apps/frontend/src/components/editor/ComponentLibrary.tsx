// apps/frontend/src/components/editor/ComponentLibrary.tsx
'use client';
import React, { useState } from 'react';
import { Component, Plus, Search, Grid3X3, List, ChevronDown } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ComponentDefinition } from '@/types/sitebuilder';

interface ComponentLibraryProps {
  components: ComponentDefinition[];
  onAdd: (componentId: string, parentId?: string) => void;
}

export function ComponentLibrary({ components, onAdd }: ComponentLibraryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  interface Category { id: string; label: string; icon: LucideIcon; }
  const categories: Category[] = [
    { id: 'all', label: 'Tutti', icon: Grid3X3 },
    { id: 'layout', label: 'Layout', icon: Grid3X3 }, // Sostituisci con Folder se importato
    { id: 'content', label: 'Contenuto', icon: Component },
    { id: 'media', label: 'Media', icon: Component },  // Sostituisci con ImageIcon
    { id: 'form', label: 'Form', icon: Component },    // Sostituisci con FileText
  ];

  const filteredComponents = components.filter(comp => {
    const matchesSearch = !searchQuery || comp.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || comp.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-3 py-2 border-b space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">Componenti</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className={cn('h-6 w-6 p-0', viewMode === 'grid' && 'text-blue-600')} onClick={() => setViewMode('grid')}>
              <Grid3X3 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className={cn('h-6 w-6 p-0', viewMode === 'list' && 'text-blue-600')} onClick={() => setViewMode('list')}>
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input placeholder="Cerca..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-7 h-7 text-xs" />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-1 px-3 py-2 border-b overflow-x-auto">
        {categories.map(({ id, label, icon: Icon }) => (
          <Button
            key={id} variant="ghost" size="sm"
            className={cn('h-7 px-2.5 text-[10px] gap-1 whitespace-nowrap', selectedCategory === id ? 'bg-blue-50 text-blue-600' : 'text-gray-500')}
            onClick={() => setSelectedCategory(id)}
          >
            <Icon className="h-3 w-3" /> {label}
          </Button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {filteredComponents.map(comp => (
              <div key={comp.id} className="group p-3 rounded-lg border hover:shadow-md transition-all cursor-pointer bg-white" onClick={() => onAdd(comp.id)}>
                <div className="aspect-video bg-gray-100 rounded mb-2 flex items-center justify-center text-2xl">🧩</div>
                <p className="text-xs font-medium truncate">{comp.name}</p>
                <p className="text-[9px] text-gray-400 truncate">{comp.description}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredComponents.map(comp => (
              <div key={comp.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => onAdd(comp.id)}>
                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">🧩</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{comp.name}</p>
                  <p className="text-[9px] text-gray-400 truncate">{comp.description}</p>
                </div>
                <Plus className="h-3.5 w-3.5 text-gray-400" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}