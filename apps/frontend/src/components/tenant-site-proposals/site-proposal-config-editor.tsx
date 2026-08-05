"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CommercialSectionCard } from "@/components/tenant-commercial/commercial-ui";
import type { JsonObject, SiteConfig } from "@/lib/tenant-site-proposals-api";
import { getPath, setPath, textLimit } from "./site-proposal-utils";

const value = (input: unknown) => typeof input === "string" || typeof input === "number" ? String(input) : "";
const labelFor = (path: string) => path.split(".").filter((part) => !/^\d+$/.test(part)).slice(-2).join(" · ").replace(/([a-z])([A-Z])/g, "$1 $2");

function Field({ config, path, label, multiline, onChange }: { config: SiteConfig; path: string; label: string; multiline?: boolean; onChange: (next: SiteConfig) => void }) {
  const current = value(getPath(config, path));
  const limit = textLimit(config, path);
  const common = { id: path, value: current, maxLength: limit || undefined, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(setPath(config, path, event.target.value)) };
  return <div><Label htmlFor={path}>{label}</Label>{multiline ? <Textarea {...common} className="mt-1 min-h-24" /> : <Input {...common} className="mt-1" />} {limit ? <p className="mt-1 text-right text-xs text-slate-400">{current.length}/{limit}</p> : null}</div>;
}

function editableContentPaths(content: JsonObject, profile: string) {
  const paths: string[] = [];
  const visit = (candidate: unknown, path: string) => {
    if (profile === "beauty-conversion-v1" && (path === "content.reviews" || path.startsWith("content.reviews."))) return;
    if (typeof candidate === "string" || typeof candidate === "number") { paths.push(path); return; }
    if (Array.isArray(candidate)) candidate.forEach((item, index) => visit(item, `${path}.${index}`));
    else if (candidate && typeof candidate === "object") Object.entries(candidate as JsonObject).forEach(([key, item]) => visit(item, `${path}.${key}`));
  };
  visit(content, "content");
  return paths;
}

export function SiteProposalConfigEditor({ config, onChange }: { config: SiteConfig; onChange: (next: SiteConfig) => void }) {
  const editing = (config.editingContract || {}) as JsonObject;
  const fixedCounts = (editing.fixedCounts || {}) as JsonObject;
  const profile = String((config.personalization as JsonObject | undefined)?.contentProfile || (Number(fixedCounts.reviews) === 3 && Number(fixedCounts.ctaItems) === 4 ? "beauty-conversion-v1" : Number(fixedCounts.services) === 4 ? "beauty-editorial-v1" : ""));
  const imageSlots = Array.isArray(editing.imageSlots) ? editing.imageSlots.filter((item): item is string => typeof item === "string") : ["hero", "consultation", "feature"];
  const contentPaths = useMemo(() => editableContentPaths(config.content as JsonObject, profile), [config.content, profile]);
  const images = config.images || {};
  const visualSlots = imageSlots.filter((slot) => !slot.startsWith("logo") && images[slot] && typeof images[slot] === "object" && !Array.isArray(images[slot]));
  const brand = config.brand as JsonObject;
  const logoDefaultPath = typeof brand.logoDefault === "string" ? "brand.logoDefault" : (images.logoDefault ? "images.logoDefault.src" : "images.logo.src");
  const logoLightPath = typeof brand.logoLight === "string" ? "brand.logoLight" : (images.logoLight ? "images.logoLight.src" : "");
  const changeImage = (slot: string, next: SiteConfig) => onChange(setPath(next, `images.${slot}.sourceMethod`, "manual"));
  const changeLogo = (path: string, next: SiteConfig) => {
    if (path.startsWith("brand.")) onChange(setPath(next, "brand.logoSourceMethod", "manual"));
    else onChange(setPath(next, path.replace(/\.src$/, ".sourceMethod"), "manual"));
  };

  return <div className="space-y-5">
    <CommercialSectionCard title="Identità"><div className="grid gap-4 md:grid-cols-2"><Field config={config} path="brand.name" label="Nome" onChange={onChange}/><Field config={config} path="brand.descriptor" label="Categoria / descrittore" onChange={onChange}/><Field config={config} path="brand.professionalTitle" label="Qualifica" onChange={onChange}/><Field config={config} path="business.city" label="Città" onChange={onChange}/><Field config={config} path="business.phoneDisplay" label="Telefono" onChange={onChange}/><Field config={config} path="business.email" label="Email" onChange={onChange}/><div className="md:col-span-2"><Field config={config} path="sourceWebsite.url" label="Sito attuale" onChange={onChange}/></div></div></CommercialSectionCard>
    <CommercialSectionCard title="Brand"><div className="grid gap-4 lg:grid-cols-2"><Field config={config} path={logoDefaultPath} label="Logo default" onChange={(next) => changeLogo(logoDefaultPath, next)}/>{logoLightPath ? <Field config={config} path={logoLightPath} label="Logo light" onChange={(next) => changeLogo(logoLightPath, next)}/> : null}<div><Label>Palette del tema</Label><div className="mt-2 flex flex-wrap gap-2">{Array.isArray(config.palette) ? config.palette.map((item) => <span key={item.variable} className="rounded-lg border px-2 py-1 text-xs"><i className="mr-2 inline-block h-3 w-3 rounded-full" style={{background: item.value}}/>{item.variable}</span>) : Object.entries(config.palette).map(([key, color]) => <span key={key} className="rounded-lg border px-2 py-1 text-xs"><i className="mr-2 inline-block h-3 w-3 rounded-full" style={{background: String(color)}}/>{key}</span>)}</div></div></div></CommercialSectionCard>
    <CommercialSectionCard title="Immagini"><div className="grid gap-4 lg:grid-cols-3">{visualSlots.map((slot) => { const image = images[slot] as JsonObject; return <div key={slot} className="rounded-xl border p-4">{image.src ? <img src={String(image.src)} alt={String(image.alt || slot)} className="mb-3 h-36 w-full rounded-lg object-cover"/> : null}<Field config={config} path={`images.${slot}.src`} label={slot} onChange={(next) => changeImage(slot, next)}/><Field config={config} path={`images.${slot}.alt`} label="Testo alternativo" onChange={onChange}/><Field config={config} path={`images.${slot}.objectPosition`} label="Posizione immagine" onChange={onChange}/><p className="mt-2 text-xs text-slate-500">Metodo: {String(image.sourceMethod || "package")}</p></div>; })}</div></CommercialSectionCard>
    <CommercialSectionCard title="Contenuti del tema"><p className="mb-4 text-sm text-slate-500">Campi generati dal contratto del profilo {profile || "del tema"}. Le sezioni protette non sono modificabili.</p><div className="grid gap-4 lg:grid-cols-2">{contentPaths.map((path) => <Field key={path} config={config} path={path} label={labelFor(path)} multiline={/description|text|quote|notice|copyright/i.test(path)} onChange={onChange}/>)}</div></CommercialSectionCard>
    <CommercialSectionCard title="SEO"><div className="grid gap-4 lg:grid-cols-2"><Field config={config} path="seo.title" label="Titolo SEO" onChange={onChange}/><Field config={config} path="seo.description" label="Descrizione SEO" multiline onChange={onChange}/></div></CommercialSectionCard>
  </div>;
}
