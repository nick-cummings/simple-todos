import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import RecurringTaskMock from "@/components/mockups/RecurringTaskMock";

export const metadata: Metadata = {
  title: "Recurring tasks mockup",
  robots: { follow: false, index: false },
};

export default function RecurringPage() {
  if (!mockupsEnabled()) notFound();
  return <RecurringTaskMock />;
}
