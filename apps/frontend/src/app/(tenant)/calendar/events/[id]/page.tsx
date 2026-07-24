import { CalendarEventDetailPage } from "@/components/tenant-calendar/calendar-event-detail";

export default function CalendarEventPage({ params }: { params: { id: string } }) {
  return <CalendarEventDetailPage eventId={params.id} />;
}
