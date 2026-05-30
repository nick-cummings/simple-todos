import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import StartDueDateMock from "@/components/mockups/StartDueDateMock";

export const metadata: Metadata = {
  title: "Start vs due date mockup",
  robots: { follow: false, index: false },
};

export default function StartDatesPage() {
  if (!mockupsEnabled()) notFound();
  return <StartDueDateMock />;
}
