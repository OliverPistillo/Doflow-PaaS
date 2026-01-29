"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  stepActive: boolean;
  title: string;
  description?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onEnter?: () => void;
  disabled?: boolean;
  accent?: "blue" | "orange" | "green" | "slate";
};

const accentToClass: Record<NonNullable<Props["accent"]>, string> = {
  blue: "border-blue-500 focus-visible:ring-blue-500",
  orange: "border-orange-500 focus-visible:ring-orange-500",
  green: "border-green-600 focus-visible:ring-green-600",
  slate: "border-slate-300 focus-visible:ring-slate-400",
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
  accent = "slate",
}: Props) {
  const activeStyle = stepActive ? "shadow-2xl scale-[1.01]" : "opacity-60";
  const borderStyle = stepActive ? `border-4 ${accentToClass[accent]}` : "border-2 border-slate-100";

  return (
    <Card className={`transition-all duration-300 ${activeStyle} ${borderStyle}`}>
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <CardDescription>{description ?? "Usa lo scanner barcode e premi INVIO"}</CardDescription>
      </CardHeader>
      <CardContent>
        <Input
          autoFocus={stepActive}
          disabled={disabled || !stepActive}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onEnter) onEnter();
          }}
          placeholder={placeholder}
          className="h-20 text-center text-3xl font-mono tracking-widest border-2"
        />
        {!!value && !stepActive && (
          <div className="mt-4 rounded-md bg-slate-50 p-3 text-center font-mono text-xl font-bold text-slate-900 border">
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}