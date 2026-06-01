import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import MultiReminderEditorMock from "@/components/mockups/MultiReminderEditorMock";

export const metadata: Metadata = {
  title: "Multi-reminder editor mockup",
  robots: { follow: false, index: false },
};

export default function MultiRemindersPage() {
  if (!mockupsEnabled()) notFound();
  return <MultiReminderEditorMock />;
}
