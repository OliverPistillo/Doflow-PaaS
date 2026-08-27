"use client"

import Image from "next/image"
import { AlertTriangle, Bot, CircleCheck, CircleX, Lightbulb, LoaderCircle, PartyPopper } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getFlowAsset, getFlowMascot } from "@/features/flow/flow-assets"

export type FlowAssistantVariant = "default" | "neutral" | "welcome" | "success" | "warning" | "error" | "thinking" | "working" | "celebration" | "support"
export type FlowAssistantSize = "reaction" | "hint" | "empty-state" | "onboarding"

const icons = { default:Bot, neutral:Bot, welcome:Bot, success:CircleCheck, warning:AlertTriangle, error:CircleX, thinking:Lightbulb, working:LoaderCircle, celebration:PartyPopper, support:Bot }
const tones: Record<FlowAssistantVariant,string> = { default:"border-border bg-card",neutral:"border-border bg-card",welcome:"border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-blue-500/5",success:"border-emerald-500/30 bg-emerald-500/5",warning:"border-amber-500/30 bg-amber-500/5",error:"border-destructive/30 bg-destructive/5",thinking:"border-blue-500/30 bg-blue-500/5",working:"border-indigo-500/30 bg-indigo-500/5",celebration:"border-violet-500/30 bg-violet-500/5",support:"border-cyan-500/30 bg-cyan-500/5" }
const imageSizes = { reaction:"size-10", hint:"size-16 sm:size-20", "empty-state":"size-32 sm:size-40", onboarding:"size-48 sm:size-56" }

export function FlowAssistant({variant="default",size="hint",title,message,primaryAction,secondaryAction,onDismiss,assetId,className,ariaLabel,position="inline",status}:{variant?:FlowAssistantVariant;size?:FlowAssistantSize;title:string;message:string;primaryAction?:{label:string;onClick:()=>void};secondaryAction?:{label:string;onClick:()=>void};onDismiss?:()=>void;assetId?:string;className?:string;ariaLabel?:string;position?:"inline"|"fixed"|"sticky";status?:string}) {
  const mascotVariant=variant === "neutral" ? "default" : variant
  const asset=getFlowAsset(assetId) ?? getFlowMascot(mascotVariant); const Icon=icons[variant]
  const visibleSecondaryAction=status?.includes("· 1 di ")?undefined:secondaryAction
  return <section aria-label={ariaLabel??`Flow: ${title}`} data-flow-tour-ui={status?.includes(" di ") ? "true" : undefined} className={cn("relative flex min-w-0 gap-3 rounded-xl border text-foreground shadow-sm",tones[variant],size==="reaction"?"items-center p-2":size==="hint"?"p-3":size==="empty-state"?"mx-auto max-w-lg flex-col items-center p-6 text-center":"flex-col items-center p-6 text-center sm:p-8",className)}>
    <div data-position={position} className={cn("grid shrink-0 place-items-center overflow-hidden rounded-xl text-primary",imageSizes[size],!asset&&"bg-primary/10")}>{asset?<Image src={asset.path} alt={`${asset.name}: ${title}`} width={asset.width} height={asset.height} loading={size==="onboarding"?"eager":"lazy"} className="size-full object-contain"/>:<Icon className={cn(size==="reaction"?"size-4":size==="hint"?"size-6":"size-10",variant==="working"&&"motion-safe:animate-spin")}/>}</div>
    <div className={cn("min-w-0 flex-1",(size==="empty-state"||size==="onboarding")&&"text-center")}><h2 className={cn("font-semibold",size==="onboarding"?"text-xl":"text-sm")}>{title}</h2>{status?<p className="mt-1 text-xs font-medium text-primary">{status}</p>:null}<p className={cn("mt-0.5 text-muted-foreground",size==="onboarding"?"text-sm":"text-xs")}>{message}</p>{primaryAction||visibleSecondaryAction?<div className={cn("mt-3 flex flex-wrap gap-2",(size==="empty-state"||size==="onboarding")&&"justify-center")}>{primaryAction?<Button size="sm" onClick={primaryAction.onClick}>{primaryAction.label}</Button>:null}{visibleSecondaryAction?<Button size="sm" variant="outline" onClick={visibleSecondaryAction.onClick}>{visibleSecondaryAction.label}</Button>:null}</div>:null}</div>
    {onDismiss?<Button size="icon-xs" variant="ghost" className="absolute right-2 top-2" onClick={onDismiss} aria-label="Chiudi suggerimento Flow">×</Button>:null}
  </section>
}
