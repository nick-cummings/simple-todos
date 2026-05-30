import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import SwipeMock from "@/components/mockups/SwipeMock";

export const metadata: Metadata = {
  title: "Swipe gestures mockup",
  robots: { follow: false, index: false },
};

export default function SwipePage() {
  if (!mockupsEnabled()) notFound();
  return <SwipeMock />;
}
