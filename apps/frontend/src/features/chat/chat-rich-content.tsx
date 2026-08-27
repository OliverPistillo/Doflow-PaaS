"use client"

import Image from "next/image"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Film, Search, Smile, Sparkles, Star } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ChatMessage, ChatMessageMedia } from "@/features/chat/team-chat"
import { useTeamChat } from "@/features/chat/team-chat-provider"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { getFlowAsset, getFlowEmojiAssets, getFlowStickerPack, type FlowAsset } from "@/features/flow/flow-assets"
import { apiFetch } from "@/lib/api"

type EmojiItem = { value: string; name: string; aliases: string[]; asset?:FlowAsset }
type EmojiCategory = { id: string; label: string; items: EmojiItem[] }

const emoji = (value: string, name: string, aliases = ""): EmojiItem => ({ value, name, aliases: aliases.split(" ").filter(Boolean) })
const flowEmojiItems:EmojiItem[]=getFlowEmojiAssets().map((asset)=>({value:`:${asset.id}:`,name:`Flow ${asset.name}`,aliases:["flow",asset.name.toLocaleLowerCase("it-IT")],asset}))
const emojiCategories: EmojiCategory[] = [
  { id: "emozioni", label: "Faccine ed emozioni", items: [emoji("😀","Sorriso","felice"),emoji("😂","Risata con lacrime","ridere lol"),emoji("🥰","Innamorato","amore"),emoji("😎","Sorriso con occhiali","cool"),emoji("🤔","Pensieroso","dubbio"),emoji("😢","Triste","pianto"),emoji("😡","Arrabbiato","rabbia"),emoji("🥳","Festa","party"),emoji("🤩","Entusiasta","wow"),emoji("😴","Assonnato","sonno")] },
  { id: "gesti", label: "Persone e gesti", items: [emoji("👍","Pollice in su","ok approvato"),emoji("👎","Pollice in giù","no"),emoji("👏","Applauso","bravo"),emoji("🙏","Grazie","prego"),emoji("💪","Forza","muscolo"),emoji("🤝","Accordo","stretta mano"),emoji("👋","Saluto","ciao"),emoji("✍️","Scrivere","penna"),emoji("🙌","Festeggia","evviva"),emoji("🤞","Incrociare le dita","fortuna")] },
  { id: "natura", label: "Animali e natura", items: [emoji("🐶","Cane"),emoji("🐱","Gatto"),emoji("🦊","Volpe"),emoji("🌱","Germoglio","crescita"),emoji("🌿","Pianta"),emoji("🌞","Sole"),emoji("🌈","Arcobaleno"),emoji("🔥","Fuoco","serie"),emoji("⭐","Stella"),emoji("🌍","Mondo")] },
  { id: "cibo", label: "Cibo", items: [emoji("☕","Caffè"),emoji("🍕","Pizza"),emoji("🍝","Pasta"),emoji("🥐","Cornetto"),emoji("🍎","Mela"),emoji("🍰","Torta"),emoji("🥂","Brindisi"),emoji("🍻","Birre"),emoji("🍫","Cioccolato"),emoji("🥗","Insalata")] },
  { id: "attivita", label: "Attività", items: [emoji("⚽","Calcio"),emoji("🏃","Corsa"),emoji("🎯","Obiettivo","target"),emoji("🏆","Trofeo","premio"),emoji("🎉","Coriandoli","festa"),emoji("🎨","Arte"),emoji("🎵","Musica"),emoji("🎮","Videogioco"),emoji("🚀","Razzo","lancio"),emoji("🧘","Meditazione")] },
  { id: "viaggi", label: "Viaggi e luoghi", items: [emoji("🚗","Auto"),emoji("🚆","Treno"),emoji("✈️","Aereo"),emoji("🏠","Casa"),emoji("🏢","Ufficio"),emoji("🏖️","Spiaggia"),emoji("🗺️","Mappa"),emoji("📍","Posizione"),emoji("🌆","Città"),emoji("🧳","Valigia")] },
  { id: "oggetti", label: "Oggetti", items: [emoji("💡","Idea","lampadina"),emoji("📱","Telefono"),emoji("💻","Computer"),emoji("📷","Fotocamera"),emoji("🔒","Lucchetto"),emoji("🔑","Chiave"),emoji("📎","Allegato"),emoji("✏️","Matita"),emoji("📌","Puntina"),emoji("🧾","Ricevuta")] },
  { id: "simboli", label: "Simboli", items: [emoji("❤️","Cuore","amore"),emoji("✅","Confermato","fatto"),emoji("❌","Errore","no"),emoji("⚠️","Attenzione","avviso"),emoji("❓","Domanda"),emoji("💯","Cento","perfetto"),emoji("➕","Più"),emoji("🔔","Notifica"),emoji("♻️","Riciclo"),emoji("✨","Scintille","magia")] },
  { id: "bandiere", label: "Bandiere", items: [emoji("🇮🇹","Italia"),emoji("🇪🇺","Europa"),emoji("🇬🇧","Regno Unito"),emoji("🇫🇷","Francia"),emoji("🇩🇪","Germania"),emoji("🇪🇸","Spagna"),emoji("🇺🇸","Stati Uniti"),emoji("🏳️","Bandiera bianca"),emoji("🏁","Traguardo"),emoji("🚩","Bandiera rossa")] },
  { id: "lavoro", label: "Lavoro", items: [emoji("📊","Grafico","report"),emoji("📈","Crescita"),emoji("📉","Calo"),emoji("📅","Calendario"),emoji("📝","Nota"),emoji("📣","Annuncio"),emoji("💼","Lavoro"),emoji("🛠️","Strumenti"),emoji("📦","Consegna"),emoji("💳","Pagamento")] },
  { id: "doflow", label: "Flow", items: flowEmojiItems },
]

