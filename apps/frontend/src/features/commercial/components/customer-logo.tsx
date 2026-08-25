import { Building2 } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { CommercialCustomer } from "@/features/commercial/components/commercial-leads-provider"

export function CustomerLogo({ customer, className = "size-10" }: { customer: CommercialCustomer; className?: string }) {
  return <Avatar className={`${className} rounded-lg border bg-background`}><AvatarImage src={customer.logoUrl} alt={`Logo ${customer.profile.company}`} className="object-contain p-0.5" /><AvatarFallback className="rounded-lg"><Building2 className="size-1/2" /></AvatarFallback></Avatar>
}
