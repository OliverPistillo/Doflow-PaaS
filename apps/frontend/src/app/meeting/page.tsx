import type { Metadata } from "next";
import { GuestMeetingPage } from "@/features/calls/guest-meeting-page";

export const metadata: Metadata = {
  title: "Doflow Calls",
  robots: { index: false, follow: false, nocache: true },
};

export default function MeetingPage() {
  return <GuestMeetingPage />;
}
