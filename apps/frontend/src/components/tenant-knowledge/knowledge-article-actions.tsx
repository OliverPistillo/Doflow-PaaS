"use client";

import Link from "next/link";
import { Archive, Check, Download, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

export function KnowledgeArticleActions({
  onPublish,
  onArchive,
  onReview,
  onExport,
  onFavorite,
  favoriteDisabled,
}: {
  onPublish: () => void;
  onArchive: () => void;
  onReview: () => void;
  onExport: () => void;
  onFavorite: () => void;
  favoriteDisabled?: boolean;
}) {
  return (
    <>
      <Button asChild variant="outline"><Link href="/knowledge/articles">Torna lista</Link></Button>
      <Button variant="outline" onClick={onPublish}><Check className="mr-2 h-4 w-4" />Publish</Button>
      <Button variant="outline" onClick={onArchive}><Archive className="mr-2 h-4 w-4" />Archive</Button>
      <Button variant="outline" onClick={onReview}>Review</Button>
      <Button variant="outline" onClick={onExport}><Download className="mr-2 h-4 w-4" />Export</Button>
      <Button variant="outline" onClick={onFavorite} disabled={favoriteDisabled}><Heart className="mr-2 h-4 w-4" />Preferito</Button>
    </>
  );
}
