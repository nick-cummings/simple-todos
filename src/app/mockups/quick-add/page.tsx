import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import QuickAddMock from "@/components/mockups/QuickAddMock";

export const metadata: Metadata = {
  title: "Quick-add mockup",
  robots: { index: false, follow: false },
};

export default function QuickAddMockupPage() {
  if (!mockupsEnabled()) notFound();
  return <QuickAddMock />;
}