type EmojiPreferences = { recent: string[]; favorites: string[]; skinTone: string }
const initialPreferences: EmojiPreferences = { recent: [], favorites: ["👍", "❤️", "✅"], skinTone: "" }
const skinTones = ["", "🏻", "🏼", "🏽", "🏾", "🏿"]

function useEmojiPreferences() {
  const [preferences, setPreferences] = useState<EmojiPreferences>(initialPreferences)
  const writeSequence = useRef(0)
  useEffect(() => {
    let active = true
    void apiFetch<{ preferences?: { emojiPreferences?: Partial<EmojiPreferences> } }>("/tenant/preferences")
      .then((payload) => {
        if (!active) return
        const saved = payload.preferences?.emojiPreferences
        if (!saved) return
        setPreferences({
          recent: Array.isArray(saved.recent) ? saved.recent.slice(0, 24) : [],
          favorites: Array.isArray(saved.favorites) ? saved.favorites.slice(0, 24) : initialPreferences.favorites,
          skinTone: skinTones.includes(saved.skinTone ?? "") ? saved.skinTone ?? "" : "",
        })
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])
  const update = useCallback((next: EmojiPreferences) => {
    const normalized = {
      recent: Array.from(new Set(next.recent)).slice(0, 24),
      favorites: Array.from(new Set(next.favorites)).slice(0, 24),
      skinTone: skinTones.includes(next.skinTone) ? next.skinTone : "",
    }
    setPreferences(normalized)
    const sequence = ++writeSequence.current
    void apiFetch("/tenant/preferences", {
      method: "PATCH",
      body: JSON.stringify({ emojiPreferences: normalized }),
    }).catch(() => {
      if (writeSequence.current === sequence) {
        void apiFetch<{ preferences?: { emojiPreferences?: EmojiPreferences } }>("/tenant/preferences")
          .then((payload) => payload.preferences?.emojiPreferences && setPreferences(payload.preferences.emojiPreferences))
          .catch(() => undefined)
      }
    })
  }, [])
  return { preferences, update }
}

function EmojiPicker({ onSelect, compact = false }: { onSelect: (value: string) => void; compact?: boolean }) {
  const { preferences, update } = useEmojiPreferences(); const [query, setQuery] = useState(""); const [category, setCategory] = useState("recent")
  const all = useMemo(() => emojiCategories.flatMap((group) => group.items), [])
  const items = useMemo(() => { const normalized = query.trim().toLocaleLowerCase("it-IT"); if (normalized) return all.filter((item) => `${item.name} ${item.aliases.join(" ")}`.toLocaleLowerCase("it-IT").includes(normalized)); if (category === "recent") return preferences.recent.flatMap((value) => all.find((item) => item.value === value) ?? []); if (category === "favorites") return preferences.favorites.flatMap((value) => all.find((item) => item.value === value) ?? []); return emojiCategories.find((item) => item.id === category)?.items ?? [] }, [all, category, preferences.favorites, preferences.recent, query])
  const choose = (item: EmojiItem) => { const canTone = /[👍👎👏🙏💪👋✍🙌🤞]/u.test(item.value); const value = canTone && preferences.skinTone ? `${item.value.replace("️", "")}${preferences.skinTone}` : item.value; update({ ...preferences, recent: [item.value, ...preferences.recent.filter((entry) => entry !== item.value)].slice(0, 24) }); onSelect(value) }
  return <div className={`flex min-h-0 flex-col ${compact ? "h-[min(70dvh,430px)]" : "h-[min(75dvh,480px)]"}`}><div className="shrink-0 space-y-2 border-b p-3"><div className="relative"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"/><Input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Cerca emoji in italiano…" aria-label="Cerca emoji" className="h-9 pl-8"/></div><div className="flex gap-1 overflow-x-auto pb-1" aria-label="Categorie emoji">{[{id:"recent",label:"Recenti"},{id:"favorites",label:"Preferite"},...emojiCategories].map((item)=><Button key={item.id} size="xs" variant={category===item.id&&!query?"secondary":"ghost"} onClick={()=>{setCategory(item.id);setQuery("")}} title={item.label} aria-label={item.label}>{item.id==="recent"?"🕘":item.id==="favorites"?"⭐":item.id==="doflow"?"💜":"items" in item ? item.items[0]?.value : "•"}</Button>)}</div><div className="flex items-center gap-1 text-xs text-muted-foreground"><span>Tonalità</span>{skinTones.map((tone)=><button key={tone||"default"} type="button" className={`grid size-7 place-items-center rounded-md ${preferences.skinTone===tone?"bg-primary/10 ring-1 ring-primary":"hover:bg-muted"}`} onClick={()=>update({...preferences,skinTone:tone})} aria-label={tone?`Tonalità ${tone}`:"Tonalità predefinita"}>👍{tone}</button>)}</div></div><ScrollArea className="min-h-0 flex-1"><div className="grid grid-cols-7 gap-1 p-3 sm:grid-cols-8">{items.map((item)=><Tooltip key={`${category}:${item.value}`}><TooltipTrigger asChild><button type="button" className="group relative grid size-10 place-items-center rounded-md text-xl hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={()=>choose(item)} aria-label={item.name}>{item.asset?<Image src={item.asset.path} alt={item.name} width={40} height={40} className="size-9 object-contain"/>:item.value}{preferences.favorites.includes(item.value)?<Star className="absolute right-0 top-0 size-2.5 fill-amber-400 text-amber-500"/>:null}</button></TooltipTrigger><TooltipContent>{item.name}</TooltipContent></Tooltip>)}</div>{!items.length?<p className="p-6 text-center text-sm text-muted-foreground">Nessuna emoji trovata.</p>:null}</ScrollArea>{items[0]?<div className="shrink-0 border-t px-3 py-2"><Button size="xs" variant="ghost" onClick={()=>update({...preferences,favorites:preferences.favorites.includes(items[0].value)?preferences.favorites.filter((value)=>value!==items[0].value):[...preferences.favorites,items[0].value].slice(0,24)})}><Star/>{preferences.favorites.includes(items[0].value)?"Rimuovi la prima dai preferiti":"Aggiungi la prima ai preferiti"}</Button></div>:null}</div>
}

export function EmojiTool({ onSelect }: { onSelect: (value: string) => void }) {
  return <Popover><Tooltip><TooltipTrigger asChild><PopoverTrigger asChild><Button type="button" size="icon-sm" variant="ghost" aria-label="Apri emoji"><Smile/></Button></PopoverTrigger></TooltipTrigger><TooltipContent>Emoji</TooltipContent></Tooltip><PopoverContent align="start" side="top" className="w-[min(94vw,390px)] p-0"><EmojiPicker onSelect={onSelect}/></PopoverContent></Popover>
}

const crm=getFlowStickerPack("crm"), work=getFlowStickerPack("work")
const stickerPacks=[
  {pack:"Emozioni",items:getFlowStickerPack("emotions")},
  {pack:"Comunicazione",items:getFlowStickerPack("communication")},
  {pack:"Lavoro",items:work.filter((item)=>!["flow-contract-signed","flow-payment-received","flow-materials-received"].includes(item.id))},
  {pack:"Commerciale e CRM",items:crm.filter((item)=>!["flow-project-in-progress","flow-waiting-materials","flow-project-delivered","flow-ticket-solved"].includes(item.id))},
  {pack:"Progetti",items:[...crm.filter((item)=>["flow-project-in-progress","flow-waiting-materials","flow-project-delivered"].includes(item.id)),...work.filter((item)=>["flow-project-planning","flow-materials-received"].includes(item.id))]},
  {pack:"Supporto",items:crm.filter((item)=>item.id==="flow-ticket-solved")},
]
const internalGifs = ["Festeggia", "Ottimo lavoro", "Daje", "Obiettivo raggiunto"]
const slug = (value:string)=>value.toLocaleLowerCase("it-IT").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")

export function MediaTools({ onSend }: { onSend: (media: ChatMessageMedia) => void }) {
  const [open,setOpen]=useState(false); const [selected,setSelected]=useState<ChatMessageMedia>(); const [caption,setCaption]=useState(""); const [query,setQuery]=useState("")
  const choose=(media:ChatMessageMedia)=>{setSelected(media);setCaption("");setOpen(false)}
  const confirm=()=>{if(!selected)return;onSend({...selected,caption:caption.trim()||undefined});setSelected(undefined);setCaption("")}
  return <><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" aria-label="GIF e sticker"><Film className="size-4"/><span className="hidden sm:inline">GIF</span></Button></PopoverTrigger><PopoverContent align="start" side="top" className="w-[min(94vw,430px)] p-0"><Tabs defaultValue="sticker"><div className="border-b p-3"><TabsList className="w-full"><TabsTrigger value="sticker" className="flex-1"><Sparkles/>Sticker</TabsTrigger><TabsTrigger value="gif" className="flex-1"><Film/>GIF</TabsTrigger></TabsList><div className="relative mt-2"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground"/><Input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Cerca contenuto…" className="h-9 pl-8"/></div></div><TabsContent value="sticker" className="m-0"><ScrollArea className="h-[min(55dvh,350px)]"><div className="space-y-4 p-3">{stickerPacks.map((pack)=><section key={pack.pack}><h3 className="mb-2 text-xs font-semibold text-muted-foreground">{pack.pack}</h3><div className="grid grid-cols-2 gap-2">{pack.items.filter((item)=>`${item.name} ${item.id}`.toLocaleLowerCase("it-IT").includes(query.toLocaleLowerCase("it-IT"))).map((item)=><button key={`${pack.pack}:${item.id}`} type="button" className="min-h-24 rounded-xl border p-2 text-center text-xs font-semibold hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={()=>choose({type:"sticker",provider:"doflow-internal",assetId:item.id,pack:pack.pack,alt:`Sticker Flow ${item.name}`,moderation:"approved"})}><Image src={item.path} alt="" width={item.width} height={item.height} className="mx-auto size-16 object-contain"/><span className="mt-1 block truncate" title={item.name}>{item.name}</span></button>)}</div></section>)}</div></ScrollArea></TabsContent><TabsContent value="gif" className="m-0"><div className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Provider esterno non configurato · contenuti interni moderati</div><div className="grid grid-cols-2 gap-2 p-3">{internalGifs.filter((item)=>item.toLocaleLowerCase("it-IT").includes(query.toLocaleLowerCase("it-IT"))).map((item)=><button key={item} type="button" className="grid min-h-24 place-items-center rounded-xl border bg-gradient-to-br from-blue-500/10 to-violet-500/15 p-2 hover:border-primary motion-safe:hover:animate-pulse" onClick={()=>choose({type:"gif",provider:"doflow-internal",assetId:`gif-${slug(item)}`,alt:`Animazione ${item}`,moderation:"approved"})}><span className="text-center text-sm font-semibold">{item}<small className="mt-1 block text-[9px] font-normal text-muted-foreground">GIF interna DoFlow</small></span></button>)}</div></TabsContent></Tabs></PopoverContent></Popover><Dialog open={Boolean(selected)} onOpenChange={(value)=>{if(!value)setSelected(undefined)}}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Inviare {selected?.type === "gif" ? "la GIF" : "lo sticker"}?</DialogTitle><DialogDescription>Il contenuto interno è moderato e verrà salvato come messaggio strutturato.</DialogDescription></DialogHeader>{selected?<MessageMedia media={selected}/>:null}<Input value={caption} onChange={(event)=>setCaption(event.target.value)} placeholder="Aggiungi una didascalia (facoltativa)" aria-label="Didascalia"/><DialogFooter><Button variant="outline" onClick={()=>setSelected(undefined)}>Annulla</Button><Button onClick={confirm}><Check/>Invia</Button></DialogFooter></DialogContent></Dialog></>
}

