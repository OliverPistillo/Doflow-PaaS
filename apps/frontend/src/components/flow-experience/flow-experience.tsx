"use client";

import * as React from "react";
import Image from "next/image";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  ImagePlus,
  Loader2,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFlowExperiencePreferences } from "@/components/flow-experience/flow-preferences-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  releasesApi,
  type AppRelease,
  type FlowPreferences,
} from "@/lib/tenant-feature-api";
import {
  flowAssets,
  flowChatAssets,
  type FlowAsset,
  type FlowAssetId,
} from "@/components/flow-experience/flow-assets";

export function FlowAssetPicker({ onSelect }: { onSelect: (asset: FlowAsset) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="icon" variant="outline" aria-label="Aggiungi emoji o sticker Flow">
          <ImagePlus />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <p className="mb-3 text-sm font-medium">Emoji e sticker</p>
        <div className="grid grid-cols-4 gap-2">
          {flowChatAssets.map((asset) => (
            <button
              type="button"
              key={asset.id}
              onClick={() => onSelect(asset)}
              className="rounded-xl border bg-card p-2 text-card-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={"Aggiungi " + asset.alt}
            >
              <Image src={asset.src} alt="" width={64} height={64} className="aspect-square w-full object-contain" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FlowIllustration({
  assetId,
  className = "",
}: {
  assetId: FlowAssetId;
  className?: string;
}) {
  const asset = flowAssets[assetId];
  const [failed, setFailed] = React.useState(false);
  if (failed) {
    return <span className={"grid place-items-center rounded-full bg-primary/10 text-primary " + className}><Sparkles className="size-6" /></span>;
  }
  return (
    <Image
      src={asset.src}
      alt={asset.alt}
      width={240}
      height={240}
      className={"object-contain " + className}
      onError={() => setFailed(true)}
    />
  );
}

export function FlowEmptyState({
  assetId,
  title,
  description,
  action,
}: {
  assetId: Extract<FlowAssetId, "empty-chat" | "empty-notifications" | "empty-projects" | "empty-search">;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const { preferences } = useFlowExperiencePreferences();
  const illustrated = preferences?.illustratedEmptyStates !== false;
  return (
    <div className="grid min-h-64 place-items-center p-6 text-center">
      <div className="max-w-sm">
        {illustrated ? <FlowIllustration assetId={assetId} className="mx-auto mb-3 size-32 sm:size-36" /> : null}
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {action ? <div className="mt-4">{action}</div> : null}
      </div>
    </div>
  );
}

export function FlowPreferencesPanel() {
  const { preferences, loading, error: loadError, update: persist } = useFlowExperiencePreferences();
  const [error, setError] = React.useState("");

  const update = async (patch: Partial<FlowPreferences>) => {
    if (!preferences) return;
    try {
      await persist(patch);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Preferenza non aggiornata.");
    }
  };

  if (loading) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />Caricamento preferenze…</p>;
  if (!preferences) return <p role="alert" className="text-sm text-destructive">{loadError || "Preferenze non disponibili."}</p>;

  const options: Array<{ key: keyof FlowPreferences; label: string; description: string }> = [
    { key: "suggestionsEnabled", label: "Suggerimenti contestuali", description: "Mostra indicazioni pertinenti alla schermata." },
    { key: "illustratedEmptyStates", label: "Empty state illustrati", description: "Usa le illustrazioni Flow quando non ci sono dati." },
    { key: "contextualAssistant", label: "Assistente contestuale", description: "Rende disponibile l’aiuto nelle feature supportate." },
    { key: "animationsEnabled", label: "Animazioni", description: "Abilita transizioni non essenziali." },
    { key: "reducedMotion", label: "Movimento ridotto", description: "Riduce animazioni e spostamenti visivi." },
  ];

  return (
    <div className="space-y-3">
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      {options.map((option) => (
        <div key={option.key} className="flex items-start justify-between gap-4 rounded-xl border p-3">
          <div>
            <Label htmlFor={"flow-pref-" + option.key}>{option.label}</Label>
            <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
          </div>
          <Switch
            id={"flow-pref-" + option.key}
            checked={Boolean(preferences[option.key])}
            onCheckedChange={(checked) => void update({ [option.key]: checked })}
          />
        </div>
      ))}
    </div>
  );
}

export function FlowAssistant({
  context = "questa schermata",
}: {
  context?: string;
}) {
  const { preferences } = useFlowExperiencePreferences();
  const contextualAssistant = preferences?.contextualAssistant !== false;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="icon" variant="outline" aria-label="Apri assistente">
          <HelpCircle />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" />Assistente Flow</DialogTitle>
          <DialogDescription>Aiuto contestuale per {context}.</DialogDescription>
        </DialogHeader>
        <div className={contextualAssistant ? "grid gap-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-center" : "rounded-xl border bg-muted/40 p-4"}>
          {contextualAssistant ? <FlowIllustration assetId="assistant-support" className="mx-auto size-28" /> : null}
          <div className="space-y-2 text-sm">
            <p>{contextualAssistant ? "Consulta le indicazioni della schermata oppure personalizza l’esperienza." : "L’assistente contestuale è disattivato."}</p>
            <p className="text-muted-foreground">{contextualAssistant ? "I suggerimenti non modificano dati senza una tua azione esplicita." : "Puoi riattivarlo dalle preferenze qui sotto."}</p>
          </div>
        </div>
        <Separator />
        <div>
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><Settings2 className="size-4" />Preferenze</h3>
          <FlowPreferencesPanel />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ReleaseIndicator() {
  const [items, setItems] = React.useState<AppRelease[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    releasesApi.list({ limit: 10 }).then((page) => setItems(page.items)).catch(() => undefined).finally(() => setLoading(false));
  }, []);

  const unread = items.filter((item) => !item.read).length;
  const markRead = async (release: AppRelease) => {
    if (release.read) return;
    setItems((current) => current.map((item) => item.id === release.id ? { ...item, read: true } : item));
    await releasesApi.read(release.id).catch(() => {
      setItems((current) => current.map((item) => item.id === release.id ? { ...item, read: false } : item));
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" size="icon" variant="outline" className="relative" aria-label={unread ? unread + " novità non lette" : "Novità applicazione"}>
          <Bell />
          {unread ? <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{unread}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="p-4">
          <p className="font-semibold">Novità</p>
          <p className="text-xs text-muted-foreground">Release pubblicate per il tenant.</p>
        </div>
        <Separator />
        <ScrollArea className="max-h-80">
          <div className="space-y-1 p-2">
            {loading ? <p className="p-3 text-sm text-muted-foreground">Caricamento…</p> : null}
            {!loading && !items.length ? <p className="p-3 text-sm text-muted-foreground">Nessuna release pubblicata.</p> : null}
            {items.map((release) => (
              <button key={release.id} type="button" onClick={() => void markRead(release)} className="w-full rounded-xl p-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{release.title}</span>
                      {!release.read ? <span className="size-2 shrink-0 rounded-full bg-primary" /> : null}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">{release.summary || "Dettagli della release disponibili."}</span>
                  </span>
                  <Badge variant="outline">{release.version}</Badge>
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export type FlowTourStep = {
  id: string;
  title: string;
  description: string;
  selector: string;
};

export function FlowOnboardingLauncher({
  tourId,
  steps,
}: {
  tourId: string;
  steps: FlowTourStep[];
}) {
  const { preferences, update } = useFlowExperiencePreferences();
  const [active, setActive] = React.useState(false);

  if (!preferences || preferences.suggestionsEnabled === false || preferences.onboardingStatus === "completed" || preferences.onboardingStatus === "dismissed") {
    return null;
  }

  const start = async () => {
    await update({
      onboardingStatus: "in_progress",
      activeTourId: tourId,
      tourStep: preferences.activeTourId === tourId ? preferences.tourStep || 0 : 0,
    }).catch(() => preferences);
    setActive(true);
  };

  const dismiss = async () => {
    await update({
      onboardingStatus: "dismissed",
      activeTourId: null,
      tourStep: 0,
    }).catch(() => preferences);
    setActive(false);
  };

  return (
    <>
      <div className="flex items-center rounded-lg border bg-card text-card-foreground">
        <Button type="button" size="sm" variant="ghost" className="gap-2" onClick={() => void start()}>
          <Sparkles className="size-4" />
          {preferences.onboardingStatus === "in_progress" ? "Continua tour" : "Tour"}
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => void dismiss()} aria-label="Ignora tour">
          <X className="size-3.5" />
        </Button>
      </div>
      <FlowGuidedTour
        key={tourId + ":" + String(preferences.tourStep || 0)}
        tourId={tourId}
        steps={steps}
        initialStep={preferences.activeTourId === tourId ? preferences.tourStep || 0 : 0}
        completedTourIds={preferences.completedTourIds}
        active={active}
        onClose={() => setActive(false)}
      />
    </>
  );
}

export function FlowGuidedTour({
  tourId,
  steps,
  initialStep = 0,
  completedTourIds = [],
  active,
  onClose,
}: {
  tourId: string;
  steps: FlowTourStep[];
  initialStep?: number;
  completedTourIds?: string[];
  active: boolean;
  onClose: () => void;
}) {
  const { update } = useFlowExperiencePreferences();
  const [index, setIndex] = React.useState(Math.max(0, Math.min(initialStep, Math.max(steps.length - 1, 0))));
  const [rect, setRect] = React.useState<DOMRect>();
  const step = steps[index];

  React.useEffect(() => {
    if (!active || !step) return;
    const update = () => setRect(document.querySelector(step.selector)?.getBoundingClientRect());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, step]);

  if (!active || !step) return null;

  const close = async (completed: boolean) => {
    await update(completed
      ? {
        onboardingStatus: "completed",
        activeTourId: null,
        tourStep: 0,
        completedTourIds: Array.from(new Set([...completedTourIds, tourId])),
      }
      : { activeTourId: null, tourStep: index }).catch(() => undefined);
    onClose();
  };

  const next = async () => {
    if (index >= steps.length - 1) {
      await close(true);
      return;
    }
    const nextIndex = index + 1;
    setIndex(nextIndex);
    await update({ activeTourId: tourId, tourStep: nextIndex }).catch(() => undefined);
  };

  return (
    <Dialog
      open={active}
      onOpenChange={(open) => {
        if (!open) void close(false);
      }}
    >
      <DialogContent
        className="fixed bottom-4 left-4 right-4 top-auto w-auto max-w-none translate-x-0 translate-y-0 rounded-2xl p-4 shadow-lg sm:left-auto sm:right-4 sm:w-96"
        showCloseButton={false}
        style={{ transform: "none" }}
      >
        {rect ? (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed rounded-xl ring-4 ring-primary ring-offset-4 ring-offset-background"
            style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
          />
        ) : null}
        <div className="flex items-start gap-3">
          <FlowIllustration assetId="assistant-default" className="size-14 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <DialogTitle>{step.title}</DialogTitle>
              <Badge variant="secondary">{index + 1}/{steps.length}</Badge>
            </div>
            <DialogDescription className="mt-2">{step.description}</DialogDescription>
          </div>
          <Button type="button" size="icon-sm" variant="ghost" onClick={() => void close(false)} aria-label="Chiudi tour"><X /></Button>
        </div>
        <div className="mt-4 flex justify-between gap-2">
          <Button type="button" variant="outline" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ChevronLeft />Indietro</Button>
          <Button type="button" onClick={() => void next()}>{index === steps.length - 1 ? "Completa" : "Avanti"}<ChevronRight /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
