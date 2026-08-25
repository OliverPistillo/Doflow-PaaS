"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const OUTPUT_SIZE = 256
const MAX_OUTPUT_BYTES = 280 * 1024
const MAX_SOURCE_BYTES = 8 * 1024 * 1024
const acceptedTypes = new Set(["image/png", "image/jpeg", "image/webp"])

function dataUrlBytes(value: string) {
  const payload = value.split(",")[1] ?? ""
  return Math.ceil(payload.length * 0.75)
}

async function resizeImage(file: File) {
  if (!acceptedTypes.has(file.type)) throw new Error("Formato non valido. Usa PNG, JPEG o WebP.")
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Il file originale supera 8 MB.")
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const sourceX = (bitmap.width - side) / 2
    const sourceY = (bitmap.height - side) / 2
    const canvas = document.createElement("canvas")
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Il browser non supporta l’elaborazione dell’immagine.")
    context.drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
    let result = canvas.toDataURL("image/webp", 0.82)
    if (!result.startsWith("data:image/webp")) result = canvas.toDataURL("image/jpeg", 0.82)
    if (dataUrlBytes(result) > MAX_OUTPUT_BYTES) throw new Error("L’immagine ottimizzata supera 280 KB. Scegli un file più semplice.")
    return result
  } finally {
    bitmap.close()
  }
}

export function EntityImageDialog({ open, onOpenChange, title, description, currentUrl, fallback, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; currentUrl?: string; fallback: string; onSave: (dataUrl?: string) => Promise<boolean> }) {
  const [preview, setPreview] = useState<string | undefined>(currentUrl)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chooseFile = async (file?: File) => {
    if (!file) return
    setProcessing(true)
    setError("")
    try { setPreview(await resizeImage(file)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Impossibile elaborare l’immagine.") }
    finally { setProcessing(false) }
  }

  const save = async () => {
    if (saving || processing || preview === currentUrl) return
    setSaving(true)
    setError("")
    try {
      if (await onSave(preview)) onOpenChange(false)
      else setError("Modifica non autorizzata o immagine non valida.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Salvataggio non riuscito.")
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="w-[calc(100%-2rem)] sm:max-w-md"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><div className="grid gap-4"><div className="flex items-center gap-4 rounded-lg border p-4"><Avatar className="size-20 rounded-xl"><AvatarImage src={preview} alt="Anteprima immagine" className="object-cover" /><AvatarFallback className="rounded-xl text-lg">{fallback}</AvatarFallback></Avatar><div className="min-w-0 text-sm"><p className="font-medium">Anteprima quadrata 256×256</p><p className="text-muted-foreground">PNG, JPEG o WebP. Massimo 280 KB dopo l’ottimizzazione.</p></div></div><div className="grid gap-2"><Label htmlFor="entity-image-file">Scegli immagine</Label><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={processing || saving} onClick={() => fileInputRef.current?.click()}><ImagePlus />{preview ? "Sostituisci" : "Scegli file"}</Button>{preview && <Button type="button" variant="outline" disabled={saving} onClick={() => { setPreview(undefined); setError("") }}><Trash2 />Rimuovi</Button>}</div><Input ref={fileInputRef} id="entity-image-file" className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseFile(event.target.files?.[0])} />{processing && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Ottimizzazione in corso…</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div></div><DialogFooter><Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Annulla</Button><Button disabled={processing || saving || preview === currentUrl} onClick={() => void save()}>{saving && <Loader2 className="animate-spin" />}{saving ? "Salvataggio…" : "Salva"}</Button></DialogFooter></DialogContent></Dialog>
}
