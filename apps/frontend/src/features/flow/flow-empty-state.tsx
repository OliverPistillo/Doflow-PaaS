"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { FlowAssistant } from "@/features/flow/flow-assistant"
import { useFlowExperience } from "@/features/flow/flow-experience-provider"

type Action={label:string;onClick:()=>void}
export function FlowEmptyState({assetId,title,message,primaryAction,secondaryAction,className}:{assetId:string;title:string;message:string;primaryAction?:Action;secondaryAction?:Action;className?:string}){
  const {preferences}=useFlowExperience()
  if(preferences?.illustratedEmptyStates!==false)return <FlowAssistant variant="support" size="empty-state" assetId={assetId} title={title} message={message} primaryAction={primaryAction} secondaryAction={secondaryAction} className={className}/>
  return <section className={className}><div className="mx-auto max-w-md rounded-xl border border-dashed p-6 text-center"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{message}</p>{primaryAction||secondaryAction?<div className="mt-3 flex flex-wrap justify-center gap-2">{primaryAction?<Button size="sm" onClick={primaryAction.onClick}>{primaryAction.label}</Button>:null}{secondaryAction?<Button size="sm" variant="outline" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>:null}</div>:null}</div></section>
}

export function FlowEmptySlot({children}:{children:ReactNode}){return <div className="px-3 py-8">{children}</div>}
