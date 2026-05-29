import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { mockupsEnabled } from "@/lib/mockupsEnabled";
import LabelsManagerMock from "@/components/mockups/LabelsManagerMock";

export const metadata: Metadata = {
  title: "Labels mockup",
  robots: { index: false, follow: false },
};

export default function LabelsMockupPage() {
  if (!mockupsEnabled()) notFound();
  return <LabelsManagerMock open />;
}
