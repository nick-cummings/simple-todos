import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import SavedFiltersMock from "@/components/mockups/SavedFiltersMock";

export const metadata: Metadata = {
  title: "Saved filters mockup",
  robots: { index: false, follow: false },
};

export default function SavedFiltersMockupPage() {
  if (!mockupsEnabled()) notFound();
  return <SavedFiltersMock />;
}