export function MessageMedia({ media }: { media: ChatMessageMedia }) {
  const asset=media.type==="sticker"?getFlowAsset(media.assetId):undefined
  return <figure className="mt-2 max-w-sm overflow-hidden rounded-xl border bg-gradient-to-br from-blue-500/10 via-background to-violet-500/15 p-4 text-center" aria-label={media.alt}><div className={media.type==="gif"?"motion-safe:animate-pulse":""}>{asset?<Image src={asset.path} alt={media.alt} width={asset.width} height={asset.height} loading="eager" className="mx-auto size-32 object-contain"/>:<span className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10 text-primary">{media.type==="gif"?<Film/>:<Sparkles/>}</span>}<p className="mt-2 text-sm font-semibold">{media.alt.replace(/^(Sticker|Animazione) /,"")}</p><p className="text-[10px] text-muted-foreground">{media.pack??"Contenuto interno DoFlow"}</p></div>{media.caption?<figcaption className="mt-2 text-xs">{media.caption}</figcaption>:null}</figure>
}

export function MessageText({text,className}:{text:string;className?:string}){const parts=text.split(/(:flow-[a-z0-9-]+:)/g);return <p className={className}>{parts.map((part,index)=>{const match=/^:(flow-[a-z0-9-]+):$/.exec(part);const asset=match?getFlowEmojiAssets().find((item)=>item.id===match[1]):undefined;return asset?<Image key={`${part}-${index}`} src={asset.path} alt={`Emoji Flow ${asset.name}`} title={`Flow ${asset.name}`} width={28} height={28} className="mx-0.5 inline-block size-7 object-contain align-middle"/>:<Fragment key={`${part}-${index}`}>{part}</Fragment>})}</p>}

const quickReactions=["👍","❤️","😂","🎉","👀","✅"]
export function MessageReactions({ message }: { message: ChatMessage }) {
  const chat=useTeamChat(); const identity=useDoflowIdentity(); const reactions=chat.reactions.filter((item)=>item.messageId===message.id)
  const toggle=(value:string)=>{const current=reactions.find((item)=>item.emoji===value);void chat.setReaction(message.id,value,!current?.userIds.includes(identity.currentUserId))}
  return <div className="mt-1 flex flex-wrap items-center gap-1"><Popover><PopoverTrigger asChild><Button size="icon-xs" variant="ghost" className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" aria-label="Aggiungi reazione"><Smile/></Button></PopoverTrigger><PopoverContent align="start" className="w-auto p-1"><div className="flex gap-0.5">{quickReactions.map((value)=><Button key={value} size="icon-sm" variant="ghost" onClick={()=>toggle(value)} aria-label={`Reagisci con ${value}`}>{value}</Button>)}</div><div className="border-t pt-1"><EmojiPicker compact onSelect={toggle}/></div></PopoverContent></Popover>{reactions.map((reaction)=>{const mine=reaction.userIds.includes(identity.currentUserId);const names=reaction.userIds.map((id)=>identity.users.find((user)=>user.id===id)?.name??"Utente").join(", ");const custom=/^:(flow-[a-z0-9-]+):$/.exec(reaction.emoji);const asset=custom?getFlowEmojiAssets().find((item)=>item.id===custom[1]):undefined;return <Tooltip key={reaction.emoji}><TooltipTrigger asChild><button type="button" className={`inline-flex h-7 items-center gap-1 rounded-full border px-1.5 text-xs ${mine?"border-primary/50 bg-primary/10":"bg-background"}`} aria-pressed={mine} onClick={()=>toggle(reaction.emoji)}>{asset?<Image src={asset.path} alt={`Flow ${asset.name}`} width={22} height={22} className="size-5 object-contain"/>:reaction.emoji}<span>{reaction.userIds.length}</span></button></TooltipTrigger><TooltipContent>{names}</TooltipContent></Tooltip>})}</div>
}
