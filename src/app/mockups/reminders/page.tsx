import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import RemindersMock from "@/components/mockups/RemindersMock";

export const metadata: Metadata = {
  title: "Reminders mockup",
  robots: { follow: false, index: false },
};

export default function RemindersPage() {
  if (!mockupsEnabled()) notFound();
  return <RemindersMock />;
}
