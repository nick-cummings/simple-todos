import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import AutoLabelMock from "@/components/mockups/AutoLabelMock";

export const metadata: Metadata = {
  title: "Auto-label mockup",
  robots: { index: false, follow: false },
};

export default function AutoLabelMockupPage() {
  if (!mockupsEnabled()) notFound();
  return <AutoLabelMock />;
}
