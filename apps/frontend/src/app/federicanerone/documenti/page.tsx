'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function FedericaDocumentiPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Documenti</h1>
        <p className="text-sm text-muted-foreground">
          Upload grandi file (fino a 5GB): lo abilitiamo con upload multipart/presigned (non ora).
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <div className="text-sm font-semibold">Caricamento file</div>
        <p className="text-sm text-muted-foreground">
          Placeholder UI. Qui metteremo:
          - selezione file
          - progress bar
          - lista documenti per cliente / cartella
        </p>

        <Button disabled>Carica documento (coming soon)</Button>
      </Card>
    </div>
  );
}
