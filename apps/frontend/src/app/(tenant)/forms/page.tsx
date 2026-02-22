"use client";

import { FormInput } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Form & Landing</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Crea form per la cattura lead</p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Piano Pro</span>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mb-4">
            <FormInput className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">In arrivo</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Questa sezione è in sviluppo. Sarà disponibile nelle prossime settimane.
          </p>
          <Button variant="outline" className="mt-6" size="sm">
            Torna alla Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
