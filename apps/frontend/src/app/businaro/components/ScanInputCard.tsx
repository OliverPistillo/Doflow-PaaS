"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  stepActive: boolean;
  title: string;
  description?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  disabled?: boolean;
  accent?: "blue" | "orange" | "green" | "slate"; // Manteniamo per compatibilità, ma usiamo lo stile Neon
};

export default function ScanInputCard({
  stepActive,
  title,
  description,
  placeholder,
  value,
  onChange,
  onEnter,
  disabled,
}: Props) {
  return (
    <Card 
      className={cn(
        "transition-all duration-500 border rounded-[2rem] overflow-hidden relative",
        stepActive 
          ? "bg-card shadow-[0_0_30px_rgba(204,243,47,0.15)] border-primary/60 scale-[1.02] z-10" 
          : "bg-muted/10 border-transparent opacity-60 scale-100"
      )}
    >
      {/* Indicatore visivo di stato */}
      {stepActive && (
         <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_10px_currentColor]" />
      )}

      <CardHeader className="pb-2">
        <CardTitle className={cn("text-2xl font-bold", stepActive ? "text-primary" : "text-muted-foreground")}>
            {title}
        </CardTitle>
        <CardDescription className="text-xs font-medium uppercase tracking-widest opacity-80">
            {description ?? "Scannerizza il codice"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="relative">
            <Input
              autoFocus={stepActive}
              disabled={disabled || !stepActive}
              value={value}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && onEnter) onEnter();
              }}
              placeholder={placeholder}
              className={cn(
                "h-20 text-center text-3xl font-mono tracking-widest rounded-2xl transition-all",
                stepActive 
                  ? "bg-muted/30 border-primary/30 focus-visible:ring-primary focus-visible:border-primary" 
                  : "bg-transparent border-border"
              )}
            />
        </div>
        
        {/* Feedback visivo valore inserito */}
        {!!value && !stepActive && (
          <div className="mt-4 flex justify-center">
             <div className="px-6 py-2 rounded-full bg-muted text-muted-foreground font-mono font-bold text-xl border border-border">
                {value}
             </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}