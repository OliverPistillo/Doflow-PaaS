import { QuotePreviewPage } from "@/features/commercial/components/quote-document"

export default async function QuotePreviewRoute(props: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await props.params
  return <QuotePreviewPage quoteId={quoteId} />
}
