import { QuotePreviewPage } from "@/features/commercial/components/quote-preview-page"

export default async function QuotePreviewRoute({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params
  return <QuotePreviewPage quoteId={quoteId} />
}
