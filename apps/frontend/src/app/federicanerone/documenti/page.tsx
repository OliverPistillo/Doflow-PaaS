'use client';

export default function DocumentiPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Documenti</h1>
      <p className="text-sm text-muted-foreground">
        Qui gestiamo upload e documenti. (Per file giganti: presigned URL / streaming, non upload “classico”.)
      </p>
    </div>
  );
}
