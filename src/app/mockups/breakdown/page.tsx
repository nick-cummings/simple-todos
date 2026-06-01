import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import BreakdownMock from "@/components/mockups/BreakdownMock";

export const metadata: Metadata = {
  title: "Break this down mockup",
  robots: { index: false, follow: false },
};

export default function BreakdownMockupPage() {
  if (!mockupsEnabled()) notFound();
  return <BreakdownMock />;
}
