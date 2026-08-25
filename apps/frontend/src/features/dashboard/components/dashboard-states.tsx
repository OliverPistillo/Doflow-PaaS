import { AlertCircle, Inbox } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"

export function DashboardWidgetSkeleton() {
  return <Skeleton className="h-56 w-full rounded-xl" />
}

export function DashboardEmptyState({ title = "Nessun dato disponibile" }: { title?: string }) {
  return <Empty className="min-h-40"><EmptyHeader><EmptyMedia variant="icon"><Inbox /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>I dati compariranno qui quando disponibili.</EmptyDescription></EmptyHeader></Empty>
}

export function DashboardErrorState({ message = "Non è stato possibile caricare il widget." }: { message?: string }) {
  return <Empty className="min-h-40 border-destructive/40"><EmptyHeader><EmptyMedia variant="icon"><AlertCircle /></EmptyMedia><EmptyTitle>Errore di caricamento</EmptyTitle><EmptyDescription>{message}</EmptyDescription></EmptyHeader></Empty>
}
