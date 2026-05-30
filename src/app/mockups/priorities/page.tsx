import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import PriorityPickerMock from "@/components/mockups/PriorityPickerMock";

export const metadata: Metadata = {
  title: "Priorities mockup",
  robots: { index: false, follow: false },
};

export default function PrioritiesMockupPage() {
  if (!mockupsEnabled()) notFound();
  return <PriorityPickerMock />;
}
