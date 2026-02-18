"use client";

/**
 * useConfirm — Hook riusabile per dialog di conferma.
 * Sostituisce window.confirm() con un AlertDialog shadcn/ui.
 *
 * UTILIZZO:
 *   const { ConfirmDialog, confirm } = useConfirm();
 *
 *   const ok = await confirm({
 *     title: "Elimina fattura?",
 *     description: "Azione irreversibile.",
 *     confirmLabel: "Elimina",
 *     variant: "destructive",
 *   });
 *   if (!ok) return;
 *
 * Nel JSX del componente:
 *   <ConfirmDialog />
 */

import { useState, useCallback, useRef, ReactElement } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmOptions {
  title:         string;
  description?:  string;
  confirmLabel?: string;
  cancelLabel?:  string;
  variant?:      "default" | "destructive";
}

interface UseConfirmReturn {
  ConfirmDialog: () => ReactElement;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

export function useConfirm(): UseConfirmReturn {
  const [open, setOpen]     = useState(false);
  const [opts, setOpts]     = useState<ConfirmOptions | null>(null);
  const resolverRef         = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const handleConfirm = () => {
    setOpen(false);
    resolverRef.current?.(true);
  };

  const handleCancel = () => {
    setOpen(false);
    resolverRef.current?.(false);
  };

  const ConfirmDialog = (): ReactElement => (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts?.title ?? "Conferma"}</AlertDialogTitle>
          {opts?.description && (
            <AlertDialogDescription>{opts.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {opts?.cancelLabel ?? "Annulla"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn(
              opts?.variant === "destructive" && "bg-red-600 hover:bg-red-700 text-white"
            )}
          >
            {opts?.confirmLabel ?? "Conferma"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { ConfirmDialog, confirm };
}