"use client";

import { Clipboard, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CommercialSectionCard } from "@/components/tenant-commercial/commercial-ui";

async function copy(text: string, message: string) { try { await navigator.clipboard.writeText(text); toast.success(message); } catch { toast.error("Copia non disponibile."); } }
export function SiteProposalEmailEditor({ subject, body, originalSubject, originalBody, onChange }: { subject: string; body: string; originalSubject: string; originalBody: string; onChange: (next: { subject: string; body: string }) => void }) { const complete = `Oggetto: ${subject}\n\n${body}`; return <CommercialSectionCard title="Bozza email"><div className="space-y-4"><div><Label htmlFor="email-subject">Oggetto</Label><Input id="email-subject" className="mt-1" value={subject} onChange={(event) => onChange({ subject: event.target.value, body })} /></div><div><Label htmlFor="email-body">Corpo</Label><Textarea id="email-body" className="mt-1 min-h-[340px]" value={body} onChange={(event) => onChange({ subject, body: event.target.value })} /><p className="mt-1 text-right text-xs text-slate-500">{body.length} caratteri</p></div>{!body.includes("[LINK_DEMO]") ? <p className="text-sm text-amber-700">Il placeholder [LINK_DEMO] non è presente.</p> : null}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void copy(subject, "Oggetto copiato.")}><Clipboard className="mr-2 h-4 w-4" />Copia oggetto</Button><Button variant="outline" onClick={() => void copy(body, "Corpo copiato.")}><Clipboard className="mr-2 h-4 w-4" />Copia corpo</Button><Button variant="outline" onClick={() => void copy(complete, "Email completa copiata.")}><Clipboard className="mr-2 h-4 w-4" />Copia email completa</Button><Button variant="outline" onClick={() => onChange({ subject: originalSubject, body: originalBody })}><RotateCcw className="mr-2 h-4 w-4" />Ripristina dal valore salvato</Button></div></div></CommercialSectionCard>; }
