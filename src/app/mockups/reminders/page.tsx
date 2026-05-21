import type { Metadata } from "next";

import RemindersMock from "@/components/mockups/RemindersMock";

export const metadata: Metadata = {
  title: "Reminders mockup",
  robots: { follow: false, index: false },
};

export default function RemindersPage() {
  return <RemindersMock />;
}
