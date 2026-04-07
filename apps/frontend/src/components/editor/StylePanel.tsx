// apps/frontend/src/components/editor/StylePanel.tsx
'use client';
import React, { useState, useCallback } from 'react';
import { Layout, Type, Palette, Settings, Monitor, ChevronDown, ChevronRight, AlignLeft, AlignCenter, AlignRight, AlignJustify, ArrowRight, ArrowDown, ArrowLeft, ArrowUp, Trash2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';

import { Brick, BrickStyles, DesignTokens, BreakpointKey, LayoutStyles, TypographyStyles, VisualStyles, ResponsiveOverride, DEFAULT_BREAKPOINTS } from '@/types/sitebuilder';

interface StyleControlProps { label: string; children: React.ReactNode; hint?: string; disabled?: boolean; }
function StyleControl({ label, children, hint, disabled }: StyleControlProps) {
  return (
    <div className={cn('space-y-1.5', disabled && 'opacity-50')}>
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</Label>
        {hint && <Tooltip><TooltipTrigger asChild><span className="text-[9px] text-gray-400 cursor-help">?</span></TooltipTrigger><TooltipContent className="text-[10px] max-w-[200px]">{hint}</TooltipContent></Tooltip>}
      </div>
      {children}
    </div>
  );
}

interface UnitInputProps { value?: string; onChange: (value: string) => void; units?: string[]; placeholder?: string; min?: number; max?: number; step?: number; className?: string; }
function UnitInput({ value = '', onChange, units = ['px', 'rem', '%', 'auto', 'none'], placeholder, min, max, step, className }: UnitInputProps) {
  const [num, unit] = React.useMemo(() => {
    if (!value) return ['', units[0]];
    const match = value.match(/^([\d.-]+)?(.*)$/);
    return [match?.[1] || '', match?.[2] || units[0]];
  }, [value, units]);

  const handleNumChange = (e: React.ChangeEvent<HTMLInputElement>) => { onChange(e.target.value ? `${e.target.value}${unit}` : ''); };
  const handleUnitChange = (newUnit: string) => { onChange(num ? `${num}${newUnit}` : newUnit); };

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Input type="number" value={num} onChange={handleNumChange} placeholder={placeholder} min={min} max={max} step={step} className="h-7 w-16 text-xs font-mono" />
      <Select value={unit} onValueChange={handleUnitChange}>
        <SelectTrigger className="h-7 w-14 text-[10px]"><SelectValue /></SelectTrigger>
        <SelectContent>{units.map(u => <SelectItem key={u} value={u} className="text-[10px]">{u}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

interface ColorPickerProps { value?: string; onChange: (value: string) => void; tokens?: DesignTokens; tokenKey?: string; }
function ColorPicker({ value, onChange, tokens }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value?.startsWith('#') || value?.startsWith('rgb') ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)} className="h-7 w-10 rounded border border-gray-200 cursor-pointer p-0.5" />
      <Input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="#000000" className="h-7 text-xs font-mono flex-1" />
    </div>
  );
}

interface StylePanelProps { brick?: Brick; designTokens?: DesignTokens; breakpoint?: BreakpointKey; onUpdateStyles: (styles: Partial<BrickStyles>) => void; onUpdateTokens: (tokens: Partial<DesignTokens>) => void; }
export function StylePanel({ brick, designTokens, breakpoint = 'desktop', onUpdateStyles, onUpdateTokens }: StylePanelProps) {
  const [activeTab, setActiveTab] = useState<'layout' | 'typography' | 'visual' | 'advanced' | 'responsive'>('layout');
  const styles = brick?.styles || {};

  const updateStyle = useCallback((section: keyof BrickStyles, patch: Partial<BrickStyles[keyof BrickStyles]>) => {
    onUpdateStyles({ [section]: { ...styles[section], ...patch } });
  }, [styles, onUpdateStyles]);

  // FIX: Safe default for designTokens
  const safeTokens = designTokens || {} as DesignTokens;

  if (!brick) return <div className="flex flex-col items-center justify-center h-full text-gray-400 p-6 text-center"><Palette className="h-12 w-12 mb-3 opacity-30" /><p className="text-sm font-medium">Seleziona un blocco</p></div>;

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <span className="text-lg">📦</span>
          <div><p className="text-sm font-semibold text-gray-900">{brick.label || brick.type}</p><p className="text-[10px] text-gray-500">ID: {brick.id.slice(0, 8)}...</p></div>
        </div>
        {breakpoint !== 'desktop' && <Badge variant="outline" className="mt-2 text-[9px]"><Monitor className="h-2.5 w-2.5 mr-1" /> Override: {breakpoint}</Badge>}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
        <TabsList className="grid grid-cols-5 h-auto p-1 bg-gray-100 rounded-none border-b">
          {[{ id: 'layout', icon: Layout, label: 'Lay' }, { id: 'typography', icon: Type, label: 'Txt' }, { id: 'visual', icon: Palette, label: 'Vis' }, { id: 'advanced', icon: Settings, label: 'Adv' }, { id: 'responsive', icon: Monitor, label: 'Rsp' }].map(({ id, icon: Icon, label }) => (
            <TabsTrigger key={id} value={id} className="flex flex-col items-center gap-0.5 py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Icon className="h-3.5 w-3.5" /><span className="text-[9px]">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <TabsContent value="layout" className="mt-0 space-y-4">
            <Accordion type="single" collapsible defaultValue="display">
              <AccordionItem value="display">
                <AccordionTrigger className="text-xs py-2">Display & Position</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <StyleControl label="Display">
                    <Select value={styles.layout?.display || 'flex'} onValueChange={(v) => updateStyle('layout', { display: v as any })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{['flex', 'grid', 'block', 'inline-flex'].map(opt => <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>)}</SelectContent>
                    </Select>
                  </StyleControl>
                  <StyleControl label="Flex Direction">
                    <div className="flex gap-1">
                      {[{ val: 'row', icon: ArrowRight }, { val: 'column', icon: ArrowDown }, { val: 'row-reverse', icon: ArrowLeft }, { val: 'column-reverse', icon: ArrowUp }].map(({ val, icon: Icon }) => (
                        <Button key={val} variant={styles.layout?.flexDirection === val ? 'default' : 'outline'} size="sm" className="h-7 w-7 p-0" onClick={() => updateStyle('layout', { flexDirection: val as any })}><Icon className="h-3 w-3" /></Button>
                      ))}
                    </div>
                  </StyleControl>
                  <StyleControl label="Justify Content">
                    <Select value={styles.layout?.justifyContent || 'flex-start'} onValueChange={(v) => updateStyle('layout', { justifyContent: v as any })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{['flex-start', 'center', 'flex-end', 'space-between', 'space-around'].map(opt => <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>)}</SelectContent>
                    </Select>
                  </StyleControl>
                  <StyleControl label="Align Items">
                    <Select value={styles.layout?.alignItems || 'stretch'} onValueChange={(v) => updateStyle('layout', { alignItems: v as any })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{['flex-start', 'center', 'flex-end', 'stretch'].map(opt => <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>)}</SelectContent>
                    </Select>
                  </StyleControl>
                  <StyleControl label="Gap">
                    <UnitInput value={styles.layout?.gap} onChange={(v) => updateStyle('layout', { gap: v })} placeholder="0" />
                  </StyleControl>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="spacing">
                <AccordionTrigger className="text-xs py-2">Spacing</AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <StyleControl label="Padding"><UnitInput value={styles.layout?.padding?.all} onChange={(v) => updateStyle('layout', { padding: { all: v } })} placeholder="0" /></StyleControl>
                  <StyleControl label="Margin"><UnitInput value={styles.layout?.margin?.all} onChange={(v) => updateStyle('layout', { margin: { all: v } })} placeholder="0" /></StyleControl>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="size">
                <AccordionTrigger className="text-xs py-2">Size</AccordionTrigger>
                <AccordionContent className="grid grid-cols-2 gap-3">
                  <StyleControl label="Width"><UnitInput value={styles.layout?.width} onChange={(v) => updateStyle('layout', { width: v })} units={['px', '%', 'vw', 'auto']} /></StyleControl>
                  <StyleControl label="Max Width"><UnitInput value={styles.layout?.maxWidth} onChange={(v) => updateStyle('layout', { maxWidth: v })} units={['px', '%', 'vw', 'none']} /></StyleControl>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="typography" className="mt-0 space-y-4">
            <Accordion type="single" collapsible defaultValue="font">
              <AccordionItem value="font">
                <AccordionTrigger className="text-xs py-2">Font & Color</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <StyleControl label="Font Size"><UnitInput value={styles.typography?.fontSize} onChange={(v) => updateStyle('typography', { fontSize: v })} units={['px', 'rem', 'em']} /></StyleControl>
                  <StyleControl label="Font Weight">
                    <Select value={styles.typography?.fontWeight || '400'} onValueChange={(v) => updateStyle('typography', { fontWeight: v as any })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{['100', '200', '300', '400', '500', '600', '700', '800'].map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </StyleControl>
                  <StyleControl label="Text Align">
                    <div className="flex gap-1">
                      {[{ val: 'left', icon: AlignLeft }, { val: 'center', icon: AlignCenter }, { val: 'right', icon: AlignRight }, { val: 'justify', icon: AlignJustify }].map(({ val, icon: Icon }) => (
                        <Button key={val} variant={styles.typography?.textAlign === val ? 'default' : 'outline'} size="sm" className="h-7 w-7 p-0" onClick={() => updateStyle('typography', { textAlign: val as any })}><Icon className="h-3 w-3" /></Button>
                      ))}
                    </div>
                  </StyleControl>
                  <StyleControl label="Color"><ColorPicker value={styles.typography?.color} onChange={(v) => updateStyle('typography', { color: v })} /></StyleControl>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="visual" className="mt-0 space-y-4">
            <Accordion type="single" collapsible defaultValue="background">
              <AccordionItem value="background">
                <AccordionTrigger className="text-xs py-2">Background</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <StyleControl label="Background Color"><ColorPicker value={styles.visual?.backgroundColor} onChange={(v) => updateStyle('visual', { backgroundColor: v })} /></StyleControl>
                  <StyleControl label="Border Radius"><UnitInput value={styles.visual?.borderRadius} onChange={(v) => updateStyle('visual', { borderRadius: v })} units={['px', 'rem', '%']} /></StyleControl>
                  <StyleControl label="Box Shadow">
                    <Select value={styles.visual?.boxShadow || 'none'} onValueChange={(v) => updateStyle('visual', { boxShadow: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{['none', 'sm', 'md', 'lg', 'xl'].map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </StyleControl>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="advanced" className="mt-0 space-y-4">
            <StyleControl label="Z-Index"><Input type="number" value={styles.layout?.zIndex || ''} onChange={(e) => updateStyle('layout', { zIndex: e.target.value ? parseInt(e.target.value) : undefined })} placeholder="0" className="h-8 text-xs" /></StyleControl>
            <StyleControl label="Overflow">
              <Select value={styles.layout?.overflow || 'visible'} onValueChange={(v) => updateStyle('layout', { overflow: v as any })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{['visible', 'hidden', 'scroll', 'auto'].map(v => <SelectItem key={v} value={v} className="text-xs">{v}</SelectItem>)}</SelectContent>
              </Select>
            </StyleControl>
          </TabsContent>

          <TabsContent value="responsive" className="mt-0 space-y-4">
            <p className="text-xs text-gray-500">Override per breakpoint <Badge variant="outline">{breakpoint}</Badge></p>
            <div className="space-y-2">
              <StyleControl label="Font Size Override">
                <UnitInput value={styles.responsive?.[breakpoint]?.typography?.fontSize} onChange={(v) => onUpdateStyles({ responsive: { ...styles.responsive, [breakpoint]: { ...styles.responsive?.[breakpoint], typography: { fontSize: v } } } })} />
              </StyleControl>
              <StyleControl label="Padding Override">
                <UnitInput value={styles.responsive?.[breakpoint]?.layout?.padding?.all} onChange={(v) => onUpdateStyles({ responsive: { ...styles.responsive, [breakpoint]: { ...styles.responsive?.[breakpoint], layout: { padding: { all: v } } } } })} />
              </StyleControl>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}